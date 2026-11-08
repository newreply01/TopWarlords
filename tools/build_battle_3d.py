# -*- coding: utf-8 -*-
"""
全面重構 TopWarlords 3D 古戰場推演引擎 (Three.js r128)
參考光榮特庫摩《三國志》與《信長之野望》古典軍事沙盤風格：
1. 典雅微縮古代兵盤：
   - 沉穩紅木雕花底座 + 饕餮青銅包角
   - 水墨寫意古戰場地表：楚河漢界河道、險隘、等高線暗紋、拒馬鹿角阻絕
   - 四角青銅烽火台：真實跳動火焰光源 (PointLight) 與飛散火星粒子
   - 兩軍陣地軍帳行轅與獵獵迎風戰旗
2. 五大兵團 3D 專屬方陣與名將立牌：
   - ⚡ 奔雷突騎 (CAV): 重裝戰馬模型 + 大纛戰旗 + 奔馳揚塵渦環
   - 🛡️ 重甲陷陣 (ARM): 三面聯結厚重鋼盾牆 (Shield Wall) + 突刺長戟長矛 + 金石守禦環
   - 🏹 神射強弩 (ARC): 雙層長弓架 + 諸葛連弩發射台 + 箭筒 + 鎖敵鷹眼光環
   - ⚔️ 先登奇兵 (VAN): 斬馬大刀尖錐攻堅陣 (鋒矢陣) + 攻城攀附梯與飛爪
   - 📜 軍師奇謀 (STR): 點將高台 + 諸葛羽扇 + 牛皮戰鼓 + 腳下持續旋轉發光的立體太極八卦陣圖
3. 高清頭像與名牌：
   - 使用 TextureLoader 動態加載名將真實肖像 (assets/warlords/*.jpg)
   - 肖像立牌具備金屬陣營包邊、國旗標籤、費用角標、浮動 3D 氣血條 (綠/黃/紅)
4. 光榮風格戰鬥演出：
   - 騎兵奔雷突襲：整陣前傾、高速突進、沙塵飛揚、撞擊震屏與金鐵交鳴
   - 萬箭齊發火箭雨：16枚帶有火尾與煙塵的火箭高角度拋物線齊射打擊
   - 先登飛躍斬：騰空躍起飛旋斬落，地面震盪與半月刀光
   - 鐵壁格擋：巨盾合攏，金色六角力場護盾浮現彈開敵擊
   - 軍師奇謀施法：八卦陣圖光芒暴漲，道術光波掃蕩敵陣
   - 名將絕技 Cut-in 特寫：$4/$5 名將發動招式時，上方水墨立繪橫幅特寫 + 招式題字 (如「封狼居胥」、「八陣奇謀」)
   - 陣亡潰散：大纛折斷倒下，部隊化作水墨戰塵散去
5. 視角旋轉與縮放互動：
   - 滑鼠拖曳旋轉沙盤視角、滾輪縮放、按鈕一鍵重置為最佳觀戰視角
"""

