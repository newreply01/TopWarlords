'use strict';
/* =====================================================
   3D 古戰場程序化貼圖、技能特效配色與靜態幾何合併 (TopWarlords)
   自 battle-3d.js 抽出：僅依賴 THREE 與 Canvas 2D，不讀寫 Battle3DEngine 內部戰況狀態。
   各貼圖於模組內快取，整場遊戲共用（與原本行為相同）。
   ===================================================== */
const Battle3DTextures = (function () {
  let campPennantTex = null;
  let dustTexture = null;
  let bannerTexCache = new Map();
  let baguaTexCache = new Map();
  let scarBurnTex = null;
  let scarMudTex = null;
  const vfxTexCache = new Map(); // 技能特效貼圖快取（戰法卷軸於 battle-3d.js 另有自己的快取）

  const VFX_PALETTES = {
    fire_storm:      { primary: '#f97316', accent: '#fde047', dark: '#7c2d12', border: '#ef4444' },
    thunder_strike:  { primary: '#38bdf8', accent: '#e0f2fe', dark: '#0c4a6e', border: '#0284c7' },
    bagua_array:     { primary: '#f59e0b', accent: '#fef3c7', dark: '#78350f', border: '#d97706' },
    overlord_cleave: { primary: '#e11d48', accent: '#fbbf24', dark: '#4c0519', border: '#f43f5e' },
    piercing_volley: { primary: '#fbbf24', accent: '#fef08a', dark: '#713f12', border: '#d97706' },
    tidal_surge:     { primary: '#06b6d4', accent: '#ecfeff', dark: '#083344', border: '#0284c7' },
    aegis_command:   { primary: '#10b981', accent: '#fef3c7', dark: '#064e3b', border: '#d97706' },
    shadow_ambush:   { primary: '#a855f7', accent: '#f3e8ff', dark: '#3b0764', border: '#9333ea' }
  };

  /* ---------- 天空、河流、地表與營寨旗幟貼圖 ---------- */
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

  /* ---------- Canvas 圓角路徑（名將圓徽與銘牌共用） ---------- */
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

  function getSkillVfxTexture(kind) {
    if (vfxTexCache.has(kind)) return vfxTexCache.get(kind);
    const isTall = kind === 'talisman_scroll' || kind === 'meteor_fireball' || kind === 'dragon_arrow';
    const c = document.createElement('canvas');
    c.width = isTall ? 256 : 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    const W = c.width;
    const H = c.height;
    const cx = W / 2;
    const cy = H / 2;

    if (kind === 'bagua_seal') {
      const bg = ctx.createRadialGradient(cx, cy, 40, cx, cy, 248);
      bg.addColorStop(0, 'rgba(15, 12, 8, 0.72)');
      bg.addColorStop(0.76, 'rgba(38, 24, 10, 0.58)');
      bg.addColorStop(1, 'rgba(15, 12, 8, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      [234, 212, 146, 84].forEach((r, idx) => {
        ctx.strokeStyle = idx % 2 === 0 ? '#fbbf24' : '#d97706';
        ctx.lineWidth = idx === 0 ? 7 : 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12;
        ctx.strokeStyle = i % 3 === 0 ? '#fde68a' : 'rgba(251, 191, 36, 0.65)';
        ctx.lineWidth = i % 3 === 0 ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 212, cy + Math.sin(a) * 212);
        ctx.lineTo(cx + Math.cos(a) * 234, cy + Math.sin(a) * 234);
        ctx.stroke();
      }
      const trigrams = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];
      const gates = ['開', '休', '生', '傷', '杜', '景', '死', '驚'];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * 180, cy + Math.sin(a) * 180);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 34px "Noto Serif TC", serif';
        ctx.fillText(trigrams[i], 0, 0);
        ctx.restore();

        ctx.save();
        ctx.translate(cx + Math.cos(a) * 116, cy + Math.sin(a) * 116);
        ctx.fillStyle = 'rgba(28, 19, 10, 0.92)';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.font = '900 24px "Noto Serif TC", serif';
        ctx.fillText(gates[i], 0, 1);
        ctx.restore();
      }
      // 陰陽雙魚太極圖
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.arc(0, 0, 74, -Math.PI / 2, Math.PI / 2);
      ctx.arc(0, 37, 37, Math.PI / 2, -Math.PI / 2, true);
      ctx.arc(0, -37, 37, Math.PI / 2, -Math.PI / 2, false);
      ctx.fillStyle = '#fef3c7';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 74, Math.PI / 2, -Math.PI / 2);
      ctx.arc(0, -37, 37, -Math.PI / 2, Math.PI / 2, true);
      ctx.arc(0, 37, 37, -Math.PI / 2, Math.PI / 2, false);
      ctx.fillStyle = '#1c1917';
      ctx.fill();
      ctx.fillStyle = '#1c1917';
      ctx.beginPath(); ctx.arc(0, -37, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath(); ctx.arc(0, 37, 11, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (kind === 'talisman_scroll') {
      ctx.fillStyle = 'rgba(24, 15, 6, 0.92)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(cx, 18);
      ctx.lineTo(W - 26, 68);
      ctx.lineTo(W - 26, H - 52);
      ctx.lineTo(cx, H - 16);
      ctx.lineTo(26, H - 52);
      ctx.lineTo(26, 68);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 3;
      ctx.strokeRect(42, 82, W - 84, H - 154);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde047';
      ctx.font = '900 54px "Noto Serif TC", serif';
      ['奇', '門', '八', '陣', '敕'].forEach((ch, idx) => {
        ctx.fillText(ch, cx, 146 + idx * 72);
      });
    } else if (kind === 'fire_lotus') {
      const bg = ctx.createRadialGradient(cx, cy, 30, cx, cy, 246);
      bg.addColorStop(0, 'rgba(124, 45, 18, 0.85)');
      bg.addColorStop(0.65, 'rgba(69, 10, 10, 0.65)');
      bg.addColorStop(1, 'rgba(20, 5, 5, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 12; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((i * Math.PI) / 6);
        const grad = ctx.createLinearGradient(0, 40, 0, 236);
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(0.45, '#f97316');
        grad.addColorStop(1, 'rgba(220, 38, 38, 0.1)');
        ctx.fillStyle = grad;
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 38);
        ctx.quadraticCurveTo(44, 130, 0, 238);
        ctx.quadraticCurveTo(-44, 130, 0, 38);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(cx, cy, 128, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 62, 0, Math.PI * 2); ctx.stroke();
    } else if (kind === 'flame_tongue') {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, H - 24);
      ctx.bezierCurveTo(60, H - 80, 74, 210, 188, 120);
      ctx.quadraticCurveTo(212, 190, 250, 26);
      ctx.quadraticCurveTo(318, 175, 344, 110);
      ctx.bezierCurveTo(445, 220, 442, H - 78, cx, H - 24);
      ctx.closePath();
      const g1 = ctx.createLinearGradient(0, 24, 0, H - 24);
      g1.addColorStop(0, '#facc15');
      g1.addColorStop(0.42, '#ea580c');
      g1.addColorStop(0.85, '#b91c1c');
      g1.addColorStop(1, 'rgba(69, 10, 10, 0)');
      ctx.fillStyle = g1;
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(42, 10, 10, 0.85)';
      ctx.stroke();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, H - 38);
      ctx.bezierCurveTo(150, H - 90, 175, 260, cx, 132);
      ctx.bezierCurveTo(335, 260, 362, H - 90, cx, H - 38);
      ctx.fillStyle = '#fef08a';
      ctx.fill();
      ctx.restore();
    } else if (kind === 'meteor_fireball') {
      const tail = ctx.createLinearGradient(cx, 24, cx, H - 40);
      tail.addColorStop(0, 'rgba(127, 29, 29, 0)');
      tail.addColorStop(0.45, 'rgba(234, 88, 12, 0.72)');
      tail.addColorStop(0.85, '#fbbf24');
      tail.addColorStop(1, '#ffffff');
      ctx.fillStyle = tail;
      ctx.beginPath();
      ctx.moveTo(cx, 20);
      ctx.quadraticCurveTo(cx + 88, 280, cx + 64, H - 88);
      ctx.arc(cx, H - 92, 64, 0, Math.PI);
      ctx.quadraticCurveTo(cx - 88, 280, cx, 20);
      ctx.fill();
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.arc(cx, H - 94, 34, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'lightning_bolt') {
      const pts = [
        [244, 14], [286, 98], [218, 176], [292, 248],
        [204, 336], [278, 412], [238, 496]
      ];
      const forks = [
        [[218, 176], [122, 248], [86, 314]],
        [[292, 248], [392, 324], [428, 396]],
        [[204, 336], [134, 416]]
      ];
      const strokePath = (coords, width, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        coords.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
      };
      strokePath(pts, 56, 'rgba(12, 74, 110, 0.75)');
      forks.forEach(f => strokePath(f, 34, 'rgba(12, 74, 110, 0.7)'));
      strokePath(pts, 32, '#0284c7');
      forks.forEach(f => strokePath(f, 18, '#0284c7'));
      strokePath(pts, 18, '#38bdf8');
      forks.forEach(f => strokePath(f, 9, '#7dd3fc'));
      strokePath(pts, 7, '#ffffff');
      forks.forEach(f => strokePath(f, 3.5, '#ffffff'));
    } else if (kind === 'thunder_seal') {
      const bg = ctx.createRadialGradient(cx, cy, 30, cx, cy, 246);
      bg.addColorStop(0, 'rgba(12, 74, 110, 0.85)');
      bg.addColorStop(0.7, 'rgba(15, 23, 42, 0.72)');
      bg.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      [230, 194, 118].forEach((r, idx) => {
        ctx.strokeStyle = idx === 1 ? '#e0f2fe' : '#38bdf8';
        ctx.lineWidth = idx === 0 ? 7 : 4;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 6;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r1 = 68, r2 = 152, r3 = 224;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a + 0.14) * r2, cy + Math.sin(a + 0.14) * r2);
        ctx.lineTo(cx + Math.cos(a - 0.04) * r3, cy + Math.sin(a - 0.04) * r3);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx + 22, cy - 72); ctx.lineTo(cx - 32, cy + 8); ctx.lineTo(cx + 8, cy + 8);
      ctx.lineTo(cx - 22, cy + 76); ctx.lineTo(cx + 38, cy - 10); ctx.lineTo(cx - 2, cy - 10);
      ctx.closePath(); ctx.fill();
    } else if (kind === 'crescent_wave') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy + 44, 212, Math.PI * 1.12, Math.PI * 1.88, false);
      ctx.arc(cx, cy + 126, 206, Math.PI * 1.82, Math.PI * 1.18, true);
      ctx.closePath();
      const grad = ctx.createRadialGradient(cx, cy, 80, cx, cy, 240);
      grad.addColorStop(0, '#9f1239');
      grad.addColorStop(0.55, '#e11d48');
      grad.addColorStop(0.85, '#fbbf24');
      grad.addColorStop(1, '#ffffff');
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(24, 6, 12, 0.88)';
      ctx.stroke();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#fffbeb';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy + 44, 206, Math.PI * 1.18, Math.PI * 1.82, false);
      ctx.stroke();
      ctx.restore();
    } else if (kind === 'earth_fissure') {
      const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 244);
      bg.addColorStop(0, 'rgba(28, 25, 23, 0.82)');
      bg.addColorStop(0.75, 'rgba(28, 25, 23, 0.45)');
      bg.addColorStop(1, 'rgba(28, 25, 23, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) {
        const a = (i * Math.PI * 2) / 9 + 0.15;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(14, -7);
        ctx.lineTo(108, -14);
        ctx.lineTo(175, 5);
        ctx.lineTo(234, 0);
        ctx.lineTo(165, 18);
        ctx.lineTo(96, 8);
        ctx.lineTo(14, 12);
        ctx.closePath();
        ctx.fillStyle = '#0c0a09';
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(cx, cy, 74, 0, Math.PI * 2); ctx.stroke();
    } else if (kind === 'dragon_arrow') {
      const glow = ctx.createLinearGradient(cx, 12, cx, H - 18);
      glow.addColorStop(0, '#fef08a');
      glow.addColorStop(0.5, 'rgba(245, 158, 11, 0.72)');
      glow.addColorStop(1, 'rgba(217, 119, 6, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 28, 60, 56, H - 80);
      // 鋒利黃金大箭鏃
      ctx.fillStyle = '#fffbeb';
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx, 14);
      ctx.lineTo(cx + 58, 134);
      ctx.lineTo(cx + 16, 112);
      ctx.lineTo(cx + 14, H - 70);
      ctx.lineTo(cx - 14, H - 70);
      ctx.lineTo(cx - 16, 112);
      ctx.lineTo(cx - 58, 134);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 纏繞金龍風環與尾羽
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 7;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(cx, 180 + k * 70, 56 - k * 6, 16, 0.25 * (k % 2 ? 1 : -1), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(cx - 12, H - 108); ctx.lineTo(cx - 46, H - 24); ctx.lineTo(cx - 10, H - 48);
      ctx.lineTo(cx + 10, H - 48); ctx.lineTo(cx + 46, H - 24); ctx.lineTo(cx + 12, H - 108);
      ctx.closePath(); ctx.fill();
    } else if (kind === 'bullseye_seal') {
      const bg = ctx.createRadialGradient(cx, cy, 24, cx, cy, 244);
      bg.addColorStop(0, 'rgba(69, 26, 3, 0.84)');
      bg.addColorStop(0.76, 'rgba(69, 26, 3, 0.45)');
      bg.addColorStop(1, 'rgba(69, 26, 3, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      [226, 160, 88].forEach((r, idx) => {
        ctx.strokeStyle = idx === 1 ? '#fde047' : '#f59e0b';
        ctx.lineWidth = idx === 0 ? 8 : 5;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      });
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(106, 0); ctx.lineTo(192, -16); ctx.lineTo(176, 0); ctx.lineTo(192, 16);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    } else if (kind === 'great_wave') {
      ctx.save();
      const grad = ctx.createLinearGradient(0, 60, 0, H - 20);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.45, '#0284c7');
      grad.addColorStop(1, 'rgba(12, 74, 110, 0.08)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(32, H - 24);
      ctx.bezierCurveTo(60, 140, 190, 48, 332, 92);
      ctx.bezierCurveTo(230, 134, 248, 224, 386, 206);
      ctx.bezierCurveTo(458, 248, 474, 390, 466, H - 24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 浮世繪浪花爪
      ctx.fillStyle = '#f8fafc';
      for (let k = 0; k < 6; k++) {
        const ang = -0.35 + k * 0.24;
        const px = 290 + Math.cos(ang) * 95;
        const py = 112 + Math.sin(ang) * 78;
        ctx.beginPath(); ctx.arc(px, py, 20 - k * 1.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(76, 380); ctx.quadraticCurveTo(180, 190, 310, 250); ctx.stroke();
      ctx.restore();
    } else if (kind === 'whirlpool_seal') {
      const bg = ctx.createRadialGradient(cx, cy, 18, cx, cy, 244);
      bg.addColorStop(0, 'rgba(8, 51, 68, 0.92)');
      bg.addColorStop(0.75, 'rgba(2, 132, 199, 0.42)');
      bg.addColorStop(1, 'rgba(2, 132, 199, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      for (let arm = 0; arm < 5; arm++) {
        ctx.strokeStyle = arm % 2 === 0 ? '#38bdf8' : '#e0f2fe';
        ctx.lineWidth = arm % 2 === 0 ? 12 : 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const base = (arm * Math.PI * 2) / 5;
        for (let t = 0; t <= 40; t++) {
          const r = 24 + t * 5.2;
          const a = base + t * 0.14;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          if (t === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    } else if (kind === 'bronze_shield') {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, 28);
      ctx.lineTo(W - 58, 92);
      ctx.lineTo(W - 44, 304);
      ctx.lineTo(cx, H - 28);
      ctx.lineTo(44, 304);
      ctx.lineTo(58, 92);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 28, 0, H - 28);
      grad.addColorStop(0, '#92400e');
      grad.addColorStop(0.5, '#451a03');
      grad.addColorStop(1, '#1c1917');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#fbbf24';
      ctx.stroke();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#34d399';
      ctx.beginPath(); ctx.arc(cx, cy - 8, 128, 0, Math.PI * 2); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde68a';
      ctx.font = '900 132px "Noto Serif TC", serif';
      ctx.fillText('禦', cx, cy + 4);
      ctx.restore();
    } else if (kind === 'aegis_seal') {
      const bg = ctx.createRadialGradient(cx, cy, 24, cx, cy, 244);
      bg.addColorStop(0, 'rgba(6, 78, 59, 0.85)');
      bg.addColorStop(0.75, 'rgba(20, 83, 45, 0.45)');
      bg.addColorStop(1, 'rgba(6, 78, 59, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      [228, 182, 108].forEach((r, idx) => {
        ctx.strokeStyle = idx === 1 ? '#fbbf24' : '#34d399';
        ctx.lineWidth = idx === 0 ? 8 : 5;
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) {
          const a = (k * Math.PI) / 4;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      });
    } else if (kind === 'shadow_cross') {
      const drawBlade = (angle) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        const grad = ctx.createLinearGradient(-230, 0, 230, 0);
        grad.addColorStop(0, 'rgba(88, 28, 135, 0)');
        grad.addColorStop(0.2, '#7e22ce');
        grad.addColorStop(0.5, '#f5d0fe');
        grad.addColorStop(0.8, '#7e22ce');
        grad.addColorStop(1, 'rgba(88, 28, 135, 0)');
        ctx.fillStyle = grad;
        ctx.strokeStyle = 'rgba(15, 7, 32, 0.92)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-234, 0);
        ctx.quadraticCurveTo(0, -46, 234, 0);
        ctx.quadraticCurveTo(0, 46, -234, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-185, 0); ctx.quadraticCurveTo(0, -14, 185, 0);
        ctx.quadraticCurveTo(0, 14, -185, 0);
        ctx.fill();
        ctx.restore();
      };
      drawBlade(0.72);
      drawBlade(-0.72);
    } else {
      // shuriken_seal
      const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 244);
      bg.addColorStop(0, 'rgba(59, 7, 100, 0.86)');
      bg.addColorStop(0.75, 'rgba(15, 7, 32, 0.56)');
      bg.addColorStop(1, 'rgba(15, 7, 32, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(cx, cy, 210, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const tipX = cx + Math.cos(a) * 218;
        const tipY = cy + Math.sin(a) * 218;
        const midX = cx + Math.cos(a + Math.PI / 4) * 58;
        const midY = cy + Math.sin(a + Math.PI / 4) * 58;
        if (i === 0) ctx.moveTo(tipX, tipY); else ctx.lineTo(tipX, tipY);
        ctx.lineTo(midX, midY);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    vfxTexCache.set(kind, tex);
    return tex;
  }

  function getBaguaTexture(colorHex = '#fbbf24') {
    const key = colorHex;
    if (baguaTexCache.has(key)) return baguaTexCache.get(key);
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
    baguaTexCache.set(key, tex);
    return tex;
  }

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

  return {
    VFX_PALETTES, createSkyBackdropTexture, createRiverTexture, createTerrainTexture, mergeStaticGeos,
    createCampPennantTexture, getBannerTexture, roundRectPath, getSkillVfxTexture, getBaguaTexture,
    getScarTexture, ensureDustTexture
  };
})();

if (typeof window !== 'undefined') {
  window.Battle3DTextures = Battle3DTextures;
}
