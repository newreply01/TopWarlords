/* =====================================================
   TopWarlords field-scale battle renderer (Three.js r128).
   Original articulated troops, restrained materials, stable camera presets.
   ===================================================== */
'use strict';

const Battle3DEngine = (function () {
  const ASSET_VER = '7.9.0';
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
  let reserveArmy = null;
  let dustTexture = null;
  let lastMarchSoundAt = 0;
  let lastMeleeSoundAt = 0;
  let audioPaused = false;

  const unitsMap = new Map();      // uid -> battalion token
  let activeMixers = [];           // { mixer, actions, currentState }
  let projectiles = [];            // 3D 箭雨與火彈
  let particleSystems = [];        // 塵土、刀光火花、衝擊波
  let floatingPopups = [];         // 3D 浮動兵力傷害數字 (-3,200 / 格擋)
  let brazierLights = [];          // 營寨篝火動態光源
  let cutinTimeout = null;
  let lastCutinAt = 0;

  // 相機軌道控制與動態微聚焦
  let isDragging = false;
  let prevMouseX = 0, prevMouseY = 0;
  let camTheta = 0.0, camPhi = 0.64, camRadius = 25.5;
  let cameraView = 'cinematic';
  let showUnitLabels = false;
  const CAM_BASE_TARGET = new THREE.Vector3(0, 0.55, 0.35);
  const camFocusOffset = new THREE.Vector3(0, 0, 0);
  const camFocusTarget = new THREE.Vector3(0, 0, 0);
  let lastFocusAt = 0;
  let finalChargeActive = false;
  let meleeActive = false;
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
      g.addColorStop(0.0, '#0f172a');
      g.addColorStop(0.52, '#1e293b');
      g.addColorStop(1.0, '#334155');
    } else if (weather === 'em') {
      g.addColorStop(0.0, '#1e293b');
      g.addColorStop(0.5, '#475569');
      g.addColorStop(1.0, '#94a3b8');
    } else {
      // 光榮《三國志》金秋黃昏蒼穹漸層
      g.addColorStop(0.0, '#172033');
      g.addColorStop(0.42, '#2d3a4f');
      g.addColorStop(0.76, '#7c583c');
      g.addColorStop(1.0, '#c89b68');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 512);
    const tex = new THREE.CanvasTexture(c);
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
      renderer.toneMappingExposure = 0.94;
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

    isInitialized = true;
    lastTimestamp = performance.now();
    startAnimationLoop();
    return true;
  }

  function setupLighting() {
    hemiLightRef = new THREE.HemisphereLight(0xc9d2d6, 0x34362b, 0.78);
    hemiLightRef.position.set(0, 28, 0);
    scene.add(hemiLightRef);

    sunLightRef = new THREE.DirectionalLight(0xffedd5, 1.55);
    sunLightRef.position.set(-16, 26, 15);
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
    const rimLight = new THREE.DirectionalLight(0xb7c4c6, 0.3);
    rimLight.position.set(18, 14, -12);
    scene.add(rimLight);
  }

  function createTerrainTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 草野與黃土交錯古戰場地表
    const baseGrad = ctx.createLinearGradient(0, 0, 1024, 0);
    baseGrad.addColorStop(0.0, '#4a5a38');
    baseGrad.addColorStop(0.28, '#6a6342');
    baseGrad.addColorStop(0.45, '#8a7652');
    baseGrad.addColorStop(0.50, '#78674a');
    baseGrad.addColorStop(0.55, '#8a7652');
    baseGrad.addColorStop(0.72, '#6a6342');
    baseGrad.addColorStop(1.0, '#4d5839');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // 自然砂石與草叢紋理顆粒
    for (let i = 0; i < 6500; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const r = 1 + Math.random() * 3.5;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(58, 72, 38, 0.18)' : 'rgba(168, 142, 98, 0.16)';
      ctx.fillRect(x, y, r, r);
    }

    // 三條橫貫東西的古戰場車馬馳道 (北翼、中軍、南翼)
    [136, 256, 376].forEach((cy) => {
      const roadG = ctx.createLinearGradient(0, cy - 28, 0, cy + 28);
      roadG.addColorStop(0, 'rgba(124, 101, 68, 0)');
      roadG.addColorStop(0.5, 'rgba(138, 112, 74, 0.58)');
      roadG.addColorStop(1, 'rgba(124, 101, 68, 0)');
      ctx.fillStyle = roadG;
      ctx.fillRect(40, cy - 28, 944, 56);
    });

    ctx.strokeStyle = 'rgba(48, 39, 27, 0.28)';
    ctx.lineWidth = 2;
    [136, 256, 376].forEach(y => {
      [-5, 5].forEach(track => {
        ctx.beginPath();
        ctx.moveTo(0, y + track);
        ctx.bezierCurveTo(320, y - 10 + track, 720, y + 12 + track, 1024, y + track);
        ctx.stroke();
      });
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  }

  function buildAncientBattlefieldTerrain() {
    brazierLights = [];

    // 1. 廣袤起伏戰場地形平面
    const groundGeo = new THREE.PlaneGeometry(58, 36, 72, 48);
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
    const groundMat = new THREE.MeshStandardMaterial({
      map: createTerrainTexture(),
      roughness: 0.88,
      metalness: 0.04
    });
    groundMaterialRef = groundMat;
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 2. 中央波光粼粼古戰場渡河 (渭水／官渡淺灘)
    waterwayGroup = new THREE.Group();
    scene.add(waterwayGroup);
    const riverGeo = new THREE.PlaneGeometry(3.2, 34, 8, 24);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x46594f,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.62,
      metalness: 0.12,
      transparent: true,
      opacity: 0.82
    });
    riverMeshRef = new THREE.Mesh(riverGeo, riverMat);
    riverMeshRef.rotation.x = -Math.PI / 2;
    riverMeshRef.position.y = -0.06;
    riverMeshRef.receiveShadow = true;
    waterwayGroup.add(riverMeshRef);

    // 3. 三座古木戰橋橫跨淺灘 (北橋 z=-3.8、中軍大橋 z=0、南橋 z=+3.8)
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x62523b, roughness: 0.95, metalness: 0.02 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x4a2e16, roughness: 0.82 });
    [-3.8, 0.0, 3.8].forEach((bz, idx) => {
      const bw = idx === 1 ? 1.45 : 1.10;
      const bridge = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.08, bw), woodMat);
      deck.position.set(0, 0.015, bz);
      deck.castShadow = true;
      deck.receiveShadow = true;
      bridge.add(deck);

      [-bw / 2 + 0.08, bw / 2 - 0.08].forEach((rz) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.08, 0.05), railMat);
        rail.position.set(0, 0.09, bz + rz);
        rail.castShadow = true;
        bridge.add(rail);
      });
      waterwayGroup.add(bridge);
    });

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
    reserveArmy = new THREE.Group();
    for (const side of ['A', 'B']) {
      reserveArmy.add(BattleFigures.createReserveRanks(isLowPowerDevice ? 192 : 384, side));
    }
    const flagCount = isLowPowerDevice ? 16 : 32;
    const reserveFlags = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.30, 0.65),
      new THREE.MeshLambertMaterial({ color: 0x8c8167, side: THREE.DoubleSide }), flagCount);
    reserveFlags.userData.reserveFlags = true;
    reserveArmy.add(reserveFlags);
    scene.add(reserveArmy);

    // 4. 東西大營篝火火盆
    const campBraziers = [
      { x: -12.4, z: -2.8, c: 0x38bdf8 },
      { x: -12.4, z: 2.8, c: 0xf97316 },
      { x: 12.4, z: -2.8, c: 0xf97316 },
      { x: 12.4, z: 2.8, c: 0xf59e0b }
    ];
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5, metalness: 0.7 });
    campBraziers.forEach((bp) => {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.65, 8), ironMat);
      stand.position.set(bp.x, 0.32, bp.z);
      stand.castShadow = true;
      scene.add(stand);

      const flameMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 7), flameMat);
      flame.position.set(bp.x, 0.82, bp.z);
      scene.add(flame);

      const pLight = new THREE.PointLight(0xff8c24, 1.45, 9.5);
      pLight.position.set(bp.x, 1.35, bp.z);
      scene.add(pLight);
      brazierLights.push({ light: pLight, fireMesh: flame, baseIntensity: 1.45 });
    });

    // 5. 待 GLB 載入完成後布置 3D 營帳、箭樓、鹿角拒馬與山崖巨石
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
    if (waterwayGroup) waterwayGroup.visible = currentBattleTerrain === 'plain';
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
    if (reserveArmy) {
      const soldier = new THREE.Object3D();
      reserveArmy.children.forEach(mesh => {
        const flags = mesh.userData.reserveFlags;
        for (let i = 0; i < mesh.count; i++) {
          const sign = flags ? (i < mesh.count / 2 ? -1 : 1) : mesh.userData.reserveSide === 'A' ? -1 : 1;
          const slot = flags ? i % (mesh.count / 2) * 24 + (i % 2) * 12 : i;
          const x = sign * (7.5 + (slot % 24) * 0.34);
          const z = -8.7 - Math.floor(slot / 24) * 0.42;
          soldier.position.set(x, getBattleTerrainHeight(x, z) + (flags ? 1.3 : 0), z);
          soldier.rotation.y = flags ? sign * 0.25 : -sign * Math.PI / 2;
          soldier.scale.setScalar(flags ? 1 : 0.9 + (i % 3) * 0.035);
          soldier.updateMatrix();
          mesh.setMatrixAt(i, soldier.matrix);
          if (flags) mesh.setColorAt(i, new THREE.Color(sign < 0 ? 0x819ba4 : 0xa47460));
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      });
    }
    if (groundCover) {
      const tuft = new THREE.Object3D();
      groundCover.userData.positions.forEach(({ x, z, size }, i) => {
        tuft.position.set(x, getBattleTerrainHeight(x, z), z);
        tuft.rotation.y = i * 0.7;
        const road = Math.abs(z) < 1.3 || Math.abs(Math.abs(z) - 3.8) < 0.8;
        const water = currentBattleTerrain === 'plain' && Math.abs(x) < 2;
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
      const tint = currentBattleTerrain === 'mountain' ? 0xd1c8b7 : currentBattleTerrain === 'forest' ? 0xb9c7a2 : 0xffffff;
      groundMaterialRef.color.setHex(tint);
    }
    occupationZones.forEach(zone => {
      const height = getBattleTerrainHeight(0, zone.z);
      zone.fill.position.y = height + 0.025;
      zone.ring.position.y = height + 0.035;
    });
  }

  function getBattleTerrainHeight(x, worldZ) {
    const terrain = currentBattleTerrain;
    const localZ = -worldZ;
    const flank = Math.max(0, Math.abs(localZ) - (terrain === 'mountain' ? 4.5 : 8.2));
    const farX = Math.max(0, Math.abs(x) - (terrain === 'mountain' ? 11 : 14.5));
    let height = Math.pow(flank, terrain === 'mountain' ? 1.2 : 1.32)
      * (terrain === 'mountain' ? 0.42 : 0.26)
      + Math.pow(farX, 1.2) * (terrain === 'mountain' ? 0.28 : 0.16);
    if (terrain === 'plain' && Math.abs(x) < 2.2) {
      height -= (1 - Math.abs(x) / 2.2) * 0.22;
    } else if (terrain === 'forest') {
      height += Math.sin(x * 0.42 + localZ * 0.16) * 0.18 + Math.cos(localZ * 0.58) * 0.1;
    } else if (terrain === 'mountain') {
      height += Math.sin(x * 0.52 + localZ * 0.35) * 0.38;
    }
    return height;
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
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.86, metalness: 0.05 });
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0x784b26, roughness: 0.82, metalness: 0.06 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.42, metalness: 0.72 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.90 });

    // 橫貫主木樑
    const mainBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, width, 7), beamMat);
    mainBeam.rotation.z = Math.PI / 2;
    mainBeam.position.set(0, height * 0.44, 0);
    mainBeam.castShadow = true;
    mainBeam.receiveShadow = true;
    abatis.add(mainBeam);

    // 多組交叉削尖圓木樁 + 鐵包尖頭 + 麻繩綑紮
    const pairCount = Math.max(3, Math.round(width / 0.30));
    const stakeLen = height * 1.28;
    for (let i = 0; i < pairCount; i++) {
      const x = pairCount === 1 ? 0 : (-width * 0.42 + (width * 0.84 * i) / (pairCount - 1));

      // 朝前斜刺 (+Z 敵陣方向)
      const fwd = new THREE.Group();
      fwd.position.set(x, height * 0.44, 0);
      fwd.rotation.x = Math.PI * 0.27;
      const fwdShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, stakeLen, 6), stakeMat);
      fwdShaft.castShadow = true;
      fwd.add(fwdShaft);
      const fwdTip = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.14, 6), tipMat);
      fwdTip.position.y = stakeLen * 0.5 + 0.06;
      fwd.add(fwdTip);
      abatis.add(fwd);

      // 朝後支撐斜樁 (-Z 方向抓地)
      const bwd = new THREE.Group();
      bwd.position.set(x + 0.03, height * 0.44, 0);
      bwd.rotation.x = -Math.PI * 0.25;
      const bwdShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.042, stakeLen * 0.94, 6), stakeMat);
      bwdShaft.castShadow = true;
      bwd.add(bwdShaft);
      const bwdTip = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.12, 6), stakeMat);
      bwdTip.position.y = stakeLen * 0.47 + 0.05;
      bwd.add(bwdTip);
      abatis.add(bwd);

      // 麻繩十字結節
      const knot = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 5, 8), ropeMat);
      knot.rotation.y = Math.PI / 2;
      knot.position.set(x + 0.015, height * 0.44, 0);
      abatis.add(knot);
    }
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

    // 東西雙方本陣營帳與箭樓
    [
      { side: 'A', sx: -1, tint: 0x2563eb },
      { side: 'B', sx: 1, tint: 0xdc2626 }
    ].forEach(({ sx, tint }) => {
      const faceY = sx < 0 ? Math.PI / 2 : -Math.PI / 2;

      [-4.8, 4.8].forEach((zPos) => {
        const tower = spawnModelInstance('watchtower', { targetHeight: 2.25, tintHex: tint, tintStrength: 0.14 });
        if (tower) {
          tower.group.position.set(sx * 13.0, 0, zPos);
          tower.group.rotation.y = faceY;
          tower.group.userData.terrainRole = 'tower';
          envPropsGroup.add(tower.group);
        }
      });

      [-1.9, 1.9].forEach((zPos) => {
        const tent = spawnModelInstance('tent', { targetHeight: 1.35, tintHex: tint, tintStrength: 0.25 });
        if (tent) {
          tent.group.position.set(sx * 13.4, 0, zPos);
          tent.group.rotation.y = faceY;
          envPropsGroup.add(tent.group);
        }
      });

      [-6.2, -2.9, 2.9, 6.2].forEach((zPos) => {
        const flag = spawnModelInstance('banner', { targetHeight: 1.95, tintHex: tint, tintStrength: 0.42 });
        if (flag) {
          flag.group.position.set(sx * 11.8, 0, zPos);
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
      const rk = spawnModelInstance(rkey, { targetHeight: rh, castShadow: true });
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
        : role === 'abatis' ? currentBattleTerrain === 'plain'
        : role === 'tower' ? !mountain : true;
      prop.position.copy(prop.userData.basePosition);
      prop.scale.copy(prop.userData.baseScale);
      if (mountain) {
        prop.position.x *= 0.85;
        prop.position.z *= 0.58;
        if (role === 'rock') prop.scale.multiply(new THREE.Vector3(1.5, 1.4, 1));
      }
      prop.position.y += getBattleTerrainHeight(prop.position.x, prop.position.z);
    });
  }

  function applyWeatherAtmosphere(weather) {
    currentWeatherKey = weather || 'plain';
    if (!scene) return;
    scene.background = createSkyBackdropTexture(currentWeatherKey);

    if (weatherParticles) {
      scene.remove(weatherParticles);
      weatherParticles.geometry.dispose();
      weatherParticles.material.dispose();
      weatherParticles = null;
    }

    if (currentWeatherKey === 'storm') {
      scene.fog = new THREE.FogExp2(0x1e293b, 0.020);
      if (sunLightRef) sunLightRef.intensity = 0.95;
      if (hemiLightRef) hemiLightRef.intensity = 0.72;
      // 暴雨雨絲粒子
      const rainCount = 420;
      const geo = new THREE.BufferGeometry();
      const arr = new Float32Array(rainCount * 3);
      for (let i = 0; i < rainCount; i++) {
        arr[i * 3] = (Math.random() - 0.5) * 34;
        arr[i * 3 + 1] = Math.random() * 14;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.14, transparent: true, opacity: 0.55 });
      weatherParticles = new THREE.Points(geo, mat);
      scene.add(weatherParticles);
    } else if (currentWeatherKey === 'em') {
      scene.fog = new THREE.FogExp2(0x64748b, 0.025);
      if (sunLightRef) sunLightRef.intensity = 1.15;
      if (hemiLightRef) hemiLightRef.intensity = 0.8;
    } else {
      scene.fog = new THREE.FogExp2(0x4a3d31, 0.0125);
      if (sunLightRef) sunLightRef.intensity = 1.55;
      if (hemiLightRef) hemiLightRef.intensity = 0.95;
    }
  }

  /* ----------------------------------------------------
     3. 打造《三國志》立體部隊方陣托盤 + 全 3D 骨骼動畫兵種
     ---------------------------------------------------- */
  function getFormationOffset(layout, index, count, mounted) {
    const stepX = mounted ? 0.50 : 0.40;
    const stepZ = mounted ? 0.85 : 0.45;
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
      return offset || { x: (i % columns - (columns - 1) / 2) * (mounted ? 0.50 : 0.40),
        z: -Math.floor(i / columns) * (mounted ? 0.85 : 0.45) };
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

  function populateFormationGLB(token) {
    const g = token.troopsContainer;
    if (!g || g.children.length > 0) return;

    const isSideA = token.side === 'A';
    const factionTint = isSideA ? 0x485c68 : 0x783c32;
    attachProp(g, 'banner', { targetHeight: 1.65, tintHex: factionTint, tintStrength: 0.3 }, [-1.2, 0, -0.65], [0, 0, 0]);
    if (token.cat === 'support') {
      const drum = buildTaikoWarDrum();
      drum.scale.setScalar(0.65);
      drum.position.set(-1.3, 0, -1.3);
      g.add(drum);
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
      const hp = Math.max(0, hpVal);
      const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
      ctx.clearRect(0, 0, 512, 176);
      if (!showUnitLabels) {
        roundRectPath(ctx, 4, 20, 504, 136, 8);
        ctx.fillStyle = 'rgba(20, 24, 25, 0.90)';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = isSideA ? '#8bbdd1' : '#dc9a82';
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = 'bold 32px "Microsoft JhengHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(isSideA ? '我軍' : '敵軍', 24, 63);
        ctx.fillStyle = '#fff4df';
        ctx.font = 'bold 64px "Microsoft JhengHei", sans-serif';
        ctx.fillText(unit.name || '無名武將', 24, 121, 460);
        ctx.fillStyle = '#9b916d';
        ctx.fillRect(22, 140, 468 * ratio, 5);
        return;
      }

      // 1. 黑金漆器銘牌底板
      roundRectPath(ctx, 88, 26, 408, 124, 18);
      const bg = ctx.createLinearGradient(88, 26, 496, 150);
      if (isSideA) {
        bg.addColorStop(0, 'rgba(12, 26, 54, 0.92)');
        bg.addColorStop(1, 'rgba(15, 23, 42, 0.88)');
      } else {
        bg.addColorStop(0, 'rgba(58, 14, 14, 0.92)');
        bg.addColorStop(1, 'rgba(28, 16, 14, 0.88)');
      }
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = isSideA ? '#38bdf8' : '#f59e0b';
      ctx.stroke();

      // 2. 名將名號與費率兵種印記
      ctx.fillStyle = '#f8fafc';
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
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 23px "JetBrains Mono", "Noto Sans TC", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`兵力 ${troopsNum}`, 474, 140);

      ctx.fillStyle = isSideA ? '#7dd3fc' : '#fca5a5';
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
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
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
    c.width = 256;
    c.height = 84;
    const ctx = c.getContext('2d');
    ctx.font = `900 ${isBig ? 44 : 36}px "Noto Sans TC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.strokeText(text, 128, 56);
    ctx.fillStyle = colorHex;
    ctx.fillText(text, 128, 56);

    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.position.set(
      worldPos.x + (Math.random() - 0.5) * 0.6,
      worldPos.y + 2.65,
      worldPos.z + (Math.random() - 0.5) * 0.5
    );
    const w = isBig ? 2.4 : 1.9;
    sp.scale.set(w, w * 0.33, 1);
    sp.renderOrder = 30;
    scene.add(sp);

    floatingPopups.push({ sprite: sp, tex, mat, startedAt: performance.now(), duration: 635 });
  }

  /* ----------------------------------------------------
     5. 載入合戰雙方陣容與事件驅動骨骼動作演出
     ---------------------------------------------------- */
  function loadBattle(res) {
    if (!isInitialized) return;
    battleEpoch++;
    clearAllTokens();
    battleSettled = false;
    audioPaused = false;

    applyBattleTerrain(res && res.terrain);
    const wKey = res?.ev?.id || res?.weather || 'clear';
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
    const now = performance.now();
    [...unitsMap.values()].forEach((token, index) => {
      const direction = token.side === 'A' ? -1 : 1;
      const frontDistance = token.formationRanged ? (token.cat === 'support' ? 7.6 : 5.2) : {
        armor: 0.82,
        air: 0.82,
        naval: 0.9,
        air_defense: 5.2,
        support: 7.6
      }[token.cat] || 2.5;
      const frontLane = {
        air: -5.4,
        armor: -1.8,
        air_defense: 1.8,
        naval: 5.4,
        support: 0
      }[token.cat] || 0;
      token.frontX = direction * frontDistance;
      const laneScale = currentBattleTerrain === 'forest' ? 0.72 : currentBattleTerrain === 'mountain' ? 0.58 : 1;
      token.frontZ = frontLane * laneScale;
      token.frontY = getBattleTerrainHeight(token.frontX, token.frontZ);
      token.march = {
        fromX: token.origX,
        fromY: token.mesh.position.y,
        fromZ: token.origZ,
        startedAt: now + (index % 5) * 70,
        duration: Math.round(1550 / Math.max(0.75, token.formationMobility)),
        started: false,
        finished: false
      };
    });
    finalChargeActive = false;
    meleeActive = false;
    lastMarchSoundAt = now;
    lastMeleeSoundAt = now;
    updateOccupationZones();
  }

  function beginFinalCharge(duration = 1150, allOut = false) {
    const participants = [...unitsMap.values()].filter(token => token.alive);
    if (!isInitialized || battleSettled || !participants.length) return Promise.resolve(false);

    const epoch = battleEpoch;
    const startedAt = performance.now();
    const chargeDuration = isEnabled ? Math.max(0, Number(duration) || 0) : 0;
    const moves = participants.map(token => {
      const start = token.mesh.position.clone();
      const lane = { air: -5.4, armor: -1.8, air_defense: 1.8, naval: 5.4, support: 0 }[token.cat];
      const ranged = !allOut && (['air_defense', 'support'].includes(token.cat) || token.formationRanged);
      const side = token.side === 'A' ? 1 : -1;
      const distance = ranged ? (token.cat === 'support' ? -6.5 : -4.5) : 0.85;
      const laneScale = currentBattleTerrain === 'forest' ? 0.72 : currentBattleTerrain === 'mountain' ? 0.58 : 1;
      const flank = token.formationLayout === 'wings' || token.cat === 'naval' ? 0.65 : 0;
      const target = new THREE.Vector3(
        side * distance,
        0,
        lane * laneScale + side * (0.32 + flank)
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
        if (epoch !== battleEpoch || isAnimationPaused) {
          finalChargeActive = false;
          resolve(false);
          return;
        }
        const progress = chargeDuration === 0 ? 1 : Math.min(1, (now - startedAt) / chargeDuration);
        const eased = progress * progress * (3 - 2 * progress);
        moves.forEach(({ token, start, target, ranged, flank }) => {
          if (!token.alive) return;
          token.mesh.position.lerpVectors(start, target, eased);
          token.mesh.position.z += Math.sin(progress * Math.PI) * flank * (token.side === 'A' ? 1 : -1);
          token.mesh.position.y = getBattleTerrainHeight(token.mesh.position.x, token.mesh.position.z);
          if (progress === 1) {
            token.frontX = target.x;
            token.frontY = target.y;
            token.frontZ = target.z;
            token.chargeCommitted = true;
            triggerSquadAnim(token, ranged ? 'idle' : 'attack', 1.2);
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
    if (state === 'attack') token.attackUntil = performance.now() + 1000 / Math.max(0.5, timeScale);
    token.unitAnims.forEach((ctrl) => ctrl.playState(state, timeScale));
  }

  function advanceBattalionToContact(token) {
    if (!token || !token.alive || token.engagement || token.formationRanged || token.cat === 'support' || token.cat === 'air_defense') return;
    const contactX = token.side === 'A' ? -0.82 : 0.82;
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
      startedAt: performance.now(),
      duration: Math.min(1750, Math.max(520, distance * 620 / Math.max(0.75, token.formationMobility))),
      lastDustAt: 0,
      finished: false
    };
    triggerSquadAnim(token, 'move', token.cat === 'air' ? 1.45 : 1.1);
  }

  async function playEvent(ln) {
    if (!isInitialized || battleSettled || !ln) return;

    const aToken = ln.auid ? unitsMap.get(ln.auid) : null;
    const tToken = ln.tuid ? unitsMap.get(ln.tuid) : null;
    if (!aToken && !tToken) return;

    // 1. 高費名將 ($4~$5) 戰法發動或斬將時觸發光榮風格橫幅 Cut-in (節流防刷屏)
    const nowMs = performance.now();
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
    const forcedMelee = ranged && tToken && aToken.mesh.position.distanceTo(tToken.mesh.position) < 2;
    if ((ln.finale || (meleeActive && (!ranged || forcedMelee))) && aToken && tToken && aToken.alive) {
      await approachMeleeTarget(aToken, tToken);
      if (aToken.epoch !== battleEpoch || battleSettled) { finishEffects(); return effectsFinished; }
      aToken.formationRig.rotation.y = Math.atan2(
        tToken.mesh.position.x - aToken.mesh.position.x,
        tToken.mesh.position.z - aToken.mesh.position.z
      );
      triggerSquadAnim(aToken, 'attack', 1.35);
      if (tToken.alive) triggerSquadAnim(tToken, 'hit', 1.25);
      const midpoint = aToken.mesh.position.clone().lerp(tToken.mesh.position, 0.5);
      spawnSparkBurst(midpoint.add(new THREE.Vector3(0, 0.9, 0)), 26, 0xfbbf24);
      applyImpactReaction(tToken, 0.3);
    } else if (aToken?.formationRanged && aToken.cat !== 'support' && tToken && aToken.alive) {
      triggerSquadAnim(aToken, 'attack', 1.15);
      spawn3DArrowVolley(aToken.mesh.position, tToken.mesh.position, aToken.side);
    } else if (ln.duel && aToken && tToken && aToken.alive && tToken.alive) {
      performDuelClash(aToken, tToken);
    } else if (aToken && tToken && aToken.alive) {
      if (aToken.cat === 'air') {
        deferTargetEffects = performCavalryCharge(aToken, tToken, playTargetEffects);
      } else if (aToken.cat === 'air_defense' || (ln.text && ln.text.includes('箭'))) {
        triggerSquadAnim(aToken, 'attack', 1.25);
        spawn3DArrowVolley(aToken.mesh.position, tToken.mesh.position, aToken.side);
      } else if (aToken.cat === 'naval') {
        performVanguardAssault(aToken, tToken);
      } else if (aToken.cat === 'support') {
        performStrategistFormation(aToken, tToken, ln.text || '');
      } else {
        performPhalanxClash(aToken, tToken);
      }
    }

    // 4. 受擊反應、盾牆格擋與 3D 浮動兵損數字
    if (!deferTargetEffects) playTargetEffects();
    return effectsFinished;

    function playTargetEffects() {
      if (!tToken || battleSettled || tToken.epoch !== battleEpoch) {
        finishEffects();
        return;
      }
      if (ln.kind === 'block') {
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
      if (ln.hpAfter !== undefined) {
        updateTokenHp(tToken, ln.hpAfter);
      }
      if (ln.kind === 'kill' || ln.kind === 'capture') {
        tokenFallDown(tToken, ln.kind === 'capture').then(finishEffects, failEffects);
      } else finishEffects();
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
    triggerSquadAnim(attacker, 'move', attacker.cat === 'air' ? 1.5 : 1.2);
    const startedAt = performance.now();
    const duration = isEnabled ? 450 / Math.max(0.75, attacker.formationMobility) : 0;
    return new Promise(resolve => {
      function step(now) {
        if (attacker.epoch !== battleEpoch || battleSettled || !attacker.alive) { resolve(); return; }
        const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
        attacker.mesh.position.lerpVectors(start, end, progress);
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
    triggerSquadAnim(aToken, 'attack', 1.3);
    triggerSquadAnim(tToken, 'attack', 1.15);
    const midpoint = aToken.mesh.position.clone().lerp(tToken.mesh.position, 0.5);
    spawnSparkBurst(midpoint.add(new THREE.Vector3(0, 0.85, 0)), 22, 0xfbbf24);
    applyImpactReaction(tToken, 0.10);
  }

  function applyImpactReaction(token, distance = 0.16) {
    if (!token || !token.alive) return;
    token.impact = {
      startedAt: performance.now(),
      duration: 300,
      distance
    };
  }

  /* 奔雷突騎：戰馬切換 Gallop 奔馳動畫衝向敵陣，騎將揮槊斬擊 */
  function performCavalryCharge(aToken, tToken, onImpact) {
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
      triggerSquadAnim(aToken, 'attack', 1.2);
      spawnSparkBurst(target.clone().add(new THREE.Vector3(0, 0.8, 0)), 9, 0xfbbf24);
      applyImpactReaction(tToken, 0.12);
      return;
    }

    aToken.chargeInProgress = true;
    aToken.chargeImpactCallbacks.push(onImpact);
    aToken.march = null;
    aToken.engagement = null;
    triggerSquadAnim(aToken, 'move', 1.45);
    const startedAt = performance.now();
    const duration = 420;

    function step(now) {
      if (aToken.epoch !== battleEpoch) {
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
        triggerSquadAnim(aToken, 'attack', 1.35);
        spawnSparkBurst(target.clone().add(new THREE.Vector3(0, 0.8, 0)), 16, 0xfbbf24);
        applyImpactReaction(tToken, 0.22);
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

  /* 神射強弩：16 支箭矢分批拋射 */
  function spawn3DArrowVolley(fromPos, toPos, side) {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const sx = (Math.random() - 0.5) * 1.6;
      const sz = (Math.random() - 0.5) * 1.6;
      const start = fromPos.clone().add(new THREE.Vector3(sx, 1.15, sz));
      const end = toPos.clone().add(new THREE.Vector3(sx * 0.65, 0.45, sz * 0.65));

      let projMesh = null;
      const arrowInst = spawnModelInstance('arrow', { targetMaxDim: 0.78, castShadow: false });
      if (arrowInst) {
        projMesh = arrowInst.group;
      } else {
        projMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.04, 0.65, 6),
          new THREE.MeshBasicMaterial({ color: 0x62523b })
        );
      }

      projMesh.position.copy(start);
      scene.add(projMesh);

      projectiles.push({
        mesh: projMesh,
        start,
        end,
        startedAt: performance.now() + Math.floor(i / 4) * 90 + (i % 4) * 12,
        duration: 450,
        arcHeight: Math.min(3.2, fromPos.distanceTo(toPos) * 0.15) + Math.random() * 0.3,
        isGLB: Boolean(arrowInst)
      });
    }
  }

  /* 先登奇兵：高速疾行騰躍突襲 */
  function performVanguardAssault(aToken, tToken) {
    const orig = aToken.mesh.position.clone();
    const target = tToken.mesh.position.clone();
    const direction = target.clone().sub(orig).normalize();
    const strikePos = orig.clone().add(direction.multiplyScalar(Math.max(0, orig.distanceTo(target) - 0.78)));
    strikePos.y = getBattleTerrainHeight(strikePos.x, strikePos.z);
    if (aToken.chargeCommitted) {
      triggerSquadAnim(aToken, 'attack', 1.25);
      spawnSparkBurst(tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 12, 0x2dd4bf);
      return;
    }

    triggerSquadAnim(aToken, 'move', 1.5);
    aToken.march = null;
    aToken.engagement = null;
    const startedAt = performance.now();
    function step(now) {
      if (aToken.epoch !== battleEpoch || !aToken.alive) return;
      const progress = Math.min(1, (now - startedAt) / 650);
      aToken.mesh.position.lerpVectors(orig, strikePos, progress);
      aToken.mesh.position.y = getBattleTerrainHeight(aToken.mesh.position.x, aToken.mesh.position.z);
      if (progress === 1) {
        aToken.chargeCommitted = true;
        aToken.frontX = strikePos.x;
        aToken.frontZ = strikePos.z;
        aToken.frontY = strikePos.y;
        triggerSquadAnim(aToken, 'attack', 1.4);
        spawnSparkBurst(tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 18, 0x2dd4bf);
        applyImpactReaction(tToken, 0.16);
      }
      if (progress < 1) requestAnimationFrame(step);
      else aToken.mesh.position.set(strikePos.x, strikePos.y, strikePos.z);
    }
    step(startedAt);
  }

  /* 重甲陷陣：步兵方陣推進短兵相接 */
  function performPhalanxClash(aToken, tToken) {
    triggerSquadAnim(aToken, 'attack', 1.25);
    spawnSparkBurst(tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.7, 0)), 16, 0xfde047);
    applyImpactReaction(tToken, 0.10);
  }

  /* Orders raise dust; only explicit fire attacks produce embers. */
  function performStrategistFormation(aToken, tToken, logText) {
    triggerSquadAnim(aToken, 'attack', 1.15);
    const isFire = logText.includes('火') || logText.includes('砲') || logText.includes('焚');
    spawnDustPuff(tToken.mesh.position);
    if (isFire) spawnSparkBurst(tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 8, 0xbe7945);
  }

  function performShieldBlockDome(tToken) {
    triggerSquadAnim(tToken, 'hit', 1.1);
    spawnSparkBurst(tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.55, 0)), 5, 0xaba58d);
    applyImpactReaction(tToken, 0.08);
  }

  function updateTokenHp(token, newHp) {
    token.currentHp = Math.max(0, newHp);
    if (token.hud && token.hud.redraw) {
      token.hud.redraw(token.currentHp);
      token.hud.tex.needsUpdate = true;
    }
  }

  function tokenFallDown(token, captured = false, immediate = false) {
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
    spawnDustPuff(token.mesh.position);
    const startedAt = performance.now();
    token.deathAnimation = new Promise(resolve => {
      function fall(now) {
        if (token.epoch !== battleEpoch) { resolve(); return; }
        const progress = immediate || token.fallen ? 1 : Math.min(1, (now - startedAt) / 700);
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
    token.troopsContainer.children.forEach(troop => {
      if (troop.userData.isFormationTroop) troop.rotation.z = progress * Math.PI / 2;
    });
    if (token.hud?.sprite?.material) token.hud.sprite.material.opacity = 1 - progress * 0.45;
    token.fallen = progress === 1;
  }

  function syncBattleResult(res) {
    battleSettled = true;
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
    if (!container || container.querySelector('#warlordCutinBanner')) return;
    const div = document.createElement('div');
    div.id = 'warlordCutinBanner';
    div.style.cssText = [
      'position:absolute;top:12px;left:50%;transform:translateX(-50%) scale(0.92);',
      'z-index:30;display:flex;align-items:center;gap:14px;padding:8px 22px 8px 10px;',
      'background:linear-gradient(95deg,rgba(15,23,42,0.96),rgba(69,10,10,0.92),rgba(15,23,42,0.95));',
      'border:1px solid #938269;border-radius:3px;',
      'box-shadow:0 4px 16px rgba(0,0,0,0.4);',
      'color:#fff;pointer-events:none;opacity:0;transition:all 0.22s cubic-bezier(0.16,1,0.3,1);'
    ].join('');
    container.appendChild(div);
  }

  function triggerWarlordCutin(token, isKill = false) {
    const el = container ? container.querySelector('#warlordCutinBanner') : null;
    if (!el) return;
    const meta = CAT_META[token.cat] || CAT_META.armor;
    const actionLabel = isKill ? '一騎討・陣斬敵將！' : `${token.wep || meta.label}・戰法發動！`;
    const borderCol = token.side === 'A' ? '#889ca5' : '#b68a74';

    el.style.borderColor = borderCol;
    el.innerHTML = `
      <img src="${PORTRAIT_DIR}${token.id}.jpg?v=${ASSET_VER}"
           style="width:54px;height:54px;border-radius:50%;object-fit:cover;object-position:center 15%;border:2.5px solid ${borderCol};flex-shrink:0;"
           onerror="this.style.display='none'">
      <div style="line-height:1.2;">
        <div style="font-size:11px;color:#fde68a;font-weight:800;letter-spacing:1.5px;">
          ${token.side === 'A' ? '【我軍主將戰法】' : '【敵軍猛將強襲】'} · ${meta.label}
        </div>
        <div style="font-size:18px;font-weight:900;font-family:'Noto Serif TC',serif;color:#ffffff;margin-top:2px;">
          ${token.name} <span style="font-size:13px;color:#fbbf24;font-weight:700;margin-left:6px;">${actionLabel}</span>
        </div>
      </div>
    `;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) scale(1)';

    if (cutinTimeout) clearTimeout(cutinTimeout);
    cutinTimeout = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) scale(0.92)';
    }, 1100);
  }

  /* ----------------------------------------------------
     7. 粒子火花、塵土、震屏與相機控制
     ---------------------------------------------------- */
  function spawnSparkBurst(pos, count = 14, colorHex = 0xfbbf24) {
    count = Math.min(count, isLowPowerDevice ? 4 : 7);
    colorHex = new THREE.Color(colorHex).lerp(new THREE.Color(0xb7a58a), 0.85);
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.022, 4, 3);
      const mat = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? colorHex : 0xffffff, transparent: true, opacity: 1 });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      scene.add(m);
      particleSystems.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 0.26,
        vy: Math.random() * 0.22 + 0.06,
        vz: (Math.random() - 0.5) * 0.26,
        startedAt: performance.now(),
        duration: 300 + Math.random() * 130,
        opacity: 1,
        gravity: 0.013
      });
    }
  }

  function spawnDustPuff(pos) {
    if (!dustTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      gradient.addColorStop(0, 'rgba(255,255,255,0.65)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      dustTexture = new THREE.CanvasTexture(canvas);
    }
    const mat = new THREE.SpriteMaterial({ map: dustTexture, color: 0xb9a68c, opacity: 0.22, depthWrite: false });
    const m = new THREE.Sprite(mat);
    m.scale.set(0.9, 0.4, 1);
    m.position.set(pos.x + (Math.random() - 0.5) * 0.5, pos.y + 0.18, pos.z + (Math.random() - 0.5) * 0.5);
    scene.add(m);
    particleSystems.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 0.04,
      vy: 0.008,
      vz: (Math.random() - 0.5) * 0.04,
      startedAt: performance.now(),
      duration: 650,
      opacity: 0.22,
      gravity: 0,
      scaleGrowth: 0.045
    });
  }

  function getBattleCameraFov(aspect) {
    if (aspect <= 2.4) return cameraView === 'cinematic' ? 42 : 48;
    const horizontalFov = (cameraView === 'cinematic' ? 78 : 100) * Math.PI / 180;
    return 2 * Math.atan(Math.tan(horizontalFov / 2) / aspect) * 180 / Math.PI;
  }

  function updateCameraPosition() {
    if (!camera) return;
    const target = CAM_BASE_TARGET.clone().add(camFocusOffset);
    const x = target.x + camRadius * Math.sin(camPhi) * Math.sin(camTheta);
    const y = target.y + camRadius * Math.cos(camPhi);
    const z = target.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta);
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
    camTheta = cameraView === 'cinematic' ? -0.12 : 0;
    camPhi = cameraView === 'cinematic' ? 1.0 : 0.78;
    camRadius = (container && container.clientWidth < 720) ? 22 : cameraView === 'cinematic' ? 18.5 : 25;
    camFocusOffset.set(0, 0, 0);
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

  function updateCommanderLabels() {
    if (!camera || !container) return;
    const height = container.clientHeight || 340;
    const width = container.clientWidth || 960;
    const topInset = 40;
    const labelAreaHeight = Math.max(1, height - topInset);
    const placed = [];
    const narrow = width < 520;
    const sideRows = { A: 0, B: 0 };
    const sideIndex = { A: 0, B: 0 };
    unitsMap.forEach(token => { sideRows[token.side]++; });
    unitsMap.forEach(token => {
      const sprite = token.hud.sprite;
      const desiredWidth = showUnitLabels ? Math.min(190, width * 0.4)
        : Math.max(124, Math.min(168, token.name.length * 16 + 44, (width - 12) / 2));
      const pixels = narrow ? Math.min(desiredWidth, Math.max(1, labelAreaHeight / sideRows[token.side] - 4) * 512 / 176) : desiredWidth;
      const labelHeight = pixels * 176 / 512;
      const anchor = token.mesh.position.clone().add(new THREE.Vector3(
        token.side === 'A' ? -0.3 : 0.3, token.cat === 'air' ? 1.95 : 1.4, 0));
      const point = anchor.clone().project(camera);
      let x = Math.max(pixels / 2 + 3, Math.min(width - pixels / 2 - 3, (point.x + 1) * width / 2));
      const startY = Math.max(topInset + labelHeight / 2 + 3, Math.min(height - labelHeight / 2 - 3, (1 - point.y) * height / 2));
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
          if (candidateY < topInset + labelHeight / 2 || candidateY > height - labelHeight / 2) continue;
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
    if (meleeActive && now - lastMeleeSoundAt > 1700) {
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

    function animate(now) {
      animFrameId = requestAnimationFrame(animate);
      if (!isEnabled) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimestamp) / 1000));
      lastTimestamp = now;
      const elapsed = now * 0.001;

      // 1. 更新所有 3D 士兵與戰馬的骨骼動畫
      for (let i = 0; i < activeMixers.length; i++) {
        activeMixers[i].mixer.update(dt);
      }

      unitsMap.forEach((token) => {
        if (!token.alive) return;
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
          if (progress < 0.9 && now - engagement.lastDustAt > 150) {
            spawnDustPuff(token.mesh.position);
            engagement.lastDustAt = now;
          }
          if (progress >= 1) {
            engagement.finished = true;
            token.mesh.position.set(engagement.targetX, engagement.targetY, engagement.targetZ);
            triggerSquadAnim(token, 'idle', 1.0);
          }
        }

        const ranks = token.troopsContainer.children.find(child => child.userData.isBattalionRanks);
        if (ranks) {
          const moving = finalChargeActive || Boolean((march && !march.finished) || (engagement && !engagement.finished));
          const fighting = meleeActive && !moving && !['air_defense', 'support'].includes(token.cat) && !token.formationRanged;
          BattleFigures.animate(ranks, token, now, moving || token.figureState === 'move', fighting, getBattleTerrainHeight);
        }
      });
      if (now - lastOccupationZoneUpdate > 180) {
        updateOccupationZones();
        lastOccupationZoneUpdate = now;
      }

      // 2. 相機焦點平滑回中與呼吸感
      if (lastFocusAt && now - lastFocusAt > 900) {
        camFocusTarget.set(0, 0, 0);
        lastFocusAt = 0;
      }
      camFocusOffset.set(0, 0, 0);
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

      // 3. 營寨火盆躍動與河水波光
      for (let i = 0; i < brazierLights.length; i++) {
        const b = brazierLights[i];
        b.light.intensity = b.baseIntensity + Math.sin(elapsed * 7.5 + i * 1.7) * 0.35;
        if (b.fireMesh) {
          const s = 1 + Math.sin(elapsed * 10 + i) * 0.14;
          b.fireMesh.scale.set(s, s * 1.22, s);
        }
      }
      if (riverMeshRef && riverMeshRef.material) {
        riverMeshRef.material.emissiveIntensity = 0.30 + Math.sin(elapsed * 2.2) * 0.08;
      }

      // 4. 暴雨粒子下落
      if (weatherParticles && currentWeatherKey === 'storm') {
        const pos = weatherParticles.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          let py = pos.getY(i) - 18 * dt;
          if (py < 0) py = 14;
          pos.setY(i, py);
        }
        pos.needsUpdate = true;
      }

      // 5. 3D 拋物線箭矢飛行
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        const progress = (now - p.startedAt) / p.duration;
        if (progress < 0) continue;
        if (progress >= 1.0) {
          spawnSparkBurst(p.end, 3, 0xf97316);
          scene.remove(p.mesh);
          if (!p.isGLB) { p.mesh.geometry.dispose(); p.mesh.material.dispose(); }
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

      // 6. 粒子與塵土更新
      for (let i = particleSystems.length - 1; i >= 0; i--) {
        const pt = particleSystems[i];
        const steps = dt * 60;
        pt.mesh.position.x += pt.vx * steps;
        pt.mesh.position.y += pt.vy * steps;
        pt.mesh.position.z += pt.vz * steps;
        pt.vy -= (pt.gravity || 0) * steps;
        if (pt.scaleGrowth) pt.mesh.scale.addScalar(pt.scaleGrowth * steps);
        const remaining = Math.max(0, 1 - (now - pt.startedAt) / pt.duration);
        if (pt.mesh.material) pt.mesh.material.opacity = remaining * pt.opacity;
        if (remaining === 0) {
          scene.remove(pt.mesh);
          if (!pt.mesh.isSprite) pt.mesh.geometry.dispose();
          pt.mesh.material.dispose();
          particleSystems.splice(i, 1);
        }
      }

      // 7. 浮動兵損數字上升消退
      for (let i = floatingPopups.length - 1; i >= 0; i--) {
        const fp = floatingPopups[i];
        fp.sprite.position.y += 1.35 * dt;
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
    window.SoundEngine?.stopSpatial?.();
    unitsMap.forEach((t) => {
      if (scene && t.mesh) scene.remove(t.mesh);
      if (t.hud && t.hud.tex) t.hud.tex.dispose();
      if (t.hud) t.hud.sprite.material.dispose();
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
      if (!p.isGLB) { p.mesh.geometry.dispose(); p.mesh.material.dispose(); }
    });
    projectiles = [];

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
      cameraPosition: camera ? camera.position.toArray() : [],
      drawCalls: renderer ? renderer.info.render.calls : 0,
      triangles: renderer ? renderer.info.render.triangles : 0,
      activeEffects: projectiles.length + particleSystems.length + floatingPopups.length,
      reserveSoldiers: reserveArmy ? reserveArmy.children.filter(mesh => !mesh.userData.reserveFlags).reduce((sum, mesh) => sum + mesh.count, 0) : 0,
      reserveFlags: reserveArmy ? reserveArmy.children.find(mesh => mesh.userData.reserveFlags).count : 0,
      audioPaused,
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
      battalions: [...unitsMap.values()].map(token => ({
        uid: token.uid, side: token.side, cat: token.cat, alive: token.alive, fallen: token.fallen,
        layout: token.formationLayout, ranged: token.formationRanged || ['air_defense', 'support'].includes(token.cat),
        originalFigures: token.troopsContainer.children.some(child => child.userData.originalFigures),
        figureParts: token.troopsContainer.children.find(child => child.userData.originalFigures)?.children.map(mesh => mesh.userData.part) || [],
        animationAt: token.troopsContainer.children.find(child => child.userData.originalFigures)?.userData.animationAt || 0,
        casualties: token.troopsContainer.children.find(child => child.userData.originalFigures)?.userData.casualtyAt.filter(value => value !== null).length || 0,
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
    beginFinalCharge,
    syncBattleResult,
    pauseAnimationLoop,
    setAudioPaused: paused => {
      audioPaused = Boolean(paused);
      if (audioPaused) window.SoundEngine?.stopSpatial?.();
    },
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
