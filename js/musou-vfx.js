'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 (TopWarlords)
   Level 2 特效底層：選擇性 Bloom + GPU 粒子 + 共用元件 + 畫質分級
   ===================================================== */
(function () {
  const QUALITY_KEY = 'wl15_vfx_quality'; // 'high' | 'medium' | 'low'
  const VALID_QUALITIES = ['high', 'medium', 'low'];
  const QUALITY_LABELS = { high: '特效：高', medium: '特效：中', low: '特效：低' };

  let quality = (() => {
    try {
      const saved = localStorage.getItem(QUALITY_KEY);
      if (VALID_QUALITIES.includes(saved)) return saved;
    } catch (_) {}
    return null; // resolved on initBloom based on isLowPowerDevice
  })();

  let bloomComposer = null;
  let finalComposer = null;
  let bloomPass = null;
  let mixPass = null;
  let gpuBursts = [];
  let activeMeshes = [];
  let fpsAccumTime = 0;
  let fpsAccumFrames = 0;
  let autoDowngraded = false;
  let vfxEpoch = 0;
  const scheduledTimers = new Set();

  function schedule(delayMs, fn) {
    if (typeof fn !== 'function') return null;
    const epoch = vfxEpoch;
    const tid = setTimeout(() => {
      scheduledTimers.delete(tid);
      if (epoch !== vfxEpoch) return;
      try { fn(); } catch (_) {}
    }, Math.max(0, Number(delayMs) || 0));
    scheduledTimers.add(tid);
    return tid;
  }

  function clearTimers() {
    vfxEpoch++;
    scheduledTimers.forEach(tid => clearTimeout(tid));
    scheduledTimers.clear();
  }

  const SIGNATURE_VFX = {};

  function getQuality() {
    return quality || 'high';
  }

  function setQuality(nextQ) {
    quality = VALID_QUALITIES.includes(nextQ) ? nextQ : 'high';
    try {
      localStorage.setItem(QUALITY_KEY, quality);
    } catch (_) {}
    syncQualityButton();
    return quality;
  }

  function cycleQuality() {
    const cur = getQuality();
    const idx = VALID_QUALITIES.indexOf(cur);
    return setQuality(VALID_QUALITIES[(idx + 1) % VALID_QUALITIES.length]);
  }

  function syncQualityButton() {
    const btn = document.getElementById('btnBattleVfxQuality');
    if (!btn) return;
    const q = getQuality();
    btn.textContent = QUALITY_LABELS[q] || QUALITY_LABELS.high;
    btn.dataset.vfxQuality = q;
  }

  function getParticleScale() {
    const q = getQuality();
    if (q === 'low') return 0.25;
    if (q === 'medium') return 0.5;
    return 1.0;
  }

  function initBloom({ renderer, scene, camera, width, height, isLowPowerDevice }) {
    if (!quality) {
      quality = isLowPowerDevice ? 'medium' : 'high';
    }
    syncQualityButton();

    if (
      typeof THREE === 'undefined' ||
      !THREE.EffectComposer ||
      !THREE.RenderPass ||
      !THREE.ShaderPass ||
      !THREE.UnrealBloomPass
    ) {
      bloomComposer = null;
      finalComposer = null;
      return false;
    }

    const w = Math.max(1, width);
    const h = Math.max(1, height);

    bloomComposer = new THREE.EffectComposer(renderer);
    bloomComposer.renderToScreen = false;
    const bloomRenderPass = new THREE.RenderPass(scene, camera);
    bloomRenderPass.clearColor = new THREE.Color(0x000000);
    bloomRenderPass.clearAlpha = 0;
    bloomComposer.addPass(bloomRenderPass);

    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.38, 0.35, 0.55);
    bloomComposer.addPass(bloomPass);

    mixPass = new THREE.ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: bloomComposer.renderTarget2.texture }
        },
        vertexShader: [
          'varying vec2 vUv;',
          'void main() {',
          '  vUv = uv;',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform sampler2D baseTexture;',
          'uniform sampler2D bloomTexture;',
          'varying vec2 vUv;',
          'void main() {',
          '  vec4 base = texture2D(baseTexture, vUv);',
          '  vec4 bloom = texture2D(bloomTexture, vUv);',
          '  gl_FragColor = vec4(base.rgb + bloom.rgb, base.a);',
          '}'
        ].join('\n'),
        defines: {}
      }),
      'baseTexture'
    );
    mixPass.needsSwap = true;

    finalComposer = new THREE.EffectComposer(renderer);
    finalComposer.addPass(new THREE.RenderPass(scene, camera));
    finalComposer.addPass(mixPass);
    return true;
  }

  function resizeBloom(width, height) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    if (bloomComposer) bloomComposer.setSize(w, h);
    if (finalComposer) finalComposer.setSize(w, h);
    if (bloomPass) bloomPass.setSize(w, h);
  }

  function renderFrame(renderer, scene, camera) {
    if (!renderer || !scene || !camera) return;
    if (getQuality() === 'high' && bloomComposer && finalComposer && bloomPass) {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      bloomPass.strength = isLight ? 0.24 : 0.38;

      const savedBg = scene.background;
      const savedFog = scene.fog;
      const savedClearAlpha = renderer.getClearAlpha();
      scene.background = null;
      scene.fog = null;
      camera.layers.set(1);
      renderer.setClearAlpha(0);
      bloomComposer.render();

      scene.background = savedBg;
      scene.fog = savedFog;
      renderer.setClearAlpha(savedClearAlpha);
      camera.layers.enableAll();
      finalComposer.render();
      return;
    }
    renderer.render(scene, camera);
  }

  function recordFrameDt(dtSec, isBattleRunning) {
    if (!isBattleRunning || autoDowngraded) return;
    if (dtSec <= 0 || dtSec > 0.25) return;
    fpsAccumTime += dtSec;
    fpsAccumFrames++;
    if (fpsAccumTime >= 2.0) {
      const avgFps = fpsAccumFrames / fpsAccumTime;
      fpsAccumTime = 0;
      fpsAccumFrames = 0;
      if (avgFps < 40) {
        const cur = getQuality();
        if (cur === 'high') {
          setQuality('medium');
          autoDowngraded = true;
          window.toast?.('⚡ 偵測到幀率偏低，已自動調整特效畫質為「中」');
        } else if (cur === 'medium') {
          setQuality('low');
          autoDowngraded = true;
          window.toast?.('⚡ 偵測到幀率偏低，已自動調整特效畫質為「低」');
        }
      }
    }
  }

  /* ----------------------------------------------------
     GPU 粒子爆發 (單一 THREE.Points + ShaderMaterial)
     ---------------------------------------------------- */
  function createGpuBurst({
    scene,
    origin,
    count = 700,
    color = 0xfbbf24,
    speed = 4.6,
    life = 950,
    size = 18.0,
    gravity = -3.4,
    spread = 1.0,
    upBias = 0.55
  }) {
    if (!scene || !origin || typeof THREE === 'undefined') return null;
    const q = getQuality();
    const maxByQuality = q === 'high' ? 750 : (q === 'medium' ? 400 : 180);
    const scaledCount = Math.max(24, Math.min(Math.round(count), maxByQuality));
    const positions = new Float32Array(scaledCount * 3);
    const velocities = new Float32Array(scaledCount * 3);
    const seeds = new Float32Array(scaledCount);

    for (let i = 0; i < scaledCount; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = speed * (0.35 + Math.random() * 0.85);
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * spd * spread;
      velocities[i * 3 + 1] = (Math.cos(phi) * 0.5 + upBias) * spd;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * spd * spread;
      seeds[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLife: { value: life / 1000 },
        uSize: { value: size * 0.58 },
        uGravity: { value: gravity },
        uColor: { value: new THREE.Color(color) }
      },
      vertexShader: [
        'attribute vec3 aVel;',
        'attribute float aSeed;',
        'uniform float uTime;',
        'uniform float uLife;',
        'uniform float uSize;',
        'uniform float uGravity;',
        'varying float vAlpha;',
        'void main() {',
        '  float t = clamp(uTime, 0.0, uLife);',
        '  float p = t / max(0.001, uLife);',
        '  vec3 displaced = position + aVel * t + vec3(0.0, 0.5 * uGravity * t * t, 0.0);',
        '  vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);',
        '  gl_Position = projectionMatrix * mvPos;',
        '  gl_PointSize = max(1.0, (uSize * (0.65 + aSeed * 0.7) * (1.0 - p * 0.55)) / max(1.0, -mvPos.z * 0.35));',
        '  vAlpha = (1.0 - p) * (1.0 - p);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'varying float vAlpha;',
        'void main() {',
        '  vec2 uv = gl_PointCoord - vec2(0.5);',
        '  float d = dot(uv, uv);',
        '  if (d > 0.25) discard;',
        '  float glow = smoothstep(0.25, 0.0, d);',
        '  gl_FragColor = vec4(uColor, glow * vAlpha * 0.62);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 30;
    pts.layers.enable(1);
    scene.add(pts);

    const startedAt = performance.now();
    gpuBursts.push({ pts, geo, mat, scene, startedAt, duration: life });
    return pts;
  }

  /* ----------------------------------------------------
     5 種共用特效元件（供 Phase 3/4/5 使用）
     ---------------------------------------------------- */
  function trackMesh(scene, mesh, duration, onUpdate, onDone) {
    mesh.layers.enable(1);
    scene.add(mesh);
    activeMeshes.push({
      mesh,
      scene,
      startedAt: performance.now(),
      duration,
      onUpdate,
      onDone
    });
    return mesh;
  }

  function spawnShockRing(scene, pos, color = 0xfbbf24, maxRadius = 3.8, duration = 680) {
    if (!scene || !pos) return null;
    const geo = new THREE.RingGeometry(0.78, 0.95, 36);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, pos.y + 0.14, pos.z);
    mesh.renderOrder = 25;
    return trackMesh(scene, mesh, duration, p => {
      const s = 0.4 + p * maxRadius;
      mesh.scale.set(s, s, 1);
      mat.opacity = 0.58 * (1 - p);
    });
  }

  function spawnSlashArc(scene, pos, dir = 1, color = 0xf43f5e, width = 2.8, duration = 420) {
    if (!scene || !pos) return null;
    const geo = new THREE.RingGeometry(width * 0.68, width, 28, 1, -Math.PI * 0.45, Math.PI * 0.9);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 1.05, pos.z);
    mesh.rotation.x = -Math.PI * 0.35;
    mesh.rotation.z = dir >= 0 ? -0.4 : Math.PI - 0.4;
    mesh.renderOrder = 29;
    return trackMesh(scene, mesh, duration, p => {
      const s = 0.7 + p * 0.75;
      mesh.scale.set(s, s, 1);
      mesh.rotation.z += (dir >= 0 ? 0.08 : -0.08);
      mat.opacity = 0.78 * (1 - p * p);
    });
  }

  function spawnRibbonTrail(scene, pathPoints, color = 0x38bdf8, width = 0.36, duration = 640) {
    if (!scene || !pathPoints || pathPoints.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(pathPoints);
    const geo = new THREE.TubeGeometry(curve, Math.max(12, pathPoints.length * 6), width * 0.24, 6, false);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 28;
    return trackMesh(scene, mesh, duration, p => {
      mat.opacity = 0.62 * (1 - p);
    });
  }

  function spawnGroundDecal(scene, pos, tex, size = 5.0, duration = 1200) {
    if (!scene || !pos || !tex) return null;
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, pos.y + 0.11, pos.z);
    mesh.renderOrder = 21;
    return trackMesh(scene, mesh, duration, p => {
      mesh.rotation.z += 0.015;
      mat.opacity = p < 0.2 ? (p / 0.2) * 0.88 : 0.88 * (1 - (p - 0.2) / 0.8);
    });
  }

  function spawnPillar(scene, pos, color = 0xf97316, height = 6.5, duration = 850) {
    if (!scene || !pos) return null;
    const geo = new THREE.CylinderGeometry(0.22, 0.55, height, 18, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + height * 0.5, pos.z);
    mesh.renderOrder = 27;
    return trackMesh(scene, mesh, duration, p => {
      const radiusScale = 0.7 + p * 0.65;
      mesh.scale.set(radiusScale, 1 + p * 0.2, radiusScale);
      mesh.rotation.y += 0.06;
      mat.opacity = 0.42 * (1 - p);
    });
  }

  function tick(nowMs) {
    const tNow = nowMs || performance.now();
    for (let i = gpuBursts.length - 1; i >= 0; i--) {
      const b = gpuBursts[i];
      const elapsed = tNow - b.startedAt;
      if (elapsed >= b.duration) {
        b.scene.remove(b.pts);
        b.geo.dispose();
        b.mat.dispose();
        gpuBursts.splice(i, 1);
      } else {
        b.mat.uniforms.uTime.value = elapsed / 1000;
      }
    }
    for (let i = activeMeshes.length - 1; i >= 0; i--) {
      const item = activeMeshes[i];
      const p = Math.min(1, (tNow - item.startedAt) / item.duration);
      item.onUpdate?.(p);
      if (p >= 1) {
        item.scene.remove(item.mesh);
        item.mesh.geometry?.dispose?.();
        item.mesh.material?.dispose?.();
        item.onDone?.();
        activeMeshes.splice(i, 1);
      }
    }
  }

  function clearAll() {
    clearTimers();
    gpuBursts.forEach(b => {
      b.scene.remove(b.pts);
      b.geo.dispose();
      b.mat.dispose();
    });
    gpuBursts = [];
    activeMeshes.forEach(item => {
      item.scene.remove(item.mesh);
      item.mesh.geometry?.dispose?.();
      item.mesh.material?.dispose?.();
    });
    activeMeshes = [];
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      syncQualityButton();
      const btn = document.getElementById('btnBattleVfxQuality');
      if (btn) btn.addEventListener('click', cycleQuality);
    });
  }

  window.MusouVfx = {
    initBloom,
    resizeBloom,
    renderFrame,
    recordFrameDt,
    getQuality,
    setQuality,
    cycleQuality,
    getParticleScale,
    createGpuBurst,
    spawnShockRing,
    spawnSlashArc,
    spawnRibbonTrail,
    spawnGroundDecal,
    spawnPillar,
    schedule,
    clearTimers,
    tick,
    clearAll,
    registerSignature(key, fn) { SIGNATURE_VFX[key] = fn; },
    getSignature(key) { return SIGNATURE_VFX[key] || null; }
  };
})();
