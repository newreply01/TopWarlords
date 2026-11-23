'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 (TopWarlords)
   Phase 5：其餘 75 位（$1～$3）武將專屬 3D 特效
   ===================================================== */
(function () {
  if (typeof window === 'undefined' || !window.MusouVfx) return;
  const V = window.MusouVfx;
  const reg = (k, fn) => V.registerSignature(k, fn);
  const later = (fn, ms) => (V.schedule ? V.schedule(ms, fn) : setTimeout(fn, ms));

  const glyphCache = new Map();
  function getGlyphTex(text, color = '#fbbf24') {
    const key = `${text}|${color}`;
    if (glyphCache.has(key)) return glyphCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 128, 106, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `900 ${text.length >= 2 ? 86 : 114}px "Noto Serif TC", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillText(text, 128, 134);
    const tex = new THREE.CanvasTexture(c);
    glyphCache.set(key, tex);
    return tex;
  }

  function beat(ctx, delay = 200, shake = 0.24, sfx = 'blade_clash') {
    later(() => {
      ctx.triggerHitStop?.(60);
      ctx.triggerCameraShake?.(shake);
      ctx.playFieldSound?.(sfx, ctx.target, 0.65);
    }, delay);
  }

  // 共用組合器，確保每隻都有鮮明差異且不重複
  function registerCustom(sig, spec) {
    reg(sig, ctx => {
      const { scene, casterPos, targetPos, groundY, addTexPlane } = ctx;
      const hit = targetPos.clone().add(new THREE.Vector3(0, 1.0, 0));

      if (spec.glyph) {
        V.spawnGroundDecal(scene, targetPos, getGlyphTex(spec.glyph, spec.hexStr || '#fbbf24'), spec.glyphSize || 4.4, 1100);
      }
      if (spec.seal) {
        addTexPlane(spec.seal, 4.8, 4.8, new THREE.Vector3(targetPos.x, groundY + 0.12, targetPos.z), {
          rotateX: -Math.PI / 2, spinZ: spec.spin || 1.6, duration: 1050, renderOrder: 22, additive: true
        });
      }
      if (spec.pillar) {
        V.spawnPillar(scene, targetPos, spec.pillar, spec.pillarH || 5.2, 680);
      }
      if (spec.ribbons) {
        const n = spec.ribbons;
        for (let i = 0; i < n; i++) {
          later(() => {
            const oz = (i - (n - 1) / 2) * 0.7;
            const p0 = spec.fromSky
              ? targetPos.clone().add(new THREE.Vector3(-1.2 + i * 0.5, 6.0, oz))
              : casterPos.clone().add(new THREE.Vector3(0, 1.3, oz));
            V.spawnRibbonTrail(scene, [p0, hit.clone().add(new THREE.Vector3(0, 0, oz * 0.4))], spec.color, 0.24, 480);
          }, i * 75);
        }
      }
      if (spec.slashes) {
        for (let i = 0; i < spec.slashes; i++) {
          later(() => {
            V.spawnSlashArc(scene, targetPos, i % 2 === 0 ? 1 : -1, i === 0 ? spec.color : (spec.accent || spec.color), 2.5 + i * 0.35, 400);
          }, i * 95);
        }
      }
      if (spec.rings) {
        for (let i = 0; i < spec.rings; i++) {
          later(() => {
            V.spawnShockRing(scene, targetPos, i % 2 === 0 ? spec.color : (spec.accent || spec.color), 2.8 + i * 0.75, 580);
          }, i * 100);
        }
      }
      later(() => {
        V.createGpuBurst({
          scene,
          origin: hit,
          count: spec.particles || 460,
          color: spec.accent || spec.color,
          speed: spec.speed || 5.2,
          life: 820,
          size: 17,
          gravity: spec.gravity ?? -2.8
        });
      }, spec.delay || 180);

      // 流派專屬實體動畫原型（火牛奔襲 / 水師齊砲 / 忍霧分身 / 箭雨箭牆）
      if (spec.proto === 'fire_ox') {
        const dir = new THREE.Vector3().subVectors(targetPos, casterPos);
        dir.y = 0;
        if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
        dir.normalize();
        const sideVec = new THREE.Vector3(-dir.z, 0, dir.x);
        for (let i = 0; i < 5; i++) {
          const lane = (i - 2) * 0.62;
          later(() => {
            const p0 = casterPos.clone().addScaledVector(sideVec, lane).add(new THREE.Vector3(0, 0.55, 0));
            const pMid = casterPos.clone().lerp(targetPos, 0.52).addScaledVector(sideVec, lane * 0.85).add(new THREE.Vector3(0, 0.72, 0));
            const p1 = targetPos.clone().addScaledVector(sideVec, lane * 0.6).addScaledVector(dir, 0.75).add(new THREE.Vector3(0, 0.45, 0));
            V.spawnRibbonTrail(scene, [p0, pMid, p1], i % 2 === 0 ? 0xf97316 : 0xef4444, 0.34, 520);
            V.spawnShockRing(scene, p1.clone().setY(groundY), i % 2 === 0 ? 0xfbbf24 : 0xf97316, 1.9, 440);
          }, i * 55);
        }
      } else if (spec.proto === 'warship_broadside') {
        for (let i = 0; i < 4; i++) {
          later(() => {
            const oz = (i - 1.5) * 0.78;
            const ox = ((i % 2) - 0.5) * 0.65;
            const p0 = casterPos.clone().add(new THREE.Vector3(0, 1.25, oz * 0.7));
            const pPeak = casterPos.clone().lerp(targetPos, 0.5).add(new THREE.Vector3(ox * 0.5, 4.4 + (i % 2) * 0.6, oz));
            const pLand = targetPos.clone().add(new THREE.Vector3(ox, 0.45, oz));
            V.spawnRibbonTrail(scene, [p0, pPeak, pLand], i % 2 === 0 ? 0xf97316 : 0x22d3ee, 0.28, 480);
            V.spawnShockRing(scene, pLand.clone().setY(groundY), i === 0 ? 0x06b6d4 : 0xf97316, 2.3 + i * 0.35, 520);
          }, i * 70);
        }
      } else if (spec.proto === 'shinobi_clone') {
        const offsets = [[-1.35, 0.2, -0.9], [1.35, 0.2, 0.9], [0, 1.65, 0]];
        offsets.forEach(([ox, oy, oz], i) => {
          later(() => {
            const pStart = targetPos.clone().add(new THREE.Vector3(ox, 0.8 + oy, oz));
            const pEnd = hit.clone().add(new THREE.Vector3(-ox * 0.5, 0.2, -oz * 0.5));
            V.spawnRibbonTrail(scene, [pStart, hit.clone().add(new THREE.Vector3(0, oy * 0.5, 0)), pEnd], 0xc084fc, 0.26, 380);
            V.spawnSlashArc(scene, pEnd, i % 2 === 0 ? 1 : -1, i === 2 ? 0xf3e8ff : 0xa855f7, 2.2 + i * 0.35, 380);
          }, i * 85);
        });
      } else if (spec.proto === 'arrow_wall') {
        for (let i = 0; i < 7; i++) {
          later(() => {
            const oz = (i - 3) * 0.48;
            const ox = ((i % 3) - 1) * 0.42;
            const pSky = targetPos.clone().add(new THREE.Vector3(ox - 1.4, 6.2 + (i % 2) * 0.6, oz));
            const pMid = targetPos.clone().add(new THREE.Vector3(ox * 0.5 - 0.5, 3.1, oz));
            const pHit = targetPos.clone().add(new THREE.Vector3(ox, 0.35, oz));
            V.spawnRibbonTrail(scene, [pSky, pMid, pHit], i % 2 === 0 ? spec.color : (spec.accent || 0xfef08a), 0.18, 420);
            if (i % 2 === 0) {
              V.spawnShockRing(scene, pHit.clone().setY(groundY), spec.color, 1.85, 420);
            }
          }, i * 42);
        }
      }
      beat(ctx, spec.delay || 180, spec.shake || 0.24, spec.sfx || 'blade_clash');
    });
  }

  /* ==================== 奔雷突騎 ($3 / $2 / $1 共 15 位) ==================== */
  registerCustom('macho_sig',       { glyph: '西涼', hexStr: '#38bdf8', color: 0x38bdf8, accent: 0xe0f2fe, slashes: 3, ribbons: 2, sfx: 'cavalry_charge' });
  registerCustom('yukimura_sig',    { glyph: '六文錢', hexStr: '#ef4444', color: 0xef4444, accent: 0xfbbf24, pillar: 0xe11d48, slashes: 2, sfx: 'cavalry_charge' });
  registerCustom('sunce_sig',       { glyph: '霸王', hexStr: '#f97316', color: 0xf43f5e, accent: 0xfbbf24, slashes: 2, rings: 2, sfx: 'cavalry_charge' });
  registerCustom('gaochanggong_sig',{ glyph: '蘭陵', hexStr: '#c084fc', color: 0xa855f7, accent: 0xfde047, rings: 3, slashes: 1, sfx: 'blade_clash' });
  registerCustom('date_sig',        { glyph: '龍', hexStr: '#38bdf8', color: 0x0284c7, accent: 0xfef08a, ribbons: 3, slashes: 1, sfx: 'arrow_volley' });
  registerCustom('gaisuwen_sig',    { color: 0x38bdf8, accent: 0xf43f5e, ribbons: 5, slashes: 1, sfx: 'blade_clash' });
  registerCustom('xiahouyuan_sig',  { color: 0x38bdf8, accent: 0xfbbf24, ribbons: 3, rings: 2, sfx: 'cavalry_charge' });
  registerCustom('eulji_sig',       { glyph: '薩水', hexStr: '#06b6d4', color: 0x06b6d4, accent: 0xbae6fd, rings: 2, ribbons: 2, sfx: 'strategy_gong' });
  registerCustom('tachibana_sig',   { seal: 'thunder_seal', color: 0xfde047, accent: 0x38bdf8, slashes: 2, pillar: 0x38bdf8, sfx: 'blade_clash' });
  registerCustom('zhaoshe_sig',     { color: 0xfbbf24, accent: 0x38bdf8, ribbons: 2, rings: 2, sfx: 'cavalry_charge' });
  registerCustom('madai_sig',       { color: 0x7dd3fc, accent: 0xe0f2fe, ribbons: 2, slashes: 1, sfx: 'cavalry_charge' });
  registerCustom('wangshuang_sig',  { color: 0xf43f5e, accent: 0xf97316, slashes: 2, rings: 1, sfx: 'blade_clash' });
  registerCustom('yamagata_sig',    { glyph: '赤備', hexStr: '#ef4444', color: 0xef4444, accent: 0xf97316, ribbons: 2, slashes: 1, sfx: 'cavalry_charge' });
  registerCustom('pangde_sig',      { color: 0xe11d48, accent: 0xfef08a, ribbons: 2, slashes: 2, sfx: 'blade_clash' });
  registerCustom('maedatoshi_sig',  { color: 0xf97316, accent: 0xfbbf24, ribbons: 3, slashes: 1, sfx: 'blade_clash' });

  /* ==================== 重甲陷陣 ($3 / $2 / $1 共 15 位) ==================== */
  registerCustom('sunjian_sig',     { glyph: '猛虎', hexStr: '#f97316', color: 0xe11d48, accent: 0xfbbf24, slashes: 2, rings: 2, sfx: 'blade_clash' });
  registerCustom('caoren_sig',      { seal: 'aegis_seal', color: 0x10b981, accent: 0x38bdf8, pillar: 0x059669, rings: 2, sfx: 'shield_block' });
  registerCustom('hojo_ujiyasu_sig',{ glyph: '相模', hexStr: '#10b981', color: 0x10b981, accent: 0xfde047, rings: 3, sfx: 'shield_block' });
  registerCustom('tachibanad_sig',  { seal: 'thunder_seal', color: 0x38bdf8, accent: 0xfde047, slashes: 2, pillar: 0x0284c7, sfx: 'blade_clash' });
  registerCustom('xuchu_sig',       { glyph: '虎癡', hexStr: '#f43f5e', color: 0xe11d48, accent: 0xf97316, slashes: 2, rings: 2, shake: 0.34, sfx: 'blade_clash' });
  registerCustom('shibata_sig',     { glyph: '破瓶', hexStr: '#ef4444', color: 0xdc2626, accent: 0xfbbf24, slashes: 2, pillar: 0xe11d48, sfx: 'blade_clash' });
  registerCustom('xiahou_dun_sig',  { color: 0xe11d48, accent: 0xf87171, slashes: 3, rings: 1, sfx: 'blade_clash' });
  registerCustom('choiyoung_sig',   { glyph: '高麗', hexStr: '#34d399', color: 0x10b981, accent: 0xfbbf24, pillar: 0x10b981, rings: 2, sfx: 'shield_block' });
  registerCustom('yangye_sig',      { glyph: '楊', hexStr: '#fbbf24', color: 0xf59e0b, accent: 0xef4444, slashes: 2, rings: 2, sfx: 'blade_clash' });
  registerCustom('iinaomasa_sig',   { glyph: '赤鬼', hexStr: '#ef4444', color: 0xf97316, accent: 0xe11d48, pillar: 0xf97316, slashes: 2, sfx: 'cavalry_charge' });
  registerCustom('dianwei_sig',     { color: 0xf59e0b, accent: 0xf43f5e, slashes: 2, rings: 2, sfx: 'blade_clash' });
  registerCustom('zhoutai_sig',     { color: 0x10b981, accent: 0xfbbf24, rings: 2, slashes: 2, sfx: 'shield_block' });
  registerCustom('gyebaek_sig',     { color: 0xe11d48, accent: 0xfde047, slashes: 2, pillar: 0xbe123c, sfx: 'blade_clash' });
  registerCustom('katokiyomasa_sig',{ color: 0x10b981, accent: 0x34d399, pillar: 0x059669, rings: 2, sfx: 'shield_block' });
  registerCustom('yujin_sig',       { seal: 'aegis_seal', color: 0x34d399, accent: 0xfde047, rings: 2, sfx: 'shield_block' });

  /* ==================== 神射強弩 ($3 / $2 / $1 共 15 位) ==================== */
  registerCustom('yoichi_sig',      { glyph: '扇', hexStr: '#fbbf24', color: 0xfbbf24, accent: 0xe0f2fe, ribbons: 1, rings: 3, sfx: 'arrow_volley' });
  registerCustom('taishici_sig',    { proto: 'arrow_wall', color: 0x38bdf8, accent: 0xfbbf24, ribbons: 3, slashes: 1, sfx: 'arrow_volley' });
  registerCustom('akechi_sig',      { glyph: '桔梗', hexStr: '#a855f7', color: 0xf97316, accent: 0xc084fc, ribbons: 3, pillar: 0xf97316, sfx: 'fire_attack' });
  registerCustom('malong_sig',      { proto: 'arrow_wall', seal: 'bullseye_seal', color: 0xfbbf24, accent: 0x34d399, ribbons: 4, rings: 2, sfx: 'arrow_volley' });
  registerCustom('shimazu_iehisa_sig', { proto: 'arrow_wall', color: 0xf97316, accent: 0xfef08a, ribbons: 4, rings: 2, sfx: 'arrow_volley' });
  registerCustom('gwonyul_sig',     { proto: 'arrow_wall', glyph: '幸州', hexStr: '#f97316', color: 0xf97316, accent: 0xfde047, ribbons: 5, fromSky: true, sfx: 'fire_attack' });
  registerCustom('zongze_sig',      { proto: 'arrow_wall', glyph: '汴京', hexStr: '#fbbf24', color: 0xfbbf24, accent: 0xfef08a, ribbons: 4, rings: 2, sfx: 'arrow_volley' });
  registerCustom('gengyan_sig',     { color: 0xf59e0b, accent: 0xfef08a, ribbons: 4, fromSky: true, sfx: 'arrow_volley' });
  registerCustom('fengyi_sig',      { color: 0x10b981, accent: 0xa855f7, ribbons: 3, rings: 2, sfx: 'arrow_volley' });
  registerCustom('asakura_sot_sig', { color: 0xf97316, accent: 0xfbbf24, ribbons: 3, rings: 2, sfx: 'arrow_volley' });
  registerCustom('torii_sig',       { seal: 'aegis_seal', color: 0xf97316, accent: 0x10b981, ribbons: 2, rings: 2, sfx: 'arrow_volley' });
  registerCustom('choimuseon_sig',  { proto: 'arrow_wall', glyph: '火桶', hexStr: '#f97316', color: 0xf97316, accent: 0xfde047, ribbons: 4, pillar: 0xea580c, sfx: 'fire_attack' });
  registerCustom('matsunaga_sig',   { color: 0xea580c, accent: 0xfde047, pillar: 0xf97316, rings: 3, shake: 0.34, sfx: 'fire_attack' });
  registerCustom('takigawa_sig',    { color: 0xfbbf24, accent: 0xa855f7, ribbons: 3, rings: 1, sfx: 'arrow_volley' });
  registerCustom('honda_tadatsugu_sig', { color: 0xf97316, accent: 0xfef08a, ribbons: 3, rings: 1, sfx: 'arrow_volley' });

  /* ==================== 先登奇兵 ($3 / $2 / $1 共 15 位) ==================== */
  registerCustom('ganning_sig',     { proto: 'shinobi_clone', glyph: '百騎', hexStr: '#06b6d4', color: 0x06b6d4, accent: 0xfbbf24, slashes: 3, rings: 2, sfx: 'blade_clash' });
  registerCustom('hattori_sig',     { proto: 'shinobi_clone', glyph: '忍', hexStr: '#a855f7', color: 0xa855f7, accent: 0xf3e8ff, slashes: 3, ribbons: 2, sfx: 'blade_clash' });
  registerCustom('jiangwei_sig',    { glyph: '麒麟', hexStr: '#34d399', color: 0x10b981, accent: 0xfbbf24, slashes: 2, pillar: 0x10b981, sfx: 'war_drum' });
  registerCustom('yungwan_sig',     { glyph: '別武', hexStr: '#22d3ee', color: 0x06b6d4, accent: 0xbae6fd, slashes: 2, ribbons: 3, sfx: 'war_drum' });
  registerCustom('zhanghe_sig',     { proto: 'shinobi_clone', color: 0xa855f7, accent: 0x38bdf8, ribbons: 3, slashes: 2, sfx: 'blade_clash' });
  registerCustom('huanggai_sig',    { proto: 'fire_ox', seal: 'fire_lotus', color: 0xf97316, accent: 0xfde047, ribbons: 2, pillar: 0xf97316, sfx: 'fire_attack' });
  registerCustom('tiandan_sig',     { proto: 'fire_ox', glyph: '火牛', hexStr: '#f97316', color: 0xf97316, accent: 0xef4444, ribbons: 4, rings: 2, sfx: 'fire_attack' });
  registerCustom('caobin_sig',      { proto: 'warship_broadside', seal: 'whirlpool_seal', color: 0x06b6d4, accent: 0xecfeff, rings: 3, sfx: 'war_drum' });
  registerCustom('jeongji_sig',     { proto: 'warship_broadside', color: 0xf97316, accent: 0x06b6d4, pillar: 0xf97316, rings: 2, sfx: 'fire_attack' });
  registerCustom('yuejin_sig',      { color: 0xe11d48, accent: 0xfbbf24, slashes: 2, rings: 2, sfx: 'blade_clash' });
  registerCustom('menghuo_sig',     { color: 0x10b981, accent: 0xf43f5e, rings: 3, slashes: 1, sfx: 'war_drum' });
  registerCustom('murakami_sig',    { proto: 'warship_broadside', color: 0xf97316, accent: 0xfbbf24, ribbons: 3, rings: 2, sfx: 'fire_attack' });
  registerCustom('yuyunwen_sig',    { proto: 'warship_broadside', glyph: '采石', hexStr: '#f97316', color: 0xf97316, accent: 0x38bdf8, pillar: 0xf97316, rings: 2, sfx: 'fire_attack' });
  registerCustom('wakizaka_sig',    { proto: 'warship_broadside', color: 0x06b6d4, accent: 0x67e8f9, slashes: 2, rings: 1, sfx: 'blade_clash' });
  registerCustom('toudo_sig',       { proto: 'warship_broadside', color: 0x0891b2, accent: 0x38bdf8, rings: 3, sfx: 'war_drum' });

  /* ==================== 軍師奇謀 ($3 / $2 / $1 共 15 位) ==================== */
  registerCustom('zhouyu_sig',      { glyph: '赤壁', hexStr: '#f97316', color: 0xf97316, accent: 0xfde047, pillar: 0xf97316, rings: 3, sfx: 'fire_attack' });
  registerCustom('simayi_sig',      { glyph: '冢虎', hexStr: '#a855f7', color: 0xa855f7, accent: 0xfbbf24, seal: 'bagua_seal', pillar: 0x9333ea, sfx: 'strategy_gong' });
  registerCustom('sunbin_sig',      { seal: 'bagua_seal', color: 0xfbbf24, accent: 0x38bdf8, ribbons: 4, rings: 2, sfx: 'strategy_gong' });
  registerCustom('guojia_sig',      { glyph: '鬼謀', hexStr: '#38bdf8', color: 0x38bdf8, accent: 0xfde047, pillar: 0x38bdf8, rings: 2, sfx: 'strategy_gong' });
  registerCustom('kanggamchan_sig', { glyph: '龜州', hexStr: '#06b6d4', color: 0x06b6d4, accent: 0xfbbf24, seal: 'whirlpool_seal', pillar: 0x0284c7, sfx: 'strategy_gong' });
  registerCustom('pangtong_sig',    { glyph: '連環', hexStr: '#f97316', color: 0xf97316, accent: 0x10b981, ribbons: 3, pillar: 0xea580c, sfx: 'fire_attack' });
  registerCustom('lusu_sig',        { seal: 'bagua_seal', color: 0x10b981, accent: 0xfde047, rings: 3, sfx: 'strategy_gong' });
  registerCustom('xunyu_sig',       { glyph: '王佐', hexStr: '#fbbf24', color: 0xfbbf24, accent: 0xfef3c7, pillar: 0xfbbf24, rings: 2, sfx: 'strategy_gong' });
  registerCustom('hanbei_sig',      { color: 0x10b981, accent: 0xfde047, seal: 'bagua_seal', ribbons: 3, sfx: 'strategy_gong' });
  registerCustom('kanbei_sig',      { glyph: '如水', hexStr: '#06b6d4', color: 0x06b6d4, accent: 0xfbbf24, pillar: 0x06b6d4, rings: 2, sfx: 'strategy_gong' });
  registerCustom('jiaxu_sig',       { glyph: '毒士', hexStr: '#a855f7', color: 0xa855f7, accent: 0xc084fc, slashes: 2, rings: 2, sfx: 'strategy_gong' });
  registerCustom('fazheng_sig',     { color: 0xf59e0b, accent: 0xfde047, pillar: 0xf59e0b, rings: 2, sfx: 'strategy_gong' });
  registerCustom('sanadamasa_sig',  { glyph: '上田', hexStr: '#ef4444', color: 0xa855f7, accent: 0xef4444, slashes: 2, rings: 2, sfx: 'strategy_gong' });
  registerCustom('shimazu_yoshihisa_sig', { color: 0xa855f7, accent: 0xfbbf24, ribbons: 2, rings: 2, sfx: 'strategy_gong' });
  registerCustom('yamamoto_sig',    { seal: 'bagua_seal', color: 0xf59e0b, accent: 0x38bdf8, rings: 2, sfx: 'strategy_gong' });
})();
