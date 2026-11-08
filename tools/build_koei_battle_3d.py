# -*- coding: utf-8 -*-
"""
全面重構 TopWarlords 3D 古戰場推演引擎 (Three.js r128)
忠實遵循光榮特庫摩《三國志11/14》與《信長之野望·創造/大志/新生》合戰風格：
1. 立體部隊方陣托盤（Unit Formation Plinth / Movement Tray）：
   - 每個單位均為重厚沉穩長方形立體方陣托盤 (3.2 x 0.28 x 2.2)
   - 藍軍/紅軍專屬漆木托盤 + 雕花鎏金/青銅陣營護角包邊
   - 托盤內部微縮沙盤軍勢地表（踏碾草皮、塵土、行軍痕跡）
   - 托盤正面浮雕番號銅牌（如「⚡ 奔雷突騎」、「🛡️ 重甲陷陣」）
2. 托盤上方嚴整排列之微縮 3D 方陣部隊（Rank & File Miniatures）：
   - ⚡ 奔雷突騎：3 匹重甲戰馬（主將居中高頭駿馬、左右 2 匹護衛騎兵，長槍平端突刺）+ 飄揚絲綢大纛戰旗
   - 🛡️ 重甲陷陣：前排 3 面巨型金屬塔盾結成無縫鋼盾牆 (Shield Wall) + 後排 3 名長戟兵長矛如林突刺出陣
   - 🏹 神射強弩：前排 2 名強弩兵半跪伏射 + 後排 2 名神箭手滿月挽弓仰射 + 地面箭箱與防騎尖樁
   - ⚔️ 先登奇兵：4 名精銳突擊隊員組成鋒矢衝堅陣（銳角破陣鋒，手持雙持斬馬大刀與鉤爪手盾）
   - 📜 軍師奇謀：實木點將觀星樓閣（飛簷翹角）+ 軍師手執白羽扇 + 巨型牛皮天音戰鼓與擂鼓衛士 + 腳下持續旋轉發光的立體太極八卦陣圖
3. 名將真實人物畫軍屏立牌（Real Warlord Character Paintings）：
   - 托盤後方立有雕花金屬軍屏，直接呈現 200 位歷史名將之高解析真實人物畫像
   - 底部水墨名牌（「霍去病」、「織田信長」、「武田信玄」、「白起」、「關羽」等）
   - 頂部浮動 3D 氣血條與動態兵力數字（如「24,000 / 24,000 兵力」）
   - 絕無單一大字遮擋面部！
4. 合戰動態演出：
   - 托盤整體衝鋒衝撞、撞退震退、激昂火花飛濺與震屏
   - 弓弩萬箭拋物線齊射、盾牆格擋六角力場防禦
   - 陣亡時托盤士兵伏倒、戰旗傾折、濃烈戰火黑煙升騰，托盤深沉沉降於沙盤泥土中
"""

import sys
from pathlib import Path

