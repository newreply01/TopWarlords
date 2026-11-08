'use strict';
/* =====================================================
   TopWarlords 3D 古戰場推演引擎 (Three.js 輕量微縮戰棋沙盤)
   ===================================================== */

const Battle3DEngine = (function () {
  let isEnabled = true;
  let container = null;
  let scene, camera, renderer;
  let animFrameId = null;
  let isInitialized = false;

  // 戰場單位網格對象與狀態
  const unitsMap = new Map(); // uid -> { mesh, baseMesh, bannerMesh, hpBar, textSprite, side, cat, cost, x, y, z, targetX, targetZ }
  let projectiles = [];      // 飛行箭矢與投石火球
  let particleSystems = [];  // 爆燃、火花與揚塵粒子

  // 槽位陣列標準座標 (五大兵團微縮戰棋站位)
  // 藍方 (Side A) 在左 X < 0；紅方 (Side B) 在右 X > 0
  const SLOT_COORDS = {
    A: {
      armor:       { x: -5.0, z:  0.0 }, // 前軍中路：重甲陷陣
      naval:       { x: -5.5, z:  3.2 }, // 前軍左翼：先登奇兵
      air:         { x: -7.5, z: -3.5 }, // 後軍右翼：奔雷突騎 (待命衝鋒)
      air_defense: { x: -8.0, z:  2.8 }, // 後軍左翼：神射強弩 (遠程箭陣)
      support:     { x: -9.5, z:  0.0 }  // 中軍帥帳：軍師奇謀 (中樞壓陣)
    },
    B: {
      armor:       { x:  5.0, z:  0.0 },
      naval:       { x:  5.5, z: -3.2 },
      air:         { x:  7.5, z:  3.5 },
      air_defense: { x:  8.0, z: -2.8 },
      support:     { x:  9.5, z:  0.0 }
    }
  };

  const CAT_COLORS = {
    air:         0x38bdf8,
    armor:       0xfbbf24,
    air_defense: 0xa78bfa,
    naval:       0x22d3ee,
    support:     0x4ade80
  };

  function init(containerEl) {
    if (!containerEl || typeof THREE === 'undefined') return false;
    container = containerEl;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 420;

    // 1. 建立場景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1320);
    scene.fog = new THREE.FogExp2(0x0b1320, 0.025);

    // 2. 建立透視相機
    camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 18, 22);
    camera.lookAt(0, 0, 0);

    // 3. 建立渲染器 (支援抗鋸齒，鎖定最高效能)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. 光照系統 (古戰場晨曦微光 + 兩軍陣營主光源)
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(-15, 25, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.camera.left = -16;
    dirLight.shadow.camera.right = 16;
    dirLight.shadow.camera.top = 16;
    dirLight.shadow.camera.bottom = -16;
    scene.add(dirLight);

    // 5. 構建古代微縮戰棋沙盤台 (Battlefield Diorama Table)
    createSandTable();

    // 6. 視窗尺寸監聽自適應
    window.addEventListener('resize', onWindowResize);

    isInitialized = true;
    startAnimationLoop();
    return true;
  }

  /* 構建 3D 地形與木質推演沙盤台 */
  function createSandTable() {
    // 外圍厚重黑胡桃木沙盤邊框
    const tableGeo = new THREE.BoxGeometry(26, 1.5, 16);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x1e150e, roughness: 0.8, metalness: 0.1 });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.y = -0.85;
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

    // 金屬銅條鑲邊
    const edgeGeo = new THREE.BoxGeometry(26.2, 0.1, 16.2);
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4, metalness: 0.8 });
    const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
    edgeMesh.position.y = -0.05;
    scene.add(edgeMesh);

    // 地表平原沙盤 (具備水墨山石地紋)
    const groundGeo = new THREE.PlaneGeometry(25.6, 15.6, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a2634,
      roughness: 0.9,
      metalness: 0.05
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 楚河漢界 / 中央分界陣線暗紋
    const gridHelper = new THREE.GridHelper(24, 24, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // 兩軍陣地楚河漢界分界線
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.02, -7.5),
      new THREE.Vector3(0, 0.02, 7.5)
    ]);
    const lineMat = new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: 0.6, gapSize: 0.4, linewidth: 2 });
    const centerLine = new THREE.Line(lineGeo, lineMat);
    centerLine.computeLineDistances();
    scene.add(centerLine);
  }

  /* 建立名將 3D 微縮戰棋標記 (Cylinder Base + 雙面精美立繪看板) */
  function createUnitToken(unit, side, slotIndex) {
    const group = new THREE.Group();
    const cat = unit.cat || 'armor';
    const coords = (SLOT_COORDS[side] && SLOT_COORDS[side][cat]) || { x: (side === 'A' ? -6 : 6), z: 0 };
    
    // 1. 圓形微縮戰棋底座 (帶陣營青銅/琉璃金邊)
    const baseColor = side === 'A' ? 0x0284c7 : 0xd97706;
    const ringColor = CAT_COLORS[cat] || 0xffffff;

    const baseGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.35, 24);
    const baseMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.3, metalness: 0.7 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // 兵團專屬發光底環
    const ringGeo = new THREE.TorusGeometry(0.88, 0.06, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: ringColor });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.16;
    group.add(ringMesh);

    // 2. 名將水墨立牌 (3D Billboard 立體旗牌)
    const bannerGeo = new THREE.BoxGeometry(1.3, 1.7, 0.08);
    
    // 繪製名將 Canvas 紋理
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 340;
    const ctx = canvas.getContext('2d');
    
    // 陣營水墨底色
    ctx.fillStyle = side === 'A' ? '#071728' : '#261208';
    ctx.fillRect(0, 0, 256, 340);
    ctx.strokeStyle = side === 'A' ? '#38bdf8' : '#f59e0b';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 248, 332);

    // 國別旗幟與兵種
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`${unit.flag || ''} $${unit.cost}`, 20, 42);

    // 名將大字題名 (水墨古典風)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(unit.name || '歷史名將', 128, 140);

    // 職位／標籤
    ctx.fillStyle = side === 'A' ? '#38bdf8' : '#fbbf24';
    ctx.font = '600 22px sans-serif';
    ctx.fillText(unit.tag || cat, 128, 195);

    // 主力兵器
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px sans-serif';
    const weaponShort = (unit.weapon || '').split(' ')[0].slice(0, 8);
    ctx.fillText(`⚔️ ${weaponShort}`, 128, 245);

    // 生成 Three.js 紋理
    const texture = new THREE.CanvasTexture(canvas);
    const bannerMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.4,
      metalness: 0.1
    });
    const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
    bannerMesh.position.y = 1.05;
    bannerMesh.castShadow = true;
    group.add(bannerMesh);

    // 3. 頂部即時 3D 血條 (綠/黃/紅動態比例)
    const hpBgGeo = new THREE.BoxGeometry(1.4, 0.14, 0.04);
    const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
    hpBg.position.y = 2.05;
    group.add(hpBg);

    const hpFgGeo = new THREE.BoxGeometry(1.36, 0.10, 0.06);
    const hpFgMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const hpFg = new THREE.Mesh(hpFgGeo, hpFgMat);
    hpFg.position.y = 2.05;
    group.add(hpFg);

    // 設定初始座標
    group.position.set(coords.x, 0.18, coords.z);
    scene.add(group);

    return {
      uid: unit.uid,
      id: unit.id,
      side: side,
      cat: cat,
      mesh: group,
      bannerMesh: bannerMesh,
      hpFg: hpFg,
      origX: coords.x,
      origZ: coords.z,
      currentHp: unit.hp,
      maxHp: unit.hpMax || unit.hp,
      alive: true
    };
  }

  /* 戰局開始：載入雙方陣容並於 3D 沙盤列陣布子 */
  function loadBattle(res) {
    if (!isInitialized) return;

    // 清理舊戰局棋子與粒子
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

    // 調整戰場相機：初始宏觀沙盤全覽
    resetCamera();
  }

  /* 執行動畫事件（支援萬箭齊發、騎兵衝鋒、近身死鬥與擊殺擊退） */
  function playEvent(ln) {
    if (!isInitialized || !isEnabled) return;

    const aToken = ln.auid ? unitsMap.get(ln.auid) : null;
    const tToken = ln.tuid ? unitsMap.get(ln.tuid) : null;

    if (!aToken && !tToken) return;

    // 1. 神射萬箭齊發（3D 拋物線金色箭雨粒子群）
    if (aToken && tToken && (aToken.cat === 'air_defense' || (ln.text && ln.text.includes('箭')))) {
      spawnArrowVolley(aToken.mesh.position, tToken.mesh.position, aToken.side);
    }
    // 2. 突騎奔雷衝鋒（棋子位移撞擊敵陣）
    else if (aToken && tToken && aToken.cat === 'air') {
      performCavalryCharge(aToken, tToken);
    }
    // 3. 先登夜襲／鬥將搏殺（近身跳躍暴擊）
    else if (aToken && tToken && aToken.cat === 'naval') {
      performAmbushStrike(aToken, tToken);
    }
    // 4. 重甲中軍正面肉搏（震動與刀光衝擊）
    else if (aToken && tToken) {
      performMeleeClash(aToken, tToken);
    }

    // 更新目標受擊血條與擊退
    if (tToken && ln.hpAfter !== undefined) {
      updateTokenHp(tToken, ln.hpAfter);
    }

    // 陣亡倒下動畫
    if (ln.kind === 'kill' && tToken) {
      tokenFallDown(tToken);
    }
  }

  /* 3D 拋物線萬箭齊發 */
  function spawnArrowVolley(fromPos, toPos, side) {
    const arrowCount = 12;
    for (let i = 0; i < arrowCount; i++) {
      const spreadX = (Math.random() - 0.5) * 1.2;
      const spreadZ = (Math.random() - 0.5) * 1.2;
      const start = fromPos.clone().add(new THREE.Vector3(spreadX, 1.2, spreadZ));
      const end = toPos.clone().add(new THREE.Vector3(spreadX * 0.8, 0.4, spreadZ * 0.8));

      // 箭身網格
      const arrowGeo = new THREE.CylinderGeometry(0.02, 0.04, 0.5, 6);
      const arrowMat = new THREE.MeshBasicMaterial({ color: side === 'A' ? 0x38bdf8 : 0xf59e0b });
      const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
      arrowMesh.position.copy(start);
      scene.add(arrowMesh);

      projectiles.push({
        mesh: arrowMesh,
        start: start,
        end: end,
        progress: - (i * 0.05), // 依序發射營造層次感
        speed: 0.045,
        arcHeight: 4.5 + Math.random() * 1.5,
        isArrow: true
      });
    }
  }

  /* 奔雷突騎 3D 高速突刺與返回 */
  function performCavalryCharge(aToken, tToken) {
    const orig = new THREE.Vector3(aToken.origX, 0.18, aToken.origZ);
    const target = tToken.mesh.position.clone();
    // 突擊至目標前方 1.2 單位處
    const dir = target.clone().sub(orig).normalize();
    const chargePos = target.clone().sub(dir.multiplyScalar(1.2));

    let t = 0;
    const duration = 28; // 影格數
    function step() {
      t++;
      if (t <= 14) {
        // 衝鋒滑行
        const p = t / 14;
        aToken.mesh.position.lerpVectors(orig, chargePos, p);
        aToken.mesh.position.y = 0.18 + Math.sin(p * Math.PI) * 0.5;
      } else if (t === 15) {
        // 碰撞火花與相機微震
        spawnSparkBurst(chargePos);
        screenShake(0.12);
      } else if (t <= duration) {
        // 返回陣列
        const p = (t - 14) / 14;
        aToken.mesh.position.lerpVectors(chargePos, orig, p);
        aToken.mesh.position.y = 0.18;
      }
      if (t < duration) {
        requestAnimationFrame(step);
      }
    }
    step();
  }

  /* 先登奇兵一番槍跳躍突擊 */
  function performAmbushStrike(aToken, tToken) {
    const orig = new THREE.Vector3(aToken.origX, 0.18, aToken.origZ);
    const strikePos = tToken.mesh.position.clone().add(new THREE.Vector3(aToken.side === 'A' ? -1.0 : 1.0, 0, 0));

    let t = 0;
    function jump() {
      t++;
      if (t <= 10) {
        const p = t / 10;
        aToken.mesh.position.lerpVectors(orig, strikePos, p);
        aToken.mesh.position.y = 0.18 + Math.sin(p * Math.PI) * 1.2; // 高空騰躍跳蕩
      } else if (t <= 20) {
        const p = (t - 10) / 10;
        aToken.mesh.position.lerpVectors(strikePos, orig, p);
        aToken.mesh.position.y = 0.18;
      }
      if (t < 20) requestAnimationFrame(jump);
    }
    jump();
  }

  /* 重甲短兵相接震盪 */
  function performMeleeClash(aToken, tToken) {
    // 目標震動閃紅
    if (tToken.bannerMesh) {
      tToken.bannerMesh.material.color.setHex(0xff3333);
      setTimeout(() => {
        if (tToken.bannerMesh) tToken.bannerMesh.material.color.setHex(0xffffff);
      }, 140);
    }
    spawnSparkBurst(tToken.mesh.position);
  }

  /* 戰棋受損與即時更新血條 */
  function updateTokenHp(token, newHp) {
    token.currentHp = Math.max(0, newHp);
    const pct = Math.max(0, token.currentHp / token.maxHp);
    token.hpFg.scale.x = pct;
    token.hpFg.position.x = - (1 - pct) * 0.68;

    // 顏色過渡：綠 -> 黃 -> 紅
    if (pct < 0.25) token.hpFg.material.color.setHex(0xef4444);
    else if (pct < 0.6) token.hpFg.material.color.setHex(0xf59e0b);
    else token.hpFg.material.color.setHex(0x22c55e);
  }

  /* 擊殺倒下動畫 (傾斜並沉入地面) */
  function tokenFallDown(token) {
    token.alive = false;
    let r = 0;
    function tilt() {
      r += 0.08;
      token.mesh.rotation.z = token.side === 'A' ? -r : r;
      token.mesh.position.y -= 0.02;
      if (r < Math.PI / 2.2) {
        requestAnimationFrame(tilt);
      }
    }
    tilt();
  }

  /* 碰撞金鐵火花粒子 */
  function spawnSparkBurst(pos) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const sparkGeo = new THREE.SphereGeometry(0.06, 4, 4);
      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.position.copy(pos).add(new THREE.Vector3(0, 1.0, 0));
      scene.add(spark);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        Math.random() * 0.2 + 0.1,
        (Math.random() - 0.5) * 0.2
      );

      particleSystems.push({ mesh: spark, vel: vel, life: 14 });
    }
  }

  /* 畫面微震 */
  function screenShake(intensity) {
    if (!camera) return;
    camera.position.x += (Math.random() - 0.5) * intensity;
    camera.position.y += (Math.random() - 0.5) * intensity;
    setTimeout(resetCamera, 80);
  }

  function resetCamera() {
    if (!camera) return;
    camera.position.set(0, 18, 22);
    camera.lookAt(0, 0, 0);
  }

  /* 主動畫循環 (Render Loop) */
  function startAnimationLoop() {
    function animate() {
      animFrameId = requestAnimationFrame(animate);

      // 1. 更新飛行箭矢
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.progress += p.speed;
        if (p.progress >= 0 && p.progress <= 1) {
          p.mesh.position.lerpVectors(p.start, p.end, p.progress);
          // 加上拋物線高度
          p.mesh.position.y = p.start.y + Math.sin(p.progress * Math.PI) * p.arcHeight;
          // 箭頭朝向切線
          p.mesh.lookAt(p.end.x, p.end.y + Math.sin((p.progress + 0.05) * Math.PI) * p.arcHeight, p.end.z);
        } else if (p.progress > 1) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          projectiles.splice(i, 1);
        }
      }

      // 2. 更新火花粒子
      for (let i = particleSystems.length - 1; i >= 0; i--) {
        const pt = particleSystems[i];
        pt.mesh.position.add(pt.vel);
        pt.vel.y -= 0.015; // 重力墜落
        pt.life--;
        if (pt.life <= 0) {
          scene.remove(pt.mesh);
          pt.mesh.geometry.dispose();
          pt.mesh.material.dispose();
          particleSystems.splice(i, 1);
        }
      }

      // 3. 名將立牌微浮動動畫
      unitsMap.forEach(token => {
        if (token.alive && token.mesh) {
          token.bannerMesh.rotation.y = Math.sin(Date.now() * 0.002 + token.origX) * 0.08;
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