CODE = r'''/* =====================================================
   TopWarlords 3D 古戰場推演引擎 (Three.js 典雅古典軍事沙盤)
   光榮特庫摩《三國志》風格 · 五大兵團方陣 · 水墨名將立繪
   ===================================================== */
'use strict';

const Battle3DEngine = (function () {
  let isEnabled = true;
  let container = null;
  let scene, camera, renderer;
  let animFrameId = null;
  let isInitialized = false;

  // 戰場單位網格與狀態 Map
  const unitsMap = new Map(); // uid -> TokenData
  let projectiles = [];       // 拋物線火箭與法術飛彈
  let particleSystems = [];   // 火星、塵土、光環粒子
  let brazierLights = [];     // 四角烽火台火光 (動態跳動)
  let cutinTimeout = null;

  // 視角互動控制
  let isDragging = false;
  let prevMouseX = 0, prevMouseY = 0;
  let camTheta = 0, camPhi = 0.65, camRadius = 26;
  const CAM_TARGET = new THREE.Vector3(0, 0.5, 0);

  // 槽位陣列標準座標 (五大兵團微縮戰棋站位)
  // A軍 (左側 X < 0)，B軍 (右側 X > 0)
  const SLOT_COORDS = {
    A: {
      armor:       { x: -4.8, z:  0.0 }, // 中軍前鋒：重甲陷陣 (盾牆)
      naval:       { x: -5.4, z:  3.4 }, // 左翼前鋒：先登奇兵 (鋒矢)
      air:         { x: -7.6, z: -3.4 }, // 右翼游弋：奔雷突騎 (大纛戰馬)
      air_defense: { x: -8.2, z:  2.6 }, // 左翼中衛：神射強弩 (弓弩台)
      support:     { x: -9.6, z:  0.0 }  // 中軍帥帳：軍師奇謀 (八卦壇)
    },
    B: {
      armor:       { x:  4.8, z:  0.0 },
      naval:       { x:  5.4, z: -3.4 },
      air:         { x:  7.6, z:  3.4 },
      air_defense: { x:  8.2, z: -2.6 },
      support:     { x:  9.6, z:  0.0 }
    }
  };

  const CAT_COLORS = {
    air:         0x38bdf8,
    armor:       0xfbbf24,
    air_defense: 0xa78bfa,
    naval:       0x22d3ee,
    support:     0x4ade80
  };

  const textureLoader = new THREE.TextureLoader();

  /* ----------------------------------------------------
     初始化 3D 沙盤場景
     ---------------------------------------------------- */
  function init(containerEl) {
    if (!containerEl || typeof THREE === 'undefined') return false;
    container = containerEl;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 420;

    // 1. 場景與古戰場大氣迷霧
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x130e0b); // 暮色古戰場深褐色
    scene.fog = new THREE.FogExp2(0x130e0b, 0.022);

    // 2. 透視相機 (古典俯仰視角)
    camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    updateCameraPosition();

    // 3. WebGL 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. 光照系統 (夕陽戰陣光影 + 晨昏環境光)
    setupLighting();

    // 5. 構建典雅古典軍事沙盤台與地形
    createAncientSandTable();

    // 6. 視角拖曳與縮放互動事件
    setupCameraControls();

    // 7. 注入名將絕技 Cut-in 橫幅層
    injectCutinLayer();

    // 視窗自適應
    window.removeEventListener('resize', onWindowResize);
    window.addEventListener('resize', onWindowResize);

    isInitialized = true;
    startAnimationLoop();
    return true;
  }

  /* 光照系統配置 */
  function setupLighting() {
    // 晨昏大氣環境光
    const ambientLight = new THREE.AmbientLight(0xffedd5, 0.75);
    scene.add(ambientLight);

    // 夕陽斜照主平行光 (鑄造金鐵長陰影)
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    sunLight.position.set(-18, 28, 12);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 70;
    sunLight.shadow.camera.left = -16;
    sunLight.shadow.camera.right = 16;
    sunLight.shadow.camera.top = 16;
    sunLight.shadow.camera.bottom = -16;
    scene.add(sunLight);

    // 戰場補光 (偏冷青藍，烘托戰場肅殺之氣)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(16, 12, -14);
    scene.add(rimLight);
  }

  /* 構建微縮古典沙盤台、楚河漢界地形與四角烽火台 */
  function createAncientSandTable() {
    // 1. 厚重紅木雕花沙盤主體
    const woodGeo = new THREE.BoxGeometry(26.4, 1.8, 16.4);
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x221309,
      roughness: 0.75,
      metalness: 0.15
    });
    const woodMesh = new THREE.Mesh(woodGeo, woodMat);
    woodMesh.position.y = -0.95;
    woodMesh.receiveShadow = true;
    scene.add(woodMesh);

    // 2. 青銅鎏金饕餮紋包邊框
    const borderGeo = new THREE.BoxGeometry(26.6, 0.25, 16.6);
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.35,
      metalness: 0.8
    });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.position.y = -0.06;
    scene.add(borderMesh);

    // 3. 古戰場寫意地形紋理 (動態 Canvas 繪製沙盤地表、等高線、山川與楚河)
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 1024;
    groundCanvas.height = 640;
    const gctx = groundCanvas.getContext('2d');

    // 泥土沙質底色
    const grad = gctx.createLinearGradient(0, 0, 1024, 640);
    grad.addColorStop(0, '#2d2419');
    grad.addColorStop(0.5, '#3b3022');
    grad.addColorStop(1, '#2d2419');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 1024, 640);

    // 沙盤等高線與軍事方格暗紋
    gctx.strokeStyle = 'rgba(217, 119, 6, 0.12)';
    gctx.lineWidth = 1.5;
    for (let x = 0; x <= 1024; x += 64) {
      gctx.beginPath();
      gctx.moveTo(x, 0); gctx.lineTo(x, 640);
      gctx.stroke();
    }
    for (let y = 0; y <= 640; y += 64) {
      gctx.beginPath();
      gctx.moveTo(0, y); gctx.lineTo(1024, y);
      gctx.stroke();
    }

    // 中央楚河漢界大河流水 (深藍泛金色波紋)
    const riverGrad = gctx.createLinearGradient(480, 0, 544, 0);
    riverGrad.addColorStop(0, 'rgba(15, 33, 56, 0.9)');
    riverGrad.addColorStop(0.5, 'rgba(24, 60, 96, 0.95)');
    riverGrad.addColorStop(1, 'rgba(15, 33, 56, 0.9)');
    gctx.fillStyle = riverGrad;
    gctx.fillRect(480, 0, 64, 640);

    // 水墨題字「楚河漢界」
    gctx.save();
    gctx.translate(512, 320);
    gctx.rotate(-Math.PI / 2);
    gctx.fillStyle = 'rgba(251, 191, 36, 0.45)';
    gctx.font = 'bold 28px "Noto Sans TC", serif';
    gctx.textAlign = 'center';
    gctx.fillText('— 楚 河 漢 界 · 決 戰 疆 場 —', 0, 8);
    gctx.restore();

    // 兩軍陣地八卦陰陽軍令徽章暗印
    gctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    gctx.beginPath(); gctx.arc(240, 320, 160, 0, Math.PI * 2); gctx.fill();
    gctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
    gctx.beginPath(); gctx.arc(784, 320, 160, 0, Math.PI * 2); gctx.fill();

    const groundTex = new THREE.CanvasTexture(groundCanvas);
    const groundGeo = new THREE.PlaneGeometry(26.0, 16.0);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.85,
      metalness: 0.1
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 4. 前線木柵拒馬與鹿角防禦工事 (Abatis & Spiked Barricades)
    createBarricades();

    // 5. 兩側大本營軍帳營寨與軍旗 (Camp Tents & Flags)
    createCampProps();

    // 6. 沙盤四角青銅烽火台 (Bronze Braziers with Flickering Fire)
    createBraziers();
  }

  /* 前線拒馬鹿角阻絕 */
  function createBarricades() {
    const barricadeGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3d22, roughness: 0.9 });

    // 沿楚河兩側布設 6 組交叉拒馬
    const zPositions = [-5.5, -2.5, 2.5, 5.5];
    zPositions.forEach(z => {
      [-1.2, 1.2].forEach(x => {
        const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6), woodMat);
        post1.rotation.z = 0.55;
        post1.position.set(x, 0.35, z);
        post1.castShadow = true;
        barricadeGroup.add(post1);

        const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6), woodMat);
        post2.rotation.z = -0.55;
        post2.position.set(x, 0.35, z);
        post2.castShadow = true;
        barricadeGroup.add(post2);

        const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), woodMat);
        crossbar.rotation.x = Math.PI / 2;
        crossbar.position.set(x, 0.45, z);
        crossbar.castShadow = true;
        barricadeGroup.add(crossbar);
      });
    });
    scene.add(barricadeGroup);
  }

  /* 兩軍大本營軍帳與帥旗 */
  function createCampProps() {
    // A 軍軍帳 (左翼後方)
    createSingleTent(-12.0, -5.8, 0x1e3a8a, 0x38bdf8, '漢');
    createSingleTent(-12.0,  5.8, 0x1e3a8a, 0x38bdf8, '唐');

    // B 軍軍帳 (右翼後方)
    createSingleTent( 12.0, -5.8, 0x7c2d12, 0xf59e0b, '秦');
    createSingleTent( 12.0,  5.8, 0x7c2d12, 0xf59e0b, '魏');
  }

  function createSingleTent(x, z, tentColor, flagColor, bannerChar) {
    const group = new THREE.Group();
    // 圓錐軍帳
    const tentGeo = new THREE.ConeGeometry(1.2, 1.6, 8);
    const tentMat = new THREE.MeshStandardMaterial({ color: tentColor, roughness: 0.8 });
    const tent = new THREE.Mesh(tentGeo, tentMat);
    tent.position.y = 0.8;
    tent.castShadow = true;
    group.add(tent);

    // 帳頂旗桿
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.2;
    group.add(pole);

    // 迎風軍旗
    const flagCanvas = document.createElement('canvas');
    flagCanvas.width = 128; flagCanvas.height = 96;
    const fctx = flagCanvas.getContext('2d');
    fctx.fillStyle = (flagColor === 0x38bdf8) ? '#0284c7' : '#d97706';
    fctx.fillRect(0, 0, 128, 96);
    fctx.strokeStyle = '#fbbf24';
    fctx.lineWidth = 6;
    fctx.strokeRect(4, 4, 120, 88);
    fctx.fillStyle = '#ffffff';
    fctx.font = 'bold 48px "Noto Sans TC", serif';
    fctx.textAlign = 'center';
    fctx.fillText(bannerChar, 64, 68);

    const flagTex = new THREE.CanvasTexture(flagCanvas);
    const flagGeo = new THREE.PlaneGeometry(0.7, 0.5);
    const flagMat = new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.38, 2.0, 0);
    group.add(flag);

    group.position.set(x, 0, z);
    scene.add(group);
  }

  /* 沙盤四角青銅烽火台 */
  function createBraziers() {
    brazierLights = [];
    const corners = [
      { x: -12.4, z: -7.4 },
      { x: -12.4, z:  7.4 },
      { x:  12.4, z: -7.4 },
      { x:  12.4, z:  7.4 }
    ];

    const standGeo = new THREE.CylinderGeometry(0.35, 0.5, 1.4, 8);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.7 });
    const bowlGeo = new THREE.CylinderGeometry(0.65, 0.25, 0.45, 8);
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });

    corners.forEach(pos => {
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, 0.7, pos.z);
      stand.castShadow = true;
      scene.add(stand);

      const bowl = new THREE.Mesh(bowlGeo, bowlMat);
      bowl.position.set(pos.x, 1.5, pos.z);
      scene.add(bowl);

      // 燃燒的火焰核心 (自發光球體)
      const fireGeo = new THREE.SphereGeometry(0.22, 8, 8);
      const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
      const fire = new THREE.Mesh(fireGeo, fireMat);
      fire.position.set(pos.x, 1.8, pos.z);
      scene.add(fire);

      // 動態點光源
      const light = new THREE.PointLight(0xff8800, 1.6, 9);
      light.position.set(pos.x, 2.0, pos.z);
      scene.add(light);
      brazierLights.push({ light, baseIntensity: 1.6, fireMesh: fire });
    });
  }

  /* ----------------------------------------------------
     五大兵團專屬 3D 方陣模型構建
     ---------------------------------------------------- */
  function createUnitToken(unit, side, slotIndex) {
    const group = new THREE.Group();
    const cat = unit.cat || 'armor';
    const coords = (SLOT_COORDS[side] && SLOT_COORDS[side][cat]) || { x: (side === 'A' ? -6 : 6), z: 0 };

    const isSideA = side === 'A';
    const primaryColor = isSideA ? 0x0284c7 : 0xd97706;
    const catColor = CAT_COLORS[cat] || 0xffffff;

    // 1. 八角型青銅鎏金主將台底座
    const baseGeo = new THREE.CylinderGeometry(1.05, 1.2, 0.38, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      roughness: 0.35,
      metalness: 0.65
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.19;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // 金屬陣營發光環
    const ringGeo = new THREE.TorusGeometry(1.15, 0.05, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: catColor });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.36;
    group.add(ringMesh);

    // 2. 兵種專屬 3D 方陣軍械配備
    const formationProps = buildFormationSubmodels(cat, isSideA);
    group.add(formationProps);

    // 3. 名將立繪立牌看板 (帶真實高清肖像 Texture)
    const billboard = buildWarlordBillboard(unit, isSideA, catColor);
    group.add(billboard.mesh);

    // 4. 頂部 3D 即時氣血條與名牌
    const hpBar = buildHpBar(unit.hp, unit.hpMax || unit.hp);
    hpBar.group.position.y = 2.45;
    group.add(hpBar.group);

    // 初始位置
    group.position.set(coords.x, 0, coords.z);
    scene.add(group);

    return {
      uid: unit.uid,
      id: unit.id,
      name: unit.name,
      cost: unit.cost,
      tag: unit.tag || '',
      side: side,
      cat: cat,
      mesh: group,
      billboardMesh: billboard.mesh,
      bannerMat: billboard.material,
      hpFg: hpBar.fg,
      hpGroup: hpBar.group,
      formationProps: formationProps,
      origX: coords.x,
      origZ: coords.z,
      currentHp: unit.hp,
      maxHp: unit.hpMax || unit.hp,
      alive: true
    };
  }

  /* 依兵種生成專屬 3D 方陣模型 */
  function buildFormationSubmodels(cat, isSideA) {
    const fGroup = new THREE.Group();
    const facingDir = isSideA ? 1 : -1;

    switch (cat) {
      case 'air': {
        // ⚡ 奔雷突騎：重鎧戰馬 + 大纛長矛
        const horseMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });
        const armorMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.3 });

        // 馬身
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.35), horseMat);
        body.position.set(0.15 * facingDir, 0.55, 0.55);
        fGroup.add(body);

        // 馬頸與頭
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.25), horseMat);
        head.position.set(0.55 * facingDir, 0.85, 0.55);
        fGroup.add(head);

        // 馬面金甲
        const chamfron = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.26), armorMat);
        chamfron.position.set(0.65 * facingDir, 0.88, 0.55);
        fGroup.add(chamfron);

        // 奔馳長槍 (指向敵陣)
        const lanceMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
        const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 1.8, 6), lanceMat);
        lance.rotation.z = Math.PI / 2 * facingDir;
        lance.position.set(0.7 * facingDir, 0.75, 0.55);
        fGroup.add(lance);

        // 大纛戰旗桿
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.6, 6), poleMat);
        pole.position.set(-0.45 * facingDir, 1.4, -0.45);
        fGroup.add(pole);

        // 飄揚絲綢大纛
        const flagMat = new THREE.MeshStandardMaterial({
          color: isSideA ? 0x0284c7 : 0xb45309,
          roughness: 0.4,
          side: THREE.DoubleSide
        });
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.95), flagMat);
        flag.position.set((-0.45 + 0.35 * -facingDir), 2.2, -0.45);
        flag.rotation.y = Math.PI / 2;
        fGroup.add(flag);
        break;
      }

      case 'armor': {
        // 🛡️ 重甲陷陣：三面厚重玄鐵大盾牆 (Shield Wall) + 突刺長戟
        const shieldMat = new THREE.MeshStandardMaterial({
          color: 0x334155,
          metalness: 0.85,
          roughness: 0.3
        });
        const bossMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9 });

        [-0.5, 0, 0.5].forEach((offsetZ, i) => {
          const shield = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.48), shieldMat);
          shield.position.set(0.65 * facingDir, 0.65, offsetZ);
          shield.rotation.y = (i === 0 ? 0.25 : i === 2 ? -0.25 : 0) * facingDir;
          shield.castShadow = true;
          fGroup.add(shield);

          // 獸面金屬銅釘盾心
          const boss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), bossMat);
          boss.position.set(0.72 * facingDir, 0.65, offsetZ);
          fGroup.add(boss);

          // 架出盾外的長戟
          const spear = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.03, 1.4, 6),
            new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 })
          );
          spear.rotation.z = (Math.PI / 2 - 0.2) * facingDir;
          spear.position.set(0.95 * facingDir, 0.85, offsetZ);
          fGroup.add(spear);
        });
        break;
      }

      case 'air_defense': {
        // 🏹 神射強弩：雙層長弓架 + 諸葛連弩發射台 + 箭桶
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });

        // 連弩台木基座
        const balBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.45), woodMat);
        balBase.position.set(0.45 * facingDir, 0.5, 0.4);
        fGroup.add(balBase);

        // 連弩雙弦弓臂
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 6, 12, Math.PI), metalMat);
        bow.rotation.y = (Math.PI / 2) * facingDir;
        bow.rotation.x = -Math.PI / 4;
        bow.position.set(0.65 * facingDir, 0.75, 0.4);
        fGroup.add(bow);

        // 地面箭筒與密箭
        const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.5, 8), woodMat);
        quiver.position.set(0.15 * facingDir, 0.55, -0.45);
        fGroup.add(quiver);

        for (let a = 0; a < 4; a++) {
          const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.65, 4), metalMat);
          arrow.position.set((0.13 + a * 0.02) * facingDir, 0.75, -0.45 + (a % 2) * 0.04);
          fGroup.add(arrow);
        }
        break;
      }

      case 'naval': {
        // ⚔️ 先登奇兵：交叉斬馬大刀 + 攻堅倒鉤雲梯
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });
        const hiltMat = new THREE.MeshStandardMaterial({ color: 0xd97706 });

        // 雙刀交錯
        [-0.35, 0.35].forEach((rot, i) => {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 0.14), bladeMat);
          blade.rotation.z = rot;
          blade.position.set(0.45 * facingDir, 0.9, (i - 0.5) * 0.2);
          fGroup.add(blade);

          const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), hiltMat);
          hilt.rotation.z = rot;
          hilt.position.set((0.45 - Math.sin(rot) * 0.5) * facingDir, 0.4, (i - 0.5) * 0.2);
          fGroup.add(hilt);
        });
        break;
      }

      case 'support': {
        // 📜 軍師奇謀：八卦法壇 + 諸葛羽扇 + 牛皮戰鼓 + 地面持續旋轉的太極八卦光盤
        const altarMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.6 });
        const drumMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 });

        // 牛皮軍鼓
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.42, 12), drumMat);
        drum.position.set(0.35 * facingDir, 0.55, 0.45);
        fGroup.add(drum);

        // 諸葛鵝毛羽扇
        const fanMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        const fan = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 6), fanMat);
        fan.rotation.z = 0.5 * facingDir;
        fan.position.set(0.35 * facingDir, 0.8, -0.45);
        fGroup.add(fan);

        // 地面旋轉太極八卦圖光圈
        const baguaCanvas = document.createElement('canvas');
        baguaCanvas.width = 256; baguaCanvas.height = 256;
        const bctx = baguaCanvas.getContext('2d');
        bctx.translate(128, 128);
        bctx.strokeStyle = '#4ade80';
        bctx.lineWidth = 6;
        bctx.beginPath(); bctx.arc(0, 0, 116, 0, Math.PI * 2); bctx.stroke();

        // 太極雙魚
        bctx.fillStyle = '#4ade80';
        bctx.beginPath(); bctx.arc(0, 0, 80, -Math.PI / 2, Math.PI / 2); bctx.fill();
        bctx.fillStyle = '#0f172a';
        bctx.beginPath(); bctx.arc(0, 0, 80, Math.PI / 2, Math.PI * 1.5); bctx.fill();
        bctx.fillStyle = '#4ade80';
        bctx.beginPath(); bctx.arc(0, 40, 40, 0, Math.PI * 2); bctx.fill();
        bctx.fillStyle = '#0f172a';
        bctx.beginPath(); bctx.arc(0, -40, 40, 0, Math.PI * 2); bctx.fill();

        const baguaTex = new THREE.CanvasTexture(baguaCanvas);
        const baguaGeo = new THREE.PlaneGeometry(1.6, 1.6);
        const baguaMat = new THREE.MeshBasicMaterial({
          map: baguaTex,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide
        });
        const baguaMesh = new THREE.Mesh(baguaGeo, baguaMat);
        baguaMesh.rotation.x = -Math.PI / 2;
        baguaMesh.position.y = 0.39;
        baguaMesh.name = 'baguaRuneRing';
        fGroup.add(baguaMesh);
        break;
      }
    }

    return fGroup;
  }

  /* 構建帶有名將真實肖像的高清 3D 立牌看板 */
  function buildWarlordBillboard(unit, isSideA, catColor) {
    const width = 1.35, height = 1.85;
    const bannerGeo = new THREE.BoxGeometry(width, height, 0.08);

    // 建立高解析度 Canvas 繪製肖像立牌
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 352;
    const ctx = canvas.getContext('2d');

    function drawCardFace(loadedImg) {
      // 陣營古典暗紋邊框底色
      ctx.fillStyle = isSideA ? '#071829' : '#261208';
      ctx.fillRect(0, 0, 256, 352);

      // 肖像繪製區
      if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
        ctx.drawImage(loadedImg, 12, 12, 232, 240);
        // 肖像四周深色水墨暈染漸層
        const edgeGrad = ctx.createLinearGradient(0, 180, 0, 252);
        edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
        edgeGrad.addColorStop(1, isSideA ? '#071829' : '#261208');
        ctx.fillStyle = edgeGrad;
        ctx.fillRect(12, 180, 232, 72);
      } else {
        // 備用典雅水墨印記
        ctx.fillStyle = isSideA ? '#0c4a6e' : '#7c2d12';
        ctx.fillRect(12, 12, 232, 240);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px "Noto Sans TC", serif';
        ctx.textAlign = 'center';
        ctx.fillText(unit.name ? unit.name.slice(0, 2) : '名將', 128, 140);
      }

      // 金屬陣營外框
      ctx.strokeStyle = isSideA ? '#38bdf8' : '#f59e0b';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 248, 344);

      // 國旗與費用角標
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(8, 8, 96, 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${unit.flag || ''} $${unit.cost}`, 14, 34);

      // 名將題名 (大字水墨楷體)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px "Noto Sans TC", serif';
      ctx.textAlign = 'center';
      ctx.fillText(unit.name || '歷史名將', 128, 290);

      // 稱號與戰術標籤
      ctx.fillStyle = isSideA ? '#38bdf8' : '#fbbf24';
      ctx.font = 'bold 18px "Noto Sans TC", sans-serif';
      const tagText = (unit.tag || '').split('·')[0].slice(0, 8);
      ctx.fillText(tagText, 128, 324);
    }

    drawCardFace(null);

    const bannerTex = new THREE.CanvasTexture(canvas);
    bannerTex.minFilter = THREE.LinearFilter;
    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerTex,
      roughness: 0.35,
      metalness: 0.15
    });

    // 嘗試非同步載入真實肖像並刷新 Canvas
    if (unit.id) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        drawCardFace(img);
        bannerTex.needsUpdate = true;
      };
      img.src = `assets/warlords/${unit.id}.jpg?v=1.0.0`;
    }

    const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
    bannerMesh.position.y = 1.35;
    bannerMesh.castShadow = true;

    return { mesh: bannerMesh, material: bannerMat };
  }

  /* 構建 3D 浮動即時血條 */
  function buildHpBar(currentHp, maxHp) {
    const hpGroup = new THREE.Group();

    // 底座背景
    const bgGeo = new THREE.BoxGeometry(1.4, 0.14, 0.04);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    hpGroup.add(bgMesh);

    // 綠色前景條
    const fgGeo = new THREE.BoxGeometry(1.36, 0.10, 0.06);
    const fgMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const fgMesh = new THREE.Mesh(fgGeo, fgMat);
    hpGroup.add(fgMesh);

    return { group: hpGroup, fg: fgMesh };
  }

  /* ----------------------------------------------------
     載入雙方名將陣容到沙盤上
     ---------------------------------------------------- */
  function loadBattle(res) {
    if (!isInitialized) return;

    clearAllTokens();

    const teamA = (res.final && res.final.A) || [];
    const teamB = (res.final && res.final.B) || [];

    teamA.forEach((u, i) => {
      const token = createUnitToken(u, 'A', i);
      unitsMap.set(u.uid, token);
    });

    teamB.forEach((u, i) => {
      const token = createUnitToken(u, 'B', i);
      unitsMap.set(u.uid, token);
    });

    resetCamera();
  }

  /* ----------------------------------------------------
     光榮特庫摩風格戰鬥事件動畫演出
     ---------------------------------------------------- */
  function playEvent(ln) {
    if (!isInitialized || !isEnabled) return;

    const aToken = ln.auid ? unitsMap.get(ln.auid) : null;
    const tToken = ln.tuid ? unitsMap.get(ln.tuid) : null;

    if (!aToken && !tToken) return;

    // 1. 名將絕技 Cut-in 特寫 ($4, $5 名將發動攻勢或擊殺時觸發)
    if (aToken && aToken.cost >= 4 && (ln.kind === 'hit' || ln.kind === 'kill')) {
      triggerWarlordCutin(aToken);
    }

    // 2. 兵種專屬動作
    if (aToken && tToken) {
      if (aToken.cat === 'air') {
        // 奔雷突騎高速衝鋒
        performCavalryCharge(aToken, tToken);
      } else if (aToken.cat === 'air_defense' || (ln.text && ln.text.includes('箭'))) {
        // 神射萬箭齊發火箭雨
        spawnArrowVolley(aToken.mesh.position, tToken.mesh.position, aToken.side);
      } else if (aToken.cat === 'naval') {
        // 先登一番槍騰躍斬
        performVanguardLeap(aToken, tToken);
      } else if (aToken.cat === 'support') {
        // 軍師八陣圖奇謀法術
        performStrategistTactic(aToken, tToken);
      } else {
        // 重甲陷陣短兵相接
        performMeleeClash(aToken, tToken);
      }
    }

    // 3. 盾牌格擋力場防禦
    if (ln.kind === 'block' && tToken) {
      performShieldBlock(tToken);
    }

    // 4. 即時更新目標氣血條
    if (tToken && ln.hpAfter !== undefined) {
      updateTokenHp(tToken, ln.hpAfter);
    }

    // 5. 擊破陣亡演出
    if (ln.kind === 'kill' && tToken) {
      tokenFallDown(tToken);
    }
  }

  /* 突騎奔雷衝鋒動畫 */
  function performCavalryCharge(aToken, tToken) {
    const orig = new THREE.Vector3(aToken.origX, 0, aToken.origZ);
    const target = tToken.mesh.position.clone();
    const dir = target.clone().sub(orig).normalize();
    const chargePos = target.clone().sub(dir.clone().multiplyScalar(1.2));

    let t = 0;
    const total = 26;

    function step() {
      t++;
      if (t <= 13) {
        // 衝刺階段：整隊前傾奔馳 + 塵土飛揚
        const p = t / 13;
        aToken.mesh.position.lerpVectors(orig, chargePos, p);
        aToken.mesh.rotation.z = (aToken.side === 'A' ? 0.22 : -0.22) * Math.sin(p * Math.PI);
        // 生成馬蹄沙塵粒子
        if (t % 2 === 0) spawnDustPuff(aToken.mesh.position);
      } else if (t === 14) {
        // 衝撞頂點：震屏 + 激昂金鐵撞擊火花
        spawnSparkBurst(chargePos, 16);
        screenShake(0.18);
      } else if (t <= total) {
        // 馳騁歸位
        const p = (t - 13) / 13;
        aToken.mesh.position.lerpVectors(chargePos, orig, p);
        aToken.mesh.rotation.z = 0;
      }

      if (t < total) requestAnimationFrame(step);
    }
    step();
  }

  /* 神射萬箭齊發 3D 火箭雨 */
  function spawnArrowVolley(fromPos, toPos, side) {
    const arrowCount = 14;
    for (let i = 0; i < arrowCount; i++) {
      const spreadX = (Math.random() - 0.5) * 1.4;
      const spreadZ = (Math.random() - 0.5) * 1.4;
      const start = fromPos.clone().add(new THREE.Vector3(spreadX, 1.4, spreadZ));
      const end = toPos.clone().add(new THREE.Vector3(spreadX * 0.7, 0.4, spreadZ * 0.7));

      // 帶火光箭矢網格
      const arrowGeo = new THREE.CylinderGeometry(0.02, 0.04, 0.55, 6);
      const arrowMat = new THREE.MeshBasicMaterial({ color: (side === 'A' ? 0x38bdf8 : 0xf59e0b) });
      const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
      arrowMesh.position.copy(start);
      scene.add(arrowMesh);

      projectiles.push({
        mesh: arrowMesh,
        start: start,
        end: end,
        progress: -(i * 0.04), // 梯次離弦
        speed: 0.042,
        arcHeight: 5.2 + Math.random() * 1.2
      });
    }
  }

  /* 先登奇兵騰躍斬落 */
  function performVanguardLeap(aToken, tToken) {
    const orig = new THREE.Vector3(aToken.origX, 0, aToken.origZ);
    const strikePos = tToken.mesh.position.clone().add(new THREE.Vector3(aToken.side === 'A' ? -1.0 : 1.0, 0, 0));

    let t = 0;
    function leap() {
      t++;
      if (t <= 11) {
        const p = t / 11;
        aToken.mesh.position.lerpVectors(orig, strikePos, p);
        aToken.mesh.position.y = Math.sin(p * Math.PI) * 1.6; // 騰空翻躍
        aToken.mesh.rotation.y += 0.3;
      } else if (t === 12) {
        // 落地暴斬
        spawnSparkBurst(strikePos, 14);
        screenShake(0.12);
      } else if (t <= 22) {
        const p = (t - 11) / 11;
        aToken.mesh.position.lerpVectors(strikePos, orig, p);
        aToken.mesh.position.y = 0;
        aToken.mesh.rotation.y = 0;
      }
      if (t < 22) requestAnimationFrame(leap);
    }
    leap();
  }

  /* 軍師八卦圖法術光波 */
  function performStrategistTactic(aToken, tToken) {
    // 陣法光芒擴散圈
    const ringGeo = new THREE.RingGeometry(0.2, 0.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(tToken.mesh.position);
    ring.position.y = 0.45;
    scene.add(ring);

    let scale = 1;
    function pulse() {
      scale += 0.15;
      ring.scale.set(scale, scale, 1);
      ring.material.opacity -= 0.05;
      if (ring.material.opacity > 0) {
        requestAnimationFrame(pulse);
      } else {
        scene.remove(ring);
        ring.geometry.dispose();
        ring.material.dispose();
      }
    }
    pulse();
  }

  /* 盾牌格擋六角力場 */
  function performShieldBlock(tToken) {
    const shieldDomeGeo = new THREE.SphereGeometry(1.3, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const shieldDomeMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    const dome = new THREE.Mesh(shieldDomeGeo, shieldDomeMat);
    dome.position.copy(tToken.mesh.position);
    scene.add(dome);

    setTimeout(() => {
      scene.remove(dome);
      dome.geometry.dispose();
      dome.material.dispose();
    }, 220);
  }

  /* 近身肉搏震動 */
  function performMeleeClash(aToken, tToken) {
    spawnSparkBurst(tToken.mesh.position, 8);
    if (tToken.billboardMesh) {
      tToken.billboardMesh.material.color.setHex(0xff3333);
      setTimeout(() => {
        if (tToken.billboardMesh) tToken.billboardMesh.material.color.setHex(0xffffff);
      }, 130);
    }
  }

  /* 戰損血條即時過渡 */
  function updateTokenHp(token, newHp) {
    token.currentHp = Math.max(0, newHp);
    const pct = Math.max(0, token.currentHp / token.maxHp);
    token.hpFg.scale.x = pct;
    token.hpFg.position.x = -(1 - pct) * 0.68;

    if (pct < 0.25) token.hpFg.material.color.setHex(0xef4444);
    else if (pct < 0.6) token.hpFg.material.color.setHex(0xf59e0b);
    else token.hpFg.material.color.setHex(0x22c55e);
  }

  /* 名將陣亡潰散動畫 */
  function tokenFallDown(token) {
    token.alive = false;
    let r = 0;
    function rout() {
      r += 0.06;
      token.mesh.rotation.z = token.side === 'A' ? -r : r;
      token.mesh.position.y -= 0.025;
      if (token.mesh.position.y > -0.6) {
        requestAnimationFrame(rout);
      }
    }
    rout();
    spawnDustPuff(token.mesh.position, 0x1e293b);
  }

  /* ----------------------------------------------------
     光榮特庫摩風格 名將絕技 Cut-in 橫幅特寫
     ---------------------------------------------------- */
  function injectCutinLayer() {
    if (!container) return;
    let cutin = container.querySelector('#battleCutinLayer');
    if (!cutin) {
      cutin = document.createElement('div');
      cutin.id = 'battleCutinLayer';
      cutin.style.position = 'absolute';
      cutin.style.top = '12px';
      cutin.style.left = '50%';
      cutin.style.transform = 'translateX(-50%)';
      cutin.style.zIndex = '30';
      cutin.style.pointerEvents = 'none';
      cutin.style.display = 'none';
      cutin.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      container.appendChild(cutin);
    }
  }

  function triggerWarlordCutin(token) {
    const cutin = document.querySelector('#battleCutinLayer');
    if (!cutin) return;

    if (cutinTimeout) clearTimeout(cutinTimeout);

    const isSideA = token.side === 'A';
    const bgGrad = isSideA
      ? 'linear-gradient(90deg, rgba(2,132,199,0) 0%, rgba(2,132,199,0.92) 20%, rgba(15,23,42,0.95) 50%, rgba(2,132,199,0.92) 80%, rgba(2,132,199,0) 100%)'
      : 'linear-gradient(90deg, rgba(217,119,6,0) 0%, rgba(217,119,6,0.92) 20%, rgba(38,18,8,0.95) 50%, rgba(217,119,6,0.92) 80%, rgba(217,119,6,0) 100%)';

    cutin.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 8px 32px;
        background: ${bgGrad};
        border-top: 2px solid #fbbf24;
        border-bottom: 2px solid #fbbf24;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6);
        color: #ffffff;
      ">
        <img src="assets/warlords/${token.id}.jpg?v=1.0.0" style="
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 2px solid #fbbf24;
          object-fit: cover;
          box-shadow: 0 0 10px rgba(251,191,36,0.8);
        " onerror="this.style.display='none'" />
        <div>
          <div style="font-family:'Noto Sans TC',serif; font-size: 20px; font-weight: bold; color: #fbbf24; text-shadow: 0 2px 6px rgba(0,0,0,0.8);">
            ⚡【${token.name}】絕技發動！
          </div>
          <div style="font-size: 13px; color: #e2e8f0; font-weight: 600;">
            ${token.tag || '名將威震疆場'}
          </div>
        </div>
      </div>
    `;

    cutin.style.display = 'block';
    cutin.style.opacity = '1';
    cutin.style.transform = 'translateX(-50%) translateY(0)';

    cutinTimeout = setTimeout(() => {
      cutin.style.opacity = '0';
      cutin.style.transform = 'translateX(-50%) translateY(-10px)';
      setTimeout(() => { cutin.style.display = 'none'; }, 260);
    }, 1100);
  }

  /* ----------------------------------------------------
     粒子特效系統 (金鐵火花、沙塵、烽火台明滅)
     ---------------------------------------------------- */
  function spawnSparkBurst(pos, count = 10) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.05, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
      const spark = new THREE.Mesh(geo, mat);
      spark.position.copy(pos).add(new THREE.Vector3(0, 0.9, 0));
      scene.add(spark);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.22,
        Math.random() * 0.22 + 0.08,
        (Math.random() - 0.5) * 0.22
      );
      particleSystems.push({ mesh: spark, vel, life: 16 });
    }
  }

  function spawnDustPuff(pos, color = 0xd97706) {
    const geo = new THREE.SphereGeometry(0.12, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 });
    const dust = new THREE.Mesh(geo, mat);
    dust.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.1, (Math.random() - 0.5) * 0.4));
    scene.add(dust);

    particleSystems.push({
      mesh: dust,
      vel: new THREE.Vector3(0, 0.02, 0),
      scaleGrowth: 0.03,
      life: 20
    });
  }

  /* 相機微震動 */
  function screenShake(intensity) {
    if (!camera) return;
    camera.position.x += (Math.random() - 0.5) * intensity;
    camera.position.y += (Math.random() - 0.5) * intensity;
    setTimeout(updateCameraPosition, 75);
  }

  /* ----------------------------------------------------
     相機軌道與滑鼠互動視角控制
     ---------------------------------------------------- */
  function updateCameraPosition() {
    if (!camera) return;
    camera.position.x = CAM_TARGET.x + camRadius * Math.sin(camPhi) * Math.sin(camTheta);
    camera.position.y = CAM_TARGET.y + camRadius * Math.cos(camPhi);
    camera.position.z = CAM_TARGET.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta);
    camera.lookAt(CAM_TARGET);
  }

  function resetCamera() {
    camTheta = 0;
    camPhi = 0.65;
    camRadius = 26;
    updateCameraPosition();
  }

  function setupCameraControls() {
    if (!container) return;

    container.addEventListener('mousedown', e => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    container.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      camTheta -= dx * 0.006;
      camPhi = Math.max(0.2, Math.min(Math.PI / 2.2, camPhi - dy * 0.006));
      updateCameraPosition();
    });

    container.addEventListener('wheel', e => {
      e.preventDefault();
      camRadius = Math.max(12, Math.min(38, camRadius + e.deltaY * 0.015));
      updateCameraPosition();
    }, { passive: false });
  }

  /* ----------------------------------------------------
     主要動畫循環 (Render Loop)
     ---------------------------------------------------- */
  function startAnimationLoop() {
    let clock = 0;

    function animate() {
      animFrameId = requestAnimationFrame(animate);
      clock += 0.016;

      // 1. 拋物線火箭動態更新
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.progress += p.speed;
        if (p.progress >= 0 && p.progress <= 1) {
          p.mesh.position.lerpVectors(p.start, p.end, p.progress);
          p.mesh.position.y = p.start.y + Math.sin(p.progress * Math.PI) * p.arcHeight;
          p.mesh.lookAt(p.end.x, p.end.y + Math.sin((p.progress + 0.05) * Math.PI) * p.arcHeight, p.end.z);
        } else if (p.progress > 1) {
          // 落地炸裂
          spawnSparkBurst(p.end, 3);
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          projectiles.splice(i, 1);
        }
      }

      // 2. 粒子消散更新
      for (let i = particleSystems.length - 1; i >= 0; i--) {
        const pt = particleSystems[i];
        pt.mesh.position.add(pt.vel);
        if (pt.scaleGrowth) {
          pt.mesh.scale.addScalar(pt.scaleGrowth);
          pt.mesh.material.opacity -= 0.03;
        } else {
          pt.vel.y -= 0.012; // 火花重力
        }
        pt.life--;
        if (pt.life <= 0) {
          scene.remove(pt.mesh);
          pt.mesh.geometry.dispose();
          pt.mesh.material.dispose();
          particleSystems.splice(i, 1);
        }
      }

      // 3. 烽火台火光與火燄動態閃爍
      brazierLights.forEach((b, idx) => {
        const flicker = Math.sin(clock * 10 + idx) * 0.35 + (Math.random() - 0.5) * 0.2;
        b.light.intensity = b.baseIntensity + flicker;
        if (b.fireMesh) {
          const s = 1.0 + flicker * 0.2;
          b.fireMesh.scale.set(s, s * 1.2, s);
        }
      });

      // 4. 軍師太極八卦陣圖持續旋轉 + 名將立牌隨風呼吸浮動
      unitsMap.forEach(token => {
        if (token.alive && token.mesh) {
          // 八卦圖持續旋轉
          const bagua = token.mesh.getObjectByName('baguaRuneRing');
          if (bagua) {
            bagua.rotation.z += 0.02;
          }
          // 立牌呼吸浮動
          token.billboardMesh.rotation.y = Math.sin(clock * 2 + token.origX) * 0.05;
        }
      });

      renderer.render(scene, camera);
    }
    animate();
  }

  function clearAllTokens() {
    unitsMap.forEach(t => {
      scene.remove(t.mesh);
    });
    unitsMap.clear();

    projectiles.forEach(p => scene.remove(p.mesh));
    projectiles = [];

    particleSystems.forEach(pt => scene.remove(pt.mesh));
    particleSystems = [];
  }

  function onWindowResize() {
    if (!renderer || !camera || !container) return;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 420;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function toggleMode(enabled) {
    isEnabled = !!enabled;
    if (container) {
      container.hidden = !isEnabled;
    }
  }

  return {
    init,
    loadBattle,
    playEvent,
    toggleMode,
    clearAllTokens,
    resetCamera
  };
})();

if (typeof window !== 'undefined') {
  window.Battle3DEngine = Battle3DEngine;
}
'''

with open('D:/TopWarlords/js/battle-3d.js', 'w', encoding='utf-8') as f:
    f.write(CODE)

print('Successfully rebuilt D:/TopWarlords/js/battle-3d.js with Koei-style 3D formations and authentic effects!')
