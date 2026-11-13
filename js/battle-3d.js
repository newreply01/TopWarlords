/* =====================================================
   TopWarlords field-scale battle renderer (Three.js r128).
   Original articulated troops, restrained materials, stable camera presets.
   ===================================================== */
'use strict';

const Battle3DEngine = (function () {
  const ASSET_VER = '7.10.9';
  const MODEL_DIR = 'assets/models/';
  const PORTRAIT_DIR = 'assets/warlords/';

  const MODEL_MANIFEST = {
    arrow: 'arrow.glb',
    banner: 'banner.glb',
    tent: 'tent.glb',
    watchtower: 'watchtower.glb',
    rock_a: 'rock_a.glb',
    rock_b: 'rock_b.glb'
  };

  let isEnabled = true;
  let container = null;
  let scene = null;
  let camera = null;
  let renderer = null;
  let resizeObserver = null;
  let animFrameId = null;
  let isAnimationPaused = false;
  let isInitialized = false;
  let isLowPowerDevice = false;
  let lastTimestamp = 0;
  let battleEpoch = 0;

  // GLTF 快取與預計算正規化參數
  const gltfCache = new Map();     // key -> { gltf, norm: { scale, ox, oy, oz } }
  let modelsLoadPromise = null;
  let modelsLoadedCount = 0;

  // 戰場場景群組與動畫清單
  let envPropsGroup = null;
  let weatherParticles = null;
  let currentWeatherKey = 'plain';
  let currentBattleTerrain = 'plain';
  let currentScene = 'plain';
  let landscapeGroup = null;
  const terrainTextures = new Map();
  let sunLightRef = null;
  let hemiLightRef = null;
  let riverMeshRef = null;
  let groundGeometryRef = null;
  let groundMaterialRef = null;
  let waterwayGroup = null;
  let terrainDecorationGroup = null;
  let occupationZones = [];
  let lastOccupationZoneUpdate = 0;
  let groundCover = null;
  let campFortificationsGroup = null;
  let campPennantsRef = null;
  let campPennantTex = null;
  let campBrazierFlamesRef = null;
  const _campAnimObj = new THREE.Object3D();
  let dustTexture = null;
  let lastMarchSoundAt = 0;
  let lastMeleeSoundAt = 0;
  let audioPaused = false;
  let combatPausedAt = null;
  let combatPausedDuration = 0;
  function combatNow() {
    return (combatPausedAt ?? performance.now()) - combatPausedDuration;
  }
  function setAudioPaused(paused) {
    const next = Boolean(paused);
    if (next === audioPaused) return;
    if (next) combatPausedAt = performance.now();
    else {
      combatPausedDuration += performance.now() - combatPausedAt;
      combatPausedAt = null;
    }
    audioPaused = next;
    if (next) window.SoundEngine?.stopSpatial?.();
  }
  const activeAttackers = new Set();
  let peakConcurrentAttackers = 0;
  let completedVolleys = 0;

  let unitsMap = new Map();      // uid -> battalion token
  let activeMixers = [];           // { mixer, actions, currentState }
  let projectiles = [];            // 3D 箭雨與火彈
  let particleSystems = [];        // 塵土、刀光火花、衝擊波
  let slashArcs = [];              // 弧形刀光劍氣網格
  let shockwaves = [];             // 擴散地面衝擊環／盾陣波
  let stuckArrows = [];            // 插地留存箭矢
  let battleScars = [];            // 戰場焦黑傷痕與八卦陣紋
  let floatingPopups = [];         // 3D 浮動兵力傷害數字 (-3,200 / 格擋)
  let brazierLights = [];          // 營寨篝火動態光源
  let cutinTimeout = null;
  let lastCutinAt = 0;
  let riverTexRef = null;
  let bannerTexCache = new Map();
  let baguaTexture = null;
  let hitStopUntil = 0;
  let shakePower = 0;
  const camShakeOffset = new THREE.Vector3(0, 0, 0);
  let camZoomOffset = 0;
  let camZoomTarget = 0;

  // 相機軌道控制與動態微聚焦
  let isDragging = false;
  let prevMouseX = 0, prevMouseY = 0;
  let camTheta = -0.16, camPhi = 1.17, camRadius = 17.2;
  let cameraView = 'cinematic';
  let showUnitLabels = false;
  const CAM_BASE_TARGET = new THREE.Vector3(0, 1.05, 0.15);
  const camFocusOffset = new THREE.Vector3(0, 0, 0);
  const camFocusTarget = new THREE.Vector3(0, 0, 0);
  let lastFocusAt = 0;
  let finalChargeActive = false;
  let meleeActive = false;
  let battleMotionActive = false;
  let ambientArrowVolleys = 0;
  let ambientSpellcasts = 0;
  let battleSettled = false;

  // 五大兵種方陣托盤陣位 (A軍在西岸 X<0 朝東，B軍在東岸 X>0 朝西)
  const SLOT_COORDS = {
    A: {
      armor: { x: -4.4, z: 0.0 }, // 中軍前鋒：重甲陷陣
      naval: { x: -5.1, z: 3.8 }, // 南翼奇襲：先登奇兵
      air: { x: -7.4, z: -3.8 }, // 北翼鐵騎：奔雷突騎
      air_defense: { x: -8.3, z: 2.7 }, // 南翼高地：神射強弩
      support: { x: -9.8, z: -0.3 }  // 中軍本陣：軍師奇謀
    },
    B: {
      armor: { x: 4.4, z: 0.0 },
      naval: { x: 5.1, z: -3.8 },
      air: { x: 7.4, z: 3.8 },
      air_defense: { x: 8.3, z: -2.7 },
      support: { x: 9.8, z: 0.3 }
    }
  };

  const CAT_META = {
    air: { label: '奔雷突騎', badge: '騎', color: 0x38bdf8, hex: '#38bdf8' },
    armor: { label: '重甲陷陣', badge: '盾', color: 0xfbbf24, hex: '#fbbf24' },
    air_defense: { label: '神射強弩', badge: '弓', color: 0xa78bfa, hex: '#a78bfa' },
    naval: { label: '先登奇兵', badge: '鋒', color: 0x2dd4bf, hex: '#2dd4bf' },
    support: { label: '軍師奇謀', badge: '謀', color: 0x4ade80, hex: '#4ade80' }
  };

  /* ----------------------------------------------------
     1. GLTF 模型預載與骨骼邊界精準正規化
     ---------------------------------------------------- */
  function findClip(animations, patterns) {
    if (!animations || !animations.length) return null;
    for (const pat of patterns) {
      const lower = pat.toLowerCase();
      const exact = animations.find((a) => a.name.toLowerCase() === lower || a.name.toLowerCase().endsWith('|' + lower));
      if (exact) return exact;
    }
    for (const pat of patterns) {
      const lower = pat.toLowerCase();
      const partial = animations.find((a) => a.name.toLowerCase().includes(lower));
      if (partial) return partial;
    }
    return null;
  }

  function computeTrueWorldBox(root, animations) {
    const clone = (typeof THREE.SkeletonUtils !== 'undefined')
      ? THREE.SkeletonUtils.clone(root)
      : root.clone(true);

    const idleClip = findClip(animations, ['idle_sword', 'attacking_idle', 'idle']);
    if (idleClip) {
      const tmpMixer = new THREE.AnimationMixer(clone);
      const act = tmpMixer.clipAction(idleClip);
      act.play();
      tmpMixer.update(0.016);
    }
    clone.updateMatrixWorld(true);

    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    let sampled = 0;

    clone.traverse((child) => {
      if (!child.isMesh || !child.geometry || !child.geometry.attributes.position) return;
      if (child.isSkinnedMesh && child.skeleton) {
        child.skeleton.update();
      }
      const pos = child.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 250));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i);
        if (child.isSkinnedMesh && typeof child.boneTransform === 'function') {
          child.boneTransform(i, v);
        }
        v.applyMatrix4(child.matrixWorld);
        if (isFinite(v.x) && isFinite(v.y) && isFinite(v.z)) {
          box.expandByPoint(v);
          sampled++;
        }
      }
    });

    if (sampled === 0 || box.isEmpty()) {
      box.setFromObject(clone);
    }
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
    const height = Math.max(size.y, 0.0001);
    return {
      height,
      maxDim,
      minY: box.min.y,
      cx: center.x,
      cz: center.z
    };
  }

  function ensureModelsLoaded() {
    if (modelsLoadPromise) return modelsLoadPromise;
    if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
      modelsLoadPromise = Promise.resolve();
      return modelsLoadPromise;
    }

    const loader = new THREE.GLTFLoader();
    const entries = Object.entries(MODEL_MANIFEST);
    const lowPower = typeof window !== 'undefined' && (
      window.innerWidth < 720 || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4)
    );
    const concurrency = lowPower ? 3 : 6;
    let nextEntry = 0;

    const loadEntry = ([key, file]) => new Promise((resolve) => {
        loader.load(
          `${MODEL_DIR}${file}?v=${ASSET_VER}`,
          (gltf) => {
            try {
              const norm = computeTrueWorldBox(gltf.scene, gltf.animations || []);
              gltfCache.set(key, { gltf, norm });
              modelsLoadedCount++;
            } catch (e) {
              console.warn('[Battle3D] norm warning:', key, e);
            }
            resolve();
          },
          undefined,
          (err) => {
            console.warn('[Battle3D] GLB load failed:', key, err);
            resolve();
          }
        );
      });
    const worker = async () => {
      while (nextEntry < entries.length) {
        const entry = entries[nextEntry++];
        await loadEntry(entry);
      }
    };

    modelsLoadPromise = Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
    return modelsLoadPromise;
  }

  /**
   * 實例化已正規化尺寸與接地 (y=0) 的 3D 模型，若具骨骼動畫則自動註冊 AnimationMixer
   */
  function spawnModelInstance(key, {
    targetHeight = null,
    targetMaxDim = null,
    tintHex = null,
    tintStrength = 0.22,
    castShadow = true,
    registerAnim = false
  } = {}) {
    const entry = gltfCache.get(key);
    if (!entry) return null;

    const { gltf, norm } = entry;
    const rawClone = (typeof THREE.SkeletonUtils !== 'undefined')
      ? THREE.SkeletonUtils.clone(gltf.scene)
      : gltf.scene.clone(true);

    const scale = targetHeight
      ? (targetHeight / norm.height)
      : (targetMaxDim ? (targetMaxDim / norm.maxDim) : (1.0 / norm.maxDim));

    rawClone.scale.multiplyScalar(scale);
    rawClone.position.set(-norm.cx * scale, -norm.minY * scale, -norm.cz * scale);

    const tintColor = tintHex !== null ? new THREE.Color(tintHex) : null;
    rawClone.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = castShadow;
      node.receiveShadow = true;
      node.frustumCulled = false;
      if (tintColor && node.material) {
        const mats = Array.isArray(node.material) ? node.material.map((m) => m.clone()) : [node.material.clone()];
        mats.forEach((m) => {
          if (m.color) m.color.lerp(tintColor, tintStrength);
          if (m.roughness !== undefined) m.roughness = Math.min(0.85, Math.max(0.28, m.roughness));
        });
        node.material = Array.isArray(node.material) ? mats : mats[0];
      }
    });

    const wrapper = new THREE.Group();
    wrapper.add(rawClone);

    let animCtrl = null;
    if (registerAnim && gltf.animations && gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(rawClone);
      const clips = {
        idle: findClip(gltf.animations, ['idle_sword', 'attacking_idle', 'idle_2', 'idle']),
        move: findClip(gltf.animations, ['gallop', 'run', 'walk']),
        attack: findClip(gltf.animations, ['sword_slash', 'dagger_attack', 'attack_headbutt', 'attack_kick', 'jump', 'punch_right']),
        hit: findClip(gltf.animations, ['hitrecieve', 'recievehit', 'idle_hitreact_left']),
        death: findClip(gltf.animations, ['death'])
      };

      const actions = {};
      Object.entries(clips).forEach(([state, clip]) => {
        if (!clip) return;
        const act = mixer.clipAction(clip);
        if (state === 'death') {
          act.setLoop(THREE.LoopOnce, 1);
          act.clampWhenFinished = true;
        } else if (state === 'attack' || state === 'hit') {
          act.setLoop(THREE.LoopOnce, 1);
          act.clampWhenFinished = false;
        }
        actions[state] = act;
      });

      animCtrl = {
        mixer,
        actions,
        currentState: 'idle',
        playState(state, timeScale = 1.0) {
          const next = actions[state] || actions.idle;
          if (!next) return;
          if (this.currentState === 'death') return;
          const prev = actions[this.currentState];
          if (prev && prev !== next) prev.fadeOut(0.14);
          next.reset();
          next.timeScale = timeScale;
          next.fadeIn(0.12).play();
          this.currentState = state;
          if (state === 'attack' || state === 'hit') {
            const durMs = Math.max(280, ((next.getClip().duration || 0.6) / timeScale) * 900);
            setTimeout(() => {
              if (this.currentState === state && actions.idle) {
                next.fadeOut(0.16);
                actions.idle.reset().fadeIn(0.16).play();
                this.currentState = 'idle';
              }
            }, durMs);
          }
        }
      };

      if (actions.idle) {
        actions.idle.play();
        // 錯開每個士兵與戰馬的呼吸節奏，營造自然軍陣律動
        mixer.update(Math.random() * 2.2);
      }
      activeMixers.push(animCtrl);
    }

    return { group: wrapper, animCtrl };
  }

  /* ----------------------------------------------------
     2. 初始化 3D 場景、金秋戰場天光與山河渡口地形
     ---------------------------------------------------- */
  function createSkyBackdropTexture(weather) {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    if (weather === 'storm') {
      g.addColorStop(0.0, '#070b14');
      g.addColorStop(0.50, '#131d2e');
      g.addColorStop(0.84, '#243247');
      g.addColorStop(1.0, '#364457');
    } else if (weather === 'em') {
      g.addColorStop(0.0, '#6a747a');
      g.addColorStop(0.5, '#8a9498');
      g.addColorStop(1.0, '#aeb5b2');
    } else {
      g.addColorStop(0.0, '#222d3d');
      g.addColorStop(0.36, '#434d5b');
      g.addColorStop(0.70, '#78624d');
      g.addColorStop(0.90, '#a6794d');
      g.addColorStop(1.0, '#c08b52');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 512);
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function createRiverTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const ctx = c.getContext('2d');
    const bankGrad = ctx.createLinearGradient(0, 0, 256, 0);
    bankGrad.addColorStop(0.0, 'rgba(30, 36, 30, 0.0)');
    bankGrad.addColorStop(0.14, 'rgba(24, 52, 62, 0.88)');
    bankGrad.addColorStop(0.5, 'rgba(18, 44, 58, 0.96)');
    bankGrad.addColorStop(0.86, 'rgba(24, 52, 62, 0.88)');
    bankGrad.addColorStop(1.0, 'rgba(30, 36, 30, 0.0)');
    ctx.fillStyle = bankGrad;
    ctx.fillRect(0, 0, 256, 512);

    // 流動水波紋與夕陽反光漣漪
    for (let i = 0; i < 240; i++) {
      const rx = 28 + Math.random() * 200;
      const ry = Math.random() * 512;
      const rw = 2 + Math.random() * 5;
      const rh = 18 + Math.random() * 44;
      ctx.fillStyle = i % 5 === 0
        ? 'rgba(226, 204, 162, 0.16)'
        : (i % 2 === 0 ? 'rgba(110, 178, 198, 0.14)' : 'rgba(12, 30, 42, 0.22)');
      ctx.fillRect(rx, ry, rw, rh);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 6);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function init(containerEl) {
    if (!containerEl || typeof THREE === 'undefined') return false;

    ensureModelsLoaded();

    if (isInitialized && container === containerEl && renderer) {
      onWindowResize();
      return true;
    }

    container = containerEl;
    const width = container.clientWidth || 960;
    const height = container.clientHeight || 340;
    isLowPowerDevice = width < 720 || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4);

    scene = new THREE.Scene();
    scene.background = createSkyBackdropTexture('plain');
    scene.fog = new THREE.FogExp2(0x4a3d31, 0.0135);

    camera = new THREE.PerspectiveCamera(getBattleCameraFov(width / height), width / height, 0.1, 300);
    updateCameraPosition();

    renderer = new THREE.WebGLRenderer({ antialias: !isLowPowerDevice, alpha: false, powerPreference: 'high-performance' });
    const gl = renderer.getContext();
    const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (rendererInfo && /swiftshader|llvmpipe|software/i.test(gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL))) {
      isLowPowerDevice = true;
      console.info('[Battle3D] Software WebGL: reduced troop detail and unshadowed lighting.');
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isLowPowerDevice ? 1 : 1.25));
    renderer.shadowMap.enabled = !isLowPowerDevice;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.ACESFilmicToneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
    }
    renderer.outputEncoding = THREE.sRGBEncoding;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    setupLighting();
    buildAncientBattlefieldTerrain();
    setupCameraControls();
    container.closest('#battle3DWrapper').querySelectorAll('[data-camera-view]').forEach(button => {
      button.onclick = () => setCameraView(button.dataset.cameraView);
    });
    const labelsButton = container.closest('#battle3DWrapper').querySelector('#btnBattleLabels');
    labelsButton.onclick = () => {
      showUnitLabels = !showUnitLabels;
      labelsButton.setAttribute('aria-pressed', String(showUnitLabels));
      unitsMap.forEach(token => {
        token.hud.redraw(token.currentHp);
        token.hud.tex.needsUpdate = true;
      });
      updateCommanderLabels();
      if (isAnimationPaused) renderer.render(scene, camera);
    };
    injectCutinLayer();

    window.removeEventListener('resize', onWindowResize);
    window.addEventListener('resize', onWindowResize);
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(onWindowResize);
    resizeObserver.observe(container);

    isInitialized = true;
    lastTimestamp = combatNow();
    startAnimationLoop();
    return true;
  }

  function setupLighting() {
    hemiLightRef = new THREE.HemisphereLight(0xaab8c6, 0x2a231c, 0.52);
    hemiLightRef.position.set(0, 28, 0);
    scene.add(hemiLightRef);

    sunLightRef = new THREE.DirectionalLight(0xffcf99, 2.05);
    sunLightRef.position.set(-22, 16, 13);
    sunLightRef.castShadow = true;
    const shadowResolution = isLowPowerDevice ? 1024 : 2048;
    sunLightRef.shadow.mapSize.width = shadowResolution;
    sunLightRef.shadow.mapSize.height = shadowResolution;
    sunLightRef.shadow.camera.near = 2;
    sunLightRef.shadow.camera.far = 68;
    const d = 18;
    sunLightRef.shadow.camera.left = -d;
    sunLightRef.shadow.camera.right = d;
    sunLightRef.shadow.camera.top = d;
    sunLightRef.shadow.camera.bottom = -d;
    sunLightRef.shadow.bias = -0.0005;
    scene.add(sunLightRef);

    // 東側冷色補光勾勒鎧甲與兵刃邊緣反光
    const rimLight = new THREE.DirectionalLight(0x88b4d6, 0.68);
    rimLight.position.set(18, 12, -14);
    scene.add(rimLight);
  }

  function createTerrainTexture(kind = 'grass') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 草野與黃土交錯古戰場地表
    const palette = kind === 'rock' ? ['#564e42', '#6b6050', '#84745d', '#6b5e4f']
      : kind === 'stone' ? ['#5f6159', '#77756a', '#8c8678', '#6e6f64']
      : ['#4b5539', '#5e6240', '#736c4c', '#5a5f3e'];
    const baseGrad = ctx.createLinearGradient(0, 0, 1024, 0);
    [0, 0.28, 0.5, 0.72, 1].forEach((stop, i) => baseGrad.addColorStop(stop, palette[i % palette.length]));
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // 自然砂石、踩踏泥斑與草叢紋理顆粒
    for (let i = 0; i < 7500; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const r = 1 + Math.random() * 3.8;
      ctx.fillStyle = i % 7 === 0
        ? 'rgba(34, 28, 20, 0.24)'
        : (Math.random() > 0.5 ? 'rgba(42, 54, 28, 0.22)' : 'rgba(154, 126, 82, 0.18)');
      ctx.fillRect(x, y, r, r);
    }

    // 中軍焦土血泥鏖戰帶與車馬馳道
    if (kind === 'grass') {
      const clashScuff = ctx.createRadialGradient(512, 256, 20, 512, 256, 240);
      clashScuff.addColorStop(0, 'rgba(64, 46, 30, 0.52)');
      clashScuff.addColorStop(0.65, 'rgba(84, 66, 44, 0.28)');
      clashScuff.addColorStop(1, 'rgba(84, 66, 44, 0)');
      ctx.fillStyle = clashScuff;
      ctx.fillRect(240, 20, 544, 472);
    }
    (kind === 'grass' ? [184, 256, 328] : []).forEach((cy, idx) => {
      const halfW = idx === 1 ? 32 : 18;
      const roadG = ctx.createLinearGradient(0, cy - halfW, 0, cy + halfW);
      roadG.addColorStop(0, 'rgba(98, 76, 48, 0)');
      roadG.addColorStop(0.5, idx === 1 ? 'rgba(112, 86, 54, 0.68)' : 'rgba(96, 76, 48, 0.44)');
      roadG.addColorStop(1, 'rgba(98, 76, 48, 0)');
      ctx.fillStyle = roadG;
      ctx.fillRect(36, cy - halfW, 952, halfW * 2);
    });

    ctx.strokeStyle = 'rgba(38, 29, 19, 0.34)';
    ctx.lineWidth = 2;
    (kind === 'grass' ? [256] : []).forEach(y => {
      [-6, 6].forEach(track => {
        ctx.beginPath();
        ctx.moveTo(0, y + track);
        ctx.bezierCurveTo(320, y - 10 + track, 720, y + 12 + track, 1024, y + track);
        ctx.stroke();
      });
    });
    if (kind === 'stone') {
      ctx.strokeStyle = 'rgba(42,43,38,0.3)';
      ctx.lineWidth = 2;
      for (let row = 0; row <= 16; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * 32);
        ctx.lineTo(1024, row * 32);
        ctx.stroke();
        for (let col = 0; col < 16; col++) {
          ctx.beginPath();
          const x = col * 68 + (row % 2) * 34;
          ctx.moveTo(x, row * 32);
          ctx.lineTo(x, row * 32 + 32);
          ctx.stroke();
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  }

  function mergeStaticGeos(entries) {
    const prepped = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    let totalVerts = 0;
    for (const item of entries) {
      const g = item.geo.index ? item.geo.toNonIndexed() : item.geo.clone();
      item.geo.dispose();
      p.set(item.pos[0], item.pos[1], item.pos[2]);
      e.set(item.rot ? item.rot[0] : 0, item.rot ? item.rot[1] : 0, item.rot ? item.rot[2] : 0);
      q.setFromEuler(e);
      m.compose(p, q, new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      totalVerts += g.attributes.position.count;
      prepped.push({ g, count: g.attributes.position.count });
    }
    const posArr = new Float32Array(totalVerts * 3);
    const normArr = new Float32Array(totalVerts * 3);
    const uvArr = new Float32Array(totalVerts * 2);
    let o3 = 0, o2 = 0;
    for (const { g, count } of prepped) {
      posArr.set(g.attributes.position.array, o3);
      if (g.attributes.normal) normArr.set(g.attributes.normal.array, o3);
      if (g.attributes.uv) uvArr.set(g.attributes.uv.array, o2);
      o3 += count * 3;
      o2 += count * 2;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    return out;
  }

  function createCampPennantTexture() {
    if (campPennantTex) return campPennantTex;
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 256;
    const ctx = c.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 0, 256);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.55, '#d4d4d8');
    bg.addColorStop(1, '#52525b');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(92, 4);
    ctx.lineTo(86, 250);
    ctx.lineTo(48, 212);
    ctx.lineTo(10, 250);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 6;
    ctx.stroke();

    // 營盤軍旗簡潔戰紋菱格
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.moveTo(48, 44);
    ctx.lineTo(72, 84);
    ctx.lineTo(48, 124);
    ctx.lineTo(24, 84);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    campPennantTex = tex;
    return tex;
  }

  function buildCampFortifications() {
    campFortificationsGroup = new THREE.Group();
    const stakeGeo = mergeStaticGeos([
      { geo: new THREE.CylinderGeometry(0.042, 0.052, 1.18, 5), pos: [-0.46, 0.59, 0] },
      { geo: new THREE.ConeGeometry(0.052, 0.24, 5), pos: [-0.46, 1.30, 0] },
      { geo: new THREE.CylinderGeometry(0.044, 0.054, 1.28, 5), pos: [-0.23, 0.64, 0.02] },
      { geo: new THREE.ConeGeometry(0.054, 0.24, 5), pos: [-0.23, 1.40, 0.02] },
      { geo: new THREE.CylinderGeometry(0.045, 0.055, 1.22, 5), pos: [0.0, 0.61, -0.01] },
      { geo: new THREE.ConeGeometry(0.055, 0.24, 5), pos: [0.0, 1.34, -0.01] },
      { geo: new THREE.CylinderGeometry(0.044, 0.054, 1.32, 5), pos: [0.23, 0.66, 0.01] },
      { geo: new THREE.ConeGeometry(0.054, 0.24, 5), pos: [0.23, 1.44, 0.01] },
      { geo: new THREE.CylinderGeometry(0.042, 0.052, 1.20, 5), pos: [0.46, 0.60, 0] },
      { geo: new THREE.ConeGeometry(0.052, 0.24, 5), pos: [0.46, 1.32, 0] },
      { geo: new THREE.BoxGeometry(1.18, 0.075, 0.075), pos: [0, 0.44, 0] },
      { geo: new THREE.BoxGeometry(1.18, 0.075, 0.075), pos: [0, 0.92, 0] }
    ]);
    const palisadeSpots = [];
    for (const sideSign of [-1, 1]) {
      // 北翼山腰防禦木柵防線（取代空曠積木區，與營圍相連成一氣）
      for (let k = 0; k < 8; k++) {
        const t = k / 7;
        palisadeSpots.push({
          x: sideSign * (8.4 + t * 7.6),
          z: -7.9 + t * 0.85,
          rotY: (sideSign < 0 ? 0.12 : -0.12) + ((k % 2) * 0.03 - 0.015),
          scale: 0.95 + (k % 3) * 0.05
        });
      }
      // 東西後方連營圍柵（退至營帳外側 x=±16.2，中軍大道 z=0 留出營門）
      for (const zPos of [-6.5, -5.4, -4.3, -3.2, -2.0, 2.0, 3.2, 4.3, 5.4, 6.5]) {
        palisadeSpots.push({
          x: sideSign * 16.2,
          z: zPos,
          rotY: Math.PI / 2 + (Math.sin(zPos) * 0.04),
          scale: 0.96 + (Math.abs(Math.round(zPos)) % 2) * 0.06
        });
      }
      // 南側本陣外緣拒柵
      for (let k = 0; k < 5; k++) {
        const t = k / 4;
        palisadeSpots.push({
          x: sideSign * (15.6 - t * 5.0),
          z: 7.0 + t * 0.9,
          rotY: sideSign < 0 ? -0.18 : 0.18,
          scale: 0.94 + (k % 2) * 0.05
        });
      }
    }
    const palisadeMesh = new THREE.InstancedMesh(
      stakeGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.05 }),
      palisadeSpots.length
    );
    palisadeMesh.receiveShadow = true;
    palisadeMesh.frustumCulled = false;
    palisadeMesh.userData.palisadeSpots = palisadeSpots;
    campFortificationsGroup.add(palisadeMesh);

    const poleGeo = mergeStaticGeos([
      { geo: new THREE.CylinderGeometry(0.020, 0.028, 2.55, 5), pos: [0, 1.275, 0] },
      { geo: new THREE.CylinderGeometry(0.012, 0.012, 0.36, 4), pos: [0.16, 2.42, 0], rot: [0, 0, Math.PI / 2] },
      { geo: new THREE.ConeGeometry(0.042, 0.16, 5), pos: [0, 2.62, 0] }
    ]);
    const allCampFlags = [];
    const westOffsets = [
      [-9.0, -7.8], [-11.3, -7.6], [-13.6, -7.3], [-15.8, -6.8],
      [-15.8, -4.4], [-12.8, -0.9], [-12.8, 0.9], [-15.8, 4.4],
      [-15.6, 6.8], [-13.2, 7.3], [-11.0, 7.7], [-12.6, -3.8]
    ];
    const perSideCount = isLowPowerDevice ? 7 : 12;
    for (const sideSign of [-1, 1]) {
      for (let i = 0; i < perSideCount; i++) {
        const [wx, wz] = westOffsets[i];
        allCampFlags.push({
          sideSign,
          x: Math.abs(wx) * sideSign,
          z: wz,
          scale: 0.92 + (i % 4) * 0.08,
          phase: i * 0.75 + (sideSign > 0 ? 1.6 : 0)
        });
      }
    }
    const campPoles = new THREE.InstancedMesh(
      poleGeo,
      new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.78, metalness: 0.22 }),
      allCampFlags.length
    );
    campPoles.frustumCulled = false;
    campPoles.userData.campFlags = allCampFlags;

    const pennantGeo = new THREE.PlaneGeometry(0.38, 1.28, 1, 2);
    pennantGeo.translate(0.18, -0.64, 0);
    const campPennants = new THREE.InstancedMesh(
      pennantGeo,
      new THREE.MeshStandardMaterial({
        map: createCampPennantTexture(),
        alphaTest: 0.35,
        side: THREE.DoubleSide,
        roughness: 0.70,
        metalness: 0.06
      }),
      allCampFlags.length
    );
    campPennants.frustumCulled = false;
    campPennants.userData.campFlags = allCampFlags;
    campPennantsRef = campPennants;

    campFortificationsGroup.add(campPoles, campPennants);
    scene.add(campFortificationsGroup);
    updateCampFortifications();
  }

  function updateCampFortifications() {
    if (!campFortificationsGroup) return;
    const obj = new THREE.Object3D();
    const mountain = currentBattleTerrain === 'mountain';
    const [palisadeMesh, campPoles, campPennants] = campFortificationsGroup.children;

    if (palisadeMesh && palisadeMesh.userData.palisadeSpots) {
      const woodPalette = [0x4c3520, 0x3f2b19, 0x573e26];
      palisadeMesh.userData.palisadeSpots.forEach((spot, i) => {
        const px = mountain ? spot.x * 0.85 : spot.x;
        const pz = mountain ? spot.z * 0.62 : spot.z;
        obj.position.set(px, getBattleTerrainHeight(px, pz), pz);
        obj.rotation.set(0, spot.rotY, 0);
        obj.scale.setScalar(mountain ? spot.scale * 0.88 : spot.scale);
        obj.updateMatrix();
        palisadeMesh.setMatrixAt(i, obj.matrix);
        palisadeMesh.setColorAt(i, new THREE.Color(woodPalette[i % woodPalette.length]).convertSRGBToLinear());
      });
      palisadeMesh.instanceMatrix.needsUpdate = true;
      if (palisadeMesh.instanceColor) palisadeMesh.instanceColor.needsUpdate = true;
    }

    if (campPoles && campPennants && campPoles.userData.campFlags) {
      const sideAPalette = [0x1e4b85, 0x265c9e, 0x183c6b];
      const sideBPalette = [0x8f221f, 0xa32924, 0x731917];
      campPoles.userData.campFlags.forEach((fl, i) => {
        const fx = mountain ? fl.x * 0.85 : fl.x;
        const fz = mountain ? fl.z * 0.62 : fl.z;
        const fy = getBattleTerrainHeight(fx, fz);
        fl.curX = fx;
        fl.curY = fy;
        fl.curZ = fz;
        const s = mountain ? fl.scale * 0.88 : fl.scale;
        fl.curScale = s;
        obj.position.set(fx, fy, fz);
        obj.rotation.set(0, fl.sideSign < 0 ? 0.18 : Math.PI - 0.18, 0);
        obj.scale.setScalar(s);
        obj.updateMatrix();
        campPoles.setMatrixAt(i, obj.matrix);

        obj.position.set(fx, fy + 2.42 * s, fz);
        obj.rotation.set(0, (fl.sideSign < 0 ? 0.18 : Math.PI - 0.18) + 0.25, 0);
        obj.scale.setScalar(s);
        obj.updateMatrix();
        campPennants.setMatrixAt(i, obj.matrix);
        const pal = fl.sideSign < 0 ? sideAPalette : sideBPalette;
        campPennants.setColorAt(i, new THREE.Color(pal[i % pal.length]).convertSRGBToLinear());
      });
      campPoles.instanceMatrix.needsUpdate = true;
      campPennants.instanceMatrix.needsUpdate = true;
      if (campPennants.instanceColor) campPennants.instanceColor.needsUpdate = true;
    }
  }

  function buildAncientBattlefieldTerrain() {
    brazierLights = [];
    campBrazierFlamesRef = null;

    // 1. 廣袤起伏戰場地形平面
    const groundGeo = new THREE.PlaneGeometry(240, 180, 160, 120);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // 旋轉後對應世界 Z
      let h = 0;
      // 中央渡河淺灘微凹
      const riverDist = Math.abs(x);
      if (riverDist < 2.2) {
        h -= (1 - riverDist / 2.2) * 0.22;
      }
      // 南北兩側山麓高坡隆起 (|z| > 8.5)
      const flank = Math.max(0, Math.abs(y) - 8.2);
      if (flank > 0) {
        h += Math.pow(flank, 1.32) * 0.26 + Math.sin(x * 0.55 + y * 0.4) * 0.22;
      }
      // 東西遠景丘陵
      const farX = Math.max(0, Math.abs(x) - 14.5);
      if (farX > 0) {
        h += Math.pow(farX, 1.2) * 0.16;
      }
      pos.setZ(i, h);
    }
    groundGeo.computeVertexNormals();

    groundGeometryRef = groundGeo;
    terrainTextures.set('grass', createTerrainTexture('grass'));
    const groundMat = new THREE.MeshStandardMaterial({
      map: terrainTextures.get('grass'),
      roughness: 0.88,
      metalness: 0.04
    });
    groundMaterialRef = groundMat;
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    buildLandscape();

    // 2. 中央波光粼粼古戰場渡河 (渭水／官渡淺灘)
    waterwayGroup = new THREE.Group();
    scene.add(waterwayGroup);
    riverTexRef = createRiverTexture();
    const riverGeo = new THREE.PlaneGeometry(3.5, 36, 8, 24);
    const riverMat = new THREE.MeshStandardMaterial({
      map: riverTexRef,
      color: 0xffffff,
      emissive: 0x081c24,
      emissiveIntensity: 0.25,
      roughness: 0.16,
      metalness: 0.36,
      transparent: true,
      opacity: 0.92
    });
    riverMeshRef = new THREE.Mesh(riverGeo, riverMat);
    riverMeshRef.rotation.x = -Math.PI / 2;
    riverMeshRef.position.y = -0.05;
    riverMeshRef.receiveShadow = true;
    waterwayGroup.add(riverMeshRef);

    // 3. 三座古木戰橋橫跨淺灘（合併網格並加上陳舊橡木與橋橫樑質感）
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3f2e1d, roughness: 0.94, metalness: 0.04 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x2b1d10, roughness: 0.88, metalness: 0.05 });
    const deckEntries = [];
    const trimEntries = [];
    [-3.8, 0.0, 3.8].forEach((bz, idx) => {
      const bw = idx === 1 ? 1.65 : 1.25;
      deckEntries.push({ geo: new THREE.BoxGeometry(3.45, 0.08, bw), pos: [0, 0.015, bz] });
      [-bw / 2 + 0.08, bw / 2 - 0.08].forEach((rz) => {
        trimEntries.push({ geo: new THREE.BoxGeometry(3.45, 0.08, 0.055), pos: [0, 0.09, bz + rz] });
      });
      for (let p = -1.4; p <= 1.45; p += 0.56) {
        trimEntries.push({ geo: new THREE.BoxGeometry(0.11, 0.025, bw + 0.04), pos: [p, 0.055, bz] });
      }
    });
    const bridgeDeckMesh = new THREE.Mesh(mergeStaticGeos(deckEntries), woodMat);
    bridgeDeckMesh.receiveShadow = true;
    const bridgeTrimMesh = new THREE.Mesh(mergeStaticGeos(trimEntries), railMat);
    bridgeTrimMesh.castShadow = true;
    bridgeTrimMesh.receiveShadow = true;
    waterwayGroup.add(bridgeDeckMesh, bridgeTrimMesh);

    const forestGroup = new THREE.Group();
    const mountainGroup = new THREE.Group();
    const forestPositions = [];
    for (const z of [-14, -11, 11, 14]) {
      for (let x = -24; x <= 24; x += 6) forestPositions.push({ x, z });
    }
    const treeTrunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.13, 0.2, 1.5, 5),
      new THREE.MeshStandardMaterial({ color: 0x59402a, roughness: 0.92 }),
      forestPositions.length
    );
    const treeCrowns = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1.05, 1),
      new THREE.MeshStandardMaterial({ color: 0x31543a, roughness: 0.94 }),
      forestPositions.length
    );
    const instanceTransform = new THREE.Object3D();
    forestPositions.forEach(({ x, z }, index) => {
      const height = 0.82 + (index % 4) * 0.12;
      instanceTransform.position.set(x, height * 0.75, z);
      instanceTransform.scale.setScalar(height);
      instanceTransform.updateMatrix();
      treeTrunks.setMatrixAt(index, instanceTransform.matrix);
      instanceTransform.position.y = height * 2.15;
      instanceTransform.scale.setScalar(height);
      instanceTransform.updateMatrix();
      instanceTransform.scale.set(height * 1.1, height * 1.35, height);
      instanceTransform.updateMatrix();
      treeCrowns.setMatrixAt(index, instanceTransform.matrix);
    });
    treeTrunks.instanceMatrix.needsUpdate = true;
    treeCrowns.instanceMatrix.needsUpdate = true;
    forestGroup.add(treeTrunks, treeCrowns);

    const rockPositions = [
      [-23, -10], [-18, -14], [-12, 14], [-5, -15], [5, 15],
      [12, -14], [18, 12], [23, 9], [-25, 4], [25, -5]
    ];
    const rocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0x77766f, roughness: 0.96 }),
      rockPositions.length
    );
    rockPositions.forEach(([x, z], index) => {
      const size = 0.8 + (index % 3) * 0.35;
      instanceTransform.position.set(x, size * 0.48, z);
      instanceTransform.scale.set(size * 1.25, size, size * 0.9);
      instanceTransform.rotation.set(index * 0.13, index * 0.41, index * 0.08);
      instanceTransform.updateMatrix();
      rocks.setMatrixAt(index, instanceTransform.matrix);
    });
    rocks.instanceMatrix.needsUpdate = true;
    mountainGroup.add(rocks);

    terrainDecorationGroup = new THREE.Group();
    terrainDecorationGroup.add(forestGroup, mountainGroup);
    scene.add(terrainDecorationGroup);
    const grassGeometry = new THREE.BufferGeometry();
    grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.035, 0, 0, 0, 0.13, 0.01, 0.035, 0, 0,
      0, 0, -0.03, -0.02, 0.10, 0, 0, 0, 0.03
    ], 3));
    grassGeometry.computeVertexNormals();
    groundCover = new THREE.InstancedMesh(grassGeometry, new THREE.MeshStandardMaterial({
      color: 0x4b5339, roughness: 1, side: THREE.DoubleSide
    }), isLowPowerDevice ? 180 : 700);
    groundCover.userData.positions = Array.from({ length: groundCover.count }, (_, i) => ({
      x: Math.sin(i * 127.1) * 21,
      z: Math.cos(i * 311.7) * 12,
      size: 0.7 + (i % 7) * 0.16
    }));
    groundCover.receiveShadow = true;
    scene.add(groundCover);

    // 4. 東西連營木柵圍牆與飄動陣旗林（取代呆板後方方陣）
    buildCampFortifications();

    // 5. 東西大營門篝火火盆（合併實例渲染壓低繪製開銷）
    const campBraziers = [
      { x: -13.2, z: -3.8 },
      { x: -13.2, z: 3.8 },
      { x: 13.2, z: -3.8 },
      { x: 13.2, z: 3.8 }
    ];
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5, metalness: 0.7 });
    const brazierStands = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.36, 0.65, 8), ironMat, campBraziers.length);
    brazierStands.frustumCulled = false;
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });
    const brazierFlames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.26, 0.62, 7), flameMat, campBraziers.length);
    brazierFlames.frustumCulled = false;
    const bObj = new THREE.Object3D();
    campBraziers.forEach((bp, idx) => {
      const baseH = getBattleTerrainHeight(bp.x, bp.z);
      bObj.position.set(bp.x, baseH + 0.32, bp.z);
      bObj.rotation.set(0, 0, 0);
      bObj.scale.setScalar(1);
      bObj.updateMatrix();
      brazierStands.setMatrixAt(idx, bObj.matrix);

      bObj.position.set(bp.x, baseH + 0.84, bp.z);
      bObj.updateMatrix();
      brazierFlames.setMatrixAt(idx, bObj.matrix);

      const pLight = new THREE.PointLight(0xff8c24, 1.85, 11.5);
      pLight.position.set(bp.x, baseH + 1.35, bp.z);
      scene.add(pLight);
      brazierLights.push({ light: pLight, baseIntensity: 1.85, x: bp.x, y: baseH + 0.84, z: bp.z, index: idx });
    });
    brazierStands.instanceMatrix.needsUpdate = true;
    brazierFlames.instanceMatrix.needsUpdate = true;
    campBrazierFlamesRef = brazierFlames;
    scene.add(brazierStands, brazierFlames);

    // 6. 待 GLB 載入完成後布置 3D 營帳、箭樓、鹿角拒馬與山崖巨石
    envPropsGroup = new THREE.Group();
    scene.add(envPropsGroup);
    ensureModelsLoaded().then(() => {
      if (!envPropsGroup) return;
      populateBattlefieldProps();
    });
    applyBattleTerrain(currentBattleTerrain);
    buildOccupationZones();
  }

  function applyBattleTerrain(terrain) {
    currentBattleTerrain = ['plain', 'mountain', 'forest'].includes(terrain) ? terrain : 'plain';
    if (waterwayGroup) waterwayGroup.visible = currentScene === 'plain' && currentBattleTerrain === 'plain';
    if (landscapeGroup) landscapeGroup.children.forEach(group => {
      group.visible = group.name === (currentScene === 'city' ? 'city' : currentBattleTerrain === 'mountain' ? 'canyon' : 'horizon');
    });
    if (terrainDecorationGroup) terrainDecorationGroup.visible = currentBattleTerrain !== 'plain';
    if (terrainDecorationGroup) {
      terrainDecorationGroup.children.forEach((group, index) => {
        group.visible = currentBattleTerrain === (index === 0 ? 'forest' : 'mountain');
        group.scale.set(index === 0 ? 0.72 : 0.62, 1, index === 0 ? 0.68 : 0.58);
        group.children.forEach(mesh => {
          if (!mesh.userData.terrainMatrices) {
            mesh.userData.terrainMatrices = Array.from({ length: mesh.count }, (_, i) => {
              const matrix = new THREE.Matrix4();
              mesh.getMatrixAt(i, matrix);
              return matrix;
            });
          }
          mesh.userData.terrainMatrices.forEach((base, i) => {
            const matrix = base.clone();
            matrix.elements[13] += getBattleTerrainHeight(matrix.elements[12] * group.scale.x, matrix.elements[14] * group.scale.z);
            mesh.setMatrixAt(i, matrix);
          });
          mesh.instanceMatrix.needsUpdate = true;
        });
      });
    }
    updateEnvironmentLayout();
    updateCampFortifications();
    if (groundCover) {
      const tuft = new THREE.Object3D();
      groundCover.userData.positions.forEach(({ x, z, size }, i) => {
        tuft.position.set(x, getBattleTerrainHeight(x, z), z);
        tuft.rotation.y = i * 0.7;
        const road = Math.abs(z) < 1.3 || Math.abs(Math.abs(z) - 3.8) < 0.8;
        const water = waterwayGroup?.visible && Math.abs(x) < 2;
        tuft.scale.setScalar(road || water ? 0 : size);
        tuft.updateMatrix();
        groundCover.setMatrixAt(i, tuft.matrix);
      });
      groundCover.instanceMatrix.needsUpdate = true;
    }
    if (!groundGeometryRef) return;

    const positions = groundGeometryRef.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      positions.setZ(i, getBattleTerrainHeight(x, -positions.getY(i)));
    }
    positions.needsUpdate = true;
    groundGeometryRef.computeVertexNormals();
    if (groundMaterialRef && groundMaterialRef.color) {
      const tint = currentBattleTerrain === 'mountain' ? 0x9c8871 : currentBattleTerrain === 'forest' ? 0x849171
        : currentScene === 'city' ? 0x888376 : currentScene === 'grassland' ? 0x92a072 : 0xb09f7d;
      groundMaterialRef.color.setHex(tint);
      const textureKey = currentBattleTerrain === 'mountain' ? 'rock' : currentScene === 'city' ? 'stone' : 'grass';
      if (!terrainTextures.has(textureKey)) terrainTextures.set(textureKey, createTerrainTexture(textureKey));
      groundMaterialRef.map = terrainTextures.get(textureKey);
      groundMaterialRef.map.wrapS = groundMaterialRef.map.wrapT = THREE.RepeatWrapping;
      groundMaterialRef.map.repeat.set(8, 6);
      groundMaterialRef.needsUpdate = true;
    }
    occupationZones.forEach(zone => {
      const height = getBattleTerrainHeight(0, zone.z);
      zone.fill.position.y = height + 0.025;
      zone.ring.position.y = height + 0.035;
    });
  }

  function getBattleTerrainHeight(x, worldZ) {
    const terrain = currentBattleTerrain;
    if (terrain === 'mountain') {
      const wall = Math.max(0, Math.abs(worldZ) - 9);
      return Math.sin(x * 0.21) * Math.cos(worldZ * 0.3) * 0.12
        + Math.min(7, wall * 0.72) + Math.max(0, Math.abs(x) - 34) * 0.08;
    }
    if (currentScene === 'grassland' || currentScene === 'city') {
      return Math.sin(x * 0.085) * Math.cos(worldZ * 0.09) * (currentScene === 'city' ? 0.03 : 0.22);
    }
    const localZ = -worldZ;
    const flank = Math.max(0, Math.abs(localZ) - (terrain === 'mountain' ? 4.5 : 8.2));
    const farX = Math.max(0, Math.abs(x) - (terrain === 'mountain' ? 11 : 14.5));
    const flankFade = Math.abs(localZ) > 22 ? Math.max(0, 1 - (Math.abs(localZ) - 22) / 14) : 1;
    let height = Math.min(terrain === 'mountain' ? 4.5 : 1.35,
      Math.pow(flank, terrain === 'mountain' ? 1.2 : 1.08) * (terrain === 'mountain' ? 0.42 : 0.11)) * flankFade
      + Math.min(1.6, Math.pow(farX, 1.05) * (terrain === 'mountain' ? 0.28 : 0.06));
    if (terrain === 'plain' && Math.abs(x) < 2.2) {
      height -= (1 - Math.abs(x) / 2.2) * 0.22;
    } else if (terrain === 'forest') {
      height += Math.sin(x * 0.42 + localZ * 0.16) * 0.18 + Math.cos(localZ * 0.58) * 0.1;
    } else if (terrain === 'mountain') {
      height += Math.sin(x * 0.52 + localZ * 0.35) * 0.38;
    }
    return height;
  }

  function buildLandscape() {
    landscapeGroup = new THREE.Group();
    if (!terrainTextures.has('rock')) terrainTextures.set('rock', createTerrainTexture('rock'));
    for (const kind of ['horizon', 'canyon', 'city']) {
      const group = new THREE.Group();
      group.name = kind;
      landscapeGroup.add(group);
      if (kind === 'city') {
        const stone = new THREE.MeshStandardMaterial({ color: 0x716f64, roughness: 1 });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(110, 5, 2.4), stone);
        wall.position.set(0, 2.5, -12);
        group.add(wall);
        const merlons = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.9, 2.5), stone, 55);
        const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 8, 4), stone, 7);
        const transform = new THREE.Object3D();
        for (let i = 0; i < 55; i++) {
          transform.position.set(-54 + i * 2, 5.4, -12);
          transform.updateMatrix();
          merlons.setMatrixAt(i, transform.matrix);
        }
        for (let i = 0; i < 7; i++) {
          transform.position.set(-48 + i * 16, 4, -12);
          transform.updateMatrix();
          towers.setMatrixAt(i, transform.matrix);
        }
        group.add(merlons, towers);
        continue;
      }
      for (let layer = 0; layer < 3; layer++) {
        for (const side of [-1, 1]) {
          const geometry = new THREE.PlaneGeometry(220, 1, 110, 16);
          const position = geometry.attributes.position;
          const colors = [];
          for (let i = 0; i < position.count; i++) {
            const x = position.getX(i);
            const t = position.getY(i) + 0.5;
            const ridge = kind === 'canyon'
              ? 8 + layer * 3 + Math.sin(x * 0.075 + layer) * 2 + Math.sin(x * 0.31) * 0.7
              : 5.5 + layer * 3.8 + Math.sin(x * 0.036 + layer * 2) * 2.4 + Math.sin(x * 0.12) * 0.9;
            const z = side * (kind === 'canyon' ? 11.5 + layer * 6 + t * 1.6 : 25 + layer * 12);
            position.setXYZ(i, x, t * ridge - 0.2,
              z + Math.sin(x * 0.13 + layer) * (kind === 'canyon' ? 1.2 : 2.6));
            const strata = kind === 'canyon' ? Math.sin(t * 70 + x * 0.15) * 0.035 : 0;
            const color = new THREE.Color(kind === 'canyon' ? 0x6b5d4d : 0x454a54);
            color.multiplyScalar(0.54 + layer * 0.14 + t * 0.24 + strata);
            colors.push(color.r, color.g, color.b);
          }
          geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
          geometry.computeVertexNormals();
          const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
            vertexColors: true, roughness: 1, side: THREE.DoubleSide,
            map: kind === 'canyon' ? terrainTextures.get('rock') : null
          }));
          group.add(mesh);
        }
      }
    }
    scene.add(landscapeGroup);
  }

  function buildOccupationZones() {
    occupationZones = [-5.4, 0, 5.4].map((z, index) => {
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: 0xc49a42,
        transparent: true,
        opacity: 0.045,
        depthWrite: false
      });
      const fill = new THREE.Mesh(new THREE.CircleGeometry(1.05, 28), fillMaterial);
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(0, getBattleTerrainHeight(0, z) + 0.025, z);
      fill.renderOrder = 1;
      scene.add(fill);

      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xc49a42,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.08, 1.18, 32), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, getBattleTerrainHeight(0, z) + 0.035, z);
      ring.renderOrder = 2;
      scene.add(ring);
      return { index, z, fill, ring };
    });
    updateOccupationZones();
  }

  function updateOccupationZones() {
    if (!occupationZones.length) return;
    occupationZones.forEach(zone => {
      let strengthA = 0;
      let strengthB = 0;
      unitsMap.forEach(token => {
        if (!token.alive || !token.formationOccupation || Math.abs(token.mesh.position.z - zone.z) > 3.2) return;
        if (token.side === 'A') strengthA += token.currentHp / Math.max(1, token.maxHp);
        else strengthB += token.currentHp / Math.max(1, token.maxHp);
      });
      const contested = strengthA > 0 && strengthB > 0 && Math.abs(strengthA - strengthB) < 0.25;
      const color = contested ? 0xfbbf24 : strengthA > strengthB ? 0x38bdf8 : strengthB > strengthA ? 0xf97316 : 0xc49a42;
      zone.fill.material.color.setHex(color);
      zone.fill.material.opacity = strengthA || strengthB ? 0.16 : 0.045;
      zone.ring.material.color.setHex(color);
      zone.ring.material.opacity = strengthA || strengthB ? 0.72 : 0.38;
      zone.fill.visible = cameraView === 'overview';
      zone.ring.visible = cameraView === 'overview';
    });
  }

  /**
   * 古戰場寫實「鹿角拒馬」交叉尖木柵 (取代現代施工路障，用於河岸防線與強弩陣前掩體)
   * 本地座標系：左右沿 X 展開、尖刺朝 +Z (敵軍來襲方向)
   */
  function buildWoodenAbatis(width = 1.15, height = 0.62) {
    const abatis = new THREE.Group();
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0x704422, roughness: 0.84, metalness: 0.05 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.42, metalness: 0.72 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.90 });

    const yMid = height * 0.44;
    const woodEntries = [
      { geo: new THREE.CylinderGeometry(0.055, 0.06, width, 7), pos: [0, yMid, 0], rot: [0, 0, Math.PI / 2] }
    ];
    const tipEntries = [];
    const ropeEntries = [];

    // 多組交叉削尖圓木樁 + 鐵包尖頭 + 麻繩綑紮（依材質合併為 3 個靜態網格大幅壓低 drawCalls）
    const pairCount = Math.max(3, Math.round(width / 0.30));
    const stakeLen = height * 1.28;
    const fwdAngle = Math.PI * 0.27;
    const fwdDy = stakeLen * 0.5 + 0.06;
    const bwdAngle = -Math.PI * 0.25;
    const bwdDy = stakeLen * 0.47 + 0.05;

    for (let i = 0; i < pairCount; i++) {
      const x = pairCount === 1 ? 0 : (-width * 0.42 + (width * 0.84 * i) / (pairCount - 1));

      // 朝前斜刺 (+Z 敵陣方向)
      woodEntries.push({
        geo: new THREE.CylinderGeometry(0.032, 0.045, stakeLen, 6),
        pos: [x, yMid, 0],
        rot: [fwdAngle, 0, 0]
      });
      tipEntries.push({
        geo: new THREE.ConeGeometry(0.034, 0.14, 6),
        pos: [x, yMid + fwdDy * Math.cos(fwdAngle), fwdDy * Math.sin(fwdAngle)],
        rot: [fwdAngle, 0, 0]
      });

      // 朝後支撐斜樁 (-Z 方向抓地)
      woodEntries.push({
        geo: new THREE.CylinderGeometry(0.030, 0.042, stakeLen * 0.94, 6),
        pos: [x + 0.03, yMid, 0],
        rot: [bwdAngle, 0, 0]
      });
      woodEntries.push({
        geo: new THREE.ConeGeometry(0.032, 0.12, 6),
        pos: [x + 0.03, yMid + bwdDy * Math.cos(bwdAngle), bwdDy * Math.sin(bwdAngle)],
        rot: [bwdAngle, 0, 0]
      });

      // 麻繩十字結節
      ropeEntries.push({
        geo: new THREE.TorusGeometry(0.065, 0.018, 5, 8),
        pos: [x + 0.015, yMid, 0],
        rot: [0, Math.PI / 2, 0]
      });
    }

    const woodMesh = new THREE.Mesh(mergeStaticGeos(woodEntries), stakeMat);
    woodMesh.castShadow = true;
    woodMesh.receiveShadow = true;
    const tipMesh = new THREE.Mesh(mergeStaticGeos(tipEntries), tipMat);
    const ropeMesh = new THREE.Mesh(mergeStaticGeos(ropeEntries), ropeMat);
    abatis.add(woodMesh, tipMesh, ropeMesh);
    return abatis;
  }

  /**
   * 古戰場朱漆鎏金「雷音大戰鼓」與木架 (用於軍師奇謀本陣擂鼓助威)
   */
  function buildTaikoWarDrum() {
    const grp = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.75, metalness: 0.10 });
    const lacquerMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.35, metalness: 0.22 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65, metalness: 0.05 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.28, metalness: 0.82 });

    // A字實木鼓架
    [-0.18, 0.18].forEach((sx) => {
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.05), woodMat);
      leg1.position.set(sx, 0.21, 0.11);
      leg1.rotation.x = -0.26;
      leg1.castShadow = true;
      grp.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.05), woodMat);
      leg2.position.set(sx, 0.21, -0.11);
      leg2.rotation.x = 0.26;
      leg2.castShadow = true;
      grp.add(leg2);
    });

    // 朱漆鼓身 (軸向沿本地 Z 鼓面朝前後)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 14), lacquerMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.44, 0);
    barrel.castShadow = true;
    grp.add(barrel);

    // 鼓腹中央隆起腰環與雙側金鉚釘環
    const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.16, 14), lacquerMat);
    belly.rotation.x = Math.PI / 2;
    belly.position.set(0, 0.44, 0);
    grp.add(belly);

    [-0.175, 0.175].forEach((dz) => {
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.232, 0.232, 0.02, 14), skinMat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 0.44, dz);
      grp.add(head);

      const goldRing = new THREE.Mesh(new THREE.TorusGeometry(0.238, 0.014, 6, 16), goldMat);
      goldRing.position.set(0, 0.44, dz);
      grp.add(goldRing);
    });

    return grp;
  }

  function populateBattlefieldProps() {
    if (!envPropsGroup || envPropsGroup.children.length > 0) return;

    // 東西雙方本陣營帳與箭樓（嵌於連營木柵之內側，避免遮擋後軍）
    [
      { side: 'A', sx: -1, tint: 0x2563eb },
      { side: 'B', sx: 1, tint: 0xdc2626 }
    ].forEach(({ sx, tint }) => {
      const faceY = sx < 0 ? Math.PI / 2 : -Math.PI / 2;

      [-5.6, 5.6].forEach((zPos) => {
        const tower = spawnModelInstance('watchtower', { targetHeight: 2.25, tintHex: tint, tintStrength: 0.14 });
        if (tower) {
          tower.group.position.set(sx * 14.8, 0, zPos);
          tower.group.rotation.y = faceY;
          tower.group.userData.terrainRole = 'tower';
          envPropsGroup.add(tower.group);
        }
      });

      [-2.3, 2.3].forEach((zPos) => {
        const tent = spawnModelInstance('tent', { targetHeight: 1.35, tintHex: tint, tintStrength: 0.25 });
        if (tent) {
          tent.group.position.set(sx * 14.2, 0, zPos);
          tent.group.rotation.y = faceY;
          envPropsGroup.add(tent.group);
        }
      });

      [-6.8, -3.8, 3.8, 6.8].forEach((zPos) => {
        const flag = spawnModelInstance('banner', { targetHeight: 1.95, tintHex: tint, tintStrength: 0.42 });
        if (flag) {
          flag.group.position.set(sx * 12.6, 0, zPos);
          flag.group.rotation.y = faceY;
          envPropsGroup.add(flag.group);
        }
      });

      // 河岸前哨寫實木製「鹿角拒馬」防線
      [-5.8, -1.9, 1.9, 5.8].forEach((zPos) => {
        const abatis = buildWoodenAbatis(1.32, 0.68);
        abatis.position.set(sx * 2.55, 0, zPos);
        abatis.rotation.y = faceY;
        abatis.userData.terrainRole = 'abatis';
        envPropsGroup.add(abatis);
      });
    });

    // 南北山崖巨石群
    const rockSpots = [
      [-17, -12.0, 2.6, 'rock_a'], [-12, -13.2, 3.1, 'rock_b'], [12, -13.0, 2.8, 'rock_a'], [17, -11.8, 3.2, 'rock_b'],
      [-17, 12.0, 2.8, 'rock_b'], [-12, 13.2, 2.5, 'rock_a'], [12, 13.0, 3.0, 'rock_b'], [17, 11.8, 2.7, 'rock_a']
    ];
    rockSpots.forEach(([rx, rz, rh, rkey], i) => {
      const rk = spawnModelInstance(rkey, {
        targetHeight: rh * 0.25, castShadow: true, tintHex: 0x7d7868, tintStrength: 0.85
      });
      if (rk) {
        rk.group.position.set(rx, 0.15, rz);
        rk.group.rotation.y = i * 1.1;
        rk.group.userData.terrainRole = 'rock';
        envPropsGroup.add(rk.group);
      }
    });
    updateEnvironmentLayout();
  }

  function updateEnvironmentLayout() {
    if (!envPropsGroup) return;
    envPropsGroup.children.forEach(prop => {
      if (!prop.userData.basePosition) {
        prop.userData.basePosition = prop.position.clone();
        prop.userData.baseScale = prop.scale.clone();
      }
      const role = prop.userData.terrainRole;
      const mountain = currentBattleTerrain === 'mountain';
      prop.visible = role === 'rock' ? mountain
        : role === 'abatis' ? currentBattleTerrain === 'plain' && currentScene === 'plain'
        : role === 'tower' ? !mountain : true;
      prop.position.copy(prop.userData.basePosition);
      prop.scale.copy(prop.userData.baseScale);
      if (mountain) {
        prop.position.x *= 0.85;
        prop.position.z *= role === 'rock' ? 0.9 : 0.58;
      }
      prop.position.y += getBattleTerrainHeight(prop.position.x, prop.position.z);
    });
  }

  function applyWeatherAtmosphere(weather) {
    currentWeatherKey = weather || 'plain';
    if (!scene) return;
    if (scene.background?.isTexture) scene.background.dispose();
    scene.background = createSkyBackdropTexture(currentWeatherKey);

    if (weatherParticles) {
      scene.remove(weatherParticles);
      weatherParticles.geometry.dispose();
      weatherParticles.material.dispose();
      weatherParticles = null;
    }

    if (currentWeatherKey === 'storm') {
      scene.fog = new THREE.FogExp2(0x131b29, 0.022);
      if (sunLightRef) sunLightRef.intensity = 1.05;
      if (hemiLightRef) hemiLightRef.intensity = 0.44;
      // 暴雨雨絲粒子
      const rainCount = 520;
      const geo = new THREE.BufferGeometry();
      const arr = new Float32Array(rainCount * 3);
      for (let i = 0; i < rainCount; i++) {
        arr[i * 3] = (Math.random() - 0.5) * 34;
        arr[i * 3 + 1] = Math.random() * 14;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.PointsMaterial({ color: 0xa5c8f8, size: 0.16, transparent: true, opacity: 0.62 });
      weatherParticles = new THREE.Points(geo, mat);
      scene.add(weatherParticles);
    } else if (currentWeatherKey === 'em') {
      scene.fog = new THREE.FogExp2(0x8c9598, 0.068);
      if (sunLightRef) sunLightRef.intensity = 0.72;
      if (hemiLightRef) hemiLightRef.intensity = 0.78;
    } else {
      scene.fog = new THREE.FogExp2(currentBattleTerrain === 'mountain' ? 0x725e4c : currentScene === 'grassland' ? 0x75725b : 0x7c6952,
        currentScene === 'grassland' ? 0.0085 : 0.013);
      if (sunLightRef) sunLightRef.intensity = 2.05;
      if (hemiLightRef) hemiLightRef.intensity = 0.52;
    }
  }

  /* ----------------------------------------------------
     3. 打造《三國志》立體部隊方陣托盤 + 全 3D 骨骼動畫兵種
     ---------------------------------------------------- */
  function getFormationOffset(layout, index, count, mounted) {
    const stepX = mounted ? 0.54 : 0.43;
    const stepZ = mounted ? 0.88 : 0.47;
    if (layout === 'wedge' || layout === 'cone') {
      const maxColumns = mounted ? 4 : 6;
      let row = 0, column = index;
      while (column >= Math.min(row + 1, maxColumns)) {
        column -= Math.min(row + 1, maxColumns);
        row++;
      }
      const columns = Math.min(row + 1, maxColumns);
      return { x: (column - (columns - 1) / 2) * stepX * (layout === 'cone' ? 0.85 : 1),
        z: 0.5 - row * stepZ };
    }
    if (layout === 'square') {
      const columns = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / columns);
      const row = Math.floor(index / columns);
      const inRow = Math.min(columns, count - row * columns);
      return { x: (index % columns - (inRow - 1) / 2) * stepX * 0.85,
        z: (rows - 1) * stepZ * 0.3 - row * stepZ };
    }
    if (layout === 'staggered') {
      const columns = mounted ? 3 : 4;
      const row = Math.floor(index / columns);
      return { x: (index % columns - (columns - 1) / 2) * stepX + (row % 2 ? stepX * 0.4 : 0),
        z: 0.42 - row * stepZ };
    }
    if (layout === 'wings') {
      if (count <= 2) return { x: (index - (count - 1) / 2) * 1.0, z: 0.1 };
      if (index === 0) return { x: 0, z: 0.55 };
      if (index === count - 1 && count % 2 === 0) return { x: 0, z: -0.55 };
      const wingIndex = index - 1;
      const columns = mounted ? 2 : 3;
      const rank = Math.floor(wingIndex / (columns * 2));
      const column = Math.floor((wingIndex % (columns * 2)) / 2);
      return { x: (wingIndex % 2 ? 1 : -1) * (0.24 + column * (mounted ? 0.44 : 0.30) + rank * 0.01),
        z: 0.08 - rank * stepZ - column * 0.14 };
    }
    if (layout === 'column') {
      if (count > 8) return { x: (index % 3 - 1) * stepX, z: 0.68 - Math.floor(index / 3) * stepZ };
      return { x: index % 2 ? 0.12 : -0.12, z: 0.68 - index * 0.48 };
    }
    return null;
  }

  function addBattalionRanks(token) {
    const mounted = token.cat === 'air';
    const count = mounted ? (isLowPowerDevice ? 12 : 24) : (isLowPowerDevice ? 24 : 48);
    token.lowPower = isLowPowerDevice;
    const ranks = BattleFigures.createRanks(token, count, (i, total) => {
      const offset = getFormationOffset(token.formationLayout, i, total, mounted);
      const columns = mounted ? 4 : 6;
      return offset || { x: (i % columns - (columns - 1) / 2) * (mounted ? 0.54 : 0.43),
        z: -Math.floor(i / columns) * (mounted ? 0.88 : 0.47) };
    });
    token.troopsContainer.add(ranks);
  }

  function createUnitToken(unit, side, index) {
    const isSideA = side === 'A';
    const cat = unit.cat || 'armor';
    const meta = CAT_META[cat] || CAT_META.armor;
    const formationLayout = unit.formationLayout || 'line';
    const coords = (SLOT_COORDS[side] && SLOT_COORDS[side][cat]) || { x: isSideA ? -6 : 6, z: (index - 2) * 3.0 };

    const rootGroup = new THREE.Group();
    rootGroup.position.set(coords.x, getBattleTerrainHeight(coords.x, coords.z), coords.z);

    // 朝向旋轉群組：本地 +Z 一律代表「面向敵陣前方」
    // A 軍 (+X 方向): rotation.y = +Math.PI/2；B 軍 (-X 方向): rotation.y = -Math.PI/2
    const formationRig = new THREE.Group();
    formationRig.rotation.y = isSideA ? Math.PI / 2 : -Math.PI / 2;
    rootGroup.add(formationRig);

    // B. 3D 兵種模型方陣容器
    const troopsContainer = new THREE.Group();
    troopsContainer.position.y = 0.03;
    formationRig.add(troopsContainer);

    // C. 光榮式懸浮名將頭像軍徽與即時兵力銘牌 (Sprite 永遠正對鏡頭、不遮擋 3D 士兵！)
    const startHp = Math.max(1, Number(unit.maxHp || unit.hpMax || unit.hp || 200));
    const hud = buildWarlordCrestHud(unit, isSideA, meta, startHp, startHp);
    hud.sprite.position.set(0, cat === 'air' ? 1.95 : 1.35, 0);
    hud.sprite.visible = true;
    rootGroup.add(hud.sprite);

    scene.add(rootGroup);

    const token = {
      uid: unit.uid,
      id: unit.id,
      name: unit.name,
      cost: unit.cost || 3,
      tag: unit.tag || '',
      wep: unit.wep || '',
      side,
      cat,
      formationName: unit.formationName || '魚鱗',
      formationRanged: Boolean(unit.formationRanged),
      formationLayout,
      formationMobility: unit.formationMobility || 1,
      formationOccupation: Boolean(unit.formationOccupation),
      mesh: rootGroup,
      formationRig,
      troopsContainer,
      hud,
      unitAnims: [],
      origX: coords.x,
      origZ: coords.z,
      frontX: coords.x,
      frontY: rootGroup.position.y,
      frontZ: coords.z,
      march: null,
      engagement: null,
      chargeCommitted: false,
      chargeInProgress: false,
      chargeImpactCallbacks: [],
      impact: null,
      currentHp: startHp,
      maxHp: startHp,
      alive: true,
      fallen: false,
      epoch: battleEpoch
    };

    // 載入完成後裝配真實 GLB 兵種方陣
    ensureModelsLoaded().then(() => {
      if (token.epoch !== battleEpoch || !unitsMap.has(token.uid)) return;
      populateFormationGLB(token);
    });

    return token;
  }

  function attachProp(parentGroup, key, opts, pos, rot) {
    const inst = spawnModelInstance(key, opts);
    if (!inst) return null;
    if (pos) inst.group.position.set(pos[0], pos[1], pos[2]);
    if (rot) inst.group.rotation.set(rot[0], rot[1], rot[2]);
    parentGroup.add(inst.group);
    return inst.group;
  }

  function getBannerTexture(unitName, side, cost = 3) {
    const ch = (unitName || '將').trim().slice(0, 1) || '將';
    const isSideA = side === 'A';
    const cacheKey = `${side}_${ch}_${cost >= 4 ? 'hi' : 'std'}`;
    if (bannerTexCache.has(cacheKey)) return bannerTexCache.get(cacheKey);

    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const ctx = c.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, 0, 256);
    if (isSideA) {
      bg.addColorStop(0, '#0f294a');
      bg.addColorStop(0.55, '#1d4d82');
      bg.addColorStop(1, '#09182e');
    } else {
      bg.addColorStop(0, '#4c0d0d');
      bg.addColorStop(0.55, '#8c1b1b');
      bg.addColorStop(1, '#2a0808');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 256);

    // 戰旗錦邊與金線刺繡
    ctx.strokeStyle = cost >= 4 ? '#fbbf24' : '#d6b36a';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 116, 244);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,243,205,0.55)';
    ctx.strokeRect(14, 14, 100, 228);

    // 上方雲紋與戰將姓氏大字
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(64, 112, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = cost >= 4 ? '#fde68a' : '#e5c985';
    ctx.stroke();

    ctx.fillStyle = '#fff3d1';
    ctx.font = '900 58px "Noto Serif TC", "Microsoft JhengHei", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 64, 114);

    // 下擺吞口三角缺口陰影感
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.moveTo(0, 256);
    ctx.lineTo(64, 226);
    ctx.lineTo(128, 256);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    bannerTexCache.set(cacheKey, tex);
    return tex;
  }

  function createFactionBannerGroup(token) {
    const group = new THREE.Group();
    group.userData.isFactionBanners = true;
    const isSideA = token.side === 'A';
    const tex = getBannerTexture(token.name, token.side, token.cost || 3);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c4223, roughness: 0.60, metalness: 0.35 });
    const clothMat = new THREE.MeshStandardMaterial({
      map: tex,
      side: THREE.DoubleSide,
      roughness: 0.65,
      metalness: 0.08
    });

    const placements = token.cost >= 4
      ? [[-1.08, -0.45, 1.12], [1.05, -0.52, 1.05]]
      : [[-1.04, -0.50, 0.98], [1.02, -0.56, 0.94]];

    const poleParts = [];
    const banners = [];
    placements.forEach(([bx, bz, scale], idx) => {
      const poleH = 1.92 * scale;
      poleParts.push({ geo: new THREE.CylinderGeometry(0.018, 0.024, poleH, 5), pos: [bx, poleH * 0.5, bz] });
      poleParts.push({ geo: new THREE.CylinderGeometry(0.012, 0.012, 0.44 * scale, 5), pos: [bx + 0.20 * scale, poleH * 0.94, bz], rot: [0, 0, Math.PI / 2] });
      poleParts.push({ geo: new THREE.ConeGeometry(0.034, 0.15, 5), pos: [bx, poleH + 0.07, bz] });

      const sub = new THREE.Group();
      sub.position.set(bx, 0, bz);
      const clothGeo = new THREE.PlaneGeometry(0.42 * scale, 0.98 * scale, 2, 4);
      const cloth = new THREE.Mesh(clothGeo, clothMat);
      cloth.position.set(0.20 * scale, poleH * 0.94 - 0.48 * scale, 0);
      cloth.rotation.y = isSideA ? -0.35 : 0.35;
      cloth.userData.baseRotY = cloth.rotation.y;
      cloth.userData.phase = (token.attackPhaseOffset || 0) + idx * 1.4;
      sub.add(cloth);

      banners.push({ root: sub, cloth, phase: cloth.userData.phase });
      group.add(sub);
    });
    group.add(new THREE.Mesh(mergeStaticGeos(poleParts), poleMat));
    group.userData.banners = banners;
    return group;
  }

  function populateFormationGLB(token) {
    const g = token.troopsContainer;
    if (!g || g.children.length > 0) return;

    const isSideA = token.side === 'A';
    if (token.cat === 'support') {
      const drum = buildTaikoWarDrum();
      drum.scale.setScalar(0.70);
      drum.position.set(-1.3, 0, -1.3);
      g.add(drum);
    }

    // 主將精雕大將軍模型 + 軍姓氏戰旗群
    const bannerGroup = createFactionBannerGroup(token);
    token.banners = bannerGroup.userData.banners || [];
    g.add(bannerGroup);

    if (typeof BattleFigures !== 'undefined' && typeof BattleFigures.createCommanderHero === 'function') {
      const hero = BattleFigures.createCommanderHero(token);
      const rangedHero = token.cat === 'air_defense' || token.cat === 'support';
      hero.position.set(0, 0, token.cat === 'air' ? 0.86 : rangedHero ? 0.24 : 0.68);
      token.commanderHero = hero;
      g.add(hero);
    }

    if ((token.cost || 3) >= 4) {
      const auraGeo = new THREE.RingGeometry(0.32, 0.41, 20);
      const auraMat = new THREE.MeshBasicMaterial({
        color: isSideA ? 0x38bdf8 : 0xfbbf24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.28,
        depthWrite: false
      });
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.rotation.x = -Math.PI / 2;
      const rangedHero = token.cat === 'air_defense' || token.cat === 'support';
      aura.position.set(0, 0.035, token.cat === 'air' ? 0.86 : rangedHero ? 0.24 : 0.68);
      aura.userData.isHeroAura = true;
      token.heroAura = aura;
      g.add(aura);
    }

    addBattalionRanks(token);
    triggerSquadAnim(token, !token.alive ? 'death' : token.march && !token.march.finished ? 'move' : 'idle', 1.0);
    if (!token.alive) applyFallenPose(token, 1);
  }

  /* ----------------------------------------------------
     4. 光榮式懸浮寫實名將圓徽與即時兵力銘牌 (Sprite HUD)
     ---------------------------------------------------- */
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function buildWarlordCrestHud(unit, isSideA, meta, currentHp, maxHp) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 176;
    const ctx = canvas.getContext('2d');
    let portraitImg = null;

    function redraw(hpVal) {
      const light = document.documentElement.dataset.theme === 'light';
      const ink = light ? '#252d35' : '#fff4df';
      const edge = isSideA ? (light ? '#175976' : '#8bbdd1') : (light ? '#93412e' : '#dc9a82');
      const hp = Math.max(0, hpVal);
      const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
      ctx.clearRect(0, 0, 512, 176);
      if (!showUnitLabels) {
        roundRectPath(ctx, 14, 34, 484, 108, 14);
        const slimBg = ctx.createLinearGradient(14, 34, 498, 142);
        if (light) {
          slimBg.addColorStop(0, isSideA ? 'rgba(22, 42, 68, 0.84)' : 'rgba(66, 24, 22, 0.84)');
          slimBg.addColorStop(1, 'rgba(32, 28, 22, 0.78)');
        } else {
          slimBg.addColorStop(0, isSideA ? 'rgba(11, 24, 48, 0.82)' : 'rgba(54, 14, 14, 0.82)');
          slimBg.addColorStop(1, 'rgba(12, 16, 26, 0.76)');
        }
        ctx.fillStyle = slimBg;
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = isSideA ? '#60a5fa' : '#f87171';
        ctx.stroke();

        // 左側簡潔陣營兵徽章
        ctx.fillStyle = isSideA ? '#1d4ed8' : '#b91c1c';
        roundRectPath(ctx, 26, 46, 54, 84, 9);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fef3c7';
        ctx.font = '900 32px "Noto Serif TC", "Microsoft JhengHei", serif';
        ctx.textAlign = 'center';
        ctx.fillText(meta.badge || (isSideA ? '漢' : '魏'), 53, 98);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff6e0';
        ctx.font = '900 50px "Noto Serif TC", "Microsoft JhengHei", sans-serif';
        ctx.fillText((unit.name || '無名武將').slice(0, 6), 94, 95, 386);

        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(94, 114, 386, 12);
        if (ratio > 0) {
          ctx.fillStyle = ratio > 0.52 ? '#4ade80' : (ratio > 0.25 ? '#fbbf24' : '#ef4444');
          ctx.fillRect(95, 115, Math.max(8, 384 * ratio), 10);
        }
        return;
      }

      // 1. 黑金漆器銘牌底板
      roundRectPath(ctx, 88, 26, 408, 124, 18);
      const bg = ctx.createLinearGradient(88, 26, 496, 150);
      if (light) {
        bg.addColorStop(0, 'rgba(255,251,240,0.98)');
        bg.addColorStop(1, 'rgba(237,232,218,0.98)');
      } else if (isSideA) {
        bg.addColorStop(0, 'rgba(12, 26, 54, 0.92)');
        bg.addColorStop(1, 'rgba(15, 23, 42, 0.88)');
      } else {
        bg.addColorStop(0, 'rgba(58, 14, 14, 0.92)');
        bg.addColorStop(1, 'rgba(28, 16, 14, 0.88)');
      }
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = edge;
      ctx.stroke();

      // 2. 名將名號與費率兵種印記
      ctx.fillStyle = ink;
      ctx.font = '900 34px "Noto Serif TC", "Microsoft JhengHei", serif';
      ctx.textAlign = 'left';
      const displayName = (unit.name || '無名武將').slice(0, 7);
      ctx.fillText(displayName, 166, 72);

      // 右上角兵種標籤印章
      roundRectPath(ctx, 412, 38, 68, 38, 10);
      ctx.fillStyle = meta.hex;
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 24px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${meta.badge}$${unit.cost || 3}`, 446, 65);

      // 3. 兵力條與即時兵力數
      roundRectPath(ctx, 166, 92, 310, 22, 10);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
      ctx.fill();

      if (ratio > 0) {
        const barW = Math.max(14, Math.round(306 * ratio));
        roundRectPath(ctx, 168, 94, barW, 18, 8);
        ctx.fillStyle = ratio > 0.52 ? '#22c55e' : (ratio > 0.25 ? '#f59e0b' : '#ef4444');
        ctx.fill();
      }

      const troopsNum = Math.round(hp * 100).toLocaleString();
      ctx.fillStyle = light ? '#594119' : '#fde68a';
      ctx.font = 'bold 23px "JetBrains Mono", "Noto Sans TC", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`兵力 ${troopsNum}`, 474, 140);

      ctx.fillStyle = edge;
      ctx.font = 'bold 20px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${unit.formationName || '魚鱗'}陣 · ${isSideA ? '我軍' : '敵軍'}`, 168, 140);

      // 4. 左側鎏金圓形名將胸像勳章 (半徑 68)
      const cx = 86, cy = 88, r = 68;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.clip();

      if (portraitImg && portraitImg.complete && portraitImg.naturalWidth > 0) {
        // 聚焦臉部與胸甲上半身 (top-center crop)
        const sw = portraitImg.naturalWidth;
        const sh = portraitImg.naturalHeight;
        const crop = Math.min(sw, sh) * 0.88;
        const sx = (sw - crop) / 2;
        const sy = Math.max(0, (sh - crop) * 0.14);
        ctx.drawImage(portraitImg, sx, sy, crop, crop, cx - r, cy - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = isSideA ? '#1e3a8a' : '#7f1d1d';
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = '#fde68a';
        ctx.font = '900 54px "Noto Serif TC", serif';
        ctx.textAlign = 'center';
        ctx.fillText((unit.name || '將')[0], cx, cy + 20);
      }
      ctx.restore();

      // 雙層金環外框
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = isSideA ? '#38bdf8' : '#fbbf24';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fef3c7';
      ctx.stroke();
    }

    redraw(currentHp);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.75, 0.60, 1);
    sprite.renderOrder = 20;

    if (unit.id) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        portraitImg = img;
        const tok = unitsMap.get(unit.uid);
        redraw(tok ? tok.currentHp : currentHp);
        tex.needsUpdate = true;
      };
      img.src = `${PORTRAIT_DIR}${unit.id}.jpg?v=${ASSET_VER}`;
    }

    return { sprite, tex, redraw };
  }

  function spawnFloatingDamagePopup(worldPos, text, colorHex = '#ef4444', isBig = false) {
    const c = document.createElement('canvas');
    const fontSpec = `900 ${isBig ? 44 : 36}px "Noto Sans TC", sans-serif`;
    const measureCtx = c.getContext('2d');
    measureCtx.font = fontSpec;
    const textW = Math.ceil(measureCtx.measureText(text).width);
    c.width = Math.max(256, Math.min(480, textW + 40));
    c.height = 84;
    const ctx = c.getContext('2d');
    ctx.font = fontSpec;
    ctx.textAlign = 'center';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
    ctx.strokeText(text, c.width / 2, 56);
    ctx.fillStyle = isBig ? '#fde68a' : colorHex;
    if (isBig) {
      ctx.shadowColor = colorHex;
      ctx.shadowBlur = 10;
    }
    ctx.fillText(text, c.width / 2, 56);

    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false });
    const sp = new THREE.Sprite(mat);
    const h = isBig ? 0.64 : 0.50;
    const w = h * (c.width / c.height);
    const spawnPos = new THREE.Vector3(
      worldPos.x,
      worldPos.y + (isBig ? 2.25 : 2.02),
      worldPos.z + (Math.random() - 0.5) * 0.55
    );
    let chosenRect = null;
    if (camera && container && container.clientWidth > 0 && container.clientHeight > 0) {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const depth = spawnPos.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const perPixel = Math.max(0.001, -2 * depth * Math.tan(camera.fov * Math.PI / 360) / ch);
      const popW = w / perPixel;
      const popH = h / perPixel;
      const occupied = [];
      unitsMap.forEach((tok) => {
        if (tok.hud && tok.hud.sprite && tok.hud.sprite.userData.screenRect) {
          occupied.push(tok.hud.sprite.userData.screenRect);
        }
      });
      floatingPopups.forEach((fp) => { if (fp.screenRect) occupied.push(fp.screenRect); });
      const proj = spawnPos.clone().project(camera);
      const minX = popW / 2 + 8;
      const maxX = Math.max(minX, cw - popW / 2 - 8);
      const minY = Math.max(36, popH / 2 + 10);
      const maxY = Math.max(minY, ch - 84 - popH / 2);
      const basePx = Math.max(minX, Math.min(maxX, (proj.x + 1) * cw / 2));
      const basePy = Math.max(minY, Math.min(maxY, (1 - proj.y) * ch / 2));
      // 預留足夠跨越名牌寬度 (104-132px + popW) 的候選偏移，並將上升飄移半徑計入安全框避免碰撞上方或兩側名牌
      const candidates = [
        [0, 0], [0, -60], [0, -104], [0, 56],
        [-128, -42], [128, -42], [-156, 0], [156, 0],
        [-148, 52], [148, 52], [0, -148], [0, 98],
        [-195, -72], [195, -72], [-195, 34], [195, 34],
        [-96, -138], [96, -138], [-240, -18], [240, -18]
      ];
      let best = { x: basePx, y: basePy, score: Infinity };
      const risePad = 12;
      for (const [dx, dy] of candidates) {
        const cx = Math.max(minX, Math.min(maxX, basePx + dx));
        const cy = Math.max(minY, Math.min(maxY, basePy + dy));
        const checkCy = cy - risePad * 0.5;
        let overlapArea = 0;
        for (const r of occupied) {
          const ox = Math.max(0, (popW + r.width) / 2 + 10 - Math.abs(cx - r.x));
          const oy = Math.max(0, (popH + risePad + r.height) / 2 + 8 - Math.abs(checkCy - r.y));
          overlapArea += ox * oy;
        }
        if (overlapArea === 0) {
          best = { x: cx, y: cy, score: 0 };
          break;
        }
        if (overlapArea < best.score) best = { x: cx, y: cy, score: overlapArea };
      }
      chosenRect = { x: best.x, y: best.y, width: popW, height: popH };
      proj.set(best.x / cw * 2 - 1, 1 - best.y / ch * 2, proj.z).unproject(camera);
      spawnPos.copy(proj);
    }
    sp.position.copy(spawnPos);
    sp.scale.set(w, h, 1);
    sp.renderOrder = 30;
    scene.add(sp);

    floatingPopups.push({ sprite: sp, tex, mat, text, screenRect: chosenRect, startedAt: combatNow(), duration: isBig ? 980 : 850 });
  }

  /* ----------------------------------------------------
     5. 載入合戰雙方陣容與事件驅動骨骼動作演出
     ---------------------------------------------------- */
  function loadBattle(res) {
    if (!isInitialized) return;
    clearAllTokens();
    battleSettled = false;
    setAudioPaused(false);
    activeAttackers.clear();
    peakConcurrentAttackers = 0;
    completedVolleys = 0;
    ambientArrowVolleys = 0;
    ambientSpellcasts = 0;

    const wKey = res?.ev?.id || res?.weather || 'clear';
    const environment = getBattleEnvironment(res?.ev || { id: wKey }, res?.terrain);
    currentScene = environment.scene;
    applyBattleTerrain(environment.terrain);
    applyWeatherAtmosphere(wKey);

    const teamA = (res && res.final && res.final.A) || [];
    const teamB = (res && res.final && res.final.B) || [];

    teamA.forEach((u, i) => {
      const tok = createUnitToken(u, 'A', i);
      unitsMap.set(u.uid, tok);
    });
    teamB.forEach((u, i) => {
      const tok = createUnitToken(u, 'B', i);
      unitsMap.set(u.uid, tok);
    });

    resetCamera();
    camFocusTarget.set(0, 0, 0);
    lastFocusAt = 0;
    const now = combatNow();
    [...unitsMap.values()].forEach((token, index) => {
      token.attackPhaseOffset = (index % 5) * 0.82 + (token.side === 'B' ? 1.1 : 0);
      const direction = token.side === 'A' ? -1 : 1;
      const slot = getArmySlot(token);
      token.origX = direction * (8.5 + slot.depth * 0.6);
      token.origZ = slot.z;
      token.mesh.position.set(token.origX, getBattleTerrainHeight(token.origX, token.origZ), token.origZ);
      const frontDistance = token.formationRanged ? (token.cat === 'support' ? 7.6 : 5.2) : {
        armor: 0.82,
        air: 0.82,
        naval: 0.9,
        air_defense: 5.2,
        support: 7.6
      }[token.cat] || 2.5;
      token.frontX = direction * (frontDistance + slot.depth * 0.35);
      token.frontZ = slot.z;
      token.frontY = getBattleTerrainHeight(token.frontX, token.frontZ);
      token.march = {
        fromX: token.origX,
        fromY: token.mesh.position.y,
        fromZ: token.origZ,
        startedAt: now + (index % 5) * 45,
        duration: Math.round(1150 / Math.max(0.75, token.formationMobility)),
        started: false,
        finished: false
      };
      token.nextAmbientAttackAt = now + 820 + (index % 5) * 160 + (token.side === 'B' ? 260 : 0);
      token.nextAmbientMeleeAt = now + 780 + (index % 5) * 130 + (token.side === 'B' ? 190 : 0);
    });
    finalChargeActive = false;
    meleeActive = false;
    battleMotionActive = true;
    lastMarchSoundAt = now;
    lastMeleeSoundAt = now;
    updateOccupationZones();
  }

  function getArmySlot(token) {
    const formations = {
      line: [[2, -5.4], [0, -1.8], [5, 1.8], [1, 5.4], [7, 0]],
      wedge: [[2, -3.4], [0, 0], [5, 2.8], [2, 3.4], [7, -1.8]],
      square: [[1, -3.8], [1, 3.8], [5, -3.8], [3, 0], [5, 3.8]],
      staggered: [[2, -5.4], [4, -2.7], [6, 0], [8, 2.7], [10, 5.4]],
      wings: [[0, -6.2], [2, 0], [6, -3.2], [0, 6.2], [6, 3.2]],
      column: [[3, 0], [0, 0], [9, 0], [6, 0], [12, 0]],
      cone: [[2, -2.5], [0, 0], [5, 2.5], [3, 5], [7, -5]]
    };
    const index = ['air', 'armor', 'air_defense', 'naval', 'support'].indexOf(token.cat);
    const [depth, lane] = (formations[token.formationLayout] || formations.line)[Math.max(0, index)];
    const scale = currentBattleTerrain === 'forest' ? 0.72 : currentBattleTerrain === 'mountain' ? 0.58 : 1;
    return { depth, z: lane * scale };
  }

  function beginFinalCharge(duration = 1150, allOut = false) {
    const participants = [...unitsMap.values()].filter(token => token.alive);
    if (!isInitialized || battleSettled || !participants.length) return Promise.resolve(false);

    const epoch = battleEpoch;
    const startedAt = combatNow();
    const chargeDuration = isEnabled ? Math.max(0, Number(duration) || 0) : 0;
    const moves = participants.map(token => {
      const start = token.mesh.position.clone();
      const slot = getArmySlot(token);
      const ranged = !allOut && (['air_defense', 'support'].includes(token.cat) || token.formationRanged);
      const side = token.side === 'A' ? 1 : -1;
      const distance = ranged ? -(4.5 + slot.depth * 0.35) : 0.85 + slot.depth * 0.12;
      const flank = token.formationLayout === 'wings' || token.cat === 'naval' ? 0.65 : 0;
      const target = new THREE.Vector3(
        side * distance,
        0,
        slot.z + side * (0.32 + flank)
      );
      target.y = getBattleTerrainHeight(target.x, target.z);
      token.march = null;
      token.engagement = null;
      triggerSquadAnim(token, 'move', token.cat === 'air' ? 1.55 : 1.25);
      return { token, start, target, ranged, flank: ranged ? 0 : flank };
    });

    camFocusTarget.set(0, 0, 0);
    lastFocusAt = startedAt + chargeDuration;
    finalChargeActive = true;

    return new Promise(resolve => {
      function step(now) {
        now = combatNow();
        if (epoch !== battleEpoch || isAnimationPaused) {
          finalChargeActive = false;
          resolve(false);
          return;
        }
        const progress = chargeDuration === 0 ? 1 : Math.min(1, (now - startedAt) / chargeDuration);
        const eased = progress * progress * (3 - 2 * progress);
        moves.forEach(({ token, start, target, ranged, flank }, idx) => {
          if (!token.alive) return;
          token.mesh.position.lerpVectors(start, target, eased);
          token.mesh.position.z += Math.sin(progress * Math.PI) * flank * (token.side === 'A' ? 1 : -1);
          token.mesh.position.y = getBattleTerrainHeight(token.mesh.position.x, token.mesh.position.z);
          if (!ranged && chargeDuration > 0 && progress > 0.3 && progress < 0.85 && Math.random() < 0.08) {
            spawnDustPuff(token.mesh.position);
          }
          if (progress === 1) {
            token.frontX = target.x;
            token.frontY = target.y;
            token.frontZ = target.z;
            token.chargeCommitted = true;
            triggerSquadAnim(token, ranged ? 'idle' : 'attack', 1.3);
            if (!ranged && chargeDuration > 0 && idx % 2 === 0) {
              const clashPt = token.mesh.position.clone().add(new THREE.Vector3(token.side === 'A' ? 0.55 : -0.55, 0.78, 0));
              spawnSparkBurst(clashPt, 18, 0xfbbf24);
              spawnSlashArc(clashPt, token.side, 0xfde047, 1.35, true);
              spawnShockwaveRing(token.mesh.position, 0xf59e0b, 2.3, 420);
              spawnWarSmoke(clashPt, 2, 0x4b4238, 1.8, 0.36);
              triggerCameraShake(0.32);
            }
          }
        });
        if (progress < 1) requestAnimationFrame(step);
        else {
          finalChargeActive = false;
          meleeActive = true;
          resolve(true);
        }
      }
      if (chargeDuration === 0) step(startedAt);
      else requestAnimationFrame(step);
    });
  }

  function triggerSquadAnim(token, state, timeScale = 1.0) {
    if (!token || !token.unitAnims) return;
    token.figureState = state;
    if (state === 'attack') token.attackUntil = combatNow() + 1000 / Math.max(0.5, timeScale);
    token.unitAnims.forEach((ctrl) => ctrl.playState(state, timeScale));
  }

  function advanceBattalionToContact(token) {
    if (!token || !token.alive || token.engagement || token.formationRanged || token.cat === 'support' || token.cat === 'air_defense') return;
    const contactX = token.side === 'A' ? -0.68 : 0.68;
    const targetX = token.side === 'A'
      ? Math.max(token.mesh.position.x, contactX)
      : Math.min(token.mesh.position.x, contactX);
    const distance = Math.abs(targetX - token.mesh.position.x);
    if (distance < 0.08) return;

    token.engagement = {
      fromX: token.mesh.position.x,
      fromY: token.mesh.position.y,
      fromZ: token.mesh.position.z,
      targetX,
      targetY: getBattleTerrainHeight(targetX, token.mesh.position.z),
      targetZ: token.mesh.position.z,
      startedAt: combatNow(),
      duration: Math.min(950, Math.max(320, distance * 420 / Math.max(0.75, token.formationMobility))),
      lastDustAt: 0,
      finished: false
    };
    triggerSquadAnim(token, 'move', token.cat === 'air' ? 1.45 : 1.15);
  }

  function waitForCombatBeat(duration, epoch) {
    let remaining = duration;
    let previous = performance.now();
    return new Promise(resolve => {
      function step() {
        const now = performance.now();
        if (!audioPaused) remaining -= now - previous;
        previous = now;
        if ((!audioPaused && remaining <= 0) || epoch !== battleEpoch || battleSettled) resolve();
        else setTimeout(step, 20);
      }
      step();
    });
  }

  async function playVolley(lines, onImpact, tempo = 1, frameHp = {}) {
    if (!isInitialized || battleSettled) return;
    const epoch = battleEpoch;
    const latestHp = new Map();
    const deaths = new Map();
    const lanes = new Map();
    for (const [index, line] of lines.entries()) {
      if (!line.auid || line.kind === 'info') {
        await playEvent(line, { tempo });
        if (epoch !== battleEpoch || battleSettled) return;
        onImpact(line);
        continue;
      }
      if (!lanes.has(line.auid)) lanes.set(line.auid, []);
      lanes.get(line.auid).push({ line, index });
    }
    await Promise.all([...lanes.entries()].map(async ([uid, events]) => {
      for (const { line, index } of events) {
        await waitForCombatBeat(0, epoch);
        if (epoch !== battleEpoch || battleSettled) return;
        activeAttackers.add(uid);
        peakConcurrentAttackers = Math.max(peakConcurrentAttackers, activeAttackers.size);
        try {
          await playEvent(line, {
            deferDeath: true,
            tempo,
            commit: target => {
              const accepted = index > (latestHp.get(target.uid) ?? -1);
              if (accepted && line.hpAfter !== undefined) {
                latestHp.set(target.uid, index);
                updateTokenHp(target, Math.max(line.hpAfter, deaths.has(target.uid) ? 1 : 0), 1000 / Math.max(0.6, tempo));
              }
              if (line.kind === 'kill' || line.kind === 'capture') {
                deaths.set(target.uid, { token: target, captured: line.kind === 'capture' });
                updateTokenHp(target, 1, 1000 / Math.max(0.6, tempo));
              }
              if (accepted) onImpact(line);
            }
          });
          await waitForCombatBeat(120 / Math.max(0.6, tempo), epoch);
        } finally {
          if (epoch === battleEpoch) activeAttackers.delete(uid);
        }
      }
    }));
    if (epoch !== battleEpoch || battleSettled) return;
    // A formation completes its simultaneous return fire before its fatal wound is resolved.
    await Promise.all([...deaths.values()].map(({ token, captured }) => tokenFallDown(token, captured, false, 500)));
    if (epoch !== battleEpoch || battleSettled) return;
    for (const [uid, hp] of Object.entries(frameHp)) {
      const token = unitsMap.get(uid);
      if (token) updateTokenHp(token, hp);
    }
    completedVolleys++;
  }

  async function playEvent(ln, options = {}) {
    if (!isInitialized || battleSettled || !ln) return;

    const aToken = ln.auid ? unitsMap.get(ln.auid) : null;
    const tToken = ln.tuid ? unitsMap.get(ln.tuid) : null;
    if (!aToken && !tToken) return;

    // 1. 高費名將 ($4~$5) 戰法發動或斬將時觸發光榮風格橫幅 Cut-in (節流防刷屏)
    const nowMs = combatNow();
    if (!ln.finale && aToken && ln.skillActivation && nowMs - lastCutinAt > 6000) {
      lastCutinAt = nowMs;
      triggerWarlordCutin(aToken, ln.kind === 'kill');
    }

    // 2. 攝影機微聚焦於交鋒熱區
    if (aToken && tToken) {
      const midX = (aToken.mesh.position.x + tToken.mesh.position.x) * 0.14;
      const midZ = (aToken.mesh.position.z + tToken.mesh.position.z) * 0.14;
      camFocusTarget.set(midX, 0, midZ);
      lastFocusAt = nowMs;
      if (aToken.alive && tToken.alive) {
        if (aToken.cat !== 'air' && aToken.cat !== 'naval') advanceBattalionToContact(aToken);
        if (tToken.cat !== 'air' && tToken.cat !== 'naval') advanceBattalionToContact(tToken);
      }
    }

    let finishEffects, failEffects;
    const effectsFinished = new Promise((resolve, reject) => {
      finishEffects = resolve;
      failEffects = reject;
    });
    let deferTargetEffects = false;

    // 3. 依五大兵種執行全 3D 模型骨骼動畫與彈道特效
    const ranged = aToken && (['air_defense', 'support'].includes(aToken.cat) || aToken.formationRanged);
    if (aToken) {
      const sound = ranged ? 'arrow_volley' : aToken.cat === 'air' ? 'cavalry_hooves'
        : ln.kind === 'miss' ? null : ln.sfxOverride || 'blade_clash';
      if (sound && ln.kind !== 'info') playFieldSound(sound, aToken, 0.45);
    }
    const forcedMelee = ranged && tToken && aToken.mesh.position.distanceTo(tToken.mesh.position) < 2;
    if ((ln.finale || (meleeActive && (!ranged || forcedMelee))) && aToken && tToken && aToken.alive) {
      await approachMeleeTarget(aToken, tToken);
      if (aToken.epoch !== battleEpoch || battleSettled) { finishEffects(); return effectsFinished; }
      aToken.formationRig.rotation.y = Math.atan2(
        tToken.mesh.position.x - aToken.mesh.position.x,
        tToken.mesh.position.z - aToken.mesh.position.z
      );
      triggerSquadAnim(aToken, 'attack', 1.35);
      if (tToken.alive && ln.kind !== 'miss') triggerSquadAnim(tToken, 'hit', 1.25);
      const midpoint = aToken.mesh.position.clone().lerp(tToken.mesh.position, 0.5);
      if (ln.kind !== 'miss') {
        const hitPos = midpoint.clone().add(new THREE.Vector3(0, 0.88, 0));
        spawnSparkBurst(hitPos, 18, 0xfbbf24);
        spawnSlashArc(hitPos, aToken.side, aToken.side === 'A' ? 0x60a5fa : 0xfbbf24, ln.kind === 'kill' ? 1.45 : 1.05, ln.kind === 'kill');
        if (ln.kind === 'kill' || ln.kind === 'capture') {
          spawnShockwaveRing(tToken.mesh.position, 0xf59e0b, 2.2, 380);
          spawnWarSmoke(hitPos, 2, 0x453d34, 1.7, 0.38);
          triggerCameraShake(0.30);
          triggerHitStop(75);
        } else {
          triggerCameraShake(0.14);
        }
        applyImpactReaction(tToken, 0.3);
      }
    } else if (aToken?.formationRanged && aToken.cat !== 'support' && tToken && aToken.alive) {
      triggerSquadAnim(aToken, 'attack', 1.15);
      spawn3DArrowVolley(aToken.mesh.position, tToken.mesh.position, aToken.side, ln.kind === 'miss');
      await waitForCombatBeat(options.continuous ? 340 : 450, aToken.epoch);
    } else if (ln.duel && aToken && tToken && aToken.alive && tToken.alive) {
      performDuelClash(aToken, tToken);
    } else if (aToken && tToken && aToken.alive) {
      if (aToken.cat === 'air') {
        deferTargetEffects = performCavalryCharge(aToken, tToken, playTargetEffects, ln.kind === 'miss');
      } else if (aToken.cat === 'air_defense' || (ln.text && ln.text.includes('箭'))) {
        triggerSquadAnim(aToken, 'attack', 1.25);
        spawn3DArrowVolley(aToken.mesh.position, tToken.mesh.position, aToken.side, ln.kind === 'miss');
        await waitForCombatBeat(options.continuous ? 340 : 450, aToken.epoch);
      } else if (aToken.cat === 'naval') {
        deferTargetEffects = performVanguardAssault(aToken, tToken, playTargetEffects, ln.kind === 'miss');
      } else if (aToken.cat === 'support') {
        if (ln.kind !== 'miss') performStrategistFormation(aToken, tToken, ln.text || '');
        else triggerSquadAnim(aToken, 'attack', 1.15);
      } else {
        performPhalanxClash(aToken, tToken, ln.kind === 'miss');
      }
    }

    // 4. 受擊反應、盾牆格擋與 3D 浮動兵損數字
    if (!deferTargetEffects) playTargetEffects();
    return effectsFinished;

    async function playTargetEffects() {
      if (!tToken || battleSettled || tToken.epoch !== battleEpoch) {
        finishEffects();
        return;
      }
      try {
        if (ln.kind === 'miss') {
          spawnFloatingDamagePopup(tToken.mesh.position, 'MISS', '#d6dbe2', false);
        } else if (ln.kind === 'block') {
          performShieldBlockDome(tToken);
          spawnFloatingDamagePopup(tToken.mesh.position, '🛡️ 鐵壁格擋', '#fbbf24', false);
        } else if (ln.dmg && ln.dmg > 0) {
          if (!ln.duel) triggerSquadAnim(tToken, 'hit', 1.2);
          const lostTroops = Math.max(100, Math.round(ln.dmg * 100)).toLocaleString();
          const isKill = ln.kind === 'kill' || ln.kind === 'capture';
          const isCaptured = ln.kind === 'capture';
          spawnFloatingDamagePopup(
            tToken.mesh.position,
            isCaptured ? `🪢 被俘 -${lostTroops}` : isKill ? `💥 擊破 -${lostTroops}` : `-${lostTroops}`,
            isKill ? '#fb7185' : '#f87171',
            isKill
          );
        }
        if (options.commit) {
          options.commit(tToken);
        } else if (ln.hpAfter !== undefined) {
          updateTokenHp(tToken, ln.hpAfter, 850 / Math.max(0.6, options.tempo || 1));
        }
        if (ln.dmg > 0 && ln.kind !== 'miss' && ln.kind !== 'block') {
          const epoch = battleEpoch;
          const tempoScale = Math.max(0.6, options.tempo || 1);
          for (let beat = 0; beat < 2; beat++) {
            await waitForCombatBeat(140 / tempoScale, epoch);
            if (epoch !== battleEpoch || battleSettled) { finishEffects(); return; }
            if (aToken?.alive) {
              triggerSquadAnim(aToken, 'attack', 1.2);
              if (ranged) spawn3DArrowVolley(aToken.mesh.position, tToken.mesh.position, aToken.side, false, 8);
              else {
                const flurryPt = tToken.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.75, (Math.random() - 0.5) * 0.4));
                spawnSparkBurst(flurryPt, 12, 0xfbbf24);
                spawnSlashArc(flurryPt, aToken.side, 0xfef08a, 0.95, false);
                applyImpactReaction(tToken, 0.08);
              }
            }
          }
        }
        if (!options.deferDeath && (ln.kind === 'kill' || ln.kind === 'capture')) {
          tokenFallDown(tToken, ln.kind === 'capture').then(finishEffects, failEffects);
        } else finishEffects();
      } catch (error) {
        failEffects(error);
      }
    }
  }

  function approachMeleeTarget(attacker, target) {
    const start = attacker.mesh.position.clone();
    const delta = start.clone().sub(target.mesh.position);
    if (delta.length() < 1.15) return Promise.resolve();
    const end = target.mesh.position.clone().add(delta.normalize().multiplyScalar(0.95));
    end.y = getBattleTerrainHeight(end.x, end.z);
    attacker.march = null;
    attacker.engagement = null;
    triggerSquadAnim(attacker, 'move', attacker.cat === 'air' ? 1.45 : 1.2);
    const startedAt = combatNow();
    const duration = isEnabled ? 380 / Math.max(0.75, attacker.formationMobility) : 0;
    return new Promise(resolve => {
      function step(now) {
        now = combatNow();
        if (attacker.epoch !== battleEpoch || battleSettled || !attacker.alive) { resolve(); return; }
        const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
        const eased = progress * progress * (3 - 2 * progress);
        attacker.mesh.position.lerpVectors(start, end, eased);
        if (attacker.formationLayout === 'wings' || attacker.cat === 'naval') {
          attacker.mesh.position.z += Math.sin(progress * Math.PI) * (attacker.side === 'A' ? 0.8 : -0.8);
        }
        if (progress < 1) requestAnimationFrame(step);
        else {
          attacker.frontX = end.x;
          attacker.frontY = end.y;
          attacker.frontZ = end.z;
          resolve();
        }
      }
      step(startedAt);
    });
  }

  function performDuelClash(aToken, tToken) {
    triggerSquadAnim(aToken, 'attack', 1.35);
    triggerSquadAnim(tToken, 'attack', 1.2);
    const midpoint = aToken.mesh.position.clone().lerp(tToken.mesh.position, 0.5);
    const hitPos = midpoint.clone().add(new THREE.Vector3(0, 0.9, 0));
    spawnSparkBurst(hitPos, 20, 0xfef08a);
    spawnSlashArc(hitPos, aToken.side, 0xfbbf24, 1.45, true);
    spawnSlashArc(hitPos, tToken.side, 0x38bdf8, 1.25, false);
    spawnShockwaveRing(midpoint, 0xfbbf24, 2.5, 420);
    triggerCameraShake(0.34);
    triggerHitStop(85);
    applyImpactReaction(tToken, 0.14);
  }

  function applyImpactReaction(token, distance = 0.16) {
    if (!token || !token.alive) return;
    token.impact = {
      startedAt: combatNow(),
      duration: 300,
      distance
    };
  }

  /* 奔雷突騎：戰馬切換 Gallop 奔馳動畫衝向敵陣，騎將揮槊斬擊 */
  function performCavalryCharge(aToken, tToken, onImpact, miss = false) {
    if (aToken.chargeInProgress) {
      aToken.chargeImpactCallbacks.push(onImpact);
      return true;
    }
    const orig = aToken.mesh.position.clone();
    const target = tToken.mesh.position.clone();
    const dir = target.clone().sub(orig).normalize();
    const impactPos = orig.clone().add(dir.multiplyScalar(Math.max(0, orig.distanceTo(target) - 0.82)));
    impactPos.y = getBattleTerrainHeight(impactPos.x, impactPos.z);

    if (aToken.chargeCommitted) {
      triggerSquadAnim(aToken, 'attack', 1.25);
      if (!miss) {
        const hitPos = target.clone().add(new THREE.Vector3(0, 0.85, 0));
        spawnSparkBurst(hitPos, 16, 0xfbbf24);
        spawnSlashArc(hitPos, aToken.side, 0xfde047, 1.25, true);
        triggerCameraShake(0.22);
        applyImpactReaction(tToken, 0.14);
      }
      return;
    }

    aToken.chargeInProgress = true;
    aToken.chargeImpactCallbacks.push(onImpact);
    aToken.march = null;
    aToken.engagement = null;
    triggerSquadAnim(aToken, 'move', 1.45);
    const startedAt = combatNow();
    const duration = 420;

    function step(now) {
      now = combatNow();
      if (aToken.epoch !== battleEpoch || battleSettled) {
        aToken.chargeInProgress = false;
        aToken.chargeImpactCallbacks.splice(0).forEach(callback => callback());
        return;
      }
      if (!aToken.alive) {
        aToken.chargeInProgress = false;
        aToken.chargeImpactCallbacks.splice(0).forEach((callback) => callback());
        return;
      }
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress * progress * (3 - 2 * progress);
      aToken.mesh.position.lerpVectors(orig, impactPos, eased);
      if (progress < 0.88 && Math.floor(progress * 12) !== Math.floor(Math.max(0, progress - 0.04) * 12)) {
        spawnDustPuff(aToken.mesh.position);
      }
      if (progress >= 1) {
        aToken.chargeCommitted = true;
        aToken.chargeInProgress = false;
        aToken.frontX = impactPos.x;
        aToken.frontZ = impactPos.z;
        aToken.frontY = impactPos.y;
        triggerSquadAnim(aToken, 'attack', 1.4);
        if (!miss) {
          const hitPos = target.clone().add(new THREE.Vector3(0, 0.88, 0));
          spawnSparkBurst(hitPos, 20, 0xfbbf24);
          spawnSlashArc(hitPos, aToken.side, 0xfef08a, 1.5, true);
          spawnShockwaveRing(target, 0xf59e0b, 2.7, 440);
          spawnWarSmoke(target, 2, 0x4d4338, 1.9, 0.38);
          triggerCameraShake(0.36);
          triggerHitStop(75);
          playFieldSound('blade_clash', tToken, 0.85);
          applyImpactReaction(tToken, 0.24);
        }
        if (tToken && tToken.alive) {
          spawnDustPuff(tToken.mesh.position);
        }
        aToken.chargeImpactCallbacks.splice(0).forEach((callback) => callback());
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    return true;
  }

  /* 神射強弩：單批 InstancedMesh 16 支曳光火矢拋射 (只需 1 個 Draw Call!) */
  const _arrowObj = new THREE.Object3D();
  function spawn3DArrowVolley(fromPos, toPos, side, miss = false, volleySize = 16) {
    if (!scene || battleSettled || volleySize <= 0) return;
    const geo = new THREE.CylinderGeometry(0.014, 0.040, 0.96, 5);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: side === 'A' ? 0xbae6fd : 0xfde047
    });
    const instMesh = new THREE.InstancedMesh(geo, mat, volleySize);
    instMesh.frustumCulled = false;
    instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const nowMs = combatNow();
    const items = [];
    for (let i = 0; i < volleySize; i++) {
      const sx = (Math.random() - 0.5) * 1.75;
      const sz = (Math.random() - 0.5) * 1.75;
      const start = fromPos.clone().add(new THREE.Vector3(sx, 1.20, sz));
      const end = toPos.clone().add(new THREE.Vector3(sx * 0.72, 0.36, sz * 0.72));
      if (miss) end.z += side === 'A' ? 2 : -2;
      _arrowObj.position.copy(start);
      _arrowObj.scale.setScalar(0);
      _arrowObj.updateMatrix();
      instMesh.setMatrixAt(i, _arrowObj.matrix);
      items.push({
        start,
        end,
        startedAt: nowMs + Math.floor(i / 4) * 85 + (i % 4) * 12,
        duration: 440,
        miss,
        arcHeight: Math.min(3.5, fromPos.distanceTo(toPos) * 0.16) + Math.random() * 0.35,
        stickChance: (i % 5 === 0),
        done: false
      });
    }
    instMesh.instanceMatrix.needsUpdate = true;
    scene.add(instMesh);
    projectiles.push({ isVolleyBatch: true, mesh: instMesh, items, side });
  }

  function spawnStrategistBolt(token, target) {
    const start = token.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    const end = target.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0));
    const boltGroup = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshBasicMaterial({ color: token.side === 'A' ? 0x67e8f9 : 0xfb923c })
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 10, 8),
      new THREE.MeshBasicMaterial({
        color: token.side === 'A' ? 0x38bdf8 : 0xef4444,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      })
    );
    boltGroup.add(core, halo);
    boltGroup.position.copy(start);
    scene.add(boltGroup);
    projectiles.push({
      mesh: boltGroup,
      disposableChildren: [core, halo],
      start,
      end,
      startedAt: combatNow(),
      duration: 600,
      arcHeight: 1.5,
      miss: false,
      isGLB: false,
      isComposite: true,
      impactColor: token.side === 'A' ? 0x67e8f9 : 0xf97316,
      impactCount: 14,
      triggerShockwave: true
    });
    ambientSpellcasts++;
  }

  /* 先登奇兵：高速疾行騰躍突襲 */
  function performVanguardAssault(aToken, tToken, onImpact, miss = false) {
    const orig = aToken.mesh.position.clone();
    const target = tToken.mesh.position.clone();
    const direction = target.clone().sub(orig).normalize();
    const strikePos = orig.clone().add(direction.multiplyScalar(Math.max(0, orig.distanceTo(target) - 0.78)));
    strikePos.y = getBattleTerrainHeight(strikePos.x, strikePos.z);
    if (aToken.chargeCommitted) {
      triggerSquadAnim(aToken, 'attack', 1.3);
      if (!miss) {
        const hitPos = tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.85, 0));
        spawnSparkBurst(hitPos, 14, 0x2dd4bf);
        spawnSlashArc(hitPos, aToken.side, 0x5eead4, 1.2, true);
      }
      return;
    }

    triggerSquadAnim(aToken, 'move', 1.5);
    aToken.march = null;
    aToken.engagement = null;
    const startedAt = combatNow();
    function step(now) {
      now = combatNow();
      if (aToken.epoch !== battleEpoch || battleSettled || !aToken.alive) { onImpact(); return; }
      const progress = Math.min(1, (now - startedAt) / 650);
      aToken.mesh.position.lerpVectors(orig, strikePos, progress);
      aToken.mesh.position.y = getBattleTerrainHeight(aToken.mesh.position.x, aToken.mesh.position.z);
      if (progress === 1) {
        aToken.chargeCommitted = true;
        aToken.frontX = strikePos.x;
        aToken.frontZ = strikePos.z;
        aToken.frontY = strikePos.y;
        triggerSquadAnim(aToken, 'attack', 1.4);
        if (!miss) {
          const hitPos = tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.85, 0));
          spawnSparkBurst(hitPos, 18, 0x2dd4bf);
          spawnSlashArc(hitPos, aToken.side, 0x5eead4, 1.35, true);
          spawnShockwaveRing(tToken.mesh.position, 0x2dd4bf, 2.2, 380);
          triggerCameraShake(0.24);
          applyImpactReaction(tToken, 0.16);
        }
        onImpact();
      }
      if (progress < 1) requestAnimationFrame(step);
      else aToken.mesh.position.set(strikePos.x, strikePos.y, strikePos.z);
    }
    step(startedAt);
    return true;
  }

  /* 重甲陷陣：步兵方陣推進短兵相接 */
  function performPhalanxClash(aToken, tToken, miss = false) {
    triggerSquadAnim(aToken, 'attack', 1.25);
    if (!miss) {
      const hitPos = tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.78, 0));
      spawnSparkBurst(hitPos, 16, 0xfde047);
      spawnSlashArc(hitPos, aToken.side, 0xfbbf24, 1.1, false);
      spawnWarSmoke(hitPos, 1, 0x4b4238, 1.5, 0.30);
      triggerCameraShake(0.14);
      applyImpactReaction(tToken, 0.10);
    }
  }

  /* 運籌帷幄：軍師陣法八卦印、火計焦土或轟雷戰法 */
  function performStrategistFormation(aToken, tToken, logText) {
    triggerSquadAnim(aToken, 'attack', 1.25);
    const isFire = logText.includes('火') || logText.includes('砲') || logText.includes('焚') || logText.includes('焰');
    const isStorm = logText.includes('雷') || logText.includes('風') || logText.includes('天');
    const tgtPos = tToken.mesh.position.clone();

    // 地面旋轉八卦金陣特效
    const ringGeo = new THREE.PlaneGeometry(2.6, 2.6);
    const ringMat = new THREE.MeshBasicMaterial({
      map: getBaguaTexture(isFire ? '#f97316' : '#fbbf24'),
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const baguaMesh = new THREE.Mesh(ringGeo, ringMat);
    baguaMesh.rotation.x = -Math.PI / 2;
    baguaMesh.position.set(tgtPos.x, tgtPos.y + 0.08, tgtPos.z);
    scene.add(baguaMesh);
    shockwaves.push({
      mesh: baguaMesh,
      startedAt: combatNow(),
      duration: 820,
      startScale: 0.45,
      endScale: 1.28,
      opacity: 0.88,
      spinRate: 1.8
    });

    spawnWarSmoke(tgtPos, 2, isFire ? 0x3b2618 : 0x4b453d, 2.1, 0.42);
    spawnShockwaveRing(tgtPos, isFire ? 0xf97316 : (isStorm ? 0x38bdf8 : 0xfbbf24), 2.8, 480);
    playFieldSound(isFire ? 'fire_attack' : 'strategy_gong', aToken, 0.72);

    if (isFire) {
      spawnSparkBurst(tgtPos.clone().add(new THREE.Vector3(0, 0.75, 0)), 18, 0xf97316);
      spawnBattleScar(tgtPos, 1.35, true);
      triggerCameraShake(0.32);
      triggerHitStop(70);
    } else {
      // 天雷光柱驟降
      const beamGeo = new THREE.CylinderGeometry(0.14, 0.42, 7.5, 8);
      const beamMat = new THREE.MeshBasicMaterial({
        color: isStorm ? 0x7dd3fc : 0xfef08a,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(tgtPos.x, tgtPos.y + 3.6, tgtPos.z);
      scene.add(beam);
      particleSystems.push({
        mesh: beam,
        vx: 0, vy: 0, vz: 0,
        startedAt: combatNow(),
        duration: 280,
        opacity: 0.85,
        gravity: 0
      });
      spawnSparkBurst(tgtPos.clone().add(new THREE.Vector3(0, 0.85, 0)), 14, isStorm ? 0x38bdf8 : 0xfde047);
      triggerCameraShake(0.26);
    }
  }

  function performShieldBlockDome(tToken) {
    triggerSquadAnim(tToken, 'hit', 1.1);
    const center = tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.55, 0));
    spawnSparkBurst(center, 12, 0xfbbf24);
    const domeGeo = new THREE.SphereGeometry(0.92, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.45,
      wireframe: true,
      depthWrite: false
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(tToken.mesh.position.x, tToken.mesh.position.y + 0.05, tToken.mesh.position.z);
    scene.add(dome);
    particleSystems.push({
      mesh: dome,
      vx: 0, vy: 0, vz: 0,
      startedAt: combatNow(),
      duration: 360,
      opacity: 0.45,
      gravity: 0,
      scaleGrowth: 0.015
    });
    applyImpactReaction(tToken, 0.08);
  }

  function updateTokenHp(token, newHp, duration = 1200) {
    const previousHp = token.visualHp ?? token.currentHp;
    token.currentHp = Math.max(0, newHp);
    token.hpTransition = { from: previousHp, to: token.currentHp, startedAt: combatNow(), duration };
    if (token.currentHp >= previousHp) token.visualHp = token.currentHp;
    if (token.hud && token.hud.redraw) {
      token.hud.redraw(token.currentHp);
      token.hud.tex.needsUpdate = true;
    }
  }

  function tokenFallDown(token, captured = false, immediate = false, durationMs = 560) {
    if (!token.alive) {
      if (immediate) applyFallenPose(token, 1);
      return token.deathAnimation || Promise.resolve();
    }
    token.alive = false;
    token.march = null;
    token.engagement = null;
    token.impact = null;
    updateOccupationZones();
    updateTokenHp(token, 0);
    triggerSquadAnim(token, 'death', 1.0);
    if (!immediate) {
      spawnWarSmoke(token.mesh.position, 2, 0x3b322b, 2.0, 0.45);
      spawnShockwaveRing(token.mesh.position, 0xef4444, 2.2, 420);
      spawnBattleScar(token.mesh.position, 1.15, false);
      triggerCameraShake(0.38);
      triggerHitStop(80);
      playFieldSound('warlord_fall', token, 0.85);
      triggerImpactVignette('rgba(220, 38, 38, 0.34)');
    } else {
      spawnDustPuff(token.mesh.position);
    }
    const startedAt = combatNow();
    const collapseDuration = Math.max(220, Number(durationMs) || 560);
    token.deathAnimation = new Promise(resolve => {
      function fall(now) {
        now = combatNow();
        if (token.epoch !== battleEpoch) { resolve(); return; }
        const progress = immediate || token.fallen ? 1 : Math.min(1, (now - startedAt) / collapseDuration);
        applyFallenPose(token, progress);
        if (progress < 1) requestAnimationFrame(fall);
        else {
          token.fallen = true;
          if (renderer && !isAnimationPaused && !immediate) renderer.render(scene, camera);
          resolve();
        }
      }
      fall(startedAt);
    });
    return token.deathAnimation;
  }

  function applyFallenPose(token, progress) {
    token.formationRig.position.y = 0;
    const ranks = token.troopsContainer.children.find(child => child.userData.isBattalionRanks);
    if (ranks) {
      ranks.rotation.x = 0;
      ranks.position.y = 0;
      BattleFigures.fall(ranks, token, progress, getBattleTerrainHeight);
    }
    if (token.commanderHero && typeof BattleFigures !== 'undefined' && typeof BattleFigures.fallCommander === 'function') {
      BattleFigures.fallCommander(token.commanderHero, progress);
    }
    if (token.banners && token.banners.length) {
      token.banners.forEach((b, idx) => {
        b.root.rotation.z = progress * (0.68 * (idx % 2 === 0 ? 1 : -1));
      });
    }
    if (token.heroAura && token.heroAura.material) {
      token.heroAura.material.opacity = Math.max(0, 0.36 * (1 - progress));
      if (progress >= 1) token.heroAura.visible = false;
    }
    token.troopsContainer.children.forEach(troop => {
      if (troop.userData.isFormationTroop) troop.rotation.z = progress * Math.PI / 2;
    });
    if (token.hud?.sprite?.material) token.hud.sprite.material.opacity = 1 - progress * 0.45;
    token.fallen = progress === 1;
  }

  function syncBattleResult(res) {
    battleSettled = true;
    battleMotionActive = false;
    unitsMap.forEach(token => { token.formationRig.rotation.x = 0; });
    activeAttackers.clear();
    window.SoundEngine?.stopSpatial?.();
    for (const unit of [...res.final.A, ...res.final.B]) {
      const token = unitsMap.get(unit.uid);
      if (!token) continue;
      updateTokenHp(token, unit.hp);
      if (!unit.alive) tokenFallDown(token, unit.captured, true);
    }
    clearBattleEffects();
    if (renderer) renderer.render(scene, camera);
  }

  /* ----------------------------------------------------
     6. 光榮《三國志》名將戰法 Cut-in 橫幅特寫
     ---------------------------------------------------- */
  function injectCutinLayer() {
    if (!container) return;
    if (!container.querySelector('#battleImpactVignette')) {
      const vig = document.createElement('div');
      vig.id = 'battleImpactVignette';
      vig.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:26;opacity:0;transition:opacity 0.16s ease-out;';
      container.appendChild(vig);
    }
    if (container.querySelector('#warlordCutinBanner')) return;
    const div = document.createElement('div');
    div.id = 'warlordCutinBanner';
    div.style.cssText = [
      'position:absolute;top:14px;left:50%;transform:translateX(-50%) skewX(-12deg) scale(0.9);',
      'z-index:30;display:flex;align-items:center;gap:14px;padding:8px 34px 8px 16px;',
      'background:linear-gradient(100deg, rgba(15,23,42,0.94) 0%, rgba(30,24,18,0.92) 72%, rgba(217,119,6,0.28) 100%);',
      'border:1.5px solid #fbbf24;border-left:5px solid #fbbf24;border-radius:3px;',
      'clip-path:polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%);',
      'box-shadow:0 8px 28px rgba(0,0,0,0.68), inset 0 0 18px rgba(251,191,36,0.18);',
      'color:#fef3c7;pointer-events:none;opacity:0;transition:all 0.22s cubic-bezier(0.16,1,0.3,1);'
    ].join('');
    container.appendChild(div);
  }

  function triggerImpactVignette(colorRgba = 'rgba(245, 158, 11, 0.28)') {
    const vig = container ? container.querySelector('#battleImpactVignette') : null;
    if (!vig) return;
    vig.style.boxShadow = `inset 0 0 85px 18px ${colorRgba}`;
    vig.style.opacity = '1';
    setTimeout(() => { vig.style.opacity = '0'; }, 180);
  }

  function triggerWarlordCutin(token, isKill = false) {
    const el = container ? container.querySelector('#warlordCutinBanner') : null;
    if (!el) return;
    const meta = CAT_META[token.cat] || CAT_META.armor;
    const actionLabel = isKill ? '一騎討・陣斬敵將！' : `${token.wep || meta.label}・無雙奧義！`;
    const borderCol = token.side === 'A' ? '#38bdf8' : '#f87171';
    const accentGlow = token.side === 'A' ? 'rgba(56,189,248,0.32)' : 'rgba(239,68,68,0.32)';

    el.style.borderColor = '#fbbf24';
    el.style.borderLeftColor = borderCol;
    el.style.background = `linear-gradient(100deg, rgba(10,16,28,0.95) 0%, rgba(28,20,16,0.92) 68%, ${accentGlow} 100%)`;
    el.innerHTML = `
      <img src="${PORTRAIT_DIR}${token.id}.jpg?v=${ASSET_VER}"
           style="width:68px;height:68px;border-radius:50%;object-fit:cover;object-position:center 15%;border:3px solid #fbbf24;box-shadow:0 0 14px ${accentGlow};transform:skewX(12deg);flex-shrink:0;"
           onerror="this.style.display='none'">
      <div style="line-height:1.25;transform:skewX(12deg);">
        <div style="font-size:11px;color:#fbbf24;font-weight:900;letter-spacing:2px;text-shadow:0 1px 4px #000;">
          ${token.side === 'A' ? '【我軍主將震威】' : '【敵軍猛將強襲】'} · ${meta.label}
        </div>
        <div style="font-size:21px;font-weight:900;font-family:'Noto Serif TC',serif;color:#fff7e6;margin-top:2px;text-shadow:0 2px 6px #000;">
          ${token.name} <span style="font-size:14px;color:${borderCol};font-weight:800;margin-left:8px;">${actionLabel}</span>
        </div>
      </div>
    `;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) skewX(-12deg) scale(1)';
    triggerImpactVignette(accentGlow);

    if (cutinTimeout) clearTimeout(cutinTimeout);
    cutinTimeout = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) skewX(-12deg) scale(0.9)';
    }, 1250);
  }

  /* ----------------------------------------------------
     7. 粒子火花、塵土、震屏與相機控制
     ---------------------------------------------------- */
  function triggerCameraShake(power = 0.25) {
    if (battleSettled) return;
    shakePower = Math.min(0.65, Math.max(shakePower, power));
    camZoomTarget = Math.max(-1.6, camZoomTarget - power * 0.95);
  }

  function triggerHitStop(ms = 75) {
    if (battleSettled) return;
    hitStopUntil = Math.max(hitStopUntil, combatNow() + ms);
  }

  function getBaguaTexture(colorHex = '#fbbf24') {
    const key = colorHex;
    if (baguaTexture && baguaTexture._key === key) return baguaTexture;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(128, 128, 114, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(128, 128, 92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(128, 128, 46, 0, Math.PI * 2);
    ctx.stroke();
    // 八卦八邊星陣幾何紋
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const x1 = 128 + Math.cos(ang) * 48;
      const y1 = 128 + Math.sin(ang) * 48;
      const x2 = 128 + Math.cos(ang) * 112;
      const y2 = 128 + Math.sin(ang) * 112;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex._key = key;
    if (baguaTexture && baguaTexture.dispose) baguaTexture.dispose();
    baguaTexture = tex;
    return tex;
  }

  let scarBurnTex = null;
  let scarMudTex = null;
  function getScarTexture(isBurn = false) {
    if (isBurn && scarBurnTex) return scarBurnTex;
    if (!isBurn && scarMudTex) return scarMudTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
    if (isBurn) {
      g.addColorStop(0, 'rgba(18, 12, 8, 0.85)');
      g.addColorStop(0.45, 'rgba(72, 32, 14, 0.58)');
      g.addColorStop(1, 'rgba(18, 12, 8, 0)');
    } else {
      g.addColorStop(0, 'rgba(28, 22, 16, 0.65)');
      g.addColorStop(0.6, 'rgba(46, 36, 26, 0.35)');
      g.addColorStop(1, 'rgba(46, 36, 26, 0)');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    if (isBurn) scarBurnTex = tex;
    else scarMudTex = tex;
    return tex;
  }

  function spawnSlashArc(pos, side, colorHex = 0xfef08a, scale = 1.0, heavy = false) {
    if (!scene || battleSettled || slashArcs.length > 28) return;
    const count = heavy ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const arcGeo = new THREE.RingGeometry(0.42 * scale, (heavy ? 0.96 : 0.78) * scale, 14, 1, -0.95, 1.9);
      const arcMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? colorHex : 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        depthWrite: false
      });
      const arcMesh = new THREE.Mesh(arcGeo, arcMat);
      arcMesh.position.copy(pos);
      arcMesh.rotation.y = (side === 'A' ? 0.35 : -0.35) + (Math.random() - 0.5) * 0.55;
      arcMesh.rotation.x = (Math.random() - 0.5) * 0.85;
      arcMesh.rotation.z = (i === 0 ? 0.65 : -0.75) + (Math.random() - 0.5) * 0.4;
      scene.add(arcMesh);
      slashArcs.push({
        mesh: arcMesh,
        startedAt: combatNow(),
        duration: heavy ? 250 : 190,
        spin: (side === 'A' ? 1 : -1) * (heavy ? 4.8 : 3.8),
        baseOpacity: 0.92
      });
    }
  }

  function spawnShockwaveRing(pos, colorHex = 0xf59e0b, maxRadius = 2.4, duration = 400) {
    if (!scene || battleSettled || shockwaves.length > 24) return;
    const ringGeo = new THREE.RingGeometry(0.24, 0.48, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, getBattleTerrainHeight(pos.x, pos.z) + 0.08, pos.z);
    scene.add(ring);
    shockwaves.push({
      mesh: ring,
      startedAt: combatNow(),
      duration,
      startScale: 0.45,
      endScale: maxRadius * 2.1,
      opacity: 0.85,
      spinRate: 0
    });
  }

  function ensureDustTexture() {
    if (dustTexture) return dustTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    gradient.addColorStop(0, 'rgba(255,255,255,0.75)');
    gradient.addColorStop(0.55, 'rgba(220,210,196,0.35)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    dustTexture = new THREE.CanvasTexture(canvas);
    return dustTexture;
  }

  function spawnWarSmoke(pos, count = 1, tint = 0x52483e, scale = 1.65, opacity = 0.36) {
    if (!scene || battleSettled) return;
    const tex = ensureDustTexture();
    for (let i = 0; i < count; i++) {
      if (particleSystems.length >= 200) break;
      const mat = new THREE.SpriteMaterial({ map: tex, color: tint, transparent: true, opacity, depthWrite: false });
      const m = new THREE.Sprite(mat);
      m.scale.set(scale * 0.72, scale * 0.55, 1);
      m.position.set(
        pos.x + (Math.random() - 0.5) * 0.9,
        Math.max(getBattleTerrainHeight(pos.x, pos.z) + 0.32, pos.y + 0.25),
        pos.z + (Math.random() - 0.5) * 0.9
      );
      scene.add(m);
      particleSystems.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 0.022 + 0.008,
        vy: 0.024 + Math.random() * 0.015,
        vz: (Math.random() - 0.5) * 0.022,
        startedAt: combatNow(),
        duration: 1350 + Math.random() * 550,
        opacity,
        gravity: -0.0002,
        scaleGrowth: 0.036
      });
    }
  }

  function spawnBattleScar(pos, radius = 1.05, isBurn = false) {
    if (!scene || battleSettled) return;
    if (battleScars.length >= 16) {
      const oldest = battleScars.shift();
      scene.remove(oldest);
      oldest.geometry.dispose();
      oldest.material.dispose();
    }
    const geo = new THREE.CircleGeometry(radius, 12);
    const mat = new THREE.MeshBasicMaterial({
      map: getScarTexture(isBurn),
      transparent: true,
      opacity: isBurn ? 0.85 : 0.65,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI * 2;
    mesh.position.set(pos.x, getBattleTerrainHeight(pos.x, pos.z) + 0.03, pos.z);
    scene.add(mesh);
    battleScars.push(mesh);
  }

  function spawnSparkBurst(pos, count = 14, colorHex = 0xfbbf24) {
    if (!scene || battleSettled) return;
    const sparkColor = new THREE.Color(colorHex);

    // 中心瞬間爆發閃光點 (1 draw call)
    if (particleSystems.length < 180) {
      const flashMat = new THREE.SpriteMaterial({
        map: ensureDustTexture(),
        color: colorHex,
        transparent: true,
        opacity: 0.86,
        depthWrite: false
      });
      const flash = new THREE.Sprite(flashMat);
      flash.scale.set(0.95, 0.95, 1);
      flash.position.copy(pos);
      scene.add(flash);
      particleSystems.push({
        mesh: flash,
        vx: 0, vy: 0.005, vz: 0,
        startedAt: combatNow(),
        duration: 165,
        opacity: 0.86,
        gravity: 0,
        scaleGrowth: 0.09
      });
    }

    // 單一 Points 粒子群噴濺 22 顆璀璨火星 (只需 1 個 Draw Call!)
    if (particleSystems.length >= 190) return;
    const n = Math.min(26, Math.max(10, count));
    const arr = new Float32Array(n * 3);
    const cols = new Float32Array(n * 3);
    const vels = new Float32Array(n * 3);
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = pos.x + (Math.random() - 0.5) * 0.14;
      arr[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.14;
      arr[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.14;
      vels[i * 3] = (Math.random() - 0.5) * 0.32;
      vels[i * 3 + 1] = Math.random() * 0.25 + 0.06;
      vels[i * 3 + 2] = (Math.random() - 0.5) * 0.32;
      const c = i % 3 === 0 ? white : sparkColor;
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    particleSystems.push({
      mesh: pts,
      isSparkCloud: true,
      vels,
      vx: 0, vy: 0, vz: 0,
      startedAt: combatNow(),
      duration: 340,
      opacity: 1,
      gravity: 0.015
    });
  }

  function spawnDustPuff(pos) {
    if (!scene || battleSettled || particleSystems.length >= 216) return;
    const mat = new THREE.SpriteMaterial({ map: ensureDustTexture(), color: 0xa89276, opacity: 0.30, depthWrite: false });
    const m = new THREE.Sprite(mat);
    m.scale.set(1.05, 0.48, 1);
    m.position.set(pos.x + (Math.random() - 0.5) * 0.65, pos.y + 0.22, pos.z + (Math.random() - 0.5) * 0.65);
    scene.add(m);
    particleSystems.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 0.045,
      vy: 0.012,
      vz: (Math.random() - 0.5) * 0.045,
      startedAt: combatNow(),
      duration: 720,
      opacity: 0.30,
      gravity: 0,
      scaleGrowth: 0.048
    });
  }

  function getBattleCameraFov(aspect) {
    if (aspect <= 2.4) return cameraView === 'cinematic' ? 42 : 48;
    const horizontalFov = (cameraView === 'cinematic' ? 78 : 100) * Math.PI / 180;
    return 2 * Math.atan(Math.tan(horizontalFov / 2) / aspect) * 180 / Math.PI;
  }

  function updateCameraPosition() {
    if (!camera) return;
    const target = CAM_BASE_TARGET.clone().add(camFocusOffset).add(camShakeOffset);
    const radius = Math.max(11, camRadius + camZoomOffset);
    const x = target.x + radius * Math.sin(camPhi) * Math.sin(camTheta);
    const y = target.y + radius * Math.cos(camPhi);
    const z = target.z + radius * Math.sin(camPhi) * Math.cos(camTheta);
    camera.position.set(x, y, z);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }

  function setupCameraControls() {
    if (!renderer) return;
    const dom = renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });
    window.addEventListener('pointerup', () => { isDragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      camTheta -= dx * 0.0065;
      camPhi = Math.max(0.32, Math.min(1.18, camPhi - dy * 0.0065));
      updateCameraPosition();
    });
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      camRadius = Math.max(13, Math.min(38, camRadius + e.deltaY * 0.018));
      updateCameraPosition();
    }, { passive: false });
  }

  function resetCamera() {
    camTheta = cameraView === 'cinematic' ? -0.16 : 0;
    camPhi = cameraView === 'cinematic' ? 1.17 : 0.78;
    camRadius = (container && container.clientWidth < 720) ? 21 : cameraView === 'cinematic' ? 17.2 : 24.5;
    if ([...unitsMap.values()].some(token => token.formationLayout === 'column')) camRadius = Math.max(camRadius, 32);
    camFocusOffset.set(0, 0, 0);
    camFocusTarget.set(0, 0, 0);
    camZoomOffset = 0;
    camZoomTarget = 0;
    shakePower = 0;
    camShakeOffset.set(0, 0, 0);
    if (camera) {
      camera.fov = getBattleCameraFov(camera.aspect);
      camera.updateProjectionMatrix();
    }
    updateCameraPosition();
    updateCommanderLabels();
    if (renderer && isAnimationPaused) renderer.render(scene, camera);
  }

  function setCameraView(view) {
    if (!['cinematic', 'overview'].includes(view)) throw new Error(`Unknown battle camera: ${view}`);
    cameraView = view;
    if (container) container.closest('#battle3DWrapper').querySelectorAll('[data-camera-view]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.cameraView === view));
    });
    updateOccupationZones();
    resetCamera();
  }

  function refreshTheme() {
    unitsMap.forEach(token => {
      token.hud.redraw(token.currentHp);
      token.hud.tex.needsUpdate = true;
    });
    if (renderer && isEnabled && isAnimationPaused) renderer.render(scene, camera);
  }

  function updateCommanderLabels() {
    if (!camera || !container) return;
    const height = container.clientHeight || 340;
    const width = container.clientWidth || 960;
    const topInset = 40;
    const bottomInset = 90;
    const labelAreaHeight = Math.max(1, height - topInset - bottomInset);
    const placed = [];
    const narrow = width < 520;
    const sideRows = { A: 0, B: 0 };
    const sideIndex = { A: 0, B: 0 };
    unitsMap.forEach(token => { sideRows[token.side]++; });
    unitsMap.forEach(token => {
      const sprite = token.hud.sprite;
      const desiredWidth = showUnitLabels ? Math.min(186, width * 0.38)
        : Math.max(104, Math.min(132, token.name.length * 14 + 34, (width - 12) / 2));
      const pixels = narrow ? Math.min(desiredWidth, Math.max(1, labelAreaHeight / sideRows[token.side] - 4) * 512 / 176) : desiredWidth;
      const labelHeight = pixels * 176 / 512;
      const anchor = token.mesh.position.clone().add(new THREE.Vector3(
        token.side === 'A' ? -0.55 : 0.55, token.cat === 'air' ? 2.15 : 1.65, 0));
      const point = anchor.clone().project(camera);
      let x = Math.max(pixels / 2 + 3, Math.min(width - pixels / 2 - 3, (point.x + 1) * width / 2));
      const startY = Math.max(topInset + labelHeight / 2 + 3, Math.min(height - bottomInset - labelHeight / 2 - 3, (1 - point.y) * height / 2));
      let y = startY;
      if (narrow) {
        x = token.side === 'A' ? pixels / 2 + 3 : width - pixels / 2 - 3;
        y = topInset + (++sideIndex[token.side] - 0.5) * labelAreaHeight / sideRows[token.side];
      }
      let found = false;
      for (const candidateX of narrow ? [] : [x, x - pixels - 4, x + pixels + 4, pixels / 2 + 3, width - pixels / 2 - 3]) {
        if (candidateX < pixels / 2 || candidateX > width - pixels / 2) continue;
        for (let step = 0; step < 20; step++) {
          const offset = step === 0 ? 0 : Math.ceil(step / 2) * (labelHeight + 3) * (step % 2 ? -1 : 1);
          const candidateY = startY + offset;
          if (candidateY < topInset + labelHeight / 2 || candidateY > height - bottomInset - labelHeight / 2) continue;
          const overlaps = placed.some(rect => Math.abs(candidateX - rect.x) < (pixels + rect.width) / 2 + 2
            && Math.abs(candidateY - rect.y) < (labelHeight + rect.height) / 2 + 2);
          if (!overlaps) { x = candidateX; y = candidateY; found = true; break; }
        }
        if (found) break;
      }
      placed.push({ x, y, width: pixels, height: labelHeight });
      point.set(x / width * 2 - 1, 1 - y / height * 2, point.z).unproject(camera);
      sprite.position.copy(point.sub(token.mesh.position));
      const depth = anchor.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const perPixel = -2 * depth * Math.tan(camera.fov * Math.PI / 360) / height;
      sprite.scale.set(pixels * perPixel, pixels * perPixel * 176 / 512, 1);
      sprite.userData.screenRect = placed[placed.length - 1];
    });
  }

  function playFieldSound(type, token, gain = 1) {
    if (!token || audioPaused || document.hidden || !window.SoundEngine?.playSpatial) return;
    const position = token.mesh.position.clone().project(camera);
    window.SoundEngine.playSpatial(type, token.side, {
      distance: camera.position.distanceTo(token.mesh.position),
      pan: Math.max(-0.85, Math.min(0.85, position.x)),
      gain
    });
  }

  function updateFieldAudio(now) {
    if (battleSettled || audioPaused) return;
    const living = [...unitsMap.values()].filter(token => token.alive);
    if (now - lastMarchSoundAt > 1100) {
      const cavalry = living.find(token => token.cat === 'air' && token.figureState === 'move');
      if (cavalry) playFieldSound('cavalry_hooves', cavalry, 0.45);
      lastMarchSoundAt = now;
    }
    if (battleMotionActive && now - lastMeleeSoundAt > 1700) {
      const front = living.filter(token => !['air_defense', 'support'].includes(token.cat) && !token.formationRanged);
      const nearest = front.sort((a, b) => camera.position.distanceTo(a.mesh.position) - camera.position.distanceTo(b.mesh.position))[0];
      if (nearest) playFieldSound(Math.floor(now / 1700) % 2 ? 'shield_block' : 'blade_clash', nearest, 0.28);
      lastMeleeSoundAt = now;
    }
  }

  /* ----------------------------------------------------
     8. 主渲染與骨骼動畫更新迴圈
     ---------------------------------------------------- */
  function startAnimationLoop() {
    if (isAnimationPaused) return;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    let lastBrazierSmokeAt = 0;

    function animate(now) {
      now = combatNow();
      animFrameId = requestAnimationFrame(animate);
      if (!isEnabled) return;
      if (audioPaused) { renderer.render(scene, camera); return; }
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimestamp) / 1000));
      lastTimestamp = now;
      const elapsed = now * 0.001;
      const inHitStop = now < hitStopUntil;
      const animDt = inHitStop ? dt * 0.12 : dt;

      // 1. 更新所有 3D 士兵與戰馬的骨骼動畫 (Hit-Stop 時極短頓幀增強衝擊感)
      for (let i = 0; i < activeMixers.length; i++) {
        activeMixers[i].mixer.update(animDt);
      }

      unitsMap.forEach((token) => {
        if (!token.alive) return;
        if (token.hpTransition) {
          const transition = token.hpTransition;
          const progress = Math.min(1, (now - transition.startedAt) / transition.duration);
          token.visualHp = transition.from + (transition.to - transition.from) * progress;
          if (progress === 1) token.hpTransition = null;
        }
        const march = token.march;
        if (march && !march.finished && now >= march.startedAt) {
          if (!march.started) {
            march.started = true;
            triggerSquadAnim(token, 'move', 1.0);
          }
          const progress = Math.min(1, (now - march.startedAt) / march.duration);
          const eased = progress * progress * (3 - 2 * progress);
          token.mesh.position.x = march.fromX + (token.frontX - march.fromX) * eased;
          token.mesh.position.y = march.fromY + (token.frontY - march.fromY) * eased;
          token.mesh.position.z = march.fromZ + (token.frontZ - march.fromZ) * eased;
          if (progress >= 1) {
            march.finished = true;
            token.mesh.position.set(token.frontX, token.frontY, token.frontZ);
            triggerSquadAnim(token, 'idle', 1.0);
          }
        }

        const engagement = token.engagement;
        if (engagement && !engagement.finished && now >= engagement.startedAt) {
          const progress = Math.min(1, (now - engagement.startedAt) / engagement.duration);
          const eased = progress * progress * (3 - 2 * progress);
          token.mesh.position.x = engagement.fromX + (engagement.targetX - engagement.fromX) * eased;
          token.mesh.position.y = engagement.fromY + (engagement.targetY - engagement.fromY) * eased;
          token.mesh.position.z = engagement.fromZ + (engagement.targetZ - engagement.fromZ) * eased;
          if (progress < 0.9 && now - engagement.lastDustAt > 140) {
            spawnDustPuff(token.mesh.position);
            engagement.lastDustAt = now;
          }
          if (progress >= 1) {
            engagement.finished = true;
            token.mesh.position.set(engagement.targetX, engagement.targetY, engagement.targetZ);
            triggerSquadAnim(token, 'idle', 1.0);
          }
        }

        // 戰旗迎風招展與高費名將靈氣光環脈動
        if (token.banners && token.banners.length) {
          for (let bIdx = 0; bIdx < token.banners.length; bIdx++) {
            const bn = token.banners[bIdx];
            bn.cloth.rotation.y = bn.cloth.userData.baseRotY + Math.sin(elapsed * 5.8 + bn.phase) * 0.25;
            bn.root.rotation.x = Math.sin(elapsed * 3.1 + bn.phase) * 0.05;
          }
        }
        if (token.heroAura) {
          const pulse = 1 + Math.sin(elapsed * 4.2 + (token.attackPhaseOffset || 0)) * 0.12;
          token.heroAura.scale.set(pulse, pulse, 1);
        }

        const backline = token.cat === 'air_defense' || token.cat === 'support' || token.formationRanged;
        let isWheelAdvancing = false;
        if (battleMotionActive && backline) {
          token.formationRig.rotation.x = Math.sin(now * 0.0035 + token.attackPhaseOffset) *
            (token.cat === 'support' ? 0.085 : 0.055);
          if (now >= token.nextAmbientAttackAt) {
            if ((march && !march.finished) || (engagement && !engagement.finished)) {
              token.nextAmbientAttackAt = now + 180;
            } else {
              let target = null;
              let nearestDistance = Infinity;
              unitsMap.forEach(enemy => {
                if (!enemy.alive || enemy.side === token.side) return;
                const distance = token.mesh.position.distanceTo(enemy.mesh.position);
                if (distance < nearestDistance) {
                  nearestDistance = distance;
                  target = enemy;
                }
              });
              if (target) {
                triggerSquadAnim(token, 'attack', 1.0);
                if (token.cat === 'support') {
                  spawnStrategistBolt(token, target);
                  token.nextAmbientAttackAt = now + 1850;
                } else {
                  spawn3DArrowVolley(token.mesh.position, target.mesh.position, token.side, false, 8);
                  ambientArrowVolleys++;
                  token.nextAmbientAttackAt = now + 1550;
                }
              } else token.nextAmbientAttackAt = now + 450;
            }
          }
        } else if (battleMotionActive && !backline) {
          token.formationRig.rotation.x = 0;
          const marchDone = !march || march.finished;
          const engageDone = !engagement || engagement.finished;

          let nearestEnemy = null;
          let nearestDist = Infinity;
          unitsMap.forEach(enemy => {
            if (!enemy.alive || enemy.side === token.side) return;
            const d = token.mesh.position.distanceTo(enemy.mesh.position);
            if (d < nearestDist) {
              nearestDist = d;
              nearestEnemy = enemy;
            }
          });

          // 側翼包抄合圍：當原本對位敵軍陣亡後，近戰勝利翼側平順轉向並包抄殘存敵陣
          if (!inHitStop && marchDone && engageDone && !token.chargeInProgress && !finalChargeActive && nearestEnemy) {
            const dx = nearestEnemy.mesh.position.x - token.mesh.position.x;
            const dz = nearestEnemy.mesh.position.z - token.mesh.position.z;
            const desiredYaw = Math.atan2(dx, dz);
            const curYaw = token.formationRig.rotation.y;
            let diffYaw = desiredYaw - curYaw;
            while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
            while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
            token.formationRig.rotation.y += diffYaw * Math.min(1, 5.5 * dt);

            if (nearestDist > 1.85 && nearestDist < 18) {
              isWheelAdvancing = true;
              const moveStep = Math.min(nearestDist - 1.45, (token.cat === 'air' ? 2.5 : 1.75) * dt);
              token.mesh.position.x = Math.max(-7.5, Math.min(7.5, token.mesh.position.x + (dx / nearestDist) * moveStep));
              token.mesh.position.z = Math.max(-5.8, Math.min(5.8, token.mesh.position.z + (dz / nearestDist) * moveStep));
              token.mesh.position.y = getBattleTerrainHeight(token.mesh.position.x, token.mesh.position.z);
              token.frontX = token.mesh.position.x;
              token.frontY = token.mesh.position.y;
              token.frontZ = token.mesh.position.z;
            }
          }

          if (now >= (token.nextAmbientMeleeAt || 0)) {
            if (!marchDone || !engageDone) {
              token.nextAmbientMeleeAt = now + 150;
            } else if (nearestEnemy && (nearestDist < 3.6 || meleeActive)) {
              token.attackUntil = Math.max(token.attackUntil || 0, now + 520);
              const clashPos = token.mesh.position.clone().lerp(nearestEnemy.mesh.position, 0.5);
              clashPos.x += (Math.random() - 0.5) * 0.45;
              clashPos.y += 0.78;
              clashPos.z += (Math.random() - 0.5) * 0.45;
              spawnSparkBurst(clashPos, 6, token.cat === 'naval' ? 0x2dd4bf : 0xfbbf24);
              if (Math.random() < 0.35) spawnSlashArc(clashPos, token.side, 0xfef08a, 0.85, false);
              if (Math.random() < 0.30) spawnDustPuff(clashPos);
              token.nextAmbientMeleeAt = now + 540 + ((Math.round(token.attackPhaseOffset * 100) % 4) * 110);
            } else {
              token.nextAmbientMeleeAt = now + 420;
            }
          }
        } else {
          token.formationRig.rotation.x = 0;
        }

        const moving = isWheelAdvancing || finalChargeActive || Boolean((march && !march.finished) || (engagement && !engagement.finished));
        const fighting = battleMotionActive || meleeActive;
        const ranks = token.troopsContainer.children.find(child => child.userData.isBattalionRanks);
        if (ranks) {
          BattleFigures.animate(ranks, token, now, moving || token.figureState === 'move',
            fighting, getBattleTerrainHeight, token.attackPhaseOffset || 0);
        }
        if (token.commanderHero && typeof BattleFigures !== 'undefined' && typeof BattleFigures.animateCommander === 'function') {
          BattleFigures.animateCommander(
            token.commanderHero,
            token,
            now,
            moving || token.figureState === 'move',
            fighting,
            token.attackUntil > now ? 0.22 : 0,
            getBattleTerrainHeight
          );
          if (token.heroAura) token.heroAura.position.z = token.commanderHero.position.z;
        }
      });
      if (now - lastOccupationZoneUpdate > 180) {
        updateOccupationZones();
        lastOccupationZoneUpdate = now;
      }

      // 2. 相機焦點動態追蹤熱區、震屏脈衝與推鏡呼吸感
      if (lastFocusAt && now - lastFocusAt > 1100) {
        camFocusTarget.set(0, 0, 0);
        lastFocusAt = 0;
      }
      const focusAlpha = 1 - Math.exp(-3.8 * dt);
      camFocusOffset.lerp(camFocusTarget, focusAlpha);
      camZoomOffset += (camZoomTarget - camZoomOffset) * (1 - Math.exp(-5.0 * dt));
      camZoomTarget *= Math.exp(-2.2 * dt);
      if (shakePower > 0.002) {
        camShakeOffset.set(
          (Math.random() - 0.5) * shakePower,
          (Math.random() - 0.5) * shakePower * 0.65,
          (Math.random() - 0.5) * shakePower
        );
        shakePower *= Math.exp(-8.5 * dt);
      } else {
        shakePower = 0;
        camShakeOffset.set(0, 0, 0);
      }

      unitsMap.forEach((token) => {
        if (!token.impact) return;
        const progress = Math.min(1, (now - token.impact.startedAt) / token.impact.duration);
        const recoil = Math.sin(progress * Math.PI) * token.impact.distance;
        token.formationRig.position.z = -recoil;
        token.troopsContainer.children.forEach((troop) => {
          if (troop.userData.isShieldLine) troop.rotation.x = -recoil * 0.65;
        });
        if (progress >= 1) {
          token.formationRig.position.z = 0;
          token.troopsContainer.children.forEach((troop) => {
            if (troop.userData.isShieldLine) troop.rotation.x = 0;
          });
          token.impact = null;
        }
      });
      updateCameraPosition();

      updateCommanderLabels();
      updateFieldAudio(now);

      // 3. 營寨火盆躍動、本陣旗林迎風飄盪、裊裊烽煙與流動河水波光
      for (let i = 0; i < brazierLights.length; i++) {
        const b = brazierLights[i];
        b.light.intensity = b.baseIntensity + Math.sin(elapsed * 7.5 + i * 1.7) * 0.42;
        if (campBrazierFlamesRef) {
          const s = 1 + Math.sin(elapsed * 10 + i) * 0.16;
          _campAnimObj.position.set(b.x, b.y, b.z);
          _campAnimObj.rotation.set(0, elapsed * 1.4 + i, 0);
          _campAnimObj.scale.set(s, s * 1.26, s);
          _campAnimObj.updateMatrix();
          campBrazierFlamesRef.setMatrixAt(i, _campAnimObj.matrix);
        }
      }
      if (campBrazierFlamesRef) campBrazierFlamesRef.instanceMatrix.needsUpdate = true;
      if (campPennantsRef && campPennantsRef.userData.campFlags) {
        campPennantsRef.userData.campFlags.forEach((fl, i) => {
          const s = fl.curScale || fl.scale || 1;
          const baseYaw = fl.sideSign < 0 ? 0.18 : Math.PI - 0.18;
          const sway = Math.sin(elapsed * 2.7 + fl.phase) * 0.24;
          const tilt = Math.cos(elapsed * 3.1 + fl.phase * 1.3) * 0.08;
          _campAnimObj.position.set(fl.curX ?? fl.x, (fl.curY ?? 0) + 2.42 * s, fl.curZ ?? fl.z);
          _campAnimObj.rotation.set(tilt, baseYaw + 0.25 + sway, Math.sin(elapsed * 2.2 + fl.phase) * 0.06);
          _campAnimObj.scale.setScalar(s);
          _campAnimObj.updateMatrix();
          campPennantsRef.setMatrixAt(i, _campAnimObj.matrix);
        });
        campPennantsRef.instanceMatrix.needsUpdate = true;
      }
      if (battleMotionActive && brazierLights.length > 0 && now - lastBrazierSmokeAt > 440) {
        lastBrazierSmokeAt = now;
        const bp = brazierLights[Math.floor((now / 440) % brazierLights.length)];
        if (bp && bp.x !== undefined) {
          spawnWarSmoke(new THREE.Vector3(bp.x, bp.y || 1.1, bp.z), 1, 0x3b3530, 1.45, 0.30);
        }
      }
      if (riverTexRef) {
        riverTexRef.offset.y = (riverTexRef.offset.y - dt * 0.28) % 1;
      }
      if (riverMeshRef && riverMeshRef.material) {
        riverMeshRef.material.emissiveIntensity = 0.28 + Math.sin(elapsed * 2.2) * 0.08;
      }

      // 4. 暴雨粒子斜落
      if (weatherParticles && currentWeatherKey === 'storm') {
        const pos = weatherParticles.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          let py = pos.getY(i) - 21 * dt;
          let px = pos.getX(i) + 3.2 * dt;
          if (py < 0) py = 14;
          if (px > 17) px = -17;
          pos.setY(i, py);
          pos.setX(i, px);
        }
        pos.needsUpdate = true;
      }

      // 5. 3D 拋物線曳光箭矢飛行與落地插箭
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if (p.isVolleyBatch) {
          let allDone = true;
          for (let j = 0; j < p.items.length; j++) {
            const it = p.items[j];
            const progress = (now - it.startedAt) / it.duration;
            if (progress < 0) {
              allDone = false;
              _arrowObj.scale.setScalar(0);
            } else if (progress >= 1.0) {
              if (!it.done) {
                it.done = true;
                if (it.miss) spawnDustPuff(it.end);
                else if (j % 4 === 0) spawnSparkBurst(it.end, 8, p.side === 'A' ? 0x93c5fd : 0xfbbf24);
                if (it.stickChance && stuckArrows.length < 8 && currentBattleTerrain !== 'mountain') {
                  const stuckGeo = new THREE.CylinderGeometry(0.015, 0.022, 0.52, 4);
                  const stuckMat = new THREE.MeshBasicMaterial({ color: 0x785d3b });
                  const stuck = new THREE.Mesh(stuckGeo, stuckMat);
                  stuck.position.set(it.end.x, getBattleTerrainHeight(it.end.x, it.end.z) + 0.16, it.end.z);
                  stuck.rotation.z = (p.side === 'A' ? -0.45 : 0.45) + (Math.random() - 0.5) * 0.25;
                  stuck.rotation.x = (Math.random() - 0.5) * 0.35;
                  scene.add(stuck);
                  stuckArrows.push(stuck);
                }
              }
              _arrowObj.scale.setScalar(0);
            } else {
              allDone = false;
              _arrowObj.position.lerpVectors(it.start, it.end, progress);
              _arrowObj.position.y += Math.sin(progress * Math.PI) * it.arcHeight;
              const nextP = Math.min(1.0, progress + 0.04);
              const nextPos = it.start.clone().lerp(it.end, nextP);
              nextPos.y += Math.sin(nextP * Math.PI) * it.arcHeight;
              _arrowObj.scale.setScalar(1);
              _arrowObj.lookAt(nextPos);
            }
            _arrowObj.updateMatrix();
            p.mesh.setMatrixAt(j, _arrowObj.matrix);
          }
          p.mesh.instanceMatrix.needsUpdate = true;
          if (allDone) {
            scene.remove(p.mesh);
            p.mesh.dispose();
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            projectiles.splice(i, 1);
          }
          continue;
        }

        const progress = (now - p.startedAt) / p.duration;
        if (progress < 0) continue;
        if (progress >= 1.0) {
          if (p.miss) spawnDustPuff(p.end);
          else {
            spawnSparkBurst(p.end, p.impactCount || 8, p.impactColor || 0xf97316);
            if (p.triggerShockwave) spawnShockwaveRing(p.end, p.impactColor || 0xf97316, 1.9, 340);
          }
          scene.remove(p.mesh);
          if (p.isComposite && p.disposableChildren) {
            p.disposableChildren.forEach(ch => { ch.geometry.dispose(); ch.material.dispose(); });
          } else if (!p.isGLB) {
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
          }
          projectiles.splice(i, 1);
        } else {
          p.mesh.position.lerpVectors(p.start, p.end, progress);
          p.mesh.position.y += Math.sin(progress * Math.PI) * p.arcHeight;
          const nextP = Math.min(1.0, progress + 0.04);
          const nextPos = p.start.clone().lerp(p.end, nextP);
          nextPos.y += Math.sin(nextP * Math.PI) * p.arcHeight;
          p.mesh.lookAt(nextPos);
        }
      }

      // 6. 刀光弧線特效更新
      for (let i = slashArcs.length - 1; i >= 0; i--) {
        const sa = slashArcs[i];
        const progress = Math.min(1, (now - sa.startedAt) / sa.duration);
        const s = 0.72 + progress * 0.78;
        sa.mesh.scale.setScalar(s);
        sa.mesh.rotation.z += sa.spin * dt;
        sa.mesh.material.opacity = (1 - progress) * sa.baseOpacity;
        if (progress >= 1) {
          scene.remove(sa.mesh);
          sa.mesh.geometry.dispose();
          sa.mesh.material.dispose();
          slashArcs.splice(i, 1);
        }
      }

      // 7. 地面震波與八卦光環更新
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        const progress = Math.min(1, (now - sw.startedAt) / sw.duration);
        const s = sw.startScale + (sw.endScale - sw.startScale) * (1 - Math.pow(1 - progress, 2));
        sw.mesh.scale.set(s, s, 1);
        if (sw.spinRate) sw.mesh.rotation.z += sw.spinRate * dt;
        sw.mesh.material.opacity = (1 - progress) * sw.opacity;
        if (progress >= 1) {
          scene.remove(sw.mesh);
          sw.mesh.geometry.dispose();
          sw.mesh.material.dispose();
          shockwaves.splice(i, 1);
        }
      }

      // 8. 粒子與烽煙塵土更新
      for (let i = particleSystems.length - 1; i >= 0; i--) {
        const pt = particleSystems[i];
        const steps = dt * 60;
        if (pt.isSparkCloud) {
          const pAttr = pt.mesh.geometry.attributes.position;
          const arr = pAttr.array;
          for (let j = 0; j < arr.length; j += 3) {
            arr[j] += pt.vels[j] * steps;
            arr[j + 1] += pt.vels[j + 1] * steps;
            arr[j + 2] += pt.vels[j + 2] * steps;
            pt.vels[j + 1] -= (pt.gravity || 0.015) * steps;
          }
          pAttr.needsUpdate = true;
        } else {
          pt.mesh.position.x += pt.vx * steps;
          pt.mesh.position.y += pt.vy * steps;
          pt.mesh.position.z += pt.vz * steps;
          pt.vy -= (pt.gravity || 0) * steps;
          if (pt.scaleGrowth) pt.mesh.scale.addScalar(pt.scaleGrowth * steps);
        }
        const remaining = Math.max(0, 1 - (now - pt.startedAt) / pt.duration);
        if (pt.mesh.material) pt.mesh.material.opacity = remaining * pt.opacity;
        if (remaining === 0) {
          scene.remove(pt.mesh);
          if (!pt.mesh.isSprite) pt.mesh.geometry.dispose();
          pt.mesh.material.dispose();
          particleSystems.splice(i, 1);
        }
      }

      // 9. 浮動兵損數字上升消退
      for (let i = floatingPopups.length - 1; i >= 0; i--) {
        const fp = floatingPopups[i];
        fp.sprite.position.y += 0.85 * dt;
        const remaining = Math.max(0, 1 - (now - fp.startedAt) / fp.duration);
        fp.mat.opacity = Math.min(1, remaining * 1.4);
        if (remaining === 0) {
          scene.remove(fp.sprite);
          fp.tex.dispose();
          fp.mat.dispose();
          floatingPopups.splice(i, 1);
        }
      }

      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    }

    animate(performance.now());
  }

  function pauseAnimationLoop(paused = true) {
    isAnimationPaused = Boolean(paused);
    if (isAnimationPaused) window.SoundEngine?.stopSpatial?.();
    if (isAnimationPaused && animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    } else if (!isAnimationPaused && isInitialized && !animFrameId) {
      startAnimationLoop();
    }
  }

  function clearAllTokens() {
    battleEpoch++;
    battleMotionActive = false;
    activeAttackers.clear();
    window.SoundEngine?.stopSpatial?.();
    unitsMap.forEach((t) => {
      if (scene && t.mesh) scene.remove(t.mesh);
      if (t.hud && t.hud.tex) t.hud.tex.dispose();
      if (t.hud) t.hud.sprite.material.dispose();
      if (t.heroAura) {
        t.heroAura.geometry.dispose();
        t.heroAura.material.dispose();
      }
      const bannerGrp = t.troopsContainer.children.find(child => child.userData.isFactionBanners);
      if (bannerGrp) {
        const mats = new Set();
        bannerGrp.traverse(obj => {
          if (obj.isMesh && obj.geometry) obj.geometry.dispose();
          if (obj.isMesh && obj.material) mats.add(obj.material);
        });
        mats.forEach(m => m.dispose());
      }
      if (t.commanderHero) {
        const mats = new Set();
        t.commanderHero.traverse(obj => {
          if (obj.isMesh && obj.geometry) obj.geometry.dispose();
          if (obj.isMesh && obj.material) mats.add(obj.material);
        });
        mats.forEach(m => m.dispose());
      }
      const ranks = t.troopsContainer.children.find(child => child.userData.isBattalionRanks);
      if (ranks) {
        ranks.children.forEach(mesh => mesh.dispose());
        ranks.userData.material.dispose();
      }
    });
    unitsMap.clear();
    activeMixers = [];

    clearBattleEffects();
  }

  function clearBattleEffects() {
    projectiles.forEach(p => {
      if (scene && p.mesh) scene.remove(p.mesh);
      if (p.isVolleyBatch) {
        p.mesh.dispose();
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      } else if (p.isComposite && p.disposableChildren) {
        p.disposableChildren.forEach(ch => { ch.geometry.dispose(); ch.material.dispose(); });
      } else if (!p.isGLB) {
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      }
    });
    projectiles = [];

    slashArcs.forEach(sa => {
      if (scene && sa.mesh) scene.remove(sa.mesh);
      sa.mesh.geometry.dispose();
      sa.mesh.material.dispose();
    });
    slashArcs = [];

    shockwaves.forEach(sw => {
      if (scene && sw.mesh) scene.remove(sw.mesh);
      sw.mesh.geometry.dispose();
      sw.mesh.material.dispose();
    });
    shockwaves = [];

    stuckArrows.forEach(st => {
      if (scene && st) scene.remove(st);
      st.geometry.dispose();
      st.material.dispose();
    });
    stuckArrows = [];

    battleScars.forEach(sc => {
      if (scene && sc) scene.remove(sc);
      sc.geometry.dispose();
      sc.material.dispose();
    });
    battleScars = [];

    particleSystems.forEach(pt => {
      if (scene && pt.mesh) scene.remove(pt.mesh);
      if (!pt.mesh.isSprite) pt.mesh.geometry.dispose();
      pt.mesh.material.dispose();
    });
    particleSystems = [];

    floatingPopups.forEach((fp) => {
      if (scene && fp.sprite) scene.remove(fp.sprite);
      fp.tex.dispose();
      fp.mat.dispose();
    });
    floatingPopups = [];

    hitStopUntil = 0;
    shakePower = 0;
    camZoomTarget = 0;
    camZoomOffset = 0;
    camShakeOffset.set(0, 0, 0);
  }

  function onWindowResize() {
    if (!renderer || !camera || !container) return;
    const width = container.clientWidth || 960;
    const height = container.clientHeight || 340;
    if (width <= 0 || height <= 0) return;
    camera.aspect = width / height;
    camera.fov = getBattleCameraFov(camera.aspect);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    updateCommanderLabels();
    if (isAnimationPaused && isEnabled) renderer.render(scene, camera);
  }

  function toggleMode(enabled) {
    isEnabled = Boolean(enabled);
    if (!isEnabled) window.SoundEngine?.stopSpatial?.();
    if (container) container.hidden = !isEnabled;
    if (isEnabled) setTimeout(onWindowResize, 30);
  }

  function getDebugState() {
    return {
      isInitialized,
      isEnabled,
      cameraView,
      unitLabels: showUnitLabels,
      nameLabelsIgnoreFog: [...unitsMap.values()].every(token => token.hud.sprite.material.fog === false),
      cameraPosition: camera ? camera.position.toArray() : [],
      drawCalls: renderer ? renderer.info.render.calls : 0,
      triangles: renderer ? renderer.info.render.triangles : 0,
      activeEffects: projectiles.length + particleSystems.length + floatingPopups.length + slashArcs.length + shockwaves.length,
      ambientArrowVolleys,
      ambientSpellcasts,
      floatingTexts: floatingPopups.map(popup => popup.text),
      floatingPositions: floatingPopups.map(popup => {
        const point = popup.sprite.position.clone().project(camera);
        return { text: popup.text, x: (point.x + 1) / 2, y: (1 - point.y) / 2 };
      }),
      reserveSoldiers: 0,
      reserveFlags: 0,
      campFortifications: campFortificationsGroup ? campFortificationsGroup.children.length : 0,
      campBannerCount: campPennantsRef ? campPennantsRef.count : 0,
      audioPaused,
      activeAttackers: [...activeAttackers],
      peakConcurrentAttackers,
      completedVolleys,
      animationPaused: isAnimationPaused,
      modelsTotal: Object.keys(MODEL_MANIFEST).length,
      modelsLoaded: modelsLoadedCount,
      plinthCount: unitsMap.size,
      activeMixers: activeMixers.length,
      soldierCount: [...unitsMap.values()].reduce((sum, token) => sum + token.troopsContainer.children.reduce((count, child) => count + (child.userData.soldierCount || 0), 0), 0),
      engagedBattalions: [...unitsMap.values()].filter(token =>
        (token.engagement && token.engagement.finished) ||
        (['air', 'armor', 'naval'].includes(token.cat) && token.march && token.march.finished)
      ).length,
      envPropsChildren: envPropsGroup ? envPropsGroup.children.length : 0,
      lowPowerDevice: isLowPowerDevice,
      aliveBattalions: [...unitsMap.values()].filter(token => token.alive).length,
      fallenBattalions: [...unitsMap.values()].filter(token => token.fallen).length,
      meleeActive,
      battleMotionActive,
      marchingBattalions: [...unitsMap.values()].filter(token => token.march && !token.march.finished).length,
      battalions: [...unitsMap.values()].map(token => ({
        uid: token.uid, side: token.side, cat: token.cat, alive: token.alive, fallen: token.fallen,
        currentHp: token.currentHp, visualHp: token.visualHp ?? token.currentHp,
        figureState: token.figureState, recoiling: Boolean(token.impact),
        layout: token.formationLayout, ranged: token.formationRanged || ['air_defense', 'support'].includes(token.cat),
        originalFigures: token.troopsContainer.children.some(child => child.userData.originalFigures),
        figureParts: token.troopsContainer.children.find(child => child.userData.originalFigures)?.children.map(mesh => mesh.userData.part) || [],
        animationAt: token.troopsContainer.children.find(child => child.userData.originalFigures)?.userData.animationAt || 0,
        casualties: token.troopsContainer.children.find(child => child.userData.originalFigures)?.userData.casualtyAt.filter(value => value !== null).length || 0,
        motionPose: (() => {
          const arm = token.troopsContainer.children.find(child => child.userData.isBattalionRanks)
            ?.children.find(child => child.userData.part === 'rightArm');
          return arm ? [5, 6, 9, 10].map(index => arm.instanceMatrix.array[index]) : [];
        })(),
        commanderName: token.name,
        nameLabelVisible: token.hud.sprite.visible,
        labelRect: token.hud.sprite.userData.screenRect,
        formationSignature: token.troopsContainer.children.find(child => child.userData.isBattalionRanks)?.children[0]?.userData.standingMatrices.map(matrix => [matrix.elements[12], matrix.elements[14]]),
        x: token.mesh.position.x, z: token.mesh.position.z, frontX: token.frontX, frontZ: token.frontZ,
        ranksFallen: token.fallen && token.troopsContainer.children.some(child =>
          child.userData.isBattalionRanks && child.children.every(mesh =>
            Array.from({ length: mesh.count }, (_, index) =>
              mesh.instanceMatrix.array[index * 16 + 13] - (child.userData.groundOffsets?.[index] || 0)
            ).every(height => Math.abs(height - 0.035) < 0.01)
          )
        )
      })),
      finalChargeActive,
      pixelRatio: renderer ? renderer.getPixelRatio() : 0,
      weather: currentWeatherKey,
      sunlight: sunLightRef ? sunLightRef.intensity : 0,
      ambientLight: hemiLightRef ? hemiLightRef.intensity : 0,
      terrain: currentBattleTerrain,
      scene: currentScene,
      fogDensity: scene?.fog?.density || 0,
      landscapeMeshes: landscapeGroup ? landscapeGroup.children.filter(group => group.visible).reduce((sum, group) => sum + group.children.length, 0) : 0,
      environmentLayout: envPropsGroup ? envPropsGroup.children.filter(prop => prop.visible).map(prop => ({
        role: prop.userData.terrainRole || 'camp', x: prop.position.x, z: prop.position.z
      })) : [],
      waterwayVisible: waterwayGroup ? waterwayGroup.visible : false,
      terrainDecorVisible: terrainDecorationGroup ? terrainDecorationGroup.visible : false,
      battalionRanks: [...unitsMap.values()].filter(token => token.troopsContainer.children.some(child => child.userData.isBattalionRanks)).length
    };
  }

  // 預先啟動 GLB 模型非同步載入，讓玩家點進戰鬥時已完成快取
  if (typeof window !== 'undefined') {
    const startPreload = window.requestIdleCallback || function (cb) { setTimeout(cb, 200); };
    startPreload(() => ensureModelsLoaded());
  }

  return {
    init,
    loadBattle,
    playEvent,
    playVolley,
    refreshTheme,
    beginFinalCharge,
    syncBattleResult,
    pauseAnimationLoop,
    setAudioPaused,
    toggleMode,
    clearAllTokens,
    resetCamera,
    getDebugState,
    whenModelsReady: ensureModelsLoaded
  };
})();

if (typeof window !== 'undefined') {
  window.Battle3DEngine = Battle3DEngine;
}