CODE = r'''/* =====================================================
   TopWarlords 3D 古戰場推演引擎 (Three.js r128)
   光榮特庫摩《三國志》風格 · 立體部隊方陣托盤 · 真實名將立牌
   ===================================================== */
'use strict';

const Battle3DEngine = (function () {
  let isEnabled = true;
  let container = null;
  let scene, camera, renderer;
  let animFrameId = null;
  let isInitialized = false;

  // 戰場單位網格與狀態 Map
  const unitsMap = new Map(); // uid -> PlinthTokenData
  let projectiles = [];       // 拋物線火箭與法術飛彈
  let particleSystems = [];   // 火星、塵土、光環粒子
  let brazierLights = [];     // 四角烽火台火光 (動態跳動)
  let cutinTimeout = null;

  // 視角互動控制
  let isDragging = false;
  let prevMouseX = 0, prevMouseY = 0;
  let camTheta = 0, camPhi = 0.62, camRadius = 27;
  const CAM_TARGET = new THREE.Vector3(0, 0.4, 0);

  // 槽位陣列標準座標 (五大部隊方陣托盤站位)
  // A軍 (左側 X < 0)，B軍 (右側 X > 0)
  const SLOT_COORDS = {
    A: {
      armor:       { x: -4.5, z:  0.0 }, // 中軍前鋒：重甲陷陣 (盾牆托盤)
      naval:       { x: -5.0, z:  3.6 }, // 左翼前鋒：先登奇兵 (鋒矢托盤)
      air:         { x: -7.8, z: -3.6 }, // 右翼游弋：奔雷突騎 (戰馬托盤)
      air_defense: { x: -8.2, z:  2.8 }, // 左翼中衛：神射強弩 (弓弩托盤)
      support:     { x: -9.6, z:  0.0 }  // 中軍帥帳：軍師奇謀 (點將亭台托盤)
    },
    B: {
      armor:       { x:  4.5, z:  0.0 },
      naval:       { x:  5.0, z: -3.6 },
      air:         { x:  7.8, z:  3.6 },
      air_defense: { x:  8.2, z: -2.8 },
      support:     { x:  9.6, z:  0.0 }
    }
  };

  const CAT_NAMES = {
    air: '⚡ 奔雷突騎',
    armor: '🛡️ 重甲陷陣',
    air_defense: '🏹 神射強弩',
    naval: '⚔️ 先登奇兵',
    support: '📜 軍師奇謀'
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
    scene.background = new THREE.Color(0x110c09);
    scene.fog = new THREE.FogExp2(0x110c09, 0.020);

    // 2. 透視相機 (俯仰典雅合戰全景視角)
    camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
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

    // 5. 構建典雅古典軍事沙盤台與楚河漢界地形
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
    const ambientLight = new THREE.AmbientLight(0xffecd1, 0.82);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.45);
    sunLight.position.set(-18, 30, 14);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 75;
    sunLight.shadow.camera.left = -18;
    sunLight.shadow.camera.right = 18;
    sunLight.shadow.camera.top = 18;
    sunLight.shadow.camera.bottom = -18;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(18, 14, -14);
    scene.add(rimLight);
  }

  /* 相機座標更新 */
  function updateCameraPosition() {
    if (!camera) return;
    camera.position.x = CAM_TARGET.x + camRadius * Math.sin(camPhi) * Math.sin(camTheta);
    camera.position.y = CAM_TARGET.y + camRadius * Math.cos(camPhi);
    camera.position.z = CAM_TARGET.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta);
    camera.lookAt(CAM_TARGET);
  }

  function resetCamera() {
    camTheta = 0;
    camPhi = 0.62;
    camRadius = 27;
    CAM_TARGET.set(0, 0.4, 0);
    updateCameraPosition();
  }

  function setupCameraControls() {
    if (!container) return;

    container.addEventListener('mousedown', e => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });

    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      camTheta -= deltaX * 0.007;
      camPhi -= deltaY * 0.005;
      camPhi = Math.max(0.18, Math.min(Math.PI / 2 - 0.05, camPhi));
      updateCameraPosition();
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    container.addEventListener('wheel', e => {
      e.preventDefault();
      camRadius += e.deltaY * 0.02;
      camRadius = Math.max(14, Math.min(46, camRadius));
      updateCameraPosition();
    }, { passive: false });
  }

  /* ----------------------------------------------------
     構建古典軍事沙盤台、楚河漢界地形與四角烽火台
     ---------------------------------------------------- */
  function createAncientSandTable() {
    // 1. 厚重紅木雕花沙盤主體
    const woodGeo = new THREE.BoxGeometry(27.4, 1.8, 16.8);
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x24150b,
      roughness: 0.72,
      metalness: 0.18
    });
    const woodMesh = new THREE.Mesh(woodGeo, woodMat);
    woodMesh.position.y = -0.95;
    woodMesh.receiveShadow = true;
    scene.add(woodMesh);

    // 2. 青銅鎏金饕餮紋包邊框
    const borderGeo = new THREE.BoxGeometry(27.6, 0.28, 17.0);
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.35,
      metalness: 0.82
    });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.position.y = -0.05;
    scene.add(borderMesh);

    // 3. 古戰場寫意地形紋理
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 1024;
    groundCanvas.height = 640;
    const gctx = groundCanvas.getContext('2d');

    // 泥土沙質底色
    const grad = gctx.createLinearGradient(0, 0, 1024, 640);
    grad.addColorStop(0, '#2d251a');
    grad.addColorStop(0.5, '#3b3122');
    grad.addColorStop(1, '#2d251a');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 1024, 640);

    // 沙盤方格暗紋
    gctx.strokeStyle = 'rgba(217, 119, 6, 0.14)';
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
    gctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
    gctx.font = 'bold 28px "Noto Sans TC", serif';
    gctx.textAlign = 'center';
    gctx.fillText('— 楚 河 漢 界 · 決 戰 疆 場 —', 0, 8);
    gctx.restore();

    // 兩軍陣地暗印
    gctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    gctx.beginPath(); gctx.arc(240, 320, 160, 0, Math.PI * 2); gctx.fill();
    gctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
    gctx.beginPath(); gctx.arc(784, 320, 160, 0, Math.PI * 2); gctx.fill();

    const groundTex = new THREE.CanvasTexture(groundCanvas);
    const groundGeo = new THREE.PlaneGeometry(27.0, 16.4);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.85,
      metalness: 0.1
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 4. 前線木柵拒馬
    createBarricades();

    // 5. 兩側大本營軍帳
    createCampProps();

    // 6. 沙盤四角青銅烽火台
    createBraziers();
  }

  function createBarricades() {
    const barricadeGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3d22, roughness: 0.9 });
    const zPositions = [-5.6, -2.5, 2.5, 5.6];
    zPositions.forEach(z => {
      [-1.3, 1.3].forEach(x => {
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
      });
    });
    scene.add(barricadeGroup);
  }

  function createCampProps() {
    createTent(-11.6, -5.5, 0x0284c7, '漢');
    createTent(-11.6,  5.5, 0x0284c7, '帥');
    createTent( 11.6, -5.5, 0xd97706, '楚');
    createTent( 11.6,  5.5, 0xd97706, '將');
  }

  function createTent(x, z, flagColor, bannerChar) {
    const group = new THREE.Group();
    const tentGeo = new THREE.ConeGeometry(1.2, 1.5, 6);
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
    const tent = new THREE.Mesh(tentGeo, tentMat);
    tent.position.y = 0.75;
    tent.castShadow = true;
    group.add(tent);

    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.2;
    group.add(pole);

    const flagCanvas = document.createElement('canvas');
    flagCanvas.width = 128; flagCanvas.height = 96;
    const fctx = flagCanvas.getContext('2d');
    fctx.fillStyle = (flagColor === 0x0284c7) ? '#0284c7' : '#d97706';
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

  function createBraziers() {
    brazierLights = [];
    const corners = [
      { x: -12.6, z: -7.5 },
      { x: -12.6, z:  7.5 },
      { x:  12.6, z: -7.5 },
      { x:  12.6, z:  7.5 }
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

      const fireGeo = new THREE.SphereGeometry(0.25, 8, 8);
      const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
      const fire = new THREE.Mesh(fireGeo, fireMat);
      fire.position.set(pos.x, 1.7, pos.z);
      scene.add(fire);

      const light = new THREE.PointLight(0xff8822, 1.6, 12);
      light.position.set(pos.x, 2.0, pos.z);
      scene.add(light);
      brazierLights.push({ light, baseIntensity: 1.6, fireMesh: fire });
    });
  }

  /* ----------------------------------------------------
     核心構建：光榮特庫摩立體部隊方陣托盤 (Unit Formation Plinth)
     ---------------------------------------------------- */
  function createUnitToken(unit, side, slotIndex) {
    const group = new THREE.Group();
    const cat = unit.cat || 'armor';
    const coords = (SLOT_COORDS[side] && SLOT_COORDS[side][cat]) || { x: (side === 'A' ? -6 : 6), z: 0 };

    const isSideA = (side === 'A');
    const facingDir = isSideA ? 1 : -1;
    const catColor = CAT_COLORS[cat] || 0xffffff;

    // ==========================================
    // 1. 厚重長方形部隊方陣托盤 (Movement Tray Plinth)
    // ==========================================
    const PLINTH_W = 3.2; // 寬度 (迎敵衝鋒向)
    const PLINTH_D = 2.2; // 深度
    const PLINTH_H = 0.28; // 托盤厚度

    const plinthGroup = new THREE.Group();

    // 托盤主體厚底座 (黑檀木/沉香木)
    const baseGeo = new THREE.BoxGeometry(PLINTH_W, PLINTH_H, PLINTH_D);
    const baseMat = new THREE.MeshStandardMaterial({
      color: isSideA ? 0x141e2e : 0x24140e,
      roughness: 0.6,
      metalness: 0.3
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = PLINTH_H / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    plinthGroup.add(baseMesh);

    // 陣營包邊 (藍軍飾金，紅軍飾銅)
    const trimMat = new THREE.MeshStandardMaterial({
      color: isSideA ? 0x38bdf8 : 0xd97706,
      metalness: 0.88,
      roughness: 0.22
    });

    // 托盤四周雕花護緣金屬框
    const rimTop = new THREE.Mesh(new THREE.BoxGeometry(PLINTH_W + 0.08, 0.08, 0.08), trimMat);
    rimTop.position.set(0, PLINTH_H + 0.02, -PLINTH_D / 2);
    plinthGroup.add(rimTop);

    const rimBot = new THREE.Mesh(new THREE.BoxGeometry(PLINTH_W + 0.08, 0.08, 0.08), trimMat);
    rimBot.position.set(0, PLINTH_H + 0.02, PLINTH_D / 2);
    plinthGroup.add(rimBot);

    const rimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, PLINTH_D + 0.08), trimMat);
    rimLeft.position.set(-PLINTH_W / 2, PLINTH_H + 0.02, 0);
    plinthGroup.add(rimLeft);

    const rimRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, PLINTH_D + 0.08), trimMat);
    rimRight.position.set(PLINTH_W / 2, PLINTH_H + 0.02, 0);
    plinthGroup.add(rimRight);

    // 4 個黃金/青銅包角花飾
    const cornerGeo = new THREE.BoxGeometry(0.24, 0.32, 0.24);
    [
      [-PLINTH_W/2, -PLINTH_D/2],
      [ PLINTH_W/2, -PLINTH_D/2],
      [-PLINTH_W/2,  PLINTH_D/2],
      [ PLINTH_W/2,  PLINTH_D/2]
    ].forEach(([cx, cz]) => {
      const corner = new THREE.Mesh(cornerGeo, trimMat);
      corner.position.set(cx, PLINTH_H / 2 + 0.02, cz);
      plinthGroup.add(corner);
    });

    // 托盤內微縮泥地沙盤草皮 (Diorama Turf Top Surface)
    const turfCanvas = document.createElement('canvas');
    turfCanvas.width = 256; turfCanvas.height = 192;
    const tctx = turfCanvas.getContext('2d');
    const turfGrad = tctx.createLinearGradient(0, 0, 256, 192);
    turfGrad.addColorStop(0, isSideA ? '#283824' : '#382820');
    turfGrad.addColorStop(0.5, isSideA ? '#34462e' : '#423224');
    turfGrad.addColorStop(1, isSideA ? '#283824' : '#382820');
    tctx.fillStyle = turfGrad;
    tctx.fillRect(0, 0, 256, 192);

    // 踏碾痕跡與行軍方格線
    tctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
    tctx.lineWidth = 2;
    tctx.strokeRect(8, 8, 240, 176);

    const turfTex = new THREE.CanvasTexture(turfCanvas);
    const turfGeo = new THREE.PlaneGeometry(PLINTH_W - 0.12, PLINTH_D - 0.12);
    const turfMat = new THREE.MeshStandardMaterial({ map: turfTex, roughness: 0.9 });
    const turfMesh = new THREE.Mesh(turfGeo, turfMat);
    turfMesh.rotation.x = -Math.PI / 2;
    turfMesh.position.y = PLINTH_H + 0.01;
    turfMesh.receiveShadow = true;
    plinthGroup.add(turfMesh);

    // 托盤前沿部隊番號青銅浮雕名牌 (正面朝向視角/敵陣)
    const plaqueCanvas = document.createElement('canvas');
    plaqueCanvas.width = 256; plaqueCanvas.height = 64;
    const pctx = plaqueCanvas.getContext('2d');
    pctx.fillStyle = isSideA ? '#0c1a2e' : '#261208';
    pctx.fillRect(0, 0, 256, 64);
    pctx.strokeStyle = isSideA ? '#38bdf8' : '#fbbf24';
    pctx.lineWidth = 4;
    pctx.strokeRect(2, 2, 252, 60);
    pctx.fillStyle = '#ffffff';
    pctx.font = 'bold 26px "Noto Sans TC", sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText(CAT_NAMES[cat] || '名將方陣', 128, 42);

    const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
    const plaqueGeo = new THREE.PlaneGeometry(1.4, 0.22);
    const plaqueMat = new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.3, metalness: 0.5 });
    const plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaqueMesh.position.set(0, PLINTH_H / 2, (PLINTH_D / 2 + 0.01) * facingDir);
    if (!isSideA) plaqueMesh.rotation.y = Math.PI;
    plinthGroup.add(plaqueMesh);

    group.add(plinthGroup);

    // ==========================================
    // 2. 托盤上方嚴整排列之微縮 3D 方陣部隊 (Miniature Rank & File)
    // ==========================================
    const troopsGroup = buildFormationTroops(cat, isSideA, PLINTH_H);
    group.add(troopsGroup);

    // ==========================================
    // 3. 名將真實人物畫軍屏立牌 (高清水墨立體屏風)
    // ==========================================
    const billboard = buildWarlordScreen(unit, isSideA, catColor, PLINTH_H);
    billboard.mesh.position.set(-0.95 * facingDir, PLINTH_H + 0.95, 0.0);
    group.add(billboard.mesh);

    // ==========================================
    // 4. 頂部 3D 即時氣血條與兵力數字看板
    // ==========================================
    const hpBar = buildHpBar(unit.hp, unit.hpMax || unit.hp, unit.name);
    hpBar.group.position.y = PLINTH_H + 2.45;
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
      plinthGroup: plinthGroup,
      troopsGroup: troopsGroup,
      billboardMesh: billboard.mesh,
      hpFg: hpBar.fg,
      hpGroup: hpBar.group,
      hpTextCanvas: hpBar.textCanvas,
      hpTextTex: hpBar.textTex,
      origX: coords.x,
      origZ: coords.z,
      currentHp: unit.hp,
      maxHp: unit.hpMax || unit.hp,
      alive: true
    };
  }

  /* ----------------------------------------------------
     五大兵團微縮士兵方陣模型建立
     ---------------------------------------------------- */
  function buildFormationTroops(cat, isSideA, plinthY) {
    const fGroup = new THREE.Group();
    fGroup.position.y = plinthY;
    const facingDir = isSideA ? 1 : -1;

    switch (cat) {
      case 'air': {
        // ====================================================
        // ⚡ 奔雷突騎：3 匹重甲戰馬 (主將居中 + 左右突騎護衛) + 大纛長槍
        // ====================================================
        const horseMat = new THREE.MeshStandardMaterial({ color: 0x3e2314, roughness: 0.65 });
        const horseArmorMat = new THREE.MeshStandardMaterial({
          color: isSideA ? 0x0284c7 : 0xd97706,
          metalness: 0.85,
          roughness: 0.25
        });
        const riderArmorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
        const lanceMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95 });

        // 生成一匹戰馬與騎兵的輔助函式
        function createCavalryman(offsetX, offsetZ, scale = 1.0, isCommander = false) {
          const cav = new THREE.Group();
          cav.position.set(offsetX * facingDir, 0, offsetZ);
          cav.scale.set(scale, scale, scale);

          // 馬身
          const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.46, 0.36), horseMat);
          body.position.set(0, 0.42, 0);
          body.castShadow = true;
          cav.add(body);

          // 馬頸與頭
          const neck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.24), horseMat);
          neck.position.set(0.35 * facingDir, 0.68, 0);
          neck.rotation.z = -0.35 * facingDir;
          cav.add(neck);

          const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.22), horseMat);
          head.position.set(0.48 * facingDir, 0.82, 0);
          cav.add(head);

          // 馬面金甲 (Chamfron)
          const chamfron = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.23), horseArmorMat);
          chamfron.position.set(0.56 * facingDir, 0.83, 0);
          cav.add(chamfron);

          // 4 條馬腿
          const legGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.42, 6);
          [
            [-0.28, -0.12], [-0.28, 0.12],
            [ 0.28, -0.12], [ 0.28, 0.12]
          ].forEach(([lx, lz]) => {
            const leg = new THREE.Mesh(legGeo, horseMat);
            leg.position.set(lx * facingDir, 0.21, lz);
            leg.castShadow = true;
            cav.add(leg);
          });

          // 馬尾
          const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.4, 6), horseMat);
          tail.position.set(-0.45 * facingDir, 0.38, 0);
          tail.rotation.z = 0.5 * facingDir;
          cav.add(tail);

          // 馬鞍與鞍韉
          const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.38), horseArmorMat);
          saddle.position.set(0, 0.64, 0);
          cav.add(saddle);

          // 騎兵軀幹 (鐵甲身軀)
          const riderBody = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.26), riderArmorMat);
          riderBody.position.set(0, 0.88, 0);
          riderBody.castShadow = true;
          cav.add(riderBody);

          // 騎兵頭盔 (帶紅纓)
          const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), riderArmorMat);
          helmet.position.set(0, 1.14, 0);
          cav.add(helmet);

          const plume = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
          plume.position.set(0, 1.28, 0);
          cav.add(plume);

          // 平端突刺衝鋒長槍 (2.2m)
          const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 2.1, 6), lanceMat);
          lance.rotation.z = Math.PI / 2 * facingDir;
          lance.position.set(0.75 * facingDir, 0.95, 0.18);
          cav.add(lance);

          // 槍尖紅纓
          const lanceTassel = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), new THREE.MeshBasicMaterial({ color: 0xd97706 }));
          lanceTassel.rotation.z = -Math.PI / 2 * facingDir;
          lanceTassel.position.set(1.65 * facingDir, 0.95, 0.18);
          cav.add(lanceTassel);

          // 若為主將，配備飄揚帥氣披風
          if (isCommander) {
            const capeMat = new THREE.MeshStandardMaterial({
              color: isSideA ? 0x0284c7 : 0xb91c1c,
              side: THREE.DoubleSide
            });
            const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.65), capeMat);
            cape.position.set(-0.25 * facingDir, 0.85, 0);
            cape.rotation.y = Math.PI / 2;
            cape.rotation.x = -0.35 * facingDir;
            cav.add(cape);
          }

          return cav;
        }

        // 居中大將戰馬 (居中居前)
        fGroup.add(createCavalryman(0.2, 0.0, 1.15, true));
        // 左翼突騎
        fGroup.add(createCavalryman(-0.25, -0.65, 0.95, false));
        // 右翼突騎
        fGroup.add(createCavalryman(-0.25,  0.65, 0.95, false));

        // 托盤大纛軍旗
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c3d22 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.7, 6), poleMat);
        pole.position.set(-1.1 * facingDir, 1.35, -0.65);
        fGroup.add(pole);

        const flagMat = new THREE.MeshStandardMaterial({
          color: isSideA ? 0x0284c7 : 0xb91c1c,
          roughness: 0.35,
          side: THREE.DoubleSide
        });
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.05), flagMat);
        flag.position.set((-1.1 + 0.42 * -facingDir), 2.15, -0.65);
        flag.rotation.y = Math.PI / 2;
        fGroup.add(flag);
        break;
      }

      case 'armor': {
        // ====================================================
        // 🛡️ 重甲陷陣：前排 3 面巨型金屬塔盾結成無縫鋼盾牆 (Shield Wall) + 後排 3 長戟刺陣
        // ====================================================
        const shieldMat = new THREE.MeshStandardMaterial({
          color: 0x334155,
          metalness: 0.88,
          roughness: 0.25
        });
        const bossMat = new THREE.MeshStandardMaterial({
          color: isSideA ? 0x38bdf8 : 0xf59e0b,
          metalness: 0.95,
          roughness: 0.15
        });
        const soldierMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
        const spearMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });

        [-0.68, 0, 0.68].forEach((offsetZ, i) => {
          // 前排厚重玄鐵塔盾 (連成鐵壁)
          const shield = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.15, 0.66), shieldMat);
          shield.position.set(0.75 * facingDir, 0.58, offsetZ);
          shield.rotation.y = (i === 0 ? 0.18 : i === 2 ? -0.18 : 0) * facingDir;
          shield.castShadow = true;
          fGroup.add(shield);

          // 獸面銅釘盾心
          const boss = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), bossMat);
          boss.position.set(0.83 * facingDir, 0.58, offsetZ);
          fGroup.add(boss);

          // 盾後持盾重甲兵身形
          const soldier = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, 0.32), soldierMat);
          soldier.position.set(0.48 * facingDir, 0.45, offsetZ);
          soldier.castShadow = true;
          fGroup.add(soldier);

          const helm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), bossMat);
          helm.position.set(0.48 * facingDir, 0.98, offsetZ);
          fGroup.add(helm);

          // 後排長戟兵 (突出盾外的長矛矛尖)
          const pikeman = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.32), soldierMat);
          pikeman.position.set(0.05 * facingDir, 0.50, offsetZ);
          pikeman.castShadow = true;
          fGroup.add(pikeman);

          const pikeHelm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), bossMat);
          pikeHelm.position.set(0.05 * facingDir, 1.08, offsetZ);
          fGroup.add(pikeHelm);

          // 架出盾外的 2.6m 長戟長矛
          const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 2.4, 6), spearMat);
          spear.rotation.z = (Math.PI / 2 - 0.22) * facingDir;
          spear.position.set(0.95 * facingDir, 0.98, offsetZ);
          fGroup.add(spear);

          // 長矛紅纓
          const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
          tassel.rotation.z = -Math.PI / 2 * facingDir;
          tassel.position.set(1.95 * facingDir, 1.25, offsetZ);
          fGroup.add(tassel);
        });
        break;
      }

      case 'air_defense': {
        // ====================================================
        // 🏹 神射強弩：前排 2 跪射強弩 + 後排 2 立射長弓 + 地面箭箱與防騎尖樁
        // ====================================================
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85 });
        const soldierMat = new THREE.MeshStandardMaterial({ color: 0x334155 });

        // 前排 2 名跪姿強弩兵
        [-0.55, 0.55].forEach(offsetZ => {
          // 跪姿步兵身軀
          const soldier = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.55, 0.28), soldierMat);
          soldier.position.set(0.45 * facingDir, 0.30, offsetZ);
          soldier.castShadow = true;
          fGroup.add(soldier);

          const helm = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), metalMat);
          helm.position.set(0.45 * facingDir, 0.65, offsetZ);
          fGroup.add(helm);

          // 諸葛連弩/軍用強弩機身
          const crossStock = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.10, 0.12), woodMat);
          crossStock.position.set(0.68 * facingDir, 0.58, offsetZ);
          fGroup.add(crossStock);

          const crossProd = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.62), metalMat);
          crossProd.position.set(0.85 * facingDir, 0.58, offsetZ);
          fGroup.add(crossProd);

          // 瞄準待發的利箭
          const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), metalMat);
          bolt.rotation.z = Math.PI / 2 * facingDir;
          bolt.position.set(0.85 * facingDir, 0.64, offsetZ);
          fGroup.add(bolt);
        });

        // 後排 2 名立射長弓兵
        [-0.55, 0.55].forEach(offsetZ => {
          const archer = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.28), soldierMat);
          archer.position.set(-0.25 * facingDir, 0.45, offsetZ);
          archer.castShadow = true;
          fGroup.add(archer);

          const helm = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), metalMat);
          helm.position.set(-0.25 * facingDir, 0.98, offsetZ);
          fGroup.add(helm);

          // 滿月開弓之複合長弓 (圓弧 Geometry)
          const bow = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.025, 6, 12, Math.PI * 0.9), woodMat);
          bow.rotation.y = (Math.PI / 2) * facingDir;
          bow.rotation.x = -Math.PI / 6; // 30度仰射
          bow.position.set(-0.05 * facingDir, 0.95, offsetZ);
          fGroup.add(bow);

          // 搭箭在弦 (仰角朝天)
          const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 4), metalMat);
          arrow.rotation.z = (Math.PI / 2 - 0.52) * facingDir;
          arrow.position.set(0.25 * facingDir, 1.15, offsetZ);
          fGroup.add(arrow);
        });

        // 托盤地面箭筒匣與防騎尖樁
        const quiverBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.36), woodMat);
        quiverBox.position.set(0.15 * facingDir, 0.20, 0);
        fGroup.add(quiverBox);

        // 前緣 3 根防騎斜尖木樁
        [-0.7, 0, 0.7].forEach(sz => {
          const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.65, 5), woodMat);
          stake.rotation.z = 0.55 * facingDir;
          stake.position.set(1.2 * facingDir, 0.22, sz);
          stake.castShadow = true;
          fGroup.add(stake);
        });
        break;
      }

      case 'naval': {
        // ====================================================
        // ⚔️ 先登奇兵：4 名精銳突擊隊員組成的銳角「鋒矢破陣陣型」
        // ====================================================
        const bladeMat = new THREE.MeshStandardMaterial({
          color: 0xf1f5f9,
          metalness: 0.96,
          roughness: 0.12
        });
        const armorMat = new THREE.MeshStandardMaterial({
          color: isSideA ? 0x0284c7 : 0xb45309,
          metalness: 0.75,
          roughness: 0.3
        });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x475569 });

        // 鋒矢陣 4 個突擊戰位 (箭頭、左右翼、後衛)
        const wedgePositions = [
          { x:  0.85, z:  0.0, scale: 1.1, role: 'point' }, // 鋒頭第一人
          { x:  0.22, z: -0.62, scale: 0.95, role: 'wing' }, // 左翼奇兵
          { x:  0.22, z:  0.62, scale: 0.95, role: 'wing' }, // 右翼奇兵
          { x: -0.40, z:  0.0, scale: 0.95, role: 'rear' }  // 陣尾壓陣
        ];

        wedgePositions.forEach(p => {
          const warrior = new THREE.Group();
          warrior.position.set(p.x * facingDir, 0, p.z);
          warrior.scale.set(p.scale, p.scale, p.scale);

          // 武士體魄
          const torso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.30), armorMat);
          torso.position.y = 0.42;
          torso.castShadow = true;
          warrior.add(torso);

          // 戰盔與怒面
          const helm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), skinMat);
          helm.position.y = 0.88;
          warrior.add(helm);

          const headband = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 12), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
          headband.position.y = 0.88;
          headband.rotation.x = Math.PI / 2;
          warrior.add(headband);

          // 雙手揮舞的大型斬馬大刀 (1.4m 長巨刃)
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.25, 0.16), bladeMat);
          blade.position.set(0.35 * facingDir, 0.95, 0.15);
          blade.rotation.z = (p.role === 'point' ? -0.45 : 0.45) * facingDir;
          blade.castShadow = true;
          warrior.add(blade);

          // 金屬刀柄與護手環
          const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), armorMat);
          hilt.position.set(0.18 * facingDir, 0.55, 0.15);
          hilt.rotation.z = (p.role === 'point' ? -0.45 : 0.45) * facingDir;
          warrior.add(hilt);

          // 先登登城倒鉤小圓盾 (左手)
          const buckler = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12), armorMat);
          buckler.rotation.z = Math.PI / 2;
          buckler.position.set(0.15 * facingDir, 0.65, -0.22);
          warrior.add(buckler);

          fGroup.add(warrior);
        });
        break;
      }

      case 'support': {
        // ====================================================
        // 📜 軍師奇謀：實木點將亭台 + 白羽扇軍師 + 巨型牛皮天音戰鼓與擂鼓手 + 八卦光陣
        // ====================================================
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.4, metalness: 0.2 });
        const drumMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 });
        const drumRimMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9 });

        // 1. 點將亭台 4 根雕花紅木立柱
        const pillarGeo = new THREE.CylinderGeometry(0.05, 0.06, 1.45, 8);
        [
          [-0.65, -0.75], [0.65, -0.75],
          [-0.65,  0.75], [0.65,  0.75]
        ].forEach(([px, pz]) => {
          const pillar = new THREE.Mesh(pillarGeo, woodMat);
          pillar.position.set(px * facingDir, 0.75, pz);
          pillar.castShadow = true;
          fGroup.add(pillar);
        });

        // 2. 飛簷翹角歇山頂亭閣頂棚 (Oriental Pavilion Roof)
        const roofBase = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 1.85), roofMat);
        roofBase.position.set(0, 1.48, 0);
        roofBase.castShadow = true;
        fGroup.add(roofBase);

        const roofTop = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.55, 4), roofMat);
        roofTop.rotation.y = Math.PI / 4;
        roofTop.position.set(0, 1.82, 0);
        roofTop.castShadow = true;
        fGroup.add(roofTop);

        const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), drumRimMat);
        jewel.position.set(0, 2.15, 0);
        fGroup.add(jewel);

        // 3. 軍師長袍仙風道骨身姿 (手執白羽扇)
        const strategist = new THREE.Group();
        strategist.position.set(-0.15 * facingDir, 0, -0.25);

        // 寬袍大袖
        const robe = new THREE.Mesh(
          new THREE.ConeGeometry(0.32, 0.95, 8),
          new THREE.MeshStandardMaterial({ color: isSideA ? 0x0284c7 : 0x7c2d12, roughness: 0.6 })
        );
        robe.position.y = 0.48;
        strategist.add(robe);

        // 綸巾高冠
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0xfde047 }));
        head.position.y = 1.02;
        strategist.add(head);

        const hat = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
        hat.position.y = 1.15;
        strategist.add(hat);

        // 諸葛鵝毛白羽扇
        const fanMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        const fan = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.42, 6), fanMat);
        fan.rotation.z = 0.55 * facingDir;
        fan.position.set(0.35 * facingDir, 0.85, 0);
        strategist.add(fan);

        fGroup.add(strategist);

        // 4. 巨型天音牛皮戰鼓與架座
        const drumStand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.42), woodMat);
        drumStand.position.set(0.25 * facingDir, 0.28, 0.45);
        fGroup.add(drumStand);

        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.48, 16), drumMat);
        drum.rotation.z = Math.PI / 2;
        drum.position.set(0.25 * facingDir, 0.65, 0.45);
        drum.castShadow = true;
        fGroup.add(drum);

        // 金屬鉚釘鼓圈
        const drumRim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 16), drumRimMat);
        drumRim.rotation.y = Math.PI / 2;
        drumRim.position.set((0.25 + 0.24) * facingDir, 0.65, 0.45);
        fGroup.add(drumRim);

        // 擂鼓力士 (雙持鼓槌在空中擂擊)
        const drummer = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.26), new THREE.MeshStandardMaterial({ color: 0x334155 }));
        drummer.position.set(-0.20 * facingDir, 0.40, 0.45);
        drummer.castShadow = true;
        fGroup.add(drummer);

        // 鼓槌
        const malletGeo = new THREE.CylinderGeometry(0.015, 0.04, 0.35, 6);
        const mallet1 = new THREE.Mesh(malletGeo, woodMat);
        mallet1.position.set(0.05 * facingDir, 0.85, 0.35);
        mallet1.rotation.z = 0.6 * facingDir;
        fGroup.add(mallet1);

        // 5. 托盤地表旋轉太極八卦陣圖光圈
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
        const baguaGeo = new THREE.PlaneGeometry(1.9, 1.9);
        const baguaMat = new THREE.MeshBasicMaterial({
          map: baguaTex,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide
        });
        const baguaMesh = new THREE.Mesh(baguaGeo, baguaMat);
        baguaMesh.rotation.x = -Math.PI / 2;
        baguaMesh.position.set(0, 0.03, 0);
        baguaMesh.name = 'baguaRuneRing';
        fGroup.add(baguaMesh);
        break;
      }
    }

    return fGroup;
  }

  /* ----------------------------------------------------
     名將真實人物畫軍屏立牌 (高清水墨立體屏風)
     ---------------------------------------------------- */
  function buildWarlordScreen(unit, isSideA, catColor, plinthH) {
    const width = 1.35, height = 1.85;
    const bannerGeo = new THREE.BoxGeometry(width, height, 0.08);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 352;
    const ctx = canvas.getContext('2d');

    function renderScreenFace(loadedImg) {
      // 陣營古典暗紋邊框底色
      ctx.fillStyle = isSideA ? '#071829' : '#261208';
      ctx.fillRect(0, 0, 256, 352);

      // 肖像繪製區 (若有載入的圖像，滿格完整繪製真實人物肖像畫)
      if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
        ctx.drawImage(loadedImg, 8, 8, 240, 248);

        // 底部暈染過渡 (讓姓名區自然銜接，絕不遮掩臉孔五官)
        const edgeGrad = ctx.createLinearGradient(0, 210, 0, 256);
        edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
        edgeGrad.addColorStop(1, isSideA ? '#071829' : '#261208');
        ctx.fillStyle = edgeGrad;
        ctx.fillRect(8, 210, 240, 46);
      } else {
        // 典雅底色
        ctx.fillStyle = isSideA ? '#0c4a6e' : '#7c2d12';
        ctx.fillRect(8, 8, 240, 248);
      }

      // 豪華金屬陣營外框 (雙層金邊 + 四角裝飾)
      ctx.strokeStyle = isSideA ? '#38bdf8' : '#f59e0b';
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, 248, 344);

      // 四角雲紋金飾
      ctx.fillStyle = isSideA ? '#38bdf8' : '#fbbf24';
      ctx.fillRect(4, 4, 16, 6);
      ctx.fillRect(4, 4, 6, 16);
      ctx.fillRect(236, 4, 16, 6);
      ctx.fillRect(246, 4, 6, 16);
      ctx.fillRect(4, 342, 16, 6);
      ctx.fillRect(4, 332, 6, 16);
      ctx.fillRect(236, 342, 16, 6);
      ctx.fillRect(246, 332, 6, 16);

      // 國旗與費用角標金牌 ($5 突)
      ctx.fillStyle = 'rgba(10, 16, 26, 0.92)';
      ctx.fillRect(8, 8, 92, 34);
      ctx.strokeStyle = isSideA ? '#38bdf8' : '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(8, 8, 92, 34);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${unit.flag || ''} $${unit.cost}`, 14, 32);

      // 底部名牌黑金漆底 (襯托書法姓名)
      ctx.fillStyle = 'rgba(8, 12, 20, 0.95)';
      ctx.fillRect(8, 260, 240, 84);
      ctx.strokeStyle = isSideA ? '#38bdf8' : '#fbbf24';
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 260, 240, 84);

      // 名將全名書法楷體
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px "KaiTi", "Noto Sans TC", serif';
      ctx.textAlign = 'center';
      ctx.fillText(unit.name || '歷史名將', 128, 298);

      // 兵種稱號與戰術標籤
      ctx.fillStyle = isSideA ? '#38bdf8' : '#fbbf24';
      ctx.font = 'bold 16px "Noto Sans TC", sans-serif';
      const tagText = (unit.tag || '').split('·')[0].slice(0, 10);
      ctx.fillText(tagText, 128, 332);
    }

    renderScreenFace(null);

    const bannerTex = new THREE.CanvasTexture(canvas);
    bannerTex.minFilter = THREE.LinearFilter;
    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerTex,
      roughness: 0.35,
      metalness: 0.15
    });

    // 非同步載入真實肖像畫並刷新 Canvas (全套 200 張本地已備齊)
    if (unit.id) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        renderScreenFace(img);
        bannerTex.needsUpdate = true;
      };
      img.src = `assets/warlords/${unit.id}.jpg?v=1.0.0`;
    }

    const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
    bannerMesh.castShadow = true;

    return { mesh: bannerMesh, material: bannerMat };
  }

  /* ----------------------------------------------------
     3D 浮動即時血條與兵力數字
     ---------------------------------------------------- */
  function buildHpBar(currentHp, maxHp, warlordName) {
    const hpGroup = new THREE.Group();

    // 1. 底座背景槽
    const bgGeo = new THREE.BoxGeometry(1.6, 0.14, 0.05);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    hpGroup.add(bgMesh);

    // 2. 綠色氣血條前景
    const fgGeo = new THREE.BoxGeometry(1.56, 0.10, 0.07);
    const fgMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const fgMesh = new THREE.Mesh(fgGeo, fgMat);
    hpGroup.add(fgMesh);

    // 3. 兵力數字動態浮動銘牌 (兵力 24,000)
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 256; textCanvas.height = 64;
    const tctx = textCanvas.getContext('2d');

    function redrawHpText(hp) {
      tctx.clearRect(0, 0, 256, 64);
      tctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
      tctx.roundRect ? tctx.roundRect(4, 4, 248, 56, 12) : tctx.fillRect(4, 4, 248, 56);
      tctx.fill();
      tctx.strokeStyle = '#38bdf8';
      tctx.lineWidth = 2;
      tctx.stroke();

      tctx.fillStyle = '#ffffff';
      tctx.font = 'bold 28px sans-serif';
      tctx.textAlign = 'center';
      const troopCount = Math.max(0, Math.round(hp * 100)).toLocaleString();
      tctx.fillText(`兵力 ${troopCount}`, 128, 42);
    }
    redrawHpText(currentHp);

    const textTex = new THREE.CanvasTexture(textCanvas);
    const textGeo = new THREE.PlaneGeometry(1.6, 0.40);
    const textMat = new THREE.MeshBasicMaterial({ map: textTex, transparent: true, side: THREE.DoubleSide });
    const textMesh = new THREE.Mesh(textGeo, textMat);
    textMesh.position.y = 0.32;
    hpGroup.add(textMesh);

    return {
      group: hpGroup,
      fg: fgMesh,
      textCanvas: textCanvas,
      textTex: textTex,
      redrawHpText: redrawHpText
    };
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

    // 2. 兵種托盤專屬合戰動作
    if (aToken && tToken) {
      if (aToken.cat === 'air') {
        // 奔雷突騎托盤高速衝鋒破陣
        performCavalryCharge(aToken, tToken);
      } else if (aToken.cat === 'air_defense' || (ln.text && ln.text.includes('箭'))) {
        // 神射萬箭齊發火箭雨
        spawnArrowVolley(aToken.mesh.position, tToken.mesh.position, aToken.side);
      } else if (aToken.cat === 'naval') {
        // 先登一番槍騰躍突擊
        performVanguardLeap(aToken, tToken);
      } else if (aToken.cat === 'support') {
        // 軍師八陣圖奇謀法術
        performStrategistTactic(aToken, tToken);
      } else {
        // 重甲陷陣托盤短兵相接
        performMeleeClash(aToken, tToken);
      }
    }

    // 3. 盾牌格擋力場防禦
    if (ln.kind === 'block' && tToken) {
      performShieldBlock(tToken);
    }

    // 4. 即時更新目標氣血條與兵力數
    if (tToken && ln.hpAfter !== undefined) {
      updateTokenHp(tToken, ln.hpAfter);
    }

    // 5. 擊破陣亡演出
    if (ln.kind === 'kill' && tToken) {
      tokenFallDown(tToken);
    }
  }

  /* 奔雷突騎整隊托盤高速衝擊 */
  function performCavalryCharge(aToken, tToken) {
    const orig = new THREE.Vector3(aToken.origX, 0, aToken.origZ);
    const target = tToken.mesh.position.clone();
    const dir = target.clone().sub(orig).normalize();
    const chargePos = target.clone().sub(dir.clone().multiplyScalar(2.0));

    let t = 0;
    const total = 28;

    function step() {
      t++;
      if (t <= 14) {
        const p = t / 14;
        aToken.mesh.position.lerpVectors(orig, chargePos, p);
        aToken.mesh.rotation.z = (aToken.side === 'A' ? 0.14 : -0.14) * Math.sin(p * Math.PI);
        if (t % 2 === 0) spawnDustPuff(aToken.mesh.position);
      } else if (t === 15) {
        // 猛烈撞擊頂點：震屏 + 金鐵交鳴火花
        spawnSparkBurst(chargePos, 22);
        screenShake(0.22);
        // 被撞托盤震退
        tToken.mesh.position.x += (aToken.side === 'A' ? 0.45 : -0.45);
        setTimeout(() => {
          if (tToken && tToken.alive) {
            tToken.mesh.position.x = tToken.origX;
          }
        }, 160);
      } else if (t <= total) {
        const p = (t - 14) / 14;
        aToken.mesh.position.lerpVectors(chargePos, orig, p);
        aToken.mesh.rotation.z = 0;
      }

      if (t < total) requestAnimationFrame(step);
    }
    step();
  }

  /* 神射萬箭齊發 3D 火箭雨 */
  function spawnArrowVolley(fromPos, toPos, side) {
    const arrowCount = 16;
    for (let i = 0; i < arrowCount; i++) {
      const spreadX = (Math.random() - 0.5) * 1.8;
      const spreadZ = (Math.random() - 0.5) * 1.8;
      const start = fromPos.clone().add(new THREE.Vector3(spreadX, 1.4, spreadZ));
      const end = toPos.clone().add(new THREE.Vector3(spreadX * 0.7, 0.4, spreadZ * 0.7));

      const arrowGeo = new THREE.CylinderGeometry(0.02, 0.04, 0.55, 6);
      const arrowMat = new THREE.MeshBasicMaterial({ color: (side === 'A' ? 0x38bdf8 : 0xf59e0b) });
      const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
      arrowMesh.position.copy(start);
      scene.add(arrowMesh);

      projectiles.push({
        mesh: arrowMesh,
        start: start,
        end: end,
        progress: -(i * 0.035),
        speed: 0.045,
        arcHeight: 5.6 + Math.random() * 1.4
      });
    }
  }

  /* 先登奇兵托盤突擊 */
  function performVanguardLeap(aToken, tToken) {
    const orig = new THREE.Vector3(aToken.origX, 0, aToken.origZ);
    const strikePos = tToken.mesh.position.clone().add(new THREE.Vector3(aToken.side === 'A' ? -1.8 : 1.8, 0, 0));

    let t = 0;
    function leap() {
      t++;
      if (t <= 12) {
        const p = t / 12;
        aToken.mesh.position.lerpVectors(orig, strikePos, p);
        aToken.mesh.position.y = Math.sin(p * Math.PI) * 1.2;
      } else if (t === 13) {
        spawnSparkBurst(strikePos, 18);
        screenShake(0.14);
      } else if (t <= 24) {
        const p = (t - 12) / 12;
        aToken.mesh.position.lerpVectors(strikePos, orig, p);
        aToken.mesh.position.y = 0;
      }
      if (t < 24) requestAnimationFrame(leap);
    }
    leap();
  }

  /* 軍師八卦圖法術光波 */
  function performStrategistTactic(aToken, tToken) {
    const ringGeo = new THREE.RingGeometry(0.3, 1.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(tToken.mesh.position);
    ring.position.y = 0.45;
    scene.add(ring);

    let scale = 1;
    function pulse() {
      scale += 0.16;
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
    const shieldDomeGeo = new THREE.SphereGeometry(1.8, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const shieldDomeMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    const dome = new THREE.Mesh(shieldDomeGeo, shieldDomeMat);
    dome.position.copy(tToken.mesh.position);
    dome.position.y = 0.2;
    scene.add(dome);

    setTimeout(() => {
      scene.remove(dome);
      dome.geometry.dispose();
      dome.material.dispose();
    }, 240);
  }

  /* 近身肉搏震動 */
  function performMeleeClash(aToken, tToken) {
    spawnSparkBurst(tToken.mesh.position, 12);
    if (tToken.billboardMesh) {
      tToken.billboardMesh.material.color.setHex(0xff3333);
      setTimeout(() => {
        if (tToken.billboardMesh) tToken.billboardMesh.material.color.setHex(0xffffff);
      }, 140);
    }
  }

  /* 戰損血條與兵力數即時過渡 */
  function updateTokenHp(token, newHp) {
    token.currentHp = Math.max(0, newHp);
    const pct = Math.max(0, token.currentHp / token.maxHp);
    token.hpFg.scale.x = pct;
    token.hpFg.position.x = -(1 - pct) * 0.78;

    if (pct < 0.25) token.hpFg.material.color.setHex(0xef4444);
    else if (pct < 0.6) token.hpFg.material.color.setHex(0xf59e0b);
    else token.hpFg.material.color.setHex(0x22c55e);

    // 刷新兵力文字
    if (token.hpTextCanvas && token.hpTextTex) {
      const tctx = token.hpTextCanvas.getContext('2d');
      tctx.clearRect(0, 0, 256, 64);
      tctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
      tctx.roundRect ? tctx.roundRect(4, 4, 248, 56, 12) : tctx.fillRect(4, 4, 248, 56);
      tctx.fill();
      tctx.strokeStyle = pct < 0.25 ? '#ef4444' : '#38bdf8';
      tctx.lineWidth = 2;
      tctx.stroke();

      tctx.fillStyle = pct < 0.25 ? '#ef4444' : '#ffffff';
      tctx.font = 'bold 28px sans-serif';
      tctx.textAlign = 'center';
      const troopCount = Math.max(0, Math.round(token.currentHp * 100)).toLocaleString();
      tctx.fillText(`兵力 ${troopCount}`, 128, 42);
      token.hpTextTex.needsUpdate = true;
    }
  }

  /* 名將陣亡潰散動畫 (部隊深沉沉降於沙盤泥土中，戰火黑煙升騰，絕非生硬側倒！) */
  function tokenFallDown(token) {
    token.alive = false;
    let step = 0;
    function sink() {
      step++;
      // 士兵與戰旗傾折，托盤下沉
      token.mesh.position.y -= 0.018;
      if (token.billboardMesh) {
        token.billboardMesh.rotation.z = (token.side === 'A' ? -0.015 : 0.015) * step;
      }
      if (token.mesh.position.y > -0.65) {
        requestAnimationFrame(sink);
      }
    }
    sink();
    spawnDustPuff(token.mesh.position, 0x1e293b);
  }

  /* ----------------------------------------------------
     名將絕技 Cut-in 水墨特寫條
     ---------------------------------------------------- */
  function injectCutinLayer() {
    if (document.getElementById('warlordCutinLayer')) return;
    const cutin = document.createElement('div');
    cutin.id = 'warlordCutinLayer';
    cutin.style.cssText = `
      position: absolute;
      top: 18%;
      left: 0;
      right: 0;
      height: 96px;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 100;
    `;
    cutin.innerHTML = `
      <div id="cutinInner" style="
        display: flex;
        align-items: center;
        gap: 16px;
        background: linear-gradient(90deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.95) 20%, rgba(15,23,42,0.95) 80%, rgba(15,23,42,0) 100%);
        padding: 8px 64px;
        border-top: 2px solid #fbbf24;
        border-bottom: 2px solid #fbbf24;
        box-shadow: 0 0 24px rgba(251, 191, 36, 0.5);
      ">
        <img id="cutinAvatar" src="" style="width: 72px; height: 72px; border-radius: 8px; border: 2px solid #fbbf24; object-fit: cover; box-shadow: 0 0 12px rgba(251,191,36,0.6);" />
        <div>
          <div id="cutinName" style="font-family: 'KaiTi', 'Noto Sans TC', serif; font-size: 28px; font-weight: 900; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.8);"></div>
          <div id="cutinTactic" style="font-family: sans-serif; font-size: 16px; font-weight: 700; color: #fbbf24; letter-spacing: 2px;"></div>
        </div>
      </div>
    `;
    if (container) container.appendChild(cutin);
  }

  function triggerWarlordCutin(token) {
    const cutin = document.getElementById('warlordCutinLayer');
    if (!cutin) return;

    const imgEl = document.getElementById('cutinAvatar');
    const nameEl = document.getElementById('cutinName');
    const tacEl = document.getElementById('cutinTactic');

    if (imgEl) imgEl.src = `assets/warlords/${token.id}.jpg?v=1.0.0`;
    if (nameEl) nameEl.textContent = `${token.name} · 全軍突擊！`;
    if (tacEl) tacEl.textContent = token.tag || '東亞名將專屬陣法奧義';

    cutin.style.opacity = '1';
    cutin.style.transform = 'translateY(0) scale(1)';

    if (cutinTimeout) clearTimeout(cutinTimeout);
    cutinTimeout = setTimeout(() => {
      cutin.style.opacity = '0';
      cutin.style.transform = 'translateY(-20px) scale(0.95)';
    }, 1400);
  }

  /* 粒子與震屏效果 */
  function spawnSparkBurst(pos, count = 12) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.04, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      scene.add(mesh);

      particleSystems.push({
        mesh: mesh,
        vx: (Math.random() - 0.5) * 0.28,
        vy: 0.15 + Math.random() * 0.22,
        vz: (Math.random() - 0.5) * 0.28,
        life: 20
      });
    }
  }

  function spawnDustPuff(pos, color = 0x94a3b8) {
    const geo = new THREE.SphereGeometry(0.24, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, 0.2, pos.z);
    scene.add(mesh);

    particleSystems.push({
      mesh: mesh,
      vx: (Math.random() - 0.5) * 0.04,
      vy: 0.03,
      vz: (Math.random() - 0.5) * 0.04,
      life: 22,
      scaleGrowth: 0.04
    });
  }

  function screenShake(intensity = 0.15) {
    const origTarget = CAM_TARGET.clone();
    let s = 0;
    function shake() {
      s++;
      CAM_TARGET.x = origTarget.x + (Math.random() - 0.5) * intensity;
      CAM_TARGET.y = origTarget.y + (Math.random() - 0.5) * intensity;
      updateCameraPosition();
      if (s < 7) {
        requestAnimationFrame(shake);
      } else {
        CAM_TARGET.copy(origTarget);
        updateCameraPosition();
      }
    }
    shake();
  }

  /* ----------------------------------------------------
     主動畫渲染循環
     ---------------------------------------------------- */
  function startAnimationLoop() {
    if (animFrameId) cancelAnimationFrame(animFrameId);

    let clock = 0;

    function animate() {
      animFrameId = requestAnimationFrame(animate);
      clock += 0.03;

      // 1. 烽火台火光躍動
      brazierLights.forEach(b => {
        b.light.intensity = b.baseIntensity + Math.sin(clock * 6 + b.light.position.x) * 0.45;
        if (b.fireMesh) {
          const s = 1.0 + Math.sin(clock * 8) * 0.18;
          b.fireMesh.scale.set(s, s * 1.3, s);
        }
      });

      // 2. 拋物線彈道更新
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.progress += p.speed;
        if (p.progress < 0) continue;

        if (p.progress >= 1.0) {
          spawnSparkBurst(p.end, 4);
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          projectiles.splice(i, 1);
        } else {
          p.mesh.position.lerpVectors(p.start, p.end, p.progress);
          p.mesh.position.y += Math.sin(p.progress * Math.PI) * p.arcHeight;
          const nextPos = p.start.clone().lerp(p.end, p.progress + 0.04);
          nextPos.y += Math.sin((p.progress + 0.04) * Math.PI) * p.arcHeight;
          p.mesh.lookAt(nextPos);
        }
      }

      // 3. 粒子運動與消退
      for (let i = particleSystems.length - 1; i >= 0; i--) {
        const pt = particleSystems[i];
        pt.mesh.position.x += pt.vx;
        pt.mesh.position.y += pt.vy;
        pt.mesh.position.z += pt.vz;
        pt.vy -= 0.012; // 重力

        if (pt.scaleGrowth) {
          pt.mesh.scale.addScalar(pt.scaleGrowth);
        }
        pt.life--;
        if (pt.mesh.material.opacity !== undefined) {
          pt.mesh.material.opacity = pt.life / 22;
        }

        if (pt.life <= 0) {
          scene.remove(pt.mesh);
          pt.mesh.geometry.dispose();
          pt.mesh.material.dispose();
          particleSystems.splice(i, 1);
        }
      }

      // 4. 太極八卦陣圖緩慢旋轉
      unitsMap.forEach(token => {
        if (token.troopsGroup && token.alive) {
          const bagua = token.troopsGroup.getObjectByName('baguaRuneRing');
          if (bagua) {
            bagua.rotation.z += 0.015;
          }
        }
      });

      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
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

def main():
    out_file = Path("D:/TopWarlords/js/battle-3d.js")
    out_file.write_text(CODE, encoding="utf-8")
    print(f"🎉 Successfully built Koei-style Unit Formation Plinths in {out_file}!")

if __name__ == "__main__":
    main()

