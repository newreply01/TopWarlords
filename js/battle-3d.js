/* =====================================================
   TopWarlords field-scale battle renderer (Three.js r128).
   Original articulated troops, restrained materials, stable camera presets.
   ===================================================== */
'use strict';

const Battle3DEngine = (function () {
  const ASSET_VER = '7.15.11';
  const PORTRAIT_DIR = 'assets/warlords/';
  // 程序化貼圖、配色與靜態幾何合併：獨立於引擎狀態，見 js/battle-3d-textures.js
  const {
    VFX_PALETTES, createSkyBackdropTexture, createRiverTexture, createTerrainTexture, mergeStaticGeos,
    createCampPennantTexture, getBannerTexture, roundRectPath, getSkillVfxTexture, getBaguaTexture,
    getScarTexture, ensureDustTexture
  } = Battle3DTextures;

  // GLTF 模型預載、正規化與實例化：見 js/battle-3d-models.js（快取與載入狀態由該模組持有）
  const { MODEL_MANIFEST } = Battle3DModels;
  function ensureModelsLoaded() {
    return Battle3DModels.ensureModelsLoaded(ASSET_VER);
  }
  function spawnModelInstance(key, opts) {
    const spawned = Battle3DModels.spawnModelInstance(key, opts);
    // 具骨骼動畫的實例由渲染迴圈統一驅動 AnimationMixer
    if (spawned && spawned.animCtrl) activeMixers.push(spawned.animCtrl);
    return spawned;
  }

  let isEnabled = true;
  let contextLost = false;          // WebGL 情境遺失（行動裝置切換 App / GPU 記憶體不足）
  let perfAccumTime = 0, perfAccumFrames = 0, rendererDowngraded = false; // 渲染解析度自動降級（特效已降級後仍嚴重掉幀時）
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
  let campBrazierFlamesRef = null;
  const _campAnimObj = new THREE.Object3D();
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
    lastPausedRenderAt = 0;
    if (next) window.SoundEngine?.stopSpatial?.();
  }
  const activeAttackers = new Set();
  let peakConcurrentAttackers = 0;
  let completedVolleys = 0;
  let skillVfxPlayed = 0;

  let unitsMap = new Map();      // uid -> battalion token
  let activeMixers = [];           // { mixer, actions, currentState }
  let projectiles = [];            // 3D 箭雨與火彈
  let particleSystems = [];        // 塵土、刀光火花、衝擊波
  let slashArcs = [];              // 弧形刀光劍氣網格
  let shockwaves = [];             // 擴散地面衝擊環／盾陣波
  let stuckArrowsPool = null;       // InstancedMesh 戰場插地箭矢物件池
  let stuckArrowCount = 0;
  const _stuckObj = new THREE.Object3D();
  const ARQUEBUS_IDS = new Set([
    'NOBUNAGA', 'SAIKA', 'AKECHI', 'DATE', 'ASAKURA_SOT',
    'TAKIGAWA', 'HONDA_TADATSUGU', 'SHIMAZU_IEHISA', 'TORII', 'MATSUNAGA', 'CHOIMUSEON'
  ]);
  let battleScars = [];            // 戰場焦黑傷痕與八卦陣紋
  let floatingPopups = [];         // 3D 浮動兵力傷害數字 (-3,200 / 格擋)
  let brazierLights = [];          // 營寨篝火動態光源
  let skillFlashLights = [];       // 技能引爆動態點光源池 (2 顆)
  let baseSunIntensity = 2.05;
  let baseHemiIntensity = 0.52;
  let arenaDimUntil = 0;
  let arenaDimStartedAt = 0;
  let arenaDimRatio = 1.0;
  let slowMoUntil = 0;
  let slowMoScale = 1.0;
  const battleTimers = new Set();
  const bannerWindUniform = { value: 0 };
  let finaleCelebrationUntil = 0;
  let finaleCelebrationTimers = [];
  let lastPausedRenderAt = 0;
  let animFrameTimer = null;
  let cutinTimeout = null;
  let cutinTimer = null;
  let cutinQueue = [];
  let lastCutinAt = 0;
  let lastLabelLayoutKey = '';
  let riverTexRef = null;
  let vfxTexCache = new Map();
  let hitStopUntil = 0;
  let cutinFrozen = false;
  let shakePower = 0;
  const camShakeOffset = new THREE.Vector3(0, 0, 0);
  let camZoomOffset = 0;
  let camZoomTarget = 0;

  // 相機軌道控制與動態微聚焦
  const CAM_SHAKE_STORAGE_KEY = 'wl15_battle_cam_shake';
  let cameraShakeEnabled = (() => {
    try {
      const saved = localStorage.getItem(CAM_SHAKE_STORAGE_KEY);
      if (saved === '0' || saved === 'false') return false;
      if (saved === '1' || saved === 'true') return true;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return false;
      }
    } catch (_) {}
    return true;
  })();
  let isDragging = false;
  let prevMouseX = 0, prevMouseY = 0;
  let camTheta = -0.16, camPhi = 1.04, camRadius = 16.4;
  let cameraView = 'cinematic';
  let showUnitLabels = false;
  const CAM_BASE_TARGET = new THREE.Vector3(0, 0.65, 0.55);
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
     2. 初始化 3D 場景、金秋戰場天光與山河渡口地形
     ---------------------------------------------------- */
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
    renderer.domElement.addEventListener('webglcontextlost', onWebglContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', onWebglContextRestored, false);
    window.MusouVfx?.initBloom?.({ renderer, scene, camera, width, height, isLowPowerDevice });

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
      if (isAnimationPaused) renderFrame();
    };
    const shakeButton = container.closest('#battle3DWrapper').querySelector('#btnBattleShake');
    if (shakeButton) {
      shakeButton.onclick = () => setCameraShakeEnabled(!cameraShakeEnabled);
    }
    syncCameraShakeButton();
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

    // 動態戰法閃光點光源池（火計橘紅／雷擊冰藍／無雙金光瞬閃照亮千軍鎧甲）
    skillFlashLights = [0, 1].map(() => {
      const l = new THREE.PointLight(0xfbbf24, 0, 16);
      l.position.set(0, 2.5, 0);
      scene.add(l);
      return { light: l, startedAt: 0, duration: 0, peak: 0 };
    });
  }

  function scheduleBattleTimer(delayMs, fn) {
    const epoch = battleEpoch;
    const tid = setTimeout(() => {
      battleTimers.delete(tid);
      if (epoch !== battleEpoch || battleSettled) return;
      try { fn(); } catch (_) {}
    }, Math.max(0, Number(delayMs) || 0));
    battleTimers.add(tid);
    return tid;
  }

  function triggerSkillFlashLight(pos, colorHex = 0xfbbf24, peak = 4.4, duration = 480) {
    if (!scene || !pos || !skillFlashLights.length || (battleSettled && combatNow() >= finaleCelebrationUntil)) return;
    let slot = skillFlashLights.find(s => s.duration === 0 || (combatNow() - s.startedAt >= s.duration));
    if (!slot) {
      slot = skillFlashLights[0].startedAt <= skillFlashLights[1].startedAt ? skillFlashLights[0] : skillFlashLights[1];
    }
    slot.light.color.setHex(colorHex);
    slot.light.position.set(pos.x, (pos.y || 0) + 1.65, pos.z);
    slot.peak = peak;
    slot.duration = Math.max(120, duration);
    slot.startedAt = combatNow();
    slot.light.intensity = peak;
  }

  function triggerArenaDimming(durationMs = 850, dimRatio = 0.54) {
    if (battleSettled || isLowPowerDevice || window.MusouVfx?.getQuality?.() === 'low') return;
    arenaDimStartedAt = combatNow();
    arenaDimUntil = arenaDimStartedAt + durationMs;
    arenaDimRatio = dimRatio;
  }

  function triggerSlowMo(durationMs = 180, scale = 0.35) {
    if (battleSettled || isLowPowerDevice || window.MusouVfx?.getQuality?.() === 'low') return;
    slowMoUntil = Math.max(slowMoUntil, combatNow() + durationMs);
    slowMoScale = scale;
  }

  function resetDynamicLightingAndTimers() {
    battleTimers.forEach(tid => clearTimeout(tid));
    battleTimers.clear();
    skillFlashLights.forEach(slot => {
      slot.light.intensity = 0;
      slot.duration = 0;
      slot.peak = 0;
    });
    arenaDimUntil = 0;
    arenaDimRatio = 1.0;
    slowMoUntil = 0;
    if (sunLightRef) sunLightRef.intensity = baseSunIntensity;
    if (hemiLightRef) hemiLightRef.intensity = baseHemiIntensity;
  }




  function buildCampFortifications() {
    campFortificationsGroup = new THREE.Group();

    const poleGeo = mergeStaticGeos([
      { geo: new THREE.CylinderGeometry(0.020, 0.028, 2.55, 5), pos: [0, 1.275, 0] },
      { geo: new THREE.CylinderGeometry(0.012, 0.012, 0.36, 4), pos: [0.16, 2.42, 0], rot: [0, 0, Math.PI / 2] },
      { geo: new THREE.ConeGeometry(0.042, 0.16, 5), pos: [0, 2.62, 0] }
    ]);
    const allCampFlags = [];
    const westOffsets = [
      [-13.4, -8.2], [-15.2, -8.0], [-17.0, -7.6], [-17.6, -5.0],
      [-16.2, -3.2], [-14.8, -1.3], [-14.8, 1.3], [-16.2, 3.2],
      [-17.6, 5.0], [-17.0, 7.6], [-15.2, 8.0], [-13.4, 8.2]
    ];
    const perSideCount = isLowPowerDevice ? 7 : 12;
    for (const sideSign of [-1, 1]) {
      for (let i = 0; i < perSideCount; i++) {
        const [wx, wz] = westOffsets[i];
        allCampFlags.push({
          sideSign,
          x: Math.abs(wx) * sideSign,
          z: wz,
          scale: 0.62 + (i % 4) * 0.05,
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
    const [campPoles, campPennants] = campFortificationsGroup.children;

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
      { x: -15.0, z: -4.2 },
      { x: -15.0, z: 4.2 },
      { x: 15.0, z: -4.2 },
      { x: 15.0, z: 4.2 }
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
            const z = kind === 'canyon'
              ? (side < 0 ? -(12.5 + layer * 6 + t * 1.6) : (42 + layer * 7 + t * 1.6))
              : side * (25 + layer * 12);
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

      [-6.8, 6.8].forEach((zPos) => {
        const tower = spawnModelInstance('watchtower', { targetHeight: 1.60, tintHex: tint, tintStrength: 0.14 });
        if (tower) {
          tower.group.position.set(sx * 16.5, 0, zPos);
          tower.group.rotation.y = faceY;
          tower.group.userData.terrainRole = 'tower';
          envPropsGroup.add(tower.group);
        }
      });

      [-2.8, 2.8].forEach((zPos) => {
        const tent = spawnModelInstance('tent', { targetHeight: 0.92, tintHex: tint, tintStrength: 0.25 });
        if (tent) {
          tent.group.position.set(sx * 16.0, 0, zPos);
          tent.group.rotation.y = faceY;
          envPropsGroup.add(tent.group);
        }
      });

      [-7.4, -4.4, 4.4, 7.4].forEach((zPos) => {
        const flag = spawnModelInstance('banner', { targetHeight: 1.28, tintHex: tint, tintStrength: 0.42 });
        if (flag) {
          flag.group.position.set(sx * 14.4, 0, zPos);
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

    // 南北山崖深色岩群
    const rockSpots = [
      [-19, -15.6, 2.4, 'rock_a'], [-13.5, -16.8, 2.8, 'rock_b'], [13.5, -16.6, 2.6, 'rock_a'], [19, -15.4, 2.9, 'rock_b'],
      [-19, 15.6, 2.5, 'rock_b'], [-13.5, 16.8, 2.3, 'rock_a'], [13.5, 16.6, 2.7, 'rock_b'], [19, 15.4, 2.5, 'rock_a']
    ];
    rockSpots.forEach(([rx, rz, rh, rkey], i) => {
      const rk = spawnModelInstance(rkey, {
        targetHeight: rh * 0.19, castShadow: true, tintHex: 0x3e352c, tintStrength: 0.92
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
    arenaDimUntil = 0;
    arenaDimRatio = 1.0;
    slowMoUntil = 0;
    skillFlashLights.forEach(slot => { slot.light.intensity = 0; slot.duration = 0; });
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
    baseSunIntensity = sunLightRef ? sunLightRef.intensity : 2.05;
    baseHemiIntensity = hemiLightRef ? hemiLightRef.intensity : 0.52;
  }

  /* ----------------------------------------------------
     3. 打造《三國志》立體部隊方陣托盤 + 全 3D 骨骼動畫兵種
     ---------------------------------------------------- */
  function clampFormationYaw(side, desiredYaw, maxTurn = 0.48) {
    const baseYaw = side === 'A' ? Math.PI / 2 : -Math.PI / 2;
    let diff = desiredYaw - baseYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const clampedDiff = Math.max(-maxTurn, Math.min(maxTurn, diff));
    return {
      yaw: baseYaw + clampedDiff,
      remainder: Math.max(-0.42, Math.min(0.42, diff - clampedDiff))
    };
  }

  function getFormationOffset(layout, index, count, mounted) {
    // 橫寬大於縱深之古代實戰陣列：全陣寬度約 2.1~2.4m (受 local X 邊界 <= 2.5m 保護)，縱深約 1.2~1.9m
    const stepX = mounted ? 0.36 : 0.30;
    const stepZ = mounted ? 0.36 : 0.27;
    if (layout === 'wedge') {
      const maxColumns = mounted ? 6 : 8;
      let row = 0, column = index;
      while (column >= Math.min(row * 2 + 1, maxColumns)) {
        column -= Math.min(row * 2 + 1, maxColumns);
        row++;
      }
      const columns = Math.min(row * 2 + 1, maxColumns);
      const colOff = column - (columns - 1) / 2;
      return {
        x: colOff * stepX * 0.96,
        z: 0.56 - row * stepZ - Math.abs(colOff) * 0.06
      };
    }
    if (layout === 'cone') {
      // 錐行：銳利狹長鑽頭陣 (2-4-5-5-4-2 菱形突貫縱陣，區別於鋒矢)
      const pattern = mounted ? [1, 3, 4, 4, 4, 4, 3, 1] : [2, 4, 5, 6, 6, 6, 6, 5, 4, 4];
      let row = 0, rem = index;
      while (rem >= (pattern[row] || (mounted ? 4 : 5))) {
        rem -= (pattern[row] || (mounted ? 4 : 5));
        row++;
      }
      const cols = Math.min(pattern[row] || (mounted ? 4 : 5), count - (index - rem));
      return {
        x: (rem - (cols - 1) / 2) * stepX * 0.84,
        z: 0.64 - row * stepZ * 0.95
      };
    }
    if (layout === 'square') {
      // 方圓：外厚內穩的圓角方陣，緊湊抗衝鋒
      const columns = mounted ? 5 : 7;
      const rows = Math.ceil(count / columns);
      const row = Math.floor(index / columns);
      const inRow = Math.min(columns, count - row * columns);
      const colOff = (index % columns) - (inRow - 1) / 2;
      const isOuter = row === 0 || row === rows - 1 || Math.abs(colOff) >= (inRow - 1) / 2 - 0.5;
      return {
        x: colOff * (mounted ? 0.34 : 0.29) * (isOuter ? 1.04 : 0.92),
        z: (rows - 1) * (mounted ? 0.18 : 0.14) - row * (mounted ? 0.36 : 0.28)
      };
    }
    if (layout === 'staggered') {
      // 雁行：橫展斜雁交錯列，利於弓弩錯開射界
      const columns = mounted ? 6 : 8;
      const row = Math.floor(index / columns);
      const col = index % columns;
      const colOff = col - (columns - 1) / 2;
      return {
        x: colOff * (mounted ? 0.32 : 0.28) + (row % 2 ? (mounted ? 0.13 : 0.11) : -(mounted ? 0.06 : 0.05)),
        z: 0.44 - row * stepZ - Math.abs(colOff) * 0.075
      };
    }
    if (layout === 'wings') {
      // 鶴翼：雙翼朝前左右包抄、中軍微收之弧形包夾陣
      const columns = mounted ? 6 : 8;
      const row = Math.floor(index / columns);
      const inRow = Math.min(columns, count - row * columns);
      const col = index % columns;
      const colOff = col - (inRow - 1) / 2;
      const normX = Math.abs(colOff) / Math.max(1, (columns - 1) / 2);
      return {
        x: colOff * stepX * 1.02,
        z: 0.12 - row * stepZ + Math.pow(normX, 1.35) * (mounted ? 0.44 : 0.48)
      };
    }
    if (layout === 'column') {
      // 長蛇：S 形蜿蜒游擊行軍陣
      const columns = mounted ? 3 : 4;
      const row = Math.floor(index / columns);
      const inRow = Math.min(columns, count - row * columns);
      const col = index % columns;
      const snakeX = Math.sin(row * 0.78) * (mounted ? 0.32 : 0.34);
      return {
        x: (col - (inRow - 1) / 2) * (mounted ? 0.36 : 0.31) + snakeX,
        z: 0.62 - row * (mounted ? 0.33 : 0.25)
      };
    }
    // fishscale（魚鱗）及預設橫陣：中央略凸之寬正面魚鱗方陣
    const columns = mounted ? 6 : 8;
    const row = Math.floor(index / columns);
    const inRow = Math.min(columns, count - row * columns);
    const colOff = (index % columns) - (inRow - 1) / 2;
    const normX = colOff / Math.max(1, (columns - 1) / 2);
    return {
      x: colOff * stepX,
      z: 0.34 - row * stepZ + (1 - normX * normX) * (mounted ? 0.22 : 0.24)
    };
  }

  function addBattalionRanks(token) {
    const mounted = token.cat === 'air';
    const count = mounted ? (isLowPowerDevice ? 12 : 24) : (isLowPowerDevice ? 24 : 48);
    token.lowPower = isLowPowerDevice;
    const ranks = BattleFigures.createRanks(token, count, (i, total) =>
      getFormationOffset(token.formationLayout, i, total, mounted)
    );
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
    const baseYaw = isSideA ? Math.PI / 2 : -Math.PI / 2;
    formationRig.rotation.y = baseYaw;
    rootGroup.add(formationRig);

    // B. 3D 兵種模型方陣容器
    const troopsContainer = new THREE.Group();
    troopsContainer.position.y = 0.03;
    formationRig.add(troopsContainer);

    // C. 光榮式懸浮名將頭像軍徽與即時兵力銘牌 (Sprite 永遠正對鏡頭、不遮擋 3D 士兵！)
    const startHp = Math.max(1, Number(unit.maxHp || unit.hpMax || unit.hp || 200));
    const hud = buildWarlordCrestHud(unit, isSideA, meta, startHp, startHp);
    hud.sprite.position.set(0, cat === 'air' ? 2.15 : 1.55, 0);
    hud.sprite.visible = true;
    rootGroup.add(hud.sprite);

    scene.add(rootGroup);

    const token = {
      uid: unit.uid,
      id: unit.id,
      name: unit.name,
      country: unit.country || (typeof UNIT_MAP !== 'undefined' && UNIT_MAP[unit.id]?.country) || 'CN',
      cost: unit.cost || 3,
      tag: unit.tag || '',
      wep: unit.wep || '',
      skillFx: unit.skill?.fx || (typeof UNIT_MAP !== 'undefined' && UNIT_MAP[unit.id]?.skill?.fx) || 'overlord_cleave',
      skillFxLabel: unit.skill?.fxLabel || (typeof UNIT_MAP !== 'undefined' && UNIT_MAP[unit.id]?.skill?.fxLabel) || '名將戰法',
      skillFxIcon: unit.skill?.fxIcon || (typeof UNIT_MAP !== 'undefined' && UNIT_MAP[unit.id]?.skill?.fxIcon) || '⚡',
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
      baseYaw,
      targetYaw: baseYaw,
      individualYawOffset: 0,
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
      statusAuras: new Map(),
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
    if (!isLowPowerDevice) {
      clothMat.customProgramCacheKey = () => 'topwarlords_banner_wind_v1';
      clothMat.onBeforeCompile = shader => {
        shader.uniforms.uWindTime = bannerWindUniform;
        shader.vertexShader = 'uniform float uWindTime;\n' + shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float flagDroop = clamp(1.0 - uv.y, 0.0, 1.0);
           transformed.z += sin(uWindTime * 4.6 + position.y * 4.2 + position.x * 5.0) * 0.08 * flagDroop;
           transformed.x += cos(uWindTime * 3.1 + uv.x * 3.5) * 0.03 * flagDroop;`
        );
      };
    }

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
      const clothGeo = new THREE.PlaneGeometry(0.42 * scale, 0.98 * scale, isLowPowerDevice ? 2 : 4, isLowPowerDevice ? 4 : 6);
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
      const tok = unitsMap.get(unit.uid);
      const isCaptured = Boolean(unit.captured || tok?.captured);
      const deadTag = hp <= 0 ? (isCaptured ? '【被俘】' : '【陣亡】') : '';
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
        ctx.fillText((unit.name || '無名武將').slice(0, 6), 94, 95, deadTag ? 256 : 386);
        if (deadTag) {
          ctx.fillStyle = isCaptured ? '#fde68a' : '#fda4af';
          ctx.font = '900 28px "Noto Sans TC", sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(deadTag, 480, 92);
        }

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
      ctx.fillStyle = deadTag
        ? (isCaptured ? (light ? '#b45309' : '#fbbf24') : (light ? '#be123c' : '#fb7185'))
        : (light ? '#594119' : '#fde68a');
      ctx.font = 'bold 23px "JetBrains Mono", "Noto Sans TC", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(deadTag ? `${deadTag} · 兵力 0` : `兵力 ${troopsNum}`, 474, 140, 195);

      ctx.fillStyle = edge;
      ctx.font = 'bold 20px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${unit.formationName || '魚鱗'}陣 · ${isSideA ? '我軍' : '敵軍'}`, 168, 140, 118);

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
    resetDynamicLightingAndTimers();
    window.MusouCutin?.resetBattle?.();
    battleSettled = false;
    setAudioPaused(false);
    activeAttackers.clear();
    peakConcurrentAttackers = 0;
    completedVolleys = 0;
    skillVfxPlayed = 0;
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
      const frontDistance = token.formationRanged ? (token.cat === 'support' ? 4.8 : 3.9) : {
        armor: 1.05,
        air: 1.15,
        naval: 1.25,
        air_defense: 3.9,
        support: 4.8
      }[token.cat] || 2.5;
      token.frontX = direction * (frontDistance + slot.depth * 0.24);
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
      column: [[2.4, 0], [0, 0], [6.4, 0], [4.4, 0], [8.4, 0]],
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
      let targetDist;
      if (ranged) {
        targetDist = 3.25 + (slot.depth % 3) * 0.10;
        const absStartX = Math.abs(start.x);
        if (Math.abs(absStartX - targetDist) < 0.35) {
          targetDist = absStartX >= 3.75 ? absStartX - 0.45 : absStartX + 0.50;
        }
      } else {
        targetDist = 0.65 + slot.depth * 0.14;
        if (Math.abs(start.x - side * targetDist) < 0.35) {
          targetDist = Math.max(targetDist + 0.45, Math.abs(start.x) + 0.45);
        }
      }
      const distance = ranged ? -targetDist : targetDist;
      const flank = token.formationLayout === 'wings' || token.cat === 'naval' ? 0.65 : 0;
      const target = new THREE.Vector3(
        side * distance,
        0,
        slot.z * 1.12 + side * (0.48 + flank)
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
    const contactX = token.side === 'A' ? -0.95 : 0.95;
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

  function advanceRangedToEffectiveRange(attacker, target) {
    if (!attacker || !attacker.alive || attacker.engagement || !target || !target.alive) return;
    const isRanged = attacker.formationRanged || attacker.cat === 'air_defense' || attacker.cat === 'support';
    if (!isRanged) return;
    if (attacker.march && !attacker.march.finished) return;
    const dx = target.mesh.position.x - attacker.mesh.position.x;
    const dz = target.mesh.position.z - attacker.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    const effectiveRange = attacker.cat === 'support' ? 7.8 : 7.2;
    if (dist <= effectiveRange) return;
    const stepX = Math.min(1.65, (dist - effectiveRange) * 0.72);
    const minAbsX = attacker.cat === 'support' ? 4.0 : 3.25;
    const rawTargetX = attacker.side === 'A'
      ? Math.min(-minAbsX, attacker.mesh.position.x + stepX)
      : Math.max(minAbsX, attacker.mesh.position.x - stepX);
    const moveDist = Math.abs(rawTargetX - attacker.mesh.position.x);
    if (moveDist < 0.12) return;
    attacker.engagement = {
      fromX: attacker.mesh.position.x,
      fromY: attacker.mesh.position.y,
      fromZ: attacker.mesh.position.z,
      targetX: rawTargetX,
      targetY: getBattleTerrainHeight(rawTargetX, attacker.mesh.position.z),
      targetZ: attacker.mesh.position.z,
      startedAt: combatNow(),
      duration: Math.min(760, Math.max(280, moveDist * 380 / Math.max(0.75, attacker.formationMobility))),
      lastDustAt: 0,
      finished: false
    };
    attacker.frontX = rawTargetX;
    attacker.frontY = attacker.engagement.targetY;
    triggerSquadAnim(attacker, 'move', 1.08);
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
      const attCat = unitsMap.get(uid)?.cat;
      const waveDelay = (lanes.size >= 3 && tempo <= 2.5)
        ? (attCat === 'armor' ? 170 : (attCat === 'air_defense' || attCat === 'support') ? 320 : 0)
        : 0;
      if (waveDelay > 0) {
        await waitForCombatBeat(waveDelay / Math.max(0.6, tempo), epoch);
        if (epoch !== battleEpoch || battleSettled) return;
      }
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
              if (accepted && line.attackerHpAfter !== undefined && line.auid) {
                const atkTok = unitsMap.get(line.auid);
                if (atkTok) updateTokenHp(atkTok, line.attackerHpAfter, 800 / Math.max(0.6, tempo));
              }
              if (line.kind === 'kill' || line.kind === 'capture') {
                deaths.set(target.uid, { token: target, captured: line.kind === 'capture' });
                updateTokenHp(target, 1, 1000 / Math.max(0.6, tempo));
              }
              if (accepted) onImpact(line);
            }
          });
          await waitForCombatBeat((line.followUp ? 55 : 120) / Math.max(0.6, tempo), epoch);
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

  function clearTokenStatusAuras(token) {
    if (!token || !token.statusAuras) return;
    token.statusAuras.forEach(entry => {
      if (entry.mesh) token.mesh?.remove(entry.mesh);
      entry.mesh?.geometry?.dispose?.();
      entry.mesh?.material?.dispose?.();
    });
    token.statusAuras.clear();
  }

  function applyTokenStatusAura(token, statusKey, durationMs = 4200) {
    if (!token || !token.alive || !token.mesh || battleSettled) return;
    token.statusAuras = token.statusAuras || new Map();
    const prev = token.statusAuras.get(statusKey);
    const now = combatNow();
    if (prev) {
      prev.expiresAt = now + durationMs;
      return;
    }
    const specs = {
      burn:    { color: 0xf97316, y: 0.14, r1: 0.56, r2: 0.72, segs: 20, tilt: -Math.PI / 2, spinZ: 2.2, spinY: 0 },
      sunder:  { color: 0xf43f5e, y: 0.78, r1: 0.52, r2: 0.65, segs: 6,  tilt: -Math.PI / 2 + 0.25, spinZ: -2.8, spinY: 0 },
      confuse: { color: 0xa855f7, y: 1.78, r1: 0.28, r2: 0.40, segs: 16, tilt: -Math.PI / 2, spinZ: 3.4, spinY: 0 },
      rally:   { color: 0xfbbf24, y: 0.12, r1: 0.62, r2: 0.76, segs: 24, tilt: -Math.PI / 2, spinZ: 1.6, spinY: 0 },
      stagger: { color: 0x38bdf8, y: 0.88, r1: 0.46, r2: 0.58, segs: 8,  tilt: -Math.PI / 2, spinZ: -3.6, spinY: 0 },
      mark:    { color: 0xfde047, y: 1.65, r1: 0.34, r2: 0.46, segs: 4,  tilt: -Math.PI / 2, spinZ: 2.6, spinY: 0 }
    };
    const spec = specs[statusKey];
    if (!spec) return;
    const geo = new THREE.RingGeometry(spec.r1, spec.r2, spec.segs);
    const mat = new THREE.MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, spec.y, 0);
    mesh.rotation.x = spec.tilt;
    mesh.renderOrder = 24;
    mesh.layers.enable(1);
    token.mesh.add(mesh);
    token.statusAuras.set(statusKey, { mesh, mat, expiresAt: now + durationMs, spinZ: spec.spinZ, spinY: spec.spinY, baseOpacity: 0.78 });
  }

  async function runWarlordSkillWithCutin(aToken, tToken, fxKey, ln, tempo = 1) {
    const epoch = battleEpoch;
    const resolvedFxKey = fxKey || aToken?.skillFx || 'overlord_cleave';
    if (!ln?.finale && aToken && window.MusouCutin) {
      await window.MusouCutin.play({
        uid: aToken.id,
        side: aToken.side,
        fxKey: resolvedFxKey,
        tempo,
        focusToken: aToken,
        cooldownKey: aToken.uid
      });
    }
    if (epoch !== battleEpoch || battleSettled) return;
    const isHighTier = (aToken?.cost || 1) >= 4;
    const palHex = parseInt((VFX_PALETTES[resolvedFxKey] || VFX_PALETTES.overlord_cleave).primary.slice(1), 16);
    const flashOrigin = tToken?.mesh ? tToken.mesh.position : (aToken?.mesh ? aToken.mesh.position : null);
    if (isHighTier && tempo <= 1.6) {
      triggerArenaDimming(850, 0.54);
      if (cameraShakeEnabled) camZoomTarget = -2.25;
      triggerSlowMo(180, 0.35);
    }
    if (flashOrigin) triggerSkillFlashLight(flashOrigin, palHex, isHighTier ? 5.2 : 3.8, 520);
    if (aToken) {
      const tAct = combatNow();
      aToken.musouActionStartedAt = tAct;
      aToken.musouActionUntil = tAct + 750;
      if (aToken.mesh) {
        window.MusouVfx?.spawnShockRing?.(scene, aToken.mesh.position, palHex, 2.4, 520);
      }
    }
    performWarlordSkillVfx(aToken, tToken, resolvedFxKey, ln, true);
    playSkillImpactSound(resolvedFxKey, aToken, tToken, 0.96);
    triggerCameraShake(0.28);
  }

  async function playEvent(ln, options = {}) {
    if (!isInitialized || battleSettled || !ln) return;

    const aToken = ln.auid ? unitsMap.get(ln.auid) : null;
    const tToken = ln.tuid ? unitsMap.get(ln.tuid) : null;
    if (!aToken && !tToken) {
      if (ln.moraleShift || ln.brevity === '短兵相接' || ln.brevity === '以逸待勞') {
        if (!audioPaused && !document.hidden && window.SoundEngine?.play) {
          window.SoundEngine.play(ln.moraleShift || ln.brevity === '短兵相接' ? 'war_drum' : 'strategy_gong');
        }
        if (cameraShakeEnabled && (ln.moraleShift || ln.brevity === '短兵相接')) {
          camZoomTarget = -0.9;
          lastFocusAt = combatNow();
        }
      }
      return;
    }

    // 1. 戰法發動時於部隊上方顯示 3D 浮動技能字，並觸發光榮風格橫幅 Cut-in（帶入技能名稱與說明）
    const nowMs = combatNow();
    if (!ln.finale && aToken && (ln.skillActivation || ln.ambushActivation)) {
      const fxIcon = ln.skillFxIcon || aToken.skillFxIcon || '⚡';
      spawnFloatingDamagePopup(
        aToken.mesh.position,
        `${fxIcon} ${ln.brevity || '戰法發動'}`,
        aToken.side === 'A' ? '#38bdf8' : '#fbbf24',
        true
      );
      if (ln.hpRestored > 0) {
        const healedTroops = Math.max(100, Math.round(ln.hpRestored * 100)).toLocaleString();
        spawnFloatingDamagePopup(
          aToken.mesh.position,
          `💚 兵力重整 +${healedTroops}`,
          '#34d399',
          false
        );
      }
      if (!tToken) {
        await runWarlordSkillWithCutin(aToken, null, ln.skillFx || aToken.skillFx, ln, options.tempo || 1);
      }
    }
    if (!ln.finale && Array.isArray(ln.statusKeys) && ln.statusKeys.length) {
      const stTarget = ln.statusTargetUid ? (unitsMap.get(ln.statusTargetUid) || tToken) : tToken;
      ln.statusKeys.forEach(sk => {
        if (sk === 'rally' && aToken) applyTokenStatusAura(aToken, 'rally', 4200);
        else if (sk === 'dispel' && stTarget) clearTokenStatusAuras(stTarget);
        else if (['burn', 'sunder', 'confuse', 'stagger', 'mark'].includes(sk) && stTarget) {
          applyTokenStatusAura(stTarget, sk, 4200);
        }
      });
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
        advanceRangedToEffectiveRange(aToken, tToken);
        const rawAimYaw = Math.atan2(
          tToken.mesh.position.x - aToken.mesh.position.x,
          tToken.mesh.position.z - aToken.mesh.position.z
        );
        const aimTurn = clampFormationYaw(aToken.side, rawAimYaw, 0.38);
        aToken.targetYaw = aimTurn.yaw;
        aToken.individualYawOffset = aimTurn.remainder;
      }
    }

    let finishEffects, failEffects;
    const effectsFinished = new Promise((resolve, reject) => {
      finishEffects = resolve;
      failEffects = reject;
    });
    let deferTargetEffects = false;

    if (ln.kind === 'info') {
      if (aToken && (ln.skillTriggered || ln.ambushTriggered || ln.ambushActivation)) {
        if (!audioPaused && !document.hidden && window.SoundEngine?.playSkillActivation) {
          window.SoundEngine.playSkillActivation(ln.skillFx || aToken.skillFx, aToken.side, ln.sfxOverride || 'strategy_gong');
        } else {
          playFieldSound(ln.sfxOverride || 'strategy_gong', aToken, 0.58);
        }
      }
      finishEffects();
      return effectsFinished;
    }

    // 3. 依五大兵種執行全 3D 模型骨骼動畫與彈道特效
    const ranged = aToken && (['air_defense', 'support'].includes(aToken.cat) || aToken.formationRanged);
    if (aToken) {
      const sound = ranged ? 'arrow_volley' : aToken.cat === 'air' ? 'cavalry_hooves'
        : ln.kind === 'miss' ? null : ln.sfxOverride || 'blade_clash';
      if (sound && ln.kind !== 'info') playFieldSound(sound, aToken, 0.45);
    }
    const isArquebus = Boolean(aToken && ARQUEBUS_IDS.has(aToken.id));
    const forcedMelee = ranged && tToken && aToken.mesh.position.distanceTo(tToken.mesh.position) < 2;
    if (ln.followUp && aToken && tToken && aToken.alive) {
      triggerSquadAnim(aToken, 'attack', 1.35);
      if (ranged) {
        spawn3DArrowVolley(aToken.mesh.position, tToken.mesh.position, aToken.side, ln.kind === 'miss', 10, isArquebus);
      } else if (ln.kind !== 'miss') {
        const hitPos = tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.85, 0));
        const col = ln.isCounter ? 0xfef08a : 0xf43f5e;
        spawnSparkBurst(hitPos, 16, col);
        spawnSlashArc(hitPos, aToken.side, col, 1.35, true);
        triggerSkillFlashLight(hitPos, col, 3.6, 360);
        applyImpactReaction(tToken, 0.16);
      }
    } else if ((ln.finale || (meleeActive && (!ranged || forcedMelee))) && aToken && tToken && aToken.alive) {
      await approachMeleeTarget(aToken, tToken);
      if (aToken.epoch !== battleEpoch || battleSettled) { finishEffects(); return effectsFinished; }
      const rawMeleeYaw = Math.atan2(
        tToken.mesh.position.x - aToken.mesh.position.x,
        tToken.mesh.position.z - aToken.mesh.position.z
      );
      const meleeTurn = clampFormationYaw(aToken.side, rawMeleeYaw, 0.48);
      aToken.targetYaw = meleeTurn.yaw;
      aToken.individualYawOffset = meleeTurn.remainder;
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
      spawn3DArrowVolley(aToken.mesh.position, tToken.mesh.position, aToken.side, ln.kind === 'miss', 16, isArquebus);
      await waitForCombatBeat(options.continuous ? 340 : 450, aToken.epoch);
    } else if (ln.duel && aToken && tToken && aToken.alive && tToken.alive) {
      performDuelClash(aToken, tToken);
    } else if (aToken && tToken && aToken.alive) {
      if (aToken.cat === 'air') {
        deferTargetEffects = performCavalryCharge(aToken, tToken, playTargetEffects, ln.kind === 'miss');
      } else if (aToken.cat === 'air_defense' || (ln.text && ln.text.includes('箭'))) {
        triggerSquadAnim(aToken, 'attack', 1.25);
        spawn3DArrowVolley(aToken.mesh.position, tToken.mesh.position, aToken.side, ln.kind === 'miss', 16, isArquebus);
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
          if (ln.skillTriggered || ln.ambushTriggered || ln.ambushActivation) {
            await runWarlordSkillWithCutin(aToken, tToken, ln.skillFx || aToken?.skillFx, ln, options.tempo || 1);
          }
        } else if (ln.dmg && ln.dmg > 0) {
          if (!ln.duel) triggerSquadAnim(tToken, 'hit', 1.2);
          const isSkillOrAmbush = Boolean(ln.skillTriggered || ln.ambushTriggered || ln.ambushActivation);
          const isKillOrCapture = ln.kind === 'kill' || ln.kind === 'capture';
          const isDesperate = Boolean(aToken && aToken.maxHp > 0 && (aToken.currentHp / aToken.maxHp) < 0.35);
          if (isSkillOrAmbush) {
            await runWarlordSkillWithCutin(aToken, tToken, ln.skillFx || aToken?.skillFx, ln, options.tempo || 1);
          } else if ((isKillOrCapture || isDesperate || ln.duel) && aToken && !ln.finale && window.MusouCutin) {
            await window.MusouCutin.play({
              uid: aToken.id,
              side: aToken.side,
              fxKey: ln.skillFx || aToken.skillFx,
              tempo: options.tempo || 1,
              focusToken: aToken,
              cooldownKey: aToken.uid
            });
            if (!battleSettled && tToken?.mesh) {
              const tAct = combatNow();
              aToken.musouActionStartedAt = tAct;
              aToken.musouActionUntil = tAct + 750;
              window.MusouVfx?.spawnShockRing?.(scene, aToken.mesh.position, 0xfbbf24, 2.2, 480);
              window.MusouVfx?.spawnSlashArc?.(scene, tToken.mesh.position, aToken.side === 'A' ? 1 : -1, 0xfbbf24, 2.8, 420);
              window.MusouVfx?.createGpuBurst?.({ scene, origin: tToken.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 420, color: 0xfbbf24, speed: 5.5, life: 780, size: 18 });
              playSkillImpactSound(ln.skillFx || aToken.skillFx, aToken, tToken, 0.88);
              triggerCameraShake(0.24);
            }
          }
          if (ln.skillTriggered && !ln.finale) {
            const tagSuffix = ln.skillTag ? `・${ln.skillTag}` : '';
            spawnFloatingDamagePopup(
              tToken.mesh.position,
              `${ln.skillFxIcon || aToken?.skillFxIcon || '⚡'} ${ln.brevity || aToken?.skillFxLabel || '戰法'}${tagSuffix}`,
              '#fde047',
              true
            );
          }
          const lostTroops = Math.max(100, Math.round(ln.dmg * 100)).toLocaleString();
          const isKill = ln.kind === 'kill' || ln.kind === 'capture';
          const isCaptured = ln.kind === 'capture';
          spawnFloatingDamagePopup(
            tToken.mesh.position,
            isCaptured ? `🪢 被俘 -${lostTroops}` : isKill ? `💥 擊破 -${lostTroops}` : `-${lostTroops}`,
            isKill ? '#fb7185' : '#f87171',
            isKill
          );
          if (ln.lastStand && tToken?.mesh) {
            performShieldBlockDome(tToken);
            spawnShockwaveRing(tToken.mesh.position, 0xfbbf24, 2.3, 450);
            spawnSparkBurst(tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0)), 20, 0xfde047);
            spawnFloatingDamagePopup(tToken.mesh.position, '🛡️ 死守殘陣!', '#fde047', true);
            triggerCameraShake(0.22);
          }
          if (ln.hpHealed > 0 && aToken?.mesh) {
            const healTroops = Math.max(100, Math.round(ln.hpHealed * 100)).toLocaleString();
            spawnFloatingDamagePopup(aToken.mesh.position, `💚 浴血 +${healTroops}`, '#34d399', false);
          }
        }
        if (options.commit) {
          options.commit(tToken);
        } else if (ln.hpAfter !== undefined) {
          updateTokenHp(tToken, ln.hpAfter, 850 / Math.max(0.6, options.tempo || 1));
        }
        if (ln.dmg > 0 && ln.kind !== 'miss' && ln.kind !== 'block' && !ln.followUp) {
          const epoch = battleEpoch;
          const tempoScale = Math.max(0.6, options.tempo || 1);
          for (let beat = 0; beat < 2; beat++) {
            await waitForCombatBeat(140 / tempoScale, epoch);
            if (epoch !== battleEpoch || battleSettled) { finishEffects(); return; }
            if (aToken?.alive) {
              triggerSquadAnim(aToken, 'attack', 1.2);
              if (ranged) spawn3DArrowVolley(aToken.mesh.position, tToken.mesh.position, aToken.side, false, 8, isArquebus);
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
    const dist = aToken.mesh.position.distanceTo(tToken.mesh.position);
    if (dist > 1.5) {
      const meet = aToken.mesh.position.clone().lerp(tToken.mesh.position, 0.5);
      aToken.mesh.position.lerp(meet, 0.35);
      tToken.mesh.position.lerp(meet, 0.35);
      aToken.mesh.position.y = getBattleTerrainHeight(aToken.mesh.position.x, aToken.mesh.position.z);
      tToken.mesh.position.y = getBattleTerrainHeight(tToken.mesh.position.x, tToken.mesh.position.z);
    }
    const duelYawA = Math.atan2(tToken.mesh.position.x - aToken.mesh.position.x, tToken.mesh.position.z - aToken.mesh.position.z);
    const turnA = clampFormationYaw(aToken.side, duelYawA, 0.45);
    aToken.targetYaw = turnA.yaw;
    aToken.individualYawOffset = turnA.remainder;
    const duelYawB = Math.atan2(aToken.mesh.position.x - tToken.mesh.position.x, aToken.mesh.position.z - tToken.mesh.position.z);
    const turnB = clampFormationYaw(tToken.side, duelYawB, 0.45);
    tToken.targetYaw = turnB.yaw;
    tToken.individualYawOffset = turnB.remainder;
    triggerSquadAnim(aToken, 'attack', 1.4);
    triggerSquadAnim(tToken, 'attack', 1.25);
    const midpoint = aToken.mesh.position.clone().lerp(tToken.mesh.position, 0.5);
    const hitPos = midpoint.clone().add(new THREE.Vector3(0, 0.92, 0));
    spawnFloatingDamagePopup(midpoint, '⚔️ 一騎討', '#fde047', true);
    // 第一合：雙將展開單挑戰圈、試探交鋒
    window.MusouVfx?.spawnShockRing?.(scene, midpoint, 0xfbbf24, 3.2, 680);
    spawnSparkBurst(hitPos, 18, 0xfef08a);
    spawnSlashArc(hitPos, aToken.side, 0xfbbf24, 1.35, true);
    spawnSlashArc(hitPos, tToken.side, 0x38bdf8, 1.2, false);
    triggerSkillFlashLight(hitPos, 0xfbbf24, 4.4, 480);
    // 第二合 (+150ms)：兵刃格擋爆火星＋反擊弧斬
    scheduleBattleTimer(150, () => {
      if (!aToken.alive && !tToken.alive) return;
      triggerSquadAnim(aToken, 'attack', 1.4);
      triggerSquadAnim(tToken, 'attack', 1.3);
      spawnSparkBurst(hitPos, 22, 0xffffff);
      spawnSlashArc(hitPos.clone().add(new THREE.Vector3(0, 0.15, 0)), tToken.side, 0x38bdf8, 1.45, true);
      spawnSlashArc(hitPos.clone().add(new THREE.Vector3(0, -0.1, 0)), aToken.side, 0xfde047, 1.4, false);
      playFieldSound('blade_clash', aToken, 0.72);
    });
    // 第三合 (+300ms)：決死霸斬＋閃光點光源＋Hit-Stop＋微推鏡
    scheduleBattleTimer(300, () => {
      if (!aToken.alive && !tToken.alive) return;
      spawnSlashArc(hitPos, aToken.side, 0xf43f5e, 1.85, true);
      spawnShockwaveRing(midpoint, 0xf59e0b, 3.0, 480);
      triggerSkillFlashLight(hitPos, 0xfde047, 5.2, 440);
      if (cameraShakeEnabled) camZoomTarget = Math.min(camZoomTarget, -1.5);
      triggerCameraShake(0.36);
      triggerHitStop(85);
      applyImpactReaction(tToken, 0.18);
    });
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

    if (orig.distanceTo(target) > 1.85) aToken.chargeCommitted = false;
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

  /* 神射強弩／戰國鐵砲：單批 InstancedMesh 曳光箭矢或火繩槍彈丸齊射 (只需 1 個 Draw Call!) */
  const _arrowObj = new THREE.Object3D();
  function spawn3DArrowVolley(fromPos, toPos, side, miss = false, volleySize = 16, isArquebus = false) {
    if (!scene || battleSettled || volleySize <= 0) return;
    if (isArquebus) {
      const muzzlePos = fromPos.clone().add(new THREE.Vector3(side === 'A' ? 0.65 : -0.65, 1.05, 0));
      spawnSparkBurst(muzzlePos, 12, 0xffedd5);
      spawnWarSmoke(muzzlePos, 2, 0xdbeafe, 1.25, 0.34);
    }
    const geo = new THREE.CylinderGeometry(isArquebus ? 0.022 : 0.014, isArquebus ? 0.026 : 0.040, isArquebus ? 0.72 : 0.96, 5);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: isArquebus ? 0xfdba74 : (side === 'A' ? 0xbae6fd : 0xfde047)
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
      const baseArc = Math.min(3.5, fromPos.distanceTo(toPos) * 0.16) + Math.random() * 0.35;
      items.push({
        start,
        end,
        startedAt: nowMs + Math.floor(i / 4) * (isArquebus ? 48 : 85) + (i % 4) * 10,
        duration: isArquebus ? 240 : 440,
        miss,
        arcHeight: isArquebus ? baseArc * 0.25 : baseArc,
        stickChance: !isArquebus && (i % 4 === 0),
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
    const isFire = token.skillFx === 'fire_storm' || token.side === 'B';
    const boltSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getSkillVfxTexture(isFire ? 'flame_tongue' : 'talisman_scroll'),
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      fog: false
    }));
    boltSprite.scale.set(isFire ? 0.92 : 0.62, 1.15, 1);
    boltGroup.add(boltSprite);
    boltGroup.position.copy(start);
    scene.add(boltGroup);
    projectiles.push({
      mesh: boltGroup,
      disposableChildren: [boltSprite],
      start,
      end,
      startedAt: combatNow(),
      duration: 600,
      arcHeight: 1.5,
      miss: false,
      isGLB: false,
      isComposite: true,
      impactColor: isFire ? 0xf97316 : 0x38bdf8,
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
    if (orig.distanceTo(target) > 1.85) aToken.chargeCommitted = false;
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
      const isHeavyTarget = tToken.cat === 'armor' || aToken.cat === 'armor';
      spawnSparkBurst(hitPos, isHeavyTarget ? 24 : 18, isHeavyTarget ? 0xfffbeb : 0xfde047);
      spawnSlashArc(hitPos, aToken.side, 0xfbbf24, isHeavyTarget ? 1.35 : 1.15, false);
      if (isHeavyTarget) {
        spawnSlashArc(hitPos.clone().add(new THREE.Vector3(0, 0.2, 0)), aToken.side === 'A' ? 'B' : 'A', 0xfef08a, 1.1, false);
        spawnShockwaveRing(tToken.mesh.position, 0xf59e0b, 1.9, 320);
      }
      spawnWarSmoke(hitPos, isHeavyTarget ? 2 : 1, 0x4b4238, isHeavyTarget ? 1.75 : 1.5, 0.34);
      triggerCameraShake(isHeavyTarget ? 0.22 : 0.14);
      applyImpactReaction(tToken, isHeavyTarget ? 0.14 : 0.10);
    }
  }

  /* 運籌帷幄：軍師手繪太極八卦陣、火蓮火舌或金篆兵符 */
  function performStrategistFormation(aToken, tToken, logText) {
    triggerSquadAnim(aToken, 'attack', 1.25);
    const isFire = logText.includes('火') || logText.includes('砲') || logText.includes('焚') || logText.includes('焰');
    const isStorm = logText.includes('雷') || logText.includes('風') || logText.includes('天');
    const tgtPos = tToken.mesh.position.clone();
    const now = combatNow();

    // 地面手繪太極八卦陣特效
    const ringGeo = new THREE.PlaneGeometry(3.4, 3.4);
    const ringMat = new THREE.MeshBasicMaterial({
      map: getSkillVfxTexture(isFire ? 'fire_lotus' : isStorm ? 'thunder_seal' : 'bagua_seal'),
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });
    const baguaMesh = new THREE.Mesh(ringGeo, ringMat);
    baguaMesh.rotation.x = -Math.PI / 2;
    baguaMesh.position.set(tgtPos.x, tgtPos.y + 0.09, tgtPos.z);
    scene.add(baguaMesh);
    shockwaves.push({
      mesh: baguaMesh,
      startedAt: now,
      duration: 840,
      startScale: 0.55,
      endScale: 1.25,
      opacity: 0.94,
      spinRate: 1.8
    });

    // 2 道上升之手繪兵符或火舌 Sprite（絕不用幾何光柱）
    const spriteKey = isFire ? 'flame_tongue' : 'talisman_scroll';
    for (let k = 0; k < 2; k++) {
      if (particleSystems.length >= 210) break;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getSkillVfxTexture(spriteKey),
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        fog: false
      }));
      sp.scale.set(isFire ? 1.55 : 0.78, isFire ? 1.85 : 1.5, 1);
      sp.position.set(tgtPos.x + (k === 0 ? -0.65 : 0.65), tgtPos.y + 0.95, tgtPos.z + (k === 0 ? 0.35 : -0.35));
      sp.renderOrder = 25;
      scene.add(sp);
      particleSystems.push({
        mesh: sp,
        vx: 0,
        vy: 0.016,
        vz: 0,
        startedAt: now,
        duration: 560,
        opacity: 0.92,
        gravity: 0,
        fadeInOut: true
      });
    }

    spawnWarSmoke(tgtPos, 2, isFire ? 0x3b2618 : 0x4b453d, 2.0, 0.38);
    spawnShockwaveRing(tgtPos, isFire ? 0xf97316 : (isStorm ? 0x38bdf8 : 0xfbbf24), 2.8, 480);
    playFieldSound(isFire ? 'fire_attack' : 'strategy_gong', aToken, 0.72);

    if (isFire) {
      spawnSparkBurst(tgtPos.clone().add(new THREE.Vector3(0, 0.75, 0)), 18, 0xf97316);
      spawnBattleScar(tgtPos, 1.35, true);
      triggerCameraShake(0.32);
      triggerHitStop(70);
    } else {
      spawnSparkBurst(tgtPos.clone().add(new THREE.Vector3(0, 0.85, 0)), 14, isStorm ? 0x38bdf8 : 0xfde047);
      triggerCameraShake(0.22);
    }
  }

  function performShieldBlockDome(tToken) {
    triggerSquadAnim(tToken, 'hit', 1.1);
    const center = tToken.mesh.position.clone().add(new THREE.Vector3(0, 0.75, 0));
    spawnSparkBurst(center, 18, 0xfef08a);
    spawnShockwaveRing(tToken.mesh.position, 0xfde047, 1.5, 280);
    spawnShockwaveRing(tToken.mesh.position, 0xf59e0b, 2.25, 400);
    if (particleSystems.length < 210) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getSkillVfxTexture('bronze_shield'),
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        fog: false
      }));
      sp.scale.set(1.55, 1.7, 1);
      sp.position.set(tToken.mesh.position.x, tToken.mesh.position.y + 1.05, tToken.mesh.position.z);
      sp.renderOrder = 26;
      scene.add(sp);
      particleSystems.push({
        mesh: sp,
        vx: 0, vy: 0.008, vz: 0,
        startedAt: combatNow(),
        duration: 420,
        opacity: 0.96,
        gravity: 0,
        fadeInOut: true
      });
    }
    applyImpactReaction(tToken, 0.11);
  }



  function spawnSkillScrollBanner(worldPos, aToken, ln, fxKey) {
    if (!scene || battleSettled || particleSystems.length >= 210) return;
    const pal = VFX_PALETTES[fxKey] || VFX_PALETTES.overlord_cleave;
    const warlordName = aToken?.name || '名將';
    const rawTitle = ln?.brevity || aToken?.skillFxLabel || '無雙戰法';
    const fxIcon = ln?.skillFxIcon || aToken?.skillFxIcon || '⚡';
    const tagStr = ln?.skillTag ? ` · ${ln.skillTag}` : '';
    const side = aToken?.side === 'A' ? 'A' : 'B';
    const cacheKey = `banner|${side}|${warlordName}|${rawTitle}|${tagStr}|${fxKey}`;

    let tex = vfxTexCache.get(cacheKey);
    if (!tex) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 136;
      const ctx = c.getContext('2d');

      const bg = ctx.createLinearGradient(0, 0, 512, 0);
      bg.addColorStop(0, 'rgba(15, 23, 42, 0.0)');
      bg.addColorStop(0.08, 'rgba(14, 10, 8, 0.99)');
      bg.addColorStop(0.5, side === 'A' ? 'rgba(15, 23, 42, 0.99)' : 'rgba(54, 15, 15, 0.99)');
      bg.addColorStop(0.92, 'rgba(14, 10, 8, 0.99)');
      bg.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
      ctx.fillStyle = bg;
      ctx.fillRect(16, 12, 480, 112);

      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 5;
      ctx.strokeRect(28, 16, 456, 104);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(35, 22, 442, 92);

      ctx.textAlign = 'center';
      ctx.fillStyle = pal.accent;
      ctx.font = '800 20px "Noto Sans TC", sans-serif';
      ctx.fillText(`${side === 'A' ? '▲ 我軍戰法' : '▼ 敵軍戰法'}${tagStr}`, 256, 49);

      ctx.fillStyle = '#fffbeb';
      ctx.font = '900 32px "Noto Serif TC", "Noto Sans TC", serif';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 8;
      ctx.fillText(`${fxIcon} ${warlordName}【${rawTitle}】`, 256, 93);

      tex = new THREE.CanvasTexture(c);
      vfxTexCache.set(cacheKey, tex);
    }

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(3.6, 0.96, 1);
    sp.position.set(worldPos.x, worldPos.y + 3.35, worldPos.z);
    sp.renderOrder = 32;
    scene.add(sp);
    particleSystems.push({
      mesh: sp,
      vx: 0,
      vy: 0.004,
      vz: 0,
      startedAt: combatNow(),
      duration: 1450,
      opacity: 1.0,
      gravity: 0,
      fadeInOut: true
    });
  }

  /* 名將專屬戰法 3D 視覺特效（八大戰法手繪 Canvas2D 陣圖與演武大招） */
  function performWarlordSkillVfx(aToken, tToken, fxKey, ln = null, isUltimate = true) {
    if (!scene || battleSettled) return;
    const targetToken = tToken || aToken;
    if (!targetToken) return;
    const key = fxKey || aToken?.skillFx || 'overlord_cleave';
    const anchor = targetToken.mesh.position.clone();
    const casterAnchor = aToken ? aToken.mesh.position.clone() : anchor.clone();
    const groundY = getBattleTerrainHeight(anchor.x, anchor.z);
    const now = combatNow();
    skillVfxPlayed++;
    if (!isUltimate) {
      const minorHex = parseInt((VFX_PALETTES[key] || VFX_PALETTES.overlord_cleave).primary.slice(1), 16);
      triggerSkillFlashLight(anchor, minorHex, 3.6, 420);
    }

    function addTexPlane(texKey, width, height, pos, opts = {}) {
      if (particleSystems.length >= 210) return null;
      const geo = new THREE.PlaneGeometry(width, height);
      const mat = new THREE.MeshBasicMaterial({
        map: getSkillVfxTexture(texKey),
        transparent: true,
        opacity: opts.opacity ?? 0.96,
        depthWrite: false,
        depthTest: opts.depthTest !== undefined ? opts.depthTest : true,
        fog: false,
        side: THREE.DoubleSide,
        blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      const mesh = new THREE.Mesh(geo, mat);
      if (opts.additive !== false) mesh.layers.enable(1);
      mesh.position.copy(pos);
      mesh.renderOrder = opts.renderOrder || 24;
      if (opts.alignDir) {
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), opts.alignDir.clone().normalize());
        if (opts.rollY) mesh.rotateY(opts.rollY);
      } else {
        if (opts.rotateX !== undefined) mesh.rotateX(opts.rotateX);
        if (opts.rotateY !== undefined) mesh.rotateY(opts.rotateY);
        if (opts.rotateZ !== undefined) mesh.rotateZ(opts.rotateZ);
      }
      scene.add(mesh);
      particleSystems.push({
        mesh,
        vx: opts.vx || 0,
        vy: opts.vy || 0,
        vz: opts.vz || 0,
        spinZ: opts.spinZ || 0,
        spinY: opts.spinY || 0,
        orbitCenter: opts.orbitCenter || null,
        orbitRadius: opts.orbitRadius || 0,
        orbitAngle: opts.orbitAngle || 0,
        orbitSpeed: opts.orbitSpeed || 2.4,
        faceOutward: Boolean(opts.faceOutward),
        fadeInOut: opts.fadeInOut !== false,
        startedAt: now,
        duration: Math.round(opts.duration || 950),
        opacity: opts.opacity ?? 0.96,
        gravity: opts.gravity || 0,
        scaleGrowth: opts.scaleGrowth || 0
      });
      return mesh;
    }

    function addTexSprite(texKey, width, height, pos, opts = {}) {
      if (particleSystems.length >= 210) return null;
      const mat = new THREE.SpriteMaterial({
        map: getSkillVfxTexture(texKey),
        transparent: true,
        opacity: opts.opacity ?? 0.96,
        depthWrite: false,
        depthTest: opts.depthTest !== undefined ? opts.depthTest : true,
        fog: false,
        blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      const sp = new THREE.Sprite(mat);
      if (opts.additive !== false) sp.layers.enable(1);
      sp.scale.set(width, height, 1);
      sp.position.copy(pos);
      sp.renderOrder = opts.renderOrder || 26;
      scene.add(sp);
      particleSystems.push({
        mesh: sp,
        vx: opts.vx || 0,
        vy: opts.vy || 0,
        vz: opts.vz || 0,
        spinZ: opts.spinZ || 0,
        fadeInOut: opts.fadeInOut !== false,
        startedAt: now,
        duration: Math.round(opts.duration || 900),
        opacity: opts.opacity ?? 0.96,
        gravity: opts.gravity || 0,
        scaleGrowth: opts.scaleGrowth || 0
      });
      return sp;
    }

    const commandCenter = new THREE.Vector3(aToken?.side === 'A' ? 2.2 : -2.2, getBattleTerrainHeight(0, 0), 0);
    const fxPos = !tToken ? (key === 'bagua_array' ? casterAnchor : commandCenter) : anchor;
    const fxY = getBattleTerrainHeight(fxPos.x, fxPos.z);

    // 於對應部隊頭頂升起高反差「【戰法名號卷軸】」讓玩家一目了然
    spawnSkillScrollBanner(new THREE.Vector3(fxPos.x, fxY, fxPos.z), aToken, ln, key);

    const musouMove = (typeof getMusouMove === 'function' && aToken?.id) ? getMusouMove(aToken.id) : null;
    const sigHandler = musouMove?.sig ? window.MusouVfx?.getSignature?.(musouMove.sig) : null;
    if (sigHandler) {
      sigHandler({
        scene,
        caster: aToken,
        target: targetToken,
        tToken,
        casterPos: casterAnchor,
        targetPos: fxPos,
        groundY: fxY,
        palette: VFX_PALETTES[key] || VFX_PALETTES.overlord_cleave,
        now,
        isUltimate,
        addTexPlane,
        addTexSprite,
        getTex: getSkillVfxTexture,
        triggerCameraShake,
        triggerHitStop,
        playFieldSound
      });
    }

    // Phase 5：其餘 75 位武將依兵種 cat 做 ±12° 色相微調並疊加 Phase 2 華麗元件
    const catHueMap = { air: -0.033, armor: 0.033, air_defense: 0.017, naval: -0.017, support: 0 };
    const tintByCat = (hex) => {
      const shift = catHueMap[aToken?.cat] || 0;
      if (!shift) return hex;
      return new THREE.Color(hex).offsetHSL(shift, 0.04, 0).getHex();
    };
    const basePalHex = parseInt((VFX_PALETTES[key] || VFX_PALETTES.overlord_cleave).primary.slice(1), 16);
    const tintedHex = tintByCat(basePalHex);
    if (aToken?.cat === 'air' || aToken?.cat === 'naval') {
      window.MusouVfx?.spawnSlashArc?.(scene, fxPos, aToken.side === 'A' ? 1 : -1, tintedHex, 2.9, 440);
    } else if (aToken?.cat === 'armor' || aToken?.cat === 'support') {
      window.MusouVfx?.spawnPillar?.(scene, fxPos, tintedHex, 4.8, 660);
    } else {
      window.MusouVfx?.spawnShockRing?.(scene, fxPos, tintedHex, 3.8, 640);
    }

    if (key === 'fire_storm') {
      // 紅蓮火陣 + 高聳烈焰火柱 + 天降赤壁火流星 + 環繞炎舌
      addTexPlane('fire_lotus', 5.8, 5.8, new THREE.Vector3(fxPos.x, fxY + 0.12, fxPos.z), {
        rotateX: -Math.PI / 2, spinZ: 1.5, duration: 1080, scaleGrowth: 0.012, renderOrder: 22, additive: false
      });
      addTexSprite('flame_tongue', 3.4, 4.2, new THREE.Vector3(fxPos.x, fxY + 2.1, fxPos.z), {
        vy: 0.018, scaleGrowth: 0.02, duration: 960, depthTest: false, renderOrder: 28, additive: false
      });
      window.MusouVfx?.createGpuBurst?.({ scene, origin: fxPos.clone().add(new THREE.Vector3(0, 0.8, 0)), count: 520, color: 0xf97316, speed: 5.2, life: 950, size: 20 });
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3 + 0.4;
        const ox = Math.cos(ang) * 0.9;
        const oz = Math.sin(ang) * 0.9;
        const meteorDir = new THREE.Vector3(-0.35, -1.0, 0.12).normalize();
        addTexPlane('meteor_fireball', 1.4, 2.9, new THREE.Vector3(fxPos.x + ox + 1.4, fxY + 5.2 + i * 0.7, fxPos.z + oz - 0.5), {
          alignDir: meteorDir, rollY: i * 1.05, vx: -0.055, vy: -0.17, vz: 0.02, duration: 540
        });
        addTexSprite('flame_tongue', 2.4, 2.9, new THREE.Vector3(fxPos.x + ox, fxY + 1.4, fxPos.z + oz), {
          vy: 0.022, scaleGrowth: 0.024, duration: 920
        });
      }
      spawnBattleScar(fxPos, 1.8, true);
      spawnWarSmoke(fxPos, 2, 0x3b2114, 2.3, 0.45);
      spawnShockwaveRing(fxPos, 0xea580c, 3.6, 760);
      spawnSparkBurst(fxPos.clone().add(new THREE.Vector3(0, 1.0, 0)), 24, 0xf97316);
      playFieldSound('fire_attack', targetToken, 0.65);
    } else if (key === 'thunder_strike') {
      // 地面雷紋法印 + 三道交錯九天分叉天雷
      addTexPlane('thunder_seal', 5.2, 5.2, new THREE.Vector3(fxPos.x, fxY + 0.12, fxPos.z), {
        rotateX: -Math.PI / 2, spinZ: -2.1, duration: 980, scaleGrowth: 0.01, renderOrder: 22, additive: false
      });
      addTexPlane('lightning_bolt', 3.4, 6.8, new THREE.Vector3(fxPos.x, fxY + 3.45, fxPos.z), {
        rotateY: 0.35, duration: 640, renderOrder: 27, additive: false
      });
      addTexPlane('lightning_bolt', 3.4, 6.8, new THREE.Vector3(fxPos.x, fxY + 3.45, fxPos.z), {
        rotateY: 0.35 + Math.PI / 2, duration: 640, renderOrder: 27, additive: false
      });
      addTexPlane('lightning_bolt', 2.4, 5.6, new THREE.Vector3(fxPos.x + 0.85, fxY + 2.85, fxPos.z - 0.65), {
        rotateY: -0.45, rotateZ: 0.16, duration: 580, renderOrder: 27, additive: false
      });
      window.MusouVfx?.createGpuBurst?.({ scene, origin: fxPos.clone().add(new THREE.Vector3(0, 1.1, 0)), count: 520, color: 0x38bdf8, speed: 6.2, life: 820, size: 19 });
      spawnShockwaveRing(fxPos, 0x0284c7, 3.5, 720);
      spawnSparkBurst(fxPos.clone().add(new THREE.Vector3(0, 1.1, 0)), 24, 0x38bdf8);
      playFieldSound('cavalry_charge', targetToken, 0.65);
      if (isUltimate) {
        triggerCameraShake(0.26);
        triggerHitStop(45);
      }
    } else if (key === 'bagua_array') {
      // 巨型太極八卦陣圖 + 六道盤旋金篆奇門兵符
      const castGround = getBattleTerrainHeight(casterAnchor.x, casterAnchor.z);
      addTexPlane('bagua_seal', 6.2, 6.2, new THREE.Vector3(fxPos.x, fxY + 0.12, fxPos.z), {
        rotateX: -Math.PI / 2, spinZ: 1.45, duration: 1220, scaleGrowth: 0.008, renderOrder: 22, additive: false
      });
      if (aToken && (!tToken || aToken !== targetToken)) {
        addTexPlane('bagua_seal', 4.6, 4.6, new THREE.Vector3(casterAnchor.x, castGround + 0.11, casterAnchor.z), {
          rotateX: -Math.PI / 2, spinZ: -1.45, duration: 1080, renderOrder: 22, additive: false
        });
      }
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI * 2) / 6;
        addTexPlane('talisman_scroll', 1.05, 2.05, new THREE.Vector3(fxPos.x, fxY + 1.55, fxPos.z), {
          orbitCenter: fxPos, orbitRadius: 2.25, orbitAngle: ang, orbitSpeed: 2.3,
          faceOutward: true, vy: 0.009, duration: 1120, renderOrder: 27, additive: false
        });
      }
      window.MusouVfx?.createGpuBurst?.({ scene, origin: fxPos.clone().add(new THREE.Vector3(0, 0.9, 0)), count: 460, color: 0xfbbf24, speed: 4.0, life: 1000, size: 18, gravity: -1.2 });
      spawnShockwaveRing(fxPos, 0xd97706, 3.4, 740);
      spawnSparkBurst(fxPos.clone().add(new THREE.Vector3(0, 1.0, 0)), 20, 0xfbbf24);
      playFieldSound('strategy_gong', targetToken, 0.65);
    } else if (key === 'piercing_volley') {
      // 破甲準星印 + 立體鎖定準星 + 三支金龍穿雲巨箭自斜空貫穿陣地
      const start = casterAnchor.clone().add(new THREE.Vector3(0, 1.35, 0));
      const end = anchor.clone().add(new THREE.Vector3(0, 0.75, 0));
      const travel = new THREE.Vector3().subVectors(end, start);
      const dist = travel.length();
      const horizontalDir = dist > 0.2 ? new THREE.Vector3(travel.x, 0, travel.z).normalize() : new THREE.Vector3(aToken?.side === 'A' ? 1 : -1, 0, 0);
      addTexPlane('bullseye_seal', 5.2, 5.2, new THREE.Vector3(anchor.x, groundY + 0.12, anchor.z), {
        rotateX: -Math.PI / 2, spinZ: -2.4, duration: 960, renderOrder: 22, additive: false
      });
      addTexSprite('bullseye_seal', 3.0, 3.0, end.clone().add(new THREE.Vector3(0, 0.35, 0)), {
        spinZ: 2.5, duration: 840, depthTest: false, renderOrder: 27, additive: false
      });
      window.MusouVfx?.createGpuBurst?.({ scene, origin: end, count: 480, color: 0xfef08a, speed: 5.5, life: 820, size: 17 });
      const plungeDir = horizontalDir.clone().multiplyScalar(0.75).add(new THREE.Vector3(0, 0.66, 0)).normalize();
      for (let i = 0; i < 3; i++) {
        const oz = (i - 1) * 0.85;
        const arrowPos = end.clone().add(new THREE.Vector3(-plungeDir.x * 1.4, 2.2, oz));
        addTexPlane('dragon_arrow', 1.65, 4.4, arrowPos, {
          alignDir: plungeDir.clone().negate(), rollY: 0,
          vx: -plungeDir.x * 0.08, vy: -plungeDir.y * 0.08, vz: 0, duration: 680, renderOrder: 28
        });
        addTexPlane('dragon_arrow', 1.65, 4.4, arrowPos, {
          alignDir: plungeDir.clone().negate(), rollY: Math.PI / 2,
          vx: -plungeDir.x * 0.08, vy: -plungeDir.y * 0.08, vz: 0, duration: 680, renderOrder: 28
        });
      }
      spawnShockwaveRing(anchor, 0xf59e0b, 3.0, 640);
      spawnSparkBurst(end, 22, 0xfbbf24);
      playFieldSound('arrow_volley', targetToken, 0.68);
    } else if (key === 'tidal_surge') {
      // 鳴梁漩渦陣 + 四面高聳浮世繪怒濤捲浪湧拍
      addTexPlane('whirlpool_seal', 5.6, 5.6, new THREE.Vector3(fxPos.x, fxY + 0.12, fxPos.z), {
        rotateX: -Math.PI / 2, spinZ: -3.1, duration: 1080, scaleGrowth: 0.01, renderOrder: 22, additive: false
      });
      window.MusouVfx?.createGpuBurst?.({ scene, origin: fxPos.clone().add(new THREE.Vector3(0, 0.8, 0)), count: 520, color: 0x22d3ee, speed: 5.0, life: 920, size: 19 });
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2 + 0.35;
        const r = 1.8;
        addTexPlane('great_wave', 3.2, 3.0, new THREE.Vector3(fxPos.x + Math.cos(ang) * r, fxY + 1.45, fxPos.z + Math.sin(ang) * r), {
          rotateY: -ang + Math.PI / 2,
          vx: -Math.cos(ang) * 0.014, vy: 0.014, vz: -Math.sin(ang) * 0.014,
          scaleGrowth: 0.022, duration: 920, renderOrder: 26
        });
      }
      spawnShockwaveRing(fxPos, 0x0891b2, 3.5, 720);
      spawnSparkBurst(fxPos.clone().add(new THREE.Vector3(0, 1.0, 0)), 22, 0x22d3ee);
      playFieldSound('war_drum', targetToken, 0.65);
    } else if (key === 'aegis_command') {
      // 八角不動如山盾陣 + 四面大型環繞金剛獸面盾
      const shieldTarget = tToken ? aToken || targetToken : targetToken;
      const shPos = shieldTarget.mesh.position.clone();
      const shGround = getBattleTerrainHeight(shPos.x, shPos.z);
      addTexPlane('aegis_seal', 5.2, 5.2, new THREE.Vector3(shPos.x, shGround + 0.12, shPos.z), {
        rotateX: -Math.PI / 2, spinZ: 0.9, duration: 1140, scaleGrowth: 0.006, renderOrder: 22, additive: false
      });
      window.MusouVfx?.createGpuBurst?.({ scene, origin: shPos.clone().add(new THREE.Vector3(0, 0.9, 0)), count: 440, color: 0x10b981, speed: 3.8, life: 960, size: 18, gravity: -1.0 });
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2;
        addTexPlane('bronze_shield', 1.65, 1.85, new THREE.Vector3(shPos.x, shGround + 1.35, shPos.z), {
          orbitCenter: shPos, orbitRadius: 2.05, orbitAngle: ang, orbitSpeed: 2.35,
          faceOutward: true, duration: 1140, renderOrder: 27
        });
      }
      spawnShockwaveRing(shPos, 0x059669, 3.2, 700);
      spawnSparkBurst(shPos.clone().add(new THREE.Vector3(0, 1.0, 0)), 20, 0x10b981);
      playFieldSound('shield_block', shieldTarget, 0.65);
    } else if (key === 'shadow_ambush') {
      // 暗影風魔陣 + 巨大十字寒芒斬 + 高速旋轉手裏劍（暗影保留正常混色，紫刃與粒子加算發光）
      const hitPos = anchor.clone().add(new THREE.Vector3(0, 1.2, 0));
      addTexPlane('shuriken_seal', 5.2, 5.2, new THREE.Vector3(anchor.x, groundY + 0.12, anchor.z), {
        rotateX: -Math.PI / 2, spinZ: -4.2, duration: 920, scaleGrowth: 0.01, renderOrder: 22, additive: false
      });
      addTexSprite('shadow_cross', 4.2, 4.2, hitPos, {
        scaleGrowth: 0.028, duration: 740, depthTest: false, renderOrder: 28, additive: false
      });
      window.MusouVfx?.createGpuBurst?.({ scene, origin: hitPos, count: 460, color: 0xc084fc, speed: 5.4, life: 780, size: 18 });
      addTexSprite('shuriken_seal', 2.6, 2.6, hitPos.clone().add(new THREE.Vector3(0, 0.3, 0)), {
        spinZ: 9.5, duration: 760, depthTest: false, renderOrder: 29
      });
      spawnSlashArc(hitPos, aToken?.side || 'A', 0xa855f7, 2.1, true);
      spawnShockwaveRing(anchor, 0x7e22ce, 3.2, 660);
      spawnSparkBurst(hitPos, 22, 0xc084fc);
      playFieldSound('blade_clash', targetToken, 0.65);
    } else {
      // overlord_cleave（霸王無雙：裂地破陣紋 + 立體旋轉月牙刀芒 + 雙重斬擊弧線）
      const hitPos = anchor.clone().add(new THREE.Vector3(0, 1.15, 0));
      addTexPlane('earth_fissure', 5.6, 5.6, new THREE.Vector3(anchor.x, groundY + 0.11, anchor.z), {
        rotateX: -Math.PI / 2, spinZ: 0.25, duration: 980, scaleGrowth: 0.012, renderOrder: 22, additive: false
      });
      addTexSprite('crescent_wave', 4.2, 4.2, hitPos.clone().add(new THREE.Vector3(0, 0.5, 0)), {
        spinZ: -4.5, scaleGrowth: 0.022, duration: 720, depthTest: false, renderOrder: 28, additive: false
      });
      window.MusouVfx?.createGpuBurst?.({ scene, origin: hitPos, count: 580, color: 0xf43f5e, speed: 5.8, life: 880, size: 20 });
      addTexPlane('crescent_wave', 4.4, 4.4, new THREE.Vector3(anchor.x, groundY + 0.85, anchor.z), {
        rotateX: -Math.PI / 2 + 0.22, spinZ: 6.8, scaleGrowth: 0.024, duration: 680, renderOrder: 27
      });
      addTexPlane('crescent_wave', 3.8, 3.8, new THREE.Vector3(anchor.x, groundY + 1.25, anchor.z), {
        rotateY: aToken?.side === 'A' ? 0.5 : -0.5, rotateX: 0.42, spinZ: -5.4, scaleGrowth: 0.022, duration: 680, renderOrder: 27
      });
      spawnSlashArc(hitPos, aToken?.side || 'A', 0xe11d48, 2.2, true);
      spawnShockwaveRing(anchor, 0xe11d48, 3.4, 680);
      spawnSparkBurst(hitPos, 24, 0xfbbf24);
      playFieldSound('blade_clash', targetToken, 0.72);
      if (isUltimate) triggerCameraShake(0.25);
    }
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
      if (immediate) {
        clearTokenStatusAuras(token);
        applyFallenPose(token, 1);
      }
      return token.deathAnimation || Promise.resolve();
    }
    token.alive = false;
    token.captured = Boolean(captured);
    token.march = null;
    token.engagement = null;
    token.impact = null;
    clearTokenStatusAuras(token);
    updateOccupationZones();
    updateTokenHp(token, 0);
    triggerSquadAnim(token, 'death', 1.0);
    if (!immediate) {
      spawnWarSmoke(token.mesh.position, 2, 0x3b322b, 2.0, 0.45);
      spawnShockwaveRing(token.mesh.position, captured ? 0xf59e0b : 0xef4444, 2.2, 420);
      spawnBattleScar(token.mesh.position, 1.15, false);
      triggerCameraShake(0.38);
      triggerHitStop(80);
      playFieldSound(captured ? 'war_drum' : 'warlord_fall', token, 0.85);
      triggerImpactVignette(captured ? 'rgba(217, 119, 6, 0.36)' : 'rgba(220, 38, 38, 0.34)');
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
          if (renderer && !isAnimationPaused && !immediate) renderFrame();
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
    resetDynamicLightingAndTimers();
    clearBattleEffects();
    if (renderer) renderFrame();
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
      'position:absolute;top:14px;left:50%;transform:translateX(-50%) skewX(-12deg) scale(0.9);max-width:min(560px, calc(100vw - 32px));box-sizing:border-box;',
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

  function scheduleWarlordCutin(token, isKill = false, ln = null) {
    const nowMs = combatNow();
    if (nowMs - lastCutinAt > 1050 && !cutinTimer) {
      lastCutinAt = nowMs;
      triggerWarlordCutin(token, isKill, ln);
      return;
    }
    if (cutinQueue.length < 3) cutinQueue.push({ token, isKill, ln });
    if (!cutinTimer) {
      const drain = () => {
        cutinTimer = null;
        if (battleSettled || !cutinQueue.length) return;
        const next = cutinQueue.shift();
        if (next && next.token && next.token.epoch === battleEpoch) {
          lastCutinAt = combatNow();
          triggerWarlordCutin(next.token, next.isKill, next.ln);
        }
        if (cutinQueue.length && !battleSettled) {
          cutinTimer = setTimeout(drain, 1050);
        }
      };
      cutinTimer = setTimeout(drain, Math.max(80, 1050 - (nowMs - lastCutinAt)));
    }
  }

  function triggerWarlordCutin(token, isKill = false, ln = null) {
    const el = container ? container.querySelector('#warlordCutinBanner') : null;
    if (!el) return;
    const meta = CAT_META[token.cat] || CAT_META.armor;
    const skillName = ln?.brevity || '';
    const rawText = String(ln?.text || '');
    const colonIdx = rawText.indexOf('：');
    const skillDesc = colonIdx >= 0 ? rawText.slice(colonIdx + 1).trim() : '';
    const actionLabel = isKill
      ? '一騎討・陣斬敵將！'
      : (skillName ? `⚡ ${skillName}` : `${token.wep || meta.label}・無雙奧義！`);
    const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
    const borderCol = token.side === 'A' ? '#38bdf8' : '#f87171';
    const accentGlow = token.side === 'A' ? 'rgba(56,189,248,0.32)' : 'rgba(239,68,68,0.32)';

    el.style.borderColor = isLightTheme ? '#f59e0b' : '#fbbf24';
    el.style.borderLeftColor = borderCol;
    el.style.background = isLightTheme
      ? `linear-gradient(100deg, rgba(15,23,42,0.99) 0%, rgba(69,26,3,0.99) 68%, ${accentGlow} 100%)`
      : `linear-gradient(100deg, rgba(20,15,11,0.96) 0%, rgba(42,33,22,0.94) 68%, ${accentGlow} 100%)`;
    el.innerHTML = `
      <img src="${PORTRAIT_DIR}${token.id}.jpg?v=${ASSET_VER}"
           style="width:62px;height:62px;border-radius:50%;object-fit:cover;object-position:center 15%;border:3px solid #fbbf24;box-shadow:0 0 14px ${accentGlow};transform:skewX(12deg);flex-shrink:0;"
           onerror="this.style.display='none'">
      <div style="line-height:1.25;transform:skewX(12deg);min-width:0;">
        <div style="font-size:11px;color:#fbbf24;font-weight:900;letter-spacing:1.5px;text-shadow:0 1px 4px #000;">
          ${token.side === 'A' ? '【我軍戰法發動】' : '【敵軍戰法發動】'} · ${meta.label}
        </div>
        <div style="font-size:19px;font-weight:900;font-family:'Noto Serif TC',serif;color:#fff7e6;margin-top:2px;text-shadow:0 2px 6px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${token.name} <span style="font-size:14px;color:${borderCol};font-weight:800;margin-left:6px;">${actionLabel}</span>
        </div>
        ${skillDesc ? `<div style="font-size:12px;color:#fde68a;font-weight:600;margin-top:3px;text-shadow:0 1px 3px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${skillDesc}</div>` : ''}
      </div>
    `;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) skewX(-12deg) scale(1)';
    triggerImpactVignette(accentGlow);

    if (cutinTimeout) clearTimeout(cutinTimeout);
    cutinTimeout = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) skewX(-12deg) scale(0.9)';
    }, 2200);
  }

  /* ----------------------------------------------------
     7. 粒子火花、塵土、震屏與相機控制
     ---------------------------------------------------- */
  function syncCameraShakeButton() {
    if (!container) return;
    const btn = container.closest('#battle3DWrapper')?.querySelector('#btnBattleShake');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(cameraShakeEnabled));
    btn.textContent = cameraShakeEnabled ? '震動：開' : '震動：關';
  }

  function setCameraShakeEnabled(enabled) {
    cameraShakeEnabled = Boolean(enabled);
    try {
      localStorage.setItem(CAM_SHAKE_STORAGE_KEY, cameraShakeEnabled ? '1' : '0');
    } catch (_) {}
    if (!cameraShakeEnabled) {
      shakePower = 0;
      camZoomTarget = 0;
      camZoomOffset = 0;
      camShakeOffset.set(0, 0, 0);
      updateCameraPosition();
    }
    syncCameraShakeButton();
    return cameraShakeEnabled;
  }

  function triggerCameraShake(power = 0.25) {
    if (battleSettled || !cameraShakeEnabled) return;
    shakePower = Math.min(0.65, Math.max(shakePower, power));
    camZoomTarget = Math.max(-0.8, camZoomTarget - power * 0.65);
  }

  function renderFrame() {
    if (contextLost || (renderer && renderer.getContext().isContextLost())) return;
    if (!renderer || !scene || !camera) return;
    if (window.MusouVfx?.renderFrame) {
      window.MusouVfx.renderFrame(renderer, scene, camera);
    } else {
      renderer.render(scene, camera);
    }
  }

  function triggerHitStop(ms = 75) {
    if (battleSettled) return;
    hitStopUntil = Math.max(hitStopUntil, combatNow() + ms);
  }

  function setCutinFreeze(active, focusToken = null) {
    cutinFrozen = Boolean(active);
    if (cutinFrozen && !battleSettled) {
      if (focusToken?.mesh) {
        camFocusTarget.set(focusToken.mesh.position.x * 0.42, 0, focusToken.mesh.position.z * 0.42);
        lastFocusAt = combatNow();
      }
      if (cameraShakeEnabled) camZoomTarget = -1.8;
    } else {
      camZoomTarget = 0;
    }
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
    if (!scene || (battleSettled && combatNow() >= finaleCelebrationUntil) || shockwaves.length > 24) return;
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
    if (aspect <= 2.75) return cameraView === 'cinematic' ? 45 : 49;
    const horizontalFov = (cameraView === 'cinematic' ? 88 : 104) * Math.PI / 180;
    return Math.max(41, 2 * Math.atan(Math.tan(horizontalFov / 2) / aspect) * 180 / Math.PI);
  }

  function updateCameraPosition() {
    if (!camera) return;
    const target = CAM_BASE_TARGET.clone().add(camFocusOffset).add(camShakeOffset);
    const radius = Math.max(9.5, camRadius + camZoomOffset);
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
      camRadius = Math.max(10.5, Math.min(38, camRadius + e.deltaY * 0.018));
      updateCameraPosition();
    }, { passive: false });
  }

  function resetCamera() {
    camTheta = cameraView === 'cinematic' ? -0.16 : 0;
    camPhi = cameraView === 'cinematic' ? 1.04 : 0.78;
    const wideShort = Boolean(container && container.clientHeight > 0 && (container.clientWidth / container.clientHeight) >= 2.15);
    camRadius = (container && container.clientWidth < 720)
      ? (cameraView === 'cinematic' ? 11.5 : 16.5)
      : (cameraView === 'cinematic' ? (wideShort ? 9.6 : 9.0) : 16.5);
    if ([...unitsMap.values()].some(token => token.formationLayout === 'column')) camRadius = Math.max(camRadius, 10.8);
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
    if (renderer && isAnimationPaused) renderFrame();
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
    if (renderer && isEnabled && isAnimationPaused) renderFrame();
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
    const layoutKey = `${width}x${height}:${cameraView}:${showUnitLabels ? 1 : 0}`;
    const shouldSmooth = !isAnimationPaused && !isDragging && layoutKey === lastLabelLayoutKey;
    lastLabelLayoutKey = layoutKey;

    const orderedTokens = [...unitsMap.values()].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (a.side !== b.side) return a.side === 'A' ? -1 : 1;
      return (a.origZ || 0) - (b.origZ || 0);
    });

    const sideRows = { A: 0, B: 0 };
    const sideIndex = { A: 0, B: 0 };
    orderedTokens.forEach(token => { sideRows[token.side]++; });

    orderedTokens.forEach(token => {
      const sprite = token.hud.sprite;
      const desiredWidth = showUnitLabels
        ? Math.min(186, width * 0.38) * (token.alive ? 1 : 0.86)
        : Math.max(104, Math.min(132, token.name.length * 14 + 34, (width - 12) / 2));
      const pixels = narrow
        ? Math.min(desiredWidth, Math.max(1, labelAreaHeight / Math.max(1, sideRows[token.side]) - 4) * 512 / 176)
        : desiredWidth;
      const labelHeight = pixels * 176 / 512;
      const minX = pixels / 2 + 2;
      const maxX = Math.max(minX, width - pixels / 2 - 2);
      const minY = topInset + labelHeight / 2 + 2;
      const maxY = Math.max(minY, height - bottomInset - labelHeight / 2 - 2);

      const anchor = token.mesh.position.clone().add(new THREE.Vector3(
        token.side === 'A' ? -0.55 : 0.55,
        token.cat === 'air' ? 2.45 : 1.90,
        0
      ));
      const point = anchor.clone().add(camShakeOffset).project(camera);
      const rawX = Math.max(minX, Math.min(maxX, (point.x + 1) * width / 2));
      const rawY = Math.max(minY, Math.min(maxY, (1 - point.y) * height / 2));

      if (!shouldSmooth || token.hud.smoothAnchorX == null) {
        token.hud.smoothAnchorX = rawX;
        token.hud.smoothAnchorY = rawY;
      } else {
        token.hud.smoothAnchorX += (rawX - token.hud.smoothAnchorX) * 0.22;
        token.hud.smoothAnchorY += (rawY - token.hud.smoothAnchorY) * 0.22;
      }
      let x = Math.max(minX, Math.min(maxX, token.hud.smoothAnchorX));
      let y = Math.max(minY, Math.min(maxY, token.hud.smoothAnchorY));

      const overlapsAt = (cx, cy) => placed.some(rect =>
        Math.abs(cx - rect.x) < (pixels + rect.width) / 2 + 2
        && Math.abs(cy - rect.y) < (labelHeight + rect.height) / 2 + 2
      );

      if (narrow) {
        x = token.side === 'A' ? minX + 1 : maxX - 1;
        y = topInset + (++sideIndex[token.side] - 0.5) * labelAreaHeight / Math.max(1, sideRows[token.side]);
      } else {
        const prev = token.hud.prevRect;
        const outDir = token.side === 'A' ? -1 : 1;
        const halfMid = width * 0.5;
        const ownHalfLimit = token.side === 'A' ? halfMid + 8 : halfMid - 8;
        const ownEdgeX = token.side === 'A' ? minX + 1 : maxX - 1;
        const rawPrimaryX = [x];
        if (prev && shouldSmooth) {
          rawPrimaryX.push(prev.x + (x - prev.x) * 0.45, prev.x);
        }
        rawPrimaryX.push(
          x + outDir * (pixels * 0.45),
          x + outDir * (pixels + 4),
          ownHalfLimit,
          ownEdgeX,
          x - outDir * (pixels * 0.45),
          x - outDir * (pixels + 4)
        );
        const primaryX = [];
        rawPrimaryX.forEach(cx => {
          const clamped = Math.max(minX, Math.min(maxX, cx));
          if (!primaryX.some(v => Math.abs(v - clamped) < 4)) primaryX.push(clamped);
        });
        const fallbackX = [];
        for (let k = 0; k <= 4; k++) {
          fallbackX.push(token.side === 'A' ? minX + k * (pixels + 3) : maxX - k * (pixels + 3));
        }
        for (let k = 0; k <= 4; k++) {
          fallbackX.push(token.side === 'A' ? maxX - k * (pixels + 3) : minX + k * (pixels + 3));
        }

        const baseY = (prev && shouldSmooth) ? prev.y : y;
        const fineYOffsets = [0, -8, 8, -16, 16, -28, 28, -42, 42, -58, 58, -76, 76, -98, 98, -124, 124, -156, 156, -196, 196];
        const searchCandidates = (xList) => {
          let best = null;
          for (const rawCandX of xList) {
            const candX = Math.max(minX, Math.min(maxX, rawCandX));
            const edgeYs = (prev && shouldSmooth)
              ? [y, baseY + (y - baseY) * 0.45, baseY]
              : [y];
            for (const off of fineYOffsets) {
              if (off !== 0) edgeYs.push(y + off);
              if (prev && shouldSmooth && off !== 0) edgeYs.push(baseY + off);
            }
            for (const rect of placed) {
              if (Math.abs(candX - rect.x) < (pixels + rect.width) / 2 + 2) {
                const needY = (labelHeight + rect.height) / 2 + 2.5;
                edgeYs.push(rect.y - needY, rect.y + needY);
              }
            }
            for (const candY of edgeYs) {
              if (candY < minY - 0.5 || candY > maxY + 0.5) continue;
              const clampedY = Math.max(minY, Math.min(maxY, candY));
              if (overlapsAt(candX, clampedY)) continue;
              const overHalf = token.side === 'A'
                ? Math.max(0, candX - (halfMid + 12))
                : Math.max(0, (halfMid - 12) - candX);
              const crossHalfPenalty = overHalf > 0 ? 420 + overHalf * 4 : 0;
              const distAnchor = Math.hypot(candX - x, clampedY - y);
              const distPrev = (prev && shouldSmooth) ? Math.hypot(candX - prev.x, clampedY - prev.y) : 0;
              const jumpPenalty = Math.max(0, distPrev - 22) * 1.45;
              const cost = distAnchor + distPrev * 0.35 + jumpPenalty + crossHalfPenalty;
              if (!best || cost < best.cost) best = { x: candX, y: clampedY, cost };
            }
          }
          return best;
        };

        const chosen = searchCandidates(primaryX) || searchCandidates(fallbackX);
        if (chosen) {
          if (shouldSmooth && prev) {
            const deltaX = chosen.x - prev.x;
            const deltaY = chosen.y - prev.y;
            const dist = Math.hypot(deltaX, deltaY);
            const maxStep = 18;
            const blendSteps = dist > maxStep
              ? [maxStep / dist, 0.35, 0.65, 1.0]
              : [1.0, 0.65, 0.35];
            let applied = null;
            for (const blend of blendSteps) {
              const candX = Math.max(minX, Math.min(maxX, prev.x + deltaX * blend));
              const candY = Math.max(minY, Math.min(maxY, prev.y + deltaY * blend));
              if (!overlapsAt(candX, candY)) {
                applied = { x: candX, y: candY };
                break;
              }
            }
            x = applied ? applied.x : chosen.x;
            y = applied ? applied.y : chosen.y;
          } else {
            x = chosen.x;
            y = chosen.y;
          }
        }
      }

      const finalRect = { x, y, width: pixels, height: labelHeight };
      token.hud.prevRect = finalRect;
      placed.push(finalRect);
      point.set(x / width * 2 - 1, 1 - y / height * 2, point.z).unproject(camera);
      sprite.position.copy(point.sub(token.mesh.position));
      const depth = anchor.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const perPixel = -2 * depth * Math.tan(camera.fov * Math.PI / 360) / height;
      sprite.scale.set(pixels * perPixel, pixels * perPixel * 176 / 512, 1);
      sprite.userData.screenRect = finalRect;
    });
  }

  function getTokenSpatialOpts(token, gain = 1) {
    const position = token.mesh.position.clone().project(camera);
    return {
      distance: camera.position.distanceTo(token.mesh.position),
      pan: Math.max(-0.85, Math.min(0.85, position.x)),
      gain
    };
  }

  function playFieldSound(type, token, gain = 1) {
    if (!token || audioPaused || document.hidden || !window.SoundEngine?.playSpatial) return;
    window.SoundEngine.playSpatial(type, token.side, getTokenSpatialOpts(token, gain));
  }

  function playSkillImpactSound(fxKey, aToken, tToken, gain = 0.95) {
    if (audioPaused || document.hidden || !window.SoundEngine?.playSkillImpact) return;
    const anchor = tToken?.mesh ? tToken : (aToken?.mesh ? aToken : null);
    const spatialOpts = anchor ? getTokenSpatialOpts(anchor, gain) : null;
    window.SoundEngine.playSkillImpact(fxKey, aToken?.side || 'A', spatialOpts);
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
     WebGL 情境遺失／恢復：遺失時停止渲染並通知介面退回 2D，恢復後由 Three.js 重建 GL 狀態並重繪
     ---------------------------------------------------- */
  /* 特效畫質已自動降級後仍持續低於約 28fps：將渲染像素比降為 1（僅降一次，不重編譯材質） */
  function monitorRendererPerf(_frameCpuMs, isBattleRunning) {
    if (rendererDowngraded || !isBattleRunning || !renderer) return;
    if ((window.MusouVfx?.getQuality?.() || 'high') === 'high') return; // 先讓特效自動降級生效
    const now = performance.now();
    if (!monitorRendererPerf.last) { monitorRendererPerf.last = now; return; }
    const wallDt = (now - monitorRendererPerf.last) / 1000;
    monitorRendererPerf.last = now;
    if (wallDt <= 0 || wallDt > 0.5) return;
    perfAccumTime += wallDt;
    perfAccumFrames++;
    if (perfAccumTime < 3) return;
    const avgFps = perfAccumFrames / perfAccumTime;
    perfAccumTime = 0;
    perfAccumFrames = 0;
    if (avgFps < 28 && renderer.getPixelRatio() > 1) {
      rendererDowngraded = true;
      renderer.setPixelRatio(1);
      onWindowResize();
      console.info(`[Battle3D] 平均 ${avgFps.toFixed(1)}fps，渲染像素比已降為 1。`);
    }
  }

  function onWebglContextLost(event) {
    event.preventDefault(); // 允許瀏覽器稍後恢復情境
    contextLost = true;
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (animFrameTimer) { clearTimeout(animFrameTimer); animFrameTimer = null; }
    console.warn('[Battle3D] WebGL context lost — 已暫停 3D 渲染並退回 2D 戰報。');
    try { window.dispatchEvent(new CustomEvent('battle3d:contextlost')); } catch (_) { }
  }

  function onWebglContextRestored() {
    contextLost = false;
    console.info('[Battle3D] WebGL context restored.');
    lastTimestamp = combatNow();
    startAnimationLoop();
    try { window.dispatchEvent(new CustomEvent('battle3d:contextrestored')); } catch (_) { }
  }

  /* ----------------------------------------------------
     8. 主渲染與骨骼動畫更新迴圈
     ---------------------------------------------------- */
  function startAnimationLoop() {
    if (isAnimationPaused || contextLost) return;
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (animFrameTimer) { clearTimeout(animFrameTimer); animFrameTimer = null; }
    let lastBrazierSmokeAt = 0;

    function scheduleNextFrame(frameMs = 0) {
      if (isAnimationPaused || contextLost) return;
      if (frameMs > 80) {
        animFrameId = null;
        animFrameTimer = setTimeout(() => {
          animFrameTimer = null;
          if (!isAnimationPaused) animFrameId = requestAnimationFrame(animate);
        }, 32);
      } else {
        animFrameId = requestAnimationFrame(animate);
      }
    }

    function animate(now) {
      const frameStart = performance.now();
      now = combatNow();
      if (!isEnabled) {
        scheduleNextFrame(0);
        return;
      }
      if (audioPaused) {
        const wallNow = performance.now();
        if (wallNow - lastPausedRenderAt >= 200) {
          lastPausedRenderAt = wallNow;
          renderFrame();
        }
        scheduleNextFrame(0);
        return;
      }
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimestamp) / 1000));
      lastTimestamp = now;
      window.MusouVfx?.tick?.(performance.now());
      window.MusouVfx?.recordFrameDt?.(dt, battleMotionActive && !cutinFrozen);
      monitorRendererPerf(performance.now() - frameStart, battleMotionActive && !cutinFrozen);
      const elapsed = now * 0.001;
      bannerWindUniform.value = now < finaleCelebrationUntil ? elapsed * 2.15 : elapsed;
      const inHitStop = now < hitStopUntil || cutinFrozen;
      const inSlowMo = !inHitStop && now < slowMoUntil;
      const animDt = inHitStop ? dt * 0.12 : (inSlowMo ? dt * slowMoScale : dt);

      for (let li = 0; li < skillFlashLights.length; li++) {
        const slot = skillFlashLights[li];
        if (slot.duration > 0) {
          const age = now - slot.startedAt;
          if (age >= slot.duration || (battleSettled && now >= finaleCelebrationUntil)) {
            slot.light.intensity = 0;
            slot.duration = 0;
          } else {
            const rem = Math.max(0, 1 - age / slot.duration);
            slot.light.intensity = slot.peak * rem * rem;
          }
        }
      }
      if (arenaDimUntil > 0 && sunLightRef && hemiLightRef) {
        if (now < arenaDimUntil && !battleSettled) {
          const dimDur = Math.max(1, arenaDimUntil - arenaDimStartedAt);
          const p = Math.min(1, Math.max(0, (now - arenaDimStartedAt) / dimDur));
          let depth = 1;
          if (p < 0.18) depth = p / 0.18;
          else if (p > 0.65) depth = Math.max(0, 1 - (p - 0.65) / 0.35);
          const mul = 1 - (1 - arenaDimRatio) * depth;
          sunLightRef.intensity = baseSunIntensity * mul;
          hemiLightRef.intensity = baseHemiIntensity * (1 - (1 - arenaDimRatio) * 0.45 * depth);
        } else {
          arenaDimUntil = 0;
          sunLightRef.intensity = baseSunIntensity;
          hemiLightRef.intensity = baseHemiIntensity;
        }
      }

      // 1. 更新所有 3D 士兵與戰馬的骨骼動畫 (Hit-Stop 時極短頓幀增強衝擊感)
      for (let i = 0; i < activeMixers.length; i++) {
        activeMixers[i].mixer.update(animDt);
      }

      unitsMap.forEach((token) => {
        if (!token.alive) {
          if (token.statusAuras && token.statusAuras.size) clearTokenStatusAuras(token);
          return;
        }
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
                const aimYaw = Math.atan2(
                  target.mesh.position.x - token.mesh.position.x,
                  target.mesh.position.z - token.mesh.position.z
                );
                const turn = clampFormationYaw(token.side, aimYaw, 0.32);
                token.targetYaw = turn.yaw;
                token.individualYawOffset = turn.remainder;
                triggerSquadAnim(token, 'attack', 1.0);
                if (token.cat === 'support') {
                  spawnStrategistBolt(token, target);
                  token.nextAmbientAttackAt = now + 1850;
                } else {
                  spawn3DArrowVolley(token.mesh.position, target.mesh.position, token.side, false, 8, ARQUEBUS_IDS.has(token.id));
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
            const turn = clampFormationYaw(token.side, desiredYaw, 0.48);
            token.targetYaw = turn.yaw;
            token.individualYawOffset = turn.remainder;

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

        const goalYaw = token.targetYaw !== undefined ? token.targetYaw : (token.baseYaw || (token.side === 'A' ? Math.PI / 2 : -Math.PI / 2));
        let yawDiff = goalYaw - token.formationRig.rotation.y;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        token.formationRig.rotation.y += yawDiff * Math.min(1, 3.2 * dt);

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
        if (token.statusAuras && token.statusAuras.size) {
          token.statusAuras.forEach((entry, sKey) => {
            if (now >= entry.expiresAt) {
              token.mesh?.remove(entry.mesh);
              entry.mesh?.geometry?.dispose?.();
              entry.mesh?.material?.dispose?.();
              token.statusAuras.delete(sKey);
            } else {
              entry.mesh.rotation.z += entry.spinZ * animDt;
              if (entry.spinY) entry.mesh.rotation.y += entry.spinY * animDt;
              const remFrac = Math.min(1, (entry.expiresAt - now) / 600);
              entry.mat.opacity = entry.baseOpacity * (0.78 + Math.sin(elapsed * 6.5) * 0.22) * remFrac;
            }
          });
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
      if (!cutinFrozen && now >= finaleCelebrationUntil) camZoomTarget *= Math.exp(-2.2 * dt);
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
                if (it.stickChance && currentBattleTerrain !== 'mountain') {
                  const maxStuck = isLowPowerDevice ? 16 : (window.MusouVfx?.getQuality?.() === 'high' ? 96 : 48);
                  if (!stuckArrowsPool && scene) {
                    const stuckGeo = new THREE.CylinderGeometry(0.014, 0.022, 0.54, 4);
                    const stuckMat = new THREE.MeshBasicMaterial({ color: 0x785d3b });
                    stuckArrowsPool = new THREE.InstancedMesh(stuckGeo, stuckMat, maxStuck);
                    stuckArrowsPool.count = 0;
                    stuckArrowsPool.frustumCulled = false;
                    scene.add(stuckArrowsPool);
                  }
                  if (stuckArrowsPool && stuckArrowCount < stuckArrowsPool.instanceMatrix.count) {
                    _stuckObj.position.set(it.end.x, getBattleTerrainHeight(it.end.x, it.end.z) + 0.16, it.end.z);
                    _stuckObj.rotation.set(
                      (Math.random() - 0.5) * 0.35,
                      Math.random() * Math.PI * 2,
                      (p.side === 'A' ? -0.45 : 0.45) + (Math.random() - 0.5) * 0.25
                    );
                    _stuckObj.scale.set(1, 1, 1);
                    _stuckObj.updateMatrix();
                    stuckArrowsPool.setMatrixAt(stuckArrowCount, _stuckObj.matrix);
                    stuckArrowCount++;
                    stuckArrowsPool.count = stuckArrowCount;
                    stuckArrowsPool.instanceMatrix.needsUpdate = true;
                  }
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
            p.disposableChildren.forEach(ch => { ch.geometry?.dispose?.(); ch.material?.dispose?.(); });
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
          if (pt.orbitCenter) {
            pt.orbitAngle = (pt.orbitAngle || 0) + (pt.orbitSpeed || 2.6) * dt;
            pt.mesh.position.x = pt.orbitCenter.x + Math.cos(pt.orbitAngle) * pt.orbitRadius;
            pt.mesh.position.z = pt.orbitCenter.z + Math.sin(pt.orbitAngle) * pt.orbitRadius;
            pt.mesh.position.y += pt.vy * steps;
            if (pt.faceOutward) pt.mesh.rotation.y = -pt.orbitAngle + Math.PI / 2;
          } else {
            pt.mesh.position.x += pt.vx * steps;
            pt.mesh.position.y += pt.vy * steps;
            pt.mesh.position.z += pt.vz * steps;
            pt.vy -= (pt.gravity || 0) * steps;
          }
          if (pt.spinZ) {
            if (pt.mesh.isSprite && pt.mesh.material) pt.mesh.material.rotation += pt.spinZ * dt;
            else pt.mesh.rotation.z += pt.spinZ * dt;
          }
          if (pt.spinY && !pt.faceOutward) pt.mesh.rotation.y += pt.spinY * dt;
          if (pt.scaleGrowth) pt.mesh.scale.addScalar(pt.scaleGrowth * steps);
        }
        const progress = Math.min(1, Math.max(0, (now - pt.startedAt) / pt.duration));
        const remaining = 1 - progress;
        const fade = pt.fadeInOut
          ? (progress < 0.04 ? progress / 0.04 : (progress < 0.68 ? 1.0 : Math.max(0, (1 - progress) / 0.32)))
          : remaining;
        if (pt.mesh.material) pt.mesh.material.opacity = fade * pt.opacity;
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
        renderFrame();
      }
      scheduleNextFrame(performance.now() - frameStart);
    }

    animate(performance.now());
  }

  function pauseAnimationLoop(paused = true) {
    isAnimationPaused = Boolean(paused);
    if (isAnimationPaused) window.SoundEngine?.stopSpatial?.();
    if (isAnimationPaused) {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      if (animFrameTimer) {
        clearTimeout(animFrameTimer);
        animFrameTimer = null;
      }
    } else if (!isAnimationPaused && isInitialized && !animFrameId && !animFrameTimer) {
      startAnimationLoop();
    }
  }

  function clearAllTokens() {
    battleEpoch++;
    battleMotionActive = false;
    stopFinaleCelebration();
    lastLabelLayoutKey = '';
    cutinQueue = [];
    if (cutinTimer) { clearTimeout(cutinTimer); cutinTimer = null; }
    activeAttackers.clear();
    window.SoundEngine?.stopSpatial?.();
    unitsMap.forEach((t) => {
      clearTokenStatusAuras(t);
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

  function stopFinaleCelebration() {
    finaleCelebrationTimers.forEach(tid => clearTimeout(tid));
    finaleCelebrationTimers = [];
    finaleCelebrationUntil = 0;
    unitsMap.forEach(token => { token.celebrateUntil = 0; });
    camFocusTarget.set(0, 0, 0);
    camZoomTarget = 0;
    lastFocusAt = 0;
    if (battleSettled) {
      window.MusouVfx?.clearAll?.();
      shockwaves.forEach(sw => {
        if (scene && sw.mesh) scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        sw.mesh.material.dispose();
      });
      shockwaves = [];
      floatingPopups.forEach(fp => {
        if (scene && fp.sprite) scene.remove(fp.sprite);
        fp.tex.dispose();
        fp.mat.dispose();
      });
      floatingPopups = [];
      skillFlashLights.forEach(slot => { slot.light.intensity = 0; slot.duration = 0; });
    }
  }

  function playFinaleCelebration(winnerSide) {
    if (!isInitialized || !scene) return;
    stopFinaleCelebration();
    if (winnerSide !== 'A' && winnerSide !== 'B') {
      camZoomTarget = 0.6;
      return;
    }

    const epoch = battleEpoch;
    const now = combatNow();
    finaleCelebrationUntil = now + 3350;
    const winners = [];
    unitsMap.forEach(token => {
      if (token.alive && token.side === winnerSide && token.mesh) {
        token.celebrateUntil = finaleCelebrationUntil;
        winners.push(token);
      }
    });
    if (!winners.length) return;

    // 鏡頭平滑推近勝方凱旋軍陣重心
    const cx = winners.reduce((s, t) => s + t.mesh.position.x, 0) / winners.length;
    const cz = winners.reduce((s, t) => s + t.mesh.position.z, 0) / winners.length;
    camFocusTarget.set(cx * 0.45, 0.25, cz * 0.35);
    lastFocusAt = now + 2600;
    camZoomTarget = -1.35;

    const shoutsByCountry = {
      CN: ['萬勝！', '大破敵軍！', '凱旋！', '威震四海！'],
      JP: ['勝鬨！', '應！', '天下布武！', '大勝凱旋！'],
      KR: ['大捷！', '忠武凱旋！', '破敵萬勝！', '軍威大振！']
    };
    const burstColor = winnerSide === 'A' ? 0xfbbf24 : 0xf87171;
    const textColor = winnerSide === 'A' ? '#fbbf24' : '#f87171';
    const burstCount = isLowPowerDevice ? 48 : 96;

    [0, 950, 1900].forEach((delayMs, waveIdx) => {
      const tid = setTimeout(() => {
        if (epoch !== battleEpoch || !scene) return;
        const focusAnchor = winners[waveIdx % winners.length]?.mesh?.position;
        if (focusAnchor) {
          triggerSkillFlashLight(focusAnchor, burstColor, waveIdx === 0 ? 5.2 : 4.2, 850);
        }
        winners.forEach((token, idx) => {
          const pos = token.mesh.position;
          window.MusouVfx?.createGpuBurst?.({
            scene,
            origin: pos.clone().add(new THREE.Vector3(0, 1.45, 0)),
            count: burstCount,
            color: idx % 2 === 0 ? burstColor : 0xfef08a,
            speed: 4.3,
            life: 1050,
            size: 15,
            gravity: -2.2
          });
          if ((idx + waveIdx) % 2 === 0) {
            spawnShockwaveRing(pos, burstColor, 2.3, 620);
          }
          // 每拍輪流由 2~3 名倖存名將高喊陣營戰吼
          if ((idx + waveIdx) % 2 === 0 || winners.length <= 2) {
            const ctry = token.country || 'CN';
            const pool = shoutsByCountry[ctry] || shoutsByCountry.CN;
            const shoutText = pool[(waveIdx + idx) % pool.length];
            spawnFloatingDamagePopup(pos, shoutText, textColor, true);
          }
        });
      }, delayMs);
      finaleCelebrationTimers.push(tid);
    });
  }

  function clearBattleEffects() {
    resetDynamicLightingAndTimers();
    stopFinaleCelebration();
    unitsMap.forEach(clearTokenStatusAuras);
    document.querySelectorAll('.battle-finale-banner').forEach(el => el.remove());
    cutinFrozen = false;
    window.MusouCutin?.clearAll?.();
    window.MusouVfx?.clearAll?.();
    cutinQueue = [];
    if (cutinTimer) { clearTimeout(cutinTimer); cutinTimer = null; }
    projectiles.forEach(p => {
      if (scene && p.mesh) scene.remove(p.mesh);
      if (p.isVolleyBatch) {
        p.mesh.dispose();
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      } else if (p.isComposite && p.disposableChildren) {
        p.disposableChildren.forEach(ch => { ch.geometry?.dispose?.(); ch.material?.dispose?.(); });
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

    if (stuckArrowsPool) {
      if (scene) scene.remove(stuckArrowsPool);
      stuckArrowsPool.dispose?.();
      stuckArrowsPool.geometry?.dispose?.();
      stuckArrowsPool.material?.dispose?.();
      stuckArrowsPool = null;
    }
    stuckArrowCount = 0;

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
    window.MusouVfx?.resizeBloom?.(width, height);
    updateCommanderLabels();
    if (isAnimationPaused && isEnabled) renderFrame();
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
      contextLost,
      rendererDowngraded,
      pixelRatio: renderer ? renderer.getPixelRatio() : 0,
      cameraView,
      cameraShakeEnabled,
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
      skillVfxPlayed,
      animationPaused: isAnimationPaused,
      modelsTotal: Object.keys(MODEL_MANIFEST).length,
      modelsLoaded: Battle3DModels.getLoadedCount(),
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
    playFinaleCelebration,
    stopFinaleCelebration,
    pauseAnimationLoop,
    setAudioPaused,
    toggleMode,
    clearAllTokens,
    resetCamera,
    setCameraShakeEnabled,
    setCutinFreeze,
    isCameraShakeEnabled: () => cameraShakeEnabled,
    getDebugState,
    whenModelsReady: ensureModelsLoaded
  };
})();

if (typeof window !== 'undefined') {
  window.Battle3DEngine = Battle3DEngine;
}
