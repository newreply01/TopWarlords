'use strict';
/* =====================================================
   3D 古戰場 GLTF 模型預載、骨骼邊界正規化與實例化 (TopWarlords)
   自 battle-3d.js 抽出：模型快取與載入狀態由本模組持有；
   具骨骼動畫的實例會回傳 animCtrl，由 Battle3DEngine 的渲染迴圈統一驅動。
   ===================================================== */
const Battle3DModels = (function () {
  const MODEL_DIR = 'assets/models/';
  const MODEL_MANIFEST = {
    arrow: 'arrow.glb',
    banner: 'banner.glb',
    tent: 'tent.glb',
    watchtower: 'watchtower.glb',
    rock_a: 'rock_a.glb',
    rock_b: 'rock_b.glb'
  };

  // GLTF 快取與預計算正規化參數
  const gltfCache = new Map();     // key -> { gltf, norm: { scale, ox, oy, oz } }
  let modelsLoadPromise = null;
  let modelsLoadedCount = 0;

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

  function ensureModelsLoaded(assetVer = '') {
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
          `${MODEL_DIR}${file}?v=${assetVer}`,
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
    }

    return { group: wrapper, animCtrl };
  }

  return {
    MODEL_MANIFEST,
    findClip,
    computeTrueWorldBox,
    ensureModelsLoaded,
    spawnModelInstance,
    getLoadedCount: () => modelsLoadedCount
  };
})();

if (typeof window !== 'undefined') {
  window.Battle3DModels = Battle3DModels;
}
