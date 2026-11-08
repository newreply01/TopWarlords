/* =====================================================
   TopWarlords 3D 古戰場全模型合戰引擎 v7.0 (Three.js r128 + GLTFLoader + SkeletonUtils)
   光榮特庫摩《三國志14》／《信長之野望・新生》風格
   全 3D 骨骼動畫兵種方陣托盤 (Unit Formation Plinth) · 寫實名將軍徽 · 山河渡口古戰場地形
   ===================================================== */
'use strict';

const Battle3DEngine = (function () {
  const ASSET_VER = '7.0.1';
  const MODEL_DIR = 'assets/models/';
  const PORTRAIT_DIR = 'assets/warlords/';

  const MODEL_MANIFEST = {
    horse_armored: 'horse_armored.glb',
    horse: 'horse.glb',
    infantry: 'infantry.glb',
    strategist: 'strategist.glb',
    spear: 'spear.glb',
    pike: 'pike.glb',
    katana: 'katana.glb',
    sword: 'sword.glb',
    bow: 'bow.glb',
    arrow: 'arrow.glb',
    shield_tower: 'shield_tower.glb',
    shield_round: 'shield_round.glb',
    banner: 'banner.glb',
    flag: 'flag.glb',
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
  let isInitialized = false;
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
  let sunLightRef = null;
  let hemiLightRef = null;
  let riverMeshRef = null;

  const unitsMap = new Map();      // uid -> UnitPlinthToken
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
  const CAM_BASE_TARGET = new THREE.Vector3(0, 0.55, 0.35);
  const camFocusOffset = new THREE.Vector3(0, 0, 0);
  const camShakeOffset = new THREE.Vector3(0, 0, 0);

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

    modelsLoadPromise = Promise.all(
      entries.map(([key, file]) => new Promise((resolve) => {
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
      }))
    );
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

    scene = new THREE.Scene();
    scene.background = createSkyBackdropTexture('plain');
    scene.fog = new THREE.FogExp2(0x4a3d31, 0.0135);

    camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 300);
    updateCameraPosition();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.ACESFilmicToneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
    }

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    setupLighting();
    buildAncientBattlefieldTerrain();
    setupCameraControls();
    injectCutinLayer();

    window.removeEventListener('resize', onWindowResize);
    window.addEventListener('resize', onWindowResize);

    isInitialized = true;
    lastTimestamp = performance.now();
    startAnimationLoop();
    return true;
  }

  function setupLighting() {
    hemiLightRef = new THREE.HemisphereLight(0xfff4d6, 0x4b3f2f, 0.95);
    hemiLightRef.position.set(0, 28, 0);
    scene.add(hemiLightRef);

    sunLightRef = new THREE.DirectionalLight(0xffedd5, 1.55);
    sunLightRef.position.set(-16, 26, 15);
    sunLightRef.castShadow = true;
    sunLightRef.shadow.mapSize.width = 2048;
    sunLightRef.shadow.mapSize.height = 2048;
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
    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.52);
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

    // 淡雅戰術九宮格刻度線 (光榮沙盤韻味)
    ctx.strokeStyle = 'rgba(245, 222, 179, 0.11)';
    ctx.lineWidth = 1;
    for (let x = 64; x < 1024; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    for (let y = 64; y < 512; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
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

    const groundMat = new THREE.MeshStandardMaterial({
      map: createTerrainTexture(),
      roughness: 0.88,
      metalness: 0.04
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 2. 中央波光粼粼古戰場渡河 (渭水／官渡淺灘)
    const riverGeo = new THREE.PlaneGeometry(3.2, 34, 8, 24);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x2b6cb0,
      emissive: 0x0c2d48,
      emissiveIntensity: 0.35,
      roughness: 0.18,
      metalness: 0.65,
      transparent: true,
      opacity: 0.82
    });
    riverMeshRef = new THREE.Mesh(riverGeo, riverMat);
    riverMeshRef.rotation.x = -Math.PI / 2;
    riverMeshRef.position.y = -0.06;
    riverMeshRef.receiveShadow = true;
    scene.add(riverMeshRef);

    // 3. 三座古木戰橋橫跨淺灘 (北橋 z=-3.8、中軍大橋 z=0、南橋 z=+3.8)
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.78, metalness: 0.08 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x4a2e16, roughness: 0.82 });
    [-3.8, 0.0, 3.8].forEach((bz, idx) => {
      const bw = idx === 1 ? 2.1 : 1.55;
      const bridge = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.14, bw), woodMat);
      deck.position.set(0, 0.06, bz);
      deck.castShadow = true;
      deck.receiveShadow = true;
      bridge.add(deck);

      [-bw / 2 + 0.08, bw / 2 - 0.08].forEach((rz) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.24, 0.10), railMat);
        rail.position.set(0, 0.22, bz + rz);
        rail.castShadow = true;
        bridge.add(rail);
      });
      scene.add(bridge);
    });

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

  /**
   * 為士兵模型頂部裝配古代兵種專屬兜鍪冠飾 (紅纓、鍬形前立、玄鐵兜)，拉開五兵種近景辨識度
   */
  function addHelmetCrest(parentGroup, headY, crestType, crestColor) {
    const mat = new THREE.MeshStandardMaterial({
      color: crestColor,
      roughness: 0.32,
      metalness: crestType === 'horns' ? 0.85 : 0.18
    });
    if (crestType === 'plume') {
      // 突騎紅纓／蒼纓馬尾冠
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 6), mat);
      plume.rotation.x = -0.55;
      plume.position.set(0, headY + 0.06, -0.05);
      parentGroup.add(plume);
    } else if (crestType === 'horns') {
      // 重甲／先登大將鎏金鍬形前立雙角
      [-1, 1].forEach((dir) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.20, 4), mat);
        horn.position.set(dir * 0.08, headY + 0.07, 0.06);
        horn.rotation.z = -dir * 0.48;
        horn.rotation.x = 0.18;
        parentGroup.add(horn);
      });
    }
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
        const tower = spawnModelInstance('watchtower', { targetHeight: 3.1, tintHex: tint, tintStrength: 0.14 });
        if (tower) {
          tower.group.position.set(sx * 13.0, 0, zPos);
          tower.group.rotation.y = faceY;
          envPropsGroup.add(tower.group);
        }
      });

      [-1.9, 1.9].forEach((zPos) => {
        const tent = spawnModelInstance('tent', { targetHeight: 1.85, tintHex: tint, tintStrength: 0.25 });
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
        envPropsGroup.add(abatis);
      });
    });

    // 南北山崖巨石群
    const rockSpots = [
      [-11, -9.5, 2.6, 'rock_a'], [-5, -10.2, 3.1, 'rock_b'], [2, -9.8, 2.8, 'rock_a'], [9, -10.0, 3.2, 'rock_b'],
      [-10, 9.6, 2.8, 'rock_b'], [-3, 10.1, 2.5, 'rock_a'], [4, 9.9, 3.0, 'rock_b'], [11, 9.5, 2.7, 'rock_a']
    ];
    rockSpots.forEach(([rx, rz, rh, rkey], i) => {
      const rk = spawnModelInstance(rkey, { targetHeight: rh, castShadow: true });
      if (rk) {
        rk.group.position.set(rx, 0.15, rz);
        rk.group.rotation.y = i * 1.1;
        envPropsGroup.add(rk.group);
      }
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
    } else {
      scene.fog = new THREE.FogExp2(0x4a3d31, 0.0125);
      if (sunLightRef) sunLightRef.intensity = 1.55;
      if (hemiLightRef) hemiLightRef.intensity = 0.95;
    }
  }

  /* ----------------------------------------------------
     3. 打造《三國志》立體部隊方陣托盤 + 全 3D 骨骼動畫兵種
     ---------------------------------------------------- */
  function createUnitToken(unit, side, index) {
    const isSideA = side === 'A';
    const cat = unit.cat || 'armor';
    const meta = CAT_META[cat] || CAT_META.armor;
    const coords = (SLOT_COORDS[side] && SLOT_COORDS[side][cat]) || { x: isSideA ? -6 : 6, z: (index - 2) * 3.0 };
    const factionColor = isSideA ? 0x2563eb : 0xdc2626;
    const factionTrim = isSideA ? 0x38bdf8 : 0xf59e0b;

    const rootGroup = new THREE.Group();
    rootGroup.position.set(coords.x, 0, coords.z);

    // 朝向旋轉群組：本地 +Z 一律代表「面向敵陣前方」
    // A 軍 (+X 方向): rotation.y = +Math.PI/2；B 軍 (-X 方向): rotation.y = -Math.PI/2
    const formationRig = new THREE.Group();
    formationRig.rotation.y = isSideA ? Math.PI / 2 : -Math.PI / 2;
    rootGroup.add(formationRig);

    // A. 光榮風格雕花漆木戰術方陣托盤 (Unit Formation Plinth)
    const PLINTH_W = 2.45; // 左右寬 (local X)
    const PLINTH_D = 2.65; // 前後深 (local Z)
    const PLINTH_H = 0.22;

    const plinthGroup = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({
      color: isSideA ? 0x172554 : 0x450a0a,
      roughness: 0.42,
      metalness: 0.25
    });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(PLINTH_W, PLINTH_H, PLINTH_D), baseMat);
    baseMesh.position.y = PLINTH_H / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    plinthGroup.add(baseMesh);

    // 托盤頂面戰陣泥石台面
    const topDeckMat = new THREE.MeshStandardMaterial({
      color: isSideA ? 0x334155 : 0x44332a,
      roughness: 0.78,
      metalness: 0.08
    });
    const topDeck = new THREE.Mesh(new THREE.BoxGeometry(PLINTH_W - 0.16, 0.04, PLINTH_D - 0.16), topDeckMat);
    topDeck.position.y = PLINTH_H + 0.015;
    topDeck.receiveShadow = true;
    plinthGroup.add(topDeck);

    // 四邊鎏金／陣營鑲邊與前鋒箭頭指向標
    const rimMat = new THREE.MeshStandardMaterial({
      color: factionTrim,
      emissive: factionColor,
      emissiveIntensity: 0.22,
      roughness: 0.3,
      metalness: 0.75
    });
    const fBar = new THREE.Mesh(new THREE.BoxGeometry(PLINTH_W + 0.06, 0.07, 0.08), rimMat);
    fBar.position.set(0, PLINTH_H + 0.01, PLINTH_D / 2);
    plinthGroup.add(fBar);
    const bBar = fBar.clone();
    bBar.position.z = -PLINTH_D / 2;
    plinthGroup.add(bBar);

    const sBarGeo = new THREE.BoxGeometry(0.08, 0.07, PLINTH_D + 0.06);
    const lBar = new THREE.Mesh(sBarGeo, rimMat);
    lBar.position.set(-PLINTH_W / 2, PLINTH_H + 0.01, 0);
    plinthGroup.add(lBar);
    const rBar = lBar.clone();
    rBar.position.x = PLINTH_W / 2;
    plinthGroup.add(rBar);

    // 托盤正前方陣向金三角箭標 (+Z 為前鋒)
    const arrowChevron = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.32, 3), rimMat);
    arrowChevron.rotation.x = Math.PI / 2;
    arrowChevron.position.set(0, PLINTH_H * 0.6, PLINTH_D / 2 + 0.18);
    plinthGroup.add(arrowChevron);

    formationRig.add(plinthGroup);

    // B. 3D 兵種模型方陣容器
    const troopsContainer = new THREE.Group();
    troopsContainer.position.y = PLINTH_H + 0.03;
    formationRig.add(troopsContainer);

    // C. 光榮式懸浮名將頭像軍徽與即時兵力銘牌 (Sprite 永遠正對鏡頭、不遮擋 3D 士兵！)
    const startHp = Math.max(1, Number(unit.maxHp || unit.hpMax || unit.hp || 200));
    const hud = buildWarlordCrestHud(unit, isSideA, meta, startHp, startHp);
    hud.sprite.position.set(0, PLINTH_H + 2.28, 0);
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
      mesh: rootGroup,
      formationRig,
      plinthGroup,
      troopsContainer,
      hud,
      unitAnims: [],
      baguaMesh: null,
      origX: coords.x,
      origZ: coords.z,
      currentHp: startHp,
      maxHp: startHp,
      alive: true,
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
    const factionTint = isSideA ? 0x1d4ed8 : 0xb91c1c;
    const plumeColor = isSideA ? 0x38bdf8 : 0xef4444;
    const goldColor = 0xfbbf24;
    const cat = token.cat;

    // 後排主將背旗／帥旗 (所有兵種托盤皆立戰旗，強化三國合戰軍陣感)
    attachProp(g, 'banner', { targetHeight: 1.55, tintHex: factionTint, tintStrength: 0.45 }, [-0.92, 0, -0.92], [0, 0, 0]);

    if (cat === 'air') {
      // 【⚡ 奔雷突騎】：3 騎全骨骼動畫具裝戰馬 + 挺立披甲騎將 + 水平前指長槊楔形陣
      const cavSpots = [
        { x: 0.00, z: 0.42, lead: true },
        { x: -0.68, z: -0.32, lead: false },
        { x: 0.68, z: -0.32, lead: false }
      ];
      cavSpots.forEach((sp) => {
        const mountUnit = new THREE.Group();
        mountUnit.position.set(sp.x, 0, sp.z);

        const horseKey = sp.lead ? 'horse_armored' : 'horse';
        const horse = spawnModelInstance(horseKey, {
          targetHeight: sp.lead ? 1.08 : 0.98,
          tintHex: sp.lead ? (isSideA ? 0xf8fafc : 0x7f1d1d) : null,
          tintStrength: sp.lead ? 0.22 : 0,
          registerAnim: true
        });
        if (horse) {
          mountUnit.add(horse.group);
          if (horse.animCtrl) token.unitAnims.push(horse.animCtrl);
        }

        const rider = spawnModelInstance('infantry', {
          targetHeight: 0.78,
          tintHex: factionTint,
          tintStrength: 0.34,
          registerAnim: true
        });
        if (rider) {
          rider.group.position.set(0, 0.50, -0.04);
          addHelmetCrest(rider.group, 0.74, sp.lead ? 'horns' : 'plume', sp.lead ? goldColor : plumeColor);
          mountUnit.add(rider.group);
          if (rider.animCtrl) token.unitAnims.push(rider.animCtrl);
        }

        // spear.glb 原生軸向已沿 +Z，設為微仰 [-0.10, 0, 0] 讓騎槊筆直朝前直指敵軍！
        attachProp(mountUnit, 'spear', { targetMaxDim: 1.52 }, [0.22, 0.78, 0.32], [-0.10, 0, 0]);
        g.add(mountUnit);
      });

    } else if (cat === 'armor') {
      // 【🛡️ 重甲陷陣】：前排 3 名大盾重鎧甲士 + 後排 3 名長槍兵密集魚鱗方陣
      const heavyArmorTint = isSideA ? 0x1e40af : 0x991b1b;
      [-0.68, 0.0, 0.68].forEach((xPos, idx) => {
        const front = new THREE.Group();
        front.position.set(xPos, 0, 0.50);
        const w = spawnModelInstance('infantry', {
          targetHeight: idx === 1 ? 1.04 : 0.96,
          tintHex: idx === 1 ? goldColor : heavyArmorTint,
          tintStrength: idx === 1 ? 0.32 : 0.36,
          registerAnim: true
        });
        if (w) {
          if (idx === 1) addHelmetCrest(w.group, 1.00, 'horns', goldColor);
          front.add(w.group);
          if (w.animCtrl) token.unitAnims.push(w.animCtrl);
        }
        attachProp(front, 'shield_tower', { targetHeight: 0.78, tintHex: factionTint, tintStrength: 0.25 }, [-0.08, 0.08, 0.28], [0, 0, 0]);
        // sword.glb 原生直立 (+Y)，旋轉 +Math.PI * 0.36 呈斜前備戰握持
        attachProp(front, 'sword', { targetMaxDim: 0.72 }, [0.24, 0.44, 0.14], [Math.PI * 0.36, 0, 0]);
        g.add(front);
      });

      [-0.68, 0.0, 0.68].forEach((xPos) => {
        const rear = new THREE.Group();
        rear.position.set(xPos, 0, -0.40);
        const inf = spawnModelInstance('infantry', {
          targetHeight: 0.96,
          tintHex: heavyArmorTint,
          tintStrength: 0.30,
          registerAnim: true
        });
        if (inf) {
          rear.add(inf.group);
          if (inf.animCtrl) token.unitAnims.push(inf.animCtrl);
        }
        // pike.glb 原生直立 (+Y)，握把置於後排兵腰側並旋轉 +Math.PI * 0.42 越過前排盾牆平指前方！
        attachProp(rear, 'pike', { targetMaxDim: 1.68 }, [0.22, 0.48, -0.05], [Math.PI * 0.42, 0, 0]);
        g.add(rear);
      });

    } else if (cat === 'air_defense') {
      // 【🏹 神射強弩】：前排雙座「鹿角拒馬」木柵掩體 + 4 名骨骼動畫強弩弓手交錯齊射陣
      [-0.56, 0.56].forEach((bx) => {
        const abatis = buildWoodenAbatis(0.92, 0.54);
        abatis.position.set(bx, 0, 0.80);
        g.add(abatis);
      });

      const archerTint = isSideA ? 0x3b82f6 : 0xd97706;
      const archSpots = [
        [-0.62, 0.16], [0.62, 0.16],
        [-0.36, -0.52], [0.36, -0.52]
      ];
      archSpots.forEach(([ax, az], idx) => {
        const archer = new THREE.Group();
        archer.position.set(ax, 0, az);
        const sol = spawnModelInstance('infantry', {
          targetHeight: 0.95,
          tintHex: archerTint,
          tintStrength: 0.28,
          registerAnim: true
        });
        if (sol) {
          if (idx < 2) addHelmetCrest(sol.group, 0.91, 'plume', plumeColor);
          archer.add(sol.group);
          if (sol.animCtrl) token.unitAnims.push(sol.animCtrl);
        }
        attachProp(archer, 'bow', { targetMaxDim: 0.74 }, [0.16, 0.22, 0.28], [0, Math.PI / 2, 0]);
        // arrow.glb 原生直立 (+Y)，旋轉 Math.PI * 0.46 微仰搭弦朝向敵軍 (+Z)
        attachProp(archer, 'arrow', { targetMaxDim: 0.64 }, [0.16, 0.56, 0.18], [Math.PI * 0.46, 0, 0]);
        g.add(archer);
      });

    } else if (cat === 'naval') {
      // 【⚔️ 先登奇兵】：4 名玄甲死士鋒矢突擊陣 (持太刀＋圓盾，頭頂鍬形前立與突擊纓冠)
      const vanguardTint = isSideA ? 0x0f766e : 0x7f1d1d;
      const vanSpots = [
        { x: 0.00, z: 0.60, h: 1.04, lead: true },
        { x: -0.66, z: 0.02, h: 0.95, lead: false },
        { x: 0.66, z: 0.02, h: 0.95, lead: false },
        { x: 0.00, z: -0.52, h: 0.95, lead: false }
      ];
      vanSpots.forEach((sp) => {
        const van = new THREE.Group();
        van.position.set(sp.x, 0, sp.z);
        const fig = spawnModelInstance('infantry', {
          targetHeight: sp.h,
          tintHex: vanguardTint,
          tintStrength: 0.42,
          registerAnim: true
        });
        if (fig) {
          addHelmetCrest(fig.group, sp.h - 0.04, sp.lead ? 'horns' : 'plume', sp.lead ? goldColor : plumeColor);
          van.add(fig.group);
          if (fig.animCtrl) token.unitAnims.push(fig.animCtrl);
        }
        attachProp(van, 'katana', { targetMaxDim: 0.84 }, [0.22, 0.46, 0.18], [Math.PI * 0.32, 0, -0.22]);
        attachProp(van, 'shield_round', { targetMaxDim: 0.52, tintHex: factionTint, tintStrength: 0.30 }, [-0.22, 0.44, 0.18], [0, 0.35, 0]);
        g.add(van);
      });

    } else {
      // 【📜 軍師奇謀】：太極八卦祈禳法壇 + 軍師本尊 + 朱漆雷音大戰鼓 + 左右金吾衛護法
      const baguaCanvas = document.createElement('canvas');
      baguaCanvas.width = 256;
      baguaCanvas.height = 256;
      const bctx = baguaCanvas.getContext('2d');
      bctx.translate(128, 128);
      bctx.strokeStyle = isSideA ? '#38bdf8' : '#fbbf24';
      bctx.lineWidth = 5;
      bctx.beginPath(); bctx.arc(0, 0, 114, 0, Math.PI * 2); bctx.stroke();
      bctx.beginPath(); bctx.arc(0, 0, 88, 0, Math.PI * 2); bctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        bctx.save();
        bctx.rotate(a);
        bctx.fillStyle = isSideA ? 'rgba(56,189,248,0.85)' : 'rgba(251,191,36,0.85)';
        bctx.fillRect(-16, -106, 32, 6);
        bctx.fillRect(-16, -96, 13, 6);
        bctx.fillRect(3, -96, 13, 6);
        bctx.restore();
      }
      const baguaTex = new THREE.CanvasTexture(baguaCanvas);
      const baguaMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2.05, 2.05),
        new THREE.MeshBasicMaterial({ map: baguaTex, transparent: true, opacity: 0.78, depthWrite: false })
      );
      baguaMesh.rotation.x = -Math.PI / 2;
      baguaMesh.position.y = 0.02;
      g.add(baguaMesh);
      token.baguaMesh = baguaMesh;

      // 中央軍師高台與軍師模型
      const dais = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.56, 0.18, 8),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5, metalness: 0.3 })
      );
      dais.position.set(0, 0.09, 0.05);
      g.add(dais);

      const strat = spawnModelInstance('strategist', {
        targetHeight: 1.08,
        tintHex: factionTint,
        tintStrength: 0.22
      });
      if (strat) {
        strat.group.position.set(0, 0.18, 0.05);
        g.add(strat.group);
      }

      // 朱漆鎏金雷音戰鼓與帥旗
      const warDrum = buildTaikoWarDrum();
      warDrum.position.set(0.68, 0, -0.42);
      warDrum.rotation.y = -0.35;
      g.add(warDrum);

      attachProp(g, 'flag', { targetHeight: 1.50, tintHex: factionTint, tintStrength: 0.45 }, [0.90, 0, -0.90], [0, 0, 0]);

      [-0.68, 0.68].forEach((gx) => {
        const guard = new THREE.Group();
        guard.position.set(gx, 0, 0.48);
        const gw = spawnModelInstance('infantry', {
          targetHeight: 0.94,
          tintHex: goldColor,
          tintStrength: 0.30,
          registerAnim: true
        });
        if (gw) {
          addHelmetCrest(gw.group, 0.90, 'plume', plumeColor);
          guard.add(gw.group);
          if (gw.animCtrl) token.unitAnims.push(gw.animCtrl);
        }
        // 護衛執戟斜立 (-Math.PI * 0.38 使長戟由地面斜指前上方)
        attachProp(guard, 'spear', { targetMaxDim: 1.38 }, [0.20, 0.55, 0.16], [-Math.PI * 0.36, 0, 0]);
        g.add(guard);
      });
    }
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
      ctx.fillText(isSideA ? '我軍方陣' : '敵軍本陣', 168, 140);

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
    sprite.scale.set(2.85, 0.98, 1);
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

    floatingPopups.push({ sprite: sp, tex, mat, life: 38, maxLife: 38 });
  }

  /* ----------------------------------------------------
     5. 載入合戰雙方陣容與事件驅動骨骼動作演出
     ---------------------------------------------------- */
  function loadBattle(res) {
    if (!isInitialized) return;
    battleEpoch++;
    clearAllTokens();

    const wKey = (res && res.weather) || (window.state && window.state.weather) || 'plain';
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
  }

  function triggerSquadAnim(token, state, timeScale = 1.0) {
    if (!token || !token.unitAnims) return;
    token.unitAnims.forEach((ctrl) => ctrl.playState(state, timeScale));
  }

  function playEvent(ln) {
    if (!isInitialized || !isEnabled || !ln) return;

    const aToken = ln.auid ? unitsMap.get(ln.auid) : null;
    const tToken = ln.tuid ? unitsMap.get(ln.tuid) : null;
    if (!aToken && !tToken) return;

    // 1. 高費名將 ($4~$5) 戰法發動或斬將時觸發光榮風格橫幅 Cut-in (節流防刷屏)
    const nowMs = performance.now();
    if (aToken && aToken.cost >= 4 && (ln.kind === 'kill' || (ln.kind === 'hit' && nowMs - lastCutinAt > 3600))) {
      lastCutinAt = nowMs;
      triggerWarlordCutin(aToken, ln.kind === 'kill');
    }

    // 2. 攝影機微聚焦於交鋒熱區
    if (aToken && tToken) {
      const midX = (aToken.mesh.position.x + tToken.mesh.position.x) * 0.14;
      const midZ = (aToken.mesh.position.z + tToken.mesh.position.z) * 0.14;
      camFocusOffset.set(midX, 0, midZ);
    }

    // 3. 依五大兵種執行全 3D 模型骨骼動畫與彈道特效
    if (aToken && tToken && aToken.alive) {
      if (aToken.cat === 'air') {
        performCavalryCharge(aToken, tToken);
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
    if (tToken) {
      if (ln.kind === 'block') {
        performShieldBlockDome(tToken);
        spawnFloatingDamagePopup(tToken.mesh.position, '🛡️ 鐵壁格擋', '#fbbf24', false);
      } else if (ln.dmg && ln.dmg > 0) {
        triggerSquadAnim(tToken, 'hit', 1.2);
        const lostTroops = Math.max(100, Math.round(ln.dmg * 100)).toLocaleString();
        const isKill = ln.kind === 'kill';
        spawnFloatingDamagePopup(
          tToken.mesh.position,
          isKill ? `💥 擊破 -${lostTroops}` : `-${lostTroops}`,
          isKill ? '#fb7185' : '#f87171',
          isKill
        );
      }

      if (ln.hpAfter !== undefined) {
        updateTokenHp(tToken, ln.hpAfter);
      }
      if (ln.kind === 'kill') {
        tokenFallDown(tToken);
      }
    }
  }

  /* 奔雷突騎：戰馬切換 Gallop 奔馳動畫衝向敵陣，騎將揮槊斬擊 */
  function performCavalryCharge(aToken, tToken) {
    const orig = new THREE.Vector3(aToken.origX, 0, aToken.origZ);
    const target = tToken.mesh.position.clone();
    const dir = target.clone().sub(orig).normalize();
    const impactPos = target.clone().sub(dir.clone().multiplyScalar(2.2));

    triggerSquadAnim(aToken, 'move', 1.45);
    let stepIdx = 0;
    const total = 30;

    function step() {
      if (!aToken.alive && stepIdx > 15) return;
      stepIdx++;
      if (stepIdx <= 14) {
        const p = stepIdx / 14;
        aToken.mesh.position.lerpVectors(orig, impactPos, p);
        if (stepIdx % 2 === 0) spawnDustPuff(aToken.mesh.position);
      } else if (stepIdx === 15) {
        triggerSquadAnim(aToken, 'attack', 1.35);
        spawnSparkBurst(target.clone().add(new THREE.Vector3(0, 0.8, 0)), 24, 0xfbbf24);
        triggerCameraShake(0.24);
        if (tToken && tToken.alive) {
          tToken.mesh.position.x += (aToken.side === 'A' ? 0.42 : -0.42);
          setTimeout(() => { if (tToken && tToken.alive) tToken.mesh.position.x = tToken.origX; }, 180);
        }
      } else {
        const p = (stepIdx - 15) / 15;
        aToken.mesh.position.lerpVectors(impactPos, orig, p);
      }
      if (stepIdx < total) {
        requestAnimationFrame(step);
      } else {
        aToken.mesh.position.copy(orig);
        triggerSquadAnim(aToken, 'idle', 1.0);
      }
    }
    step();
  }

  /* 神射強弩：發射 16 支真實 3D 箭矢模型 + 火羽軌跡拋物線齊射 */
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
        // 附著火箭尾焰亮點
        const tipGlow = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 6, 6),
          new THREE.MeshBasicMaterial({ color: side === 'A' ? 0x38bdf8 : 0xf97316 })
        );
        tipGlow.position.set(0, 0, 0.25);
        projMesh.add(tipGlow);
      } else {
        projMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.04, 0.65, 6),
          new THREE.MeshBasicMaterial({ color: side === 'A' ? 0x38bdf8 : 0xf97316 })
        );
      }

      projMesh.position.copy(start);
      scene.add(projMesh);

      projectiles.push({
        mesh: projMesh,
        start,
        end,
        progress: -(i * 0.032),
        speed: 0.046,
        arcHeight: 4.8 + Math.random() * 1.3,
        isGLB: Boolean(arrowInst)
      });
    }
  }

  /* 先登奇兵：高速疾行騰躍突襲 */
  function performVanguardAssault(aToken, tToken) {
    const orig = new THREE.Vector3(aToken.origX, 0, aToken.origZ);
    const strikePos = tToken.mesh.position.clone().add(new THREE.Vector3(aToken.side === 'A' ? -1.85 : 1.85, 0, 0));
    triggerSquadAnim(aToken, 'move', 1.5);

    let t = 0;
    function step() {
      t++;
      if (t <= 12) {
        const p = t / 12;
        aToken.mesh.position.lerpVectors(orig, strikePos, p);
        aToken.mesh.position.y = Math.sin(p * Math.PI) * 1.05;
      } else if (t === 13) {
        triggerSquadAnim(aToken, 'attack', 1.4);
        spawnSparkBurst(tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 18, 0x2dd4bf);
        triggerCameraShake(0.15);
      } else if (t <= 24) {
        const p = (t - 12) / 12;
        aToken.mesh.position.lerpVectors(strikePos, orig, p);
        aToken.mesh.position.y = 0;
      }
      if (t < 24) requestAnimationFrame(step);
      else aToken.mesh.position.copy(orig);
    }
    step();
  }

  /* 重甲陷陣：步兵方陣推進短兵相接 */
  function performPhalanxClash(aToken, tToken) {
    const orig = new THREE.Vector3(aToken.origX, 0, aToken.origZ);
    const dir = tToken.mesh.position.clone().sub(orig).normalize();
    const advancePos = orig.clone().add(dir.multiplyScalar(2.2));
    triggerSquadAnim(aToken, 'move', 1.25);

    let t = 0;
    function step() {
      t++;
      if (t <= 11) {
        aToken.mesh.position.lerpVectors(orig, advancePos, t / 11);
      } else if (t === 12) {
        triggerSquadAnim(aToken, 'attack', 1.25);
        spawnSparkBurst(tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.7, 0)), 16, 0xfde047);
        triggerCameraShake(0.14);
      } else if (t <= 22) {
        aToken.mesh.position.lerpVectors(advancePos, orig, (t - 11) / 11);
      }
      if (t < 22) requestAnimationFrame(step);
      else aToken.mesh.position.copy(orig);
    }
    step();
  }

  /* 軍師奇謀：八卦天雷／火計光柱與陣紋擴散 */
  function performStrategistFormation(aToken, tToken, logText) {
    triggerSquadAnim(aToken, 'attack', 1.15);
    const isFire = logText.includes('火') || logText.includes('砲') || logText.includes('焚');
    const fxColor = isFire ? 0xf97316 : 0x4ade80;

    // 目標陣地降下奇謀光柱 + 擴散法陣環
    const pillarGeo = new THREE.CylinderGeometry(0.65, 0.95, 7.5, 16, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: fxColor,
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.copy(tToken.mesh.position);
    pillar.position.y = 3.75;
    scene.add(pillar);

    const ringGeo = new THREE.RingGeometry(0.4, 1.35, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: fxColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(tToken.mesh.position);
    ring.position.y = 0.28;
    scene.add(ring);

    spawnSparkBurst(tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0)), isFire ? 26 : 16, fxColor);

    let f = 0;
    function animPillar() {
      f++;
      const s = 1 + f * 0.08;
      ring.scale.set(s, s, 1);
      ring.material.opacity = Math.max(0, 0.92 - f * 0.05);
      pillar.scale.set(1 - f * 0.03, 1, 1 - f * 0.03);
      pillar.material.opacity = Math.max(0, 0.68 - f * 0.04);
      if (f < 18) {
        requestAnimationFrame(animPillar);
      } else {
        scene.remove(pillar);
        scene.remove(ring);
        pillarGeo.dispose(); pillarMat.dispose();
        ringGeo.dispose(); ringMat.dispose();
      }
    }
    animPillar();
  }

  function performShieldBlockDome(tToken) {
    const geo = new THREE.SphereGeometry(1.75, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true, transparent: true, opacity: 0.85 });
    const dome = new THREE.Mesh(geo, mat);
    dome.position.copy(tToken.mesh.position);
    dome.position.y = 0.2;
    scene.add(dome);

    let f = 0;
    function fade() {
      f++;
      dome.material.opacity = Math.max(0, 0.85 - f * 0.07);
      dome.scale.addScalar(0.02);
      if (f < 13) requestAnimationFrame(fade);
      else {
        scene.remove(dome);
        geo.dispose();
        mat.dispose();
      }
    }
    fade();
  }

  function updateTokenHp(token, newHp) {
    token.currentHp = Math.max(0, newHp);
    if (token.hud && token.hud.redraw) {
      token.hud.redraw(token.currentHp);
      token.hud.tex.needsUpdate = true;
    }
  }

  function tokenFallDown(token) {
    if (!token.alive) return;
    token.alive = false;
    updateTokenHp(token, 0);
    triggerSquadAnim(token, 'death', 1.0);
    spawnSparkBurst(token.mesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 28, 0xef4444);
    triggerCameraShake(0.26);

    // 托盤微沉並半透明黯淡，保留屍骸戰場滄桑感
    let f = 0;
    function sink() {
      f++;
      token.formationRig.position.y = -0.10 * (f / 20);
      if (token.hud && token.hud.sprite && token.hud.sprite.material) {
        token.hud.sprite.material.opacity = Math.max(0.28, 1 - (f / 20) * 0.72);
      }
      if (f < 20) requestAnimationFrame(sink);
    }
    sink();
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
      'border:2px solid #fbbf24;border-radius:999px;',
      'box-shadow:0 10px 28px rgba(0,0,0,0.65),0 0 22px rgba(251,191,36,0.35);',
      'color:#fff;pointer-events:none;opacity:0;transition:all 0.22s cubic-bezier(0.16,1,0.3,1);'
    ].join('');
    container.appendChild(div);
  }

  function triggerWarlordCutin(token, isKill = false) {
    const el = container ? container.querySelector('#warlordCutinBanner') : null;
    if (!el) return;
    const meta = CAT_META[token.cat] || CAT_META.armor;
    const actionLabel = isKill ? '一騎討・陣斬敵將！' : `${token.wep || meta.label}・戰法發動！`;
    const borderCol = token.side === 'A' ? '#38bdf8' : '#f59e0b';

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
    }, 1550);
  }

  /* ----------------------------------------------------
     7. 粒子火花、塵土、震屏與相機控制
     ---------------------------------------------------- */
  function spawnSparkBurst(pos, count = 14, colorHex = 0xfbbf24) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.065, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? colorHex : 0xffffff, transparent: true, opacity: 1 });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      scene.add(m);
      particleSystems.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 0.26,
        vy: Math.random() * 0.22 + 0.06,
        vz: (Math.random() - 0.5) * 0.26,
        life: 18 + Math.floor(Math.random() * 8),
        maxLife: 24,
        gravity: 0.013
      });
    }
  }

  function spawnDustPuff(pos) {
    const geo = new THREE.SphereGeometry(0.22, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xd6c3a5, transparent: true, opacity: 0.48 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos.x + (Math.random() - 0.5) * 0.5, 0.22, pos.z + (Math.random() - 0.5) * 0.5);
    scene.add(m);
    particleSystems.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 0.04,
      vy: 0.035,
      vz: (Math.random() - 0.5) * 0.04,
      life: 20,
      maxLife: 20,
      gravity: 0,
      scaleGrowth: 0.045
    });
  }

  function triggerCameraShake(intensity = 0.18) {
    let f = 0;
    function step() {
      f++;
      if (f < 8) {
        camShakeOffset.set((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity * 0.7, 0);
        requestAnimationFrame(step);
      } else {
        camShakeOffset.set(0, 0, 0);
      }
    }
    step();
  }

  function updateCameraPosition() {
    if (!camera) return;
    const target = CAM_BASE_TARGET.clone().add(camFocusOffset).add(camShakeOffset);
    const x = target.x + camRadius * Math.sin(camPhi) * Math.sin(camTheta);
    const y = target.y + camRadius * Math.cos(camPhi);
    const z = target.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta);
    camera.position.set(x, y, z);
    camera.lookAt(target);
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
    camTheta = 0.0;
    camPhi = 0.64;
    camRadius = 25.5;
    camFocusOffset.set(0, 0, 0);
    camShakeOffset.set(0, 0, 0);
    updateCameraPosition();
  }

  /* ----------------------------------------------------
     8. 主渲染與骨骼動畫更新迴圈
     ---------------------------------------------------- */
  function startAnimationLoop() {
    if (animFrameId) cancelAnimationFrame(animFrameId);

    function animate(now) {
      animFrameId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimestamp) / 1000));
      lastTimestamp = now;
      const elapsed = now * 0.001;

      if (!isEnabled) return;

      // 1. 更新所有 3D 士兵與戰馬的骨骼動畫
      for (let i = 0; i < activeMixers.length; i++) {
        activeMixers[i].mixer.update(dt);
      }

      // 2. 相機焦點平滑回中與呼吸感
      camFocusOffset.lerp(new THREE.Vector3(0, 0, 0), 0.035);
      updateCameraPosition();

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
        p.progress += p.speed;
        if (p.progress < 0) continue;
        if (p.progress >= 1.0) {
          spawnSparkBurst(p.end, 3, 0xf97316);
          scene.remove(p.mesh);
          projectiles.splice(i, 1);
        } else {
          p.mesh.position.lerpVectors(p.start, p.end, p.progress);
          p.mesh.position.y += Math.sin(p.progress * Math.PI) * p.arcHeight;
          const nextP = Math.min(1.0, p.progress + 0.04);
          const nextPos = p.start.clone().lerp(p.end, nextP);
          nextPos.y += Math.sin(nextP * Math.PI) * p.arcHeight;
          p.mesh.lookAt(nextPos);
        }
      }

      // 6. 粒子與塵土更新
      for (let i = particleSystems.length - 1; i >= 0; i--) {
        const pt = particleSystems[i];
        pt.mesh.position.x += pt.vx;
        pt.mesh.position.y += pt.vy;
        pt.mesh.position.z += pt.vz;
        pt.vy -= pt.gravity || 0;
        if (pt.scaleGrowth) pt.mesh.scale.addScalar(pt.scaleGrowth);
        pt.life--;
        if (pt.mesh.material) pt.mesh.material.opacity = Math.max(0, pt.life / pt.maxLife);
        if (pt.life <= 0) {
          scene.remove(pt.mesh);
          pt.mesh.geometry.dispose();
          pt.mesh.material.dispose();
          particleSystems.splice(i, 1);
        }
      }

      // 7. 浮動兵損數字上升消退
      for (let i = floatingPopups.length - 1; i >= 0; i--) {
        const fp = floatingPopups[i];
        fp.sprite.position.y += 1.35 * dt;
        fp.life--;
        fp.mat.opacity = Math.min(1, (fp.life / fp.maxLife) * 1.4);
        if (fp.life <= 0) {
          scene.remove(fp.sprite);
          fp.tex.dispose();
          fp.mat.dispose();
          floatingPopups.splice(i, 1);
        }
      }

      // 8. 軍師八卦陣緩緩旋轉
      unitsMap.forEach((tok) => {
        if (tok.baguaMesh && tok.alive) {
          tok.baguaMesh.rotation.z += 0.75 * dt;
        }
      });

      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    }

    animate(performance.now());
  }

  function clearAllTokens() {
    unitsMap.forEach((t) => {
      if (scene && t.mesh) scene.remove(t.mesh);
      if (t.hud && t.hud.tex) t.hud.tex.dispose();
    });
    unitsMap.clear();
    activeMixers = [];

    projectiles.forEach((p) => { if (scene && p.mesh) scene.remove(p.mesh); });
    projectiles = [];

    particleSystems.forEach((pt) => { if (scene && pt.mesh) scene.remove(pt.mesh); });
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
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function toggleMode(enabled) {
    isEnabled = Boolean(enabled);
    if (container) container.hidden = !isEnabled;
    if (isEnabled) setTimeout(onWindowResize, 30);
  }

  function getDebugState() {
    return {
      isInitialized,
      isEnabled,
      modelsTotal: Object.keys(MODEL_MANIFEST).length,
      modelsLoaded: modelsLoadedCount,
      plinthCount: unitsMap.size,
      activeMixers: activeMixers.length,
      envPropsChildren: envPropsGroup ? envPropsGroup.children.length : 0,
      weather: currentWeatherKey
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
