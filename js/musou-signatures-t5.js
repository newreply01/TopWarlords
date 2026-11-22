'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 (TopWarlords)
   Phase 3：$5 招牌專屬 3D 特效（25 位）
   ===================================================== */
(function () {
  if (typeof window === 'undefined' || !window.MusouVfx) return;
  const V = window.MusouVfx;
  const reg = (k, fn) => V.registerSignature(k, fn);
  const later = (fn, ms) => (V.schedule ? V.schedule(ms, fn) : setTimeout(fn, ms));

  // 小工具：產生漢字／徽記光影貼圖（供風林火山、毘、岳、天下布武等使用）
  const kanjiCache = new Map();
  function getGlyphTex(text, color = '#fbbf24', bg = 'rgba(0,0,0,0)') {
    const key = `${text}|${color}|${bg}`;
    if (kanjiCache.has(key)) return kanjiCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    if (bg !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(128, 128, 112, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 128, 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '900 118px "Noto Serif TC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillText(text, 128, 134);
    const tex = new THREE.CanvasTexture(c);
    kanjiCache.set(key, tex);
    return tex;
  }

  function impactBeat(ctx, delayMs = 260, shake = 0.32, sfx = 'blade_clash') {
    later(() => {
      ctx.triggerHitStop?.(80);
      ctx.triggerCameraShake?.(shake);
      ctx.playFieldSound?.(sfx, ctx.target, 0.72);
    }, delayMs);
  }

  /* ==================== 奔雷突騎 (air $5) ==================== */
  reg('huo_wolf_raid', ctx => {
    const { scene, casterPos, targetPos, groundY, addTexPlane } = ctx;
    const p0 = casterPos.clone().add(new THREE.Vector3(0, 0.9, 0));
    const p1 = casterPos.clone().lerp(targetPos, 0.5).add(new THREE.Vector3(0, 1.3, 0.6));
    const p2 = targetPos.clone().add(new THREE.Vector3(0, 0.9, 0));
    V.spawnRibbonTrail(scene, [p0, p1, p2], 0x38bdf8, 0.45, 780);
    for (let i = 0; i < 3; i++) {
      const pt = casterPos.clone().lerp(targetPos, (i + 1) / 3.4);
      later(() => {
        V.spawnPillar(scene, pt, 0x38bdf8, 4.2, 460);
        V.createGpuBurst({ scene, origin: pt.clone().add(new THREE.Vector3(0, 1, 0)), count: 220, color: 0x38bdf8, speed: 4.5, life: 600, size: 16 });
      }, i * 110);
    }
    later(() => {
      addTexPlane('thunder_seal', 5.8, 5.8, new THREE.Vector3(targetPos.x, groundY + 0.14, targetPos.z), {
        rotateX: -Math.PI / 2, spinZ: -2.8, duration: 1100, renderOrder: 24, additive: true
      });
      V.spawnShockRing(scene, targetPos, 0x38bdf8, 4.4, 720);
      V.createGpuBurst({ scene, origin: p2, count: 720, color: 0x7dd3fc, speed: 6.5, life: 920, size: 20 });
    }, 300);
    impactBeat(ctx, 300, 0.34, 'cavalry_charge');
  });

  reg('lubu_sky_halberd', ctx => {
    const { scene, targetPos, groundY, addTexPlane, addTexSprite } = ctx;
    const hit = targetPos.clone().add(new THREE.Vector3(0, 1.1, 0));
    V.spawnPillar(scene, targetPos, 0xe11d48, 7.2, 760);
    addTexPlane('earth_fissure', 6.4, 6.4, new THREE.Vector3(targetPos.x, groundY + 0.12, targetPos.z), {
      rotateX: -Math.PI / 2, spinZ: 0.4, duration: 1450, renderOrder: 22, additive: true
    });
    for (let i = 0; i < 3; i++) {
      later(() => {
        V.spawnSlashArc(scene, targetPos, i % 2 === 0 ? 1 : -1, i === 2 ? 0xfbbf24 : 0xe11d48, 3.2 + i * 0.4, 460);
        addTexSprite('crescent_wave', 4.6, 4.6, hit.clone().add(new THREE.Vector3(0, 0.35 * i, 0)), {
          spinZ: (i % 2 === 0 ? 1 : -1) * 5.2, duration: 520, depthTest: false, renderOrder: 29, additive: true
        });
      }, 160 + i * 160);
    }
    later(() => {
      V.spawnShockRing(scene, targetPos, 0xfbbf24, 5.2, 820);
      V.createGpuBurst({ scene, origin: hit, count: 950, color: 0xf43f5e, speed: 7.2, life: 1050, size: 22 });
    }, 480);
    impactBeat(ctx, 480, 0.42, 'blade_clash');
  });

  reg('yoshitsune_cliff_dive', ctx => {
    const { scene, targetPos, groundY } = ctx;
    const sky = targetPos.clone().add(new THREE.Vector3(-2.5, 7.5, -1.5));
    V.spawnRibbonTrail(scene, [sky, targetPos.clone().lerp(sky, 0.45), targetPos.clone().add(new THREE.Vector3(0, 0.5, 0))], 0x7dd3fc, 0.52, 750);
    for (let i = 0; i < 8; i++) {
      later(() => {
        const ang = (i / 8) * Math.PI * 2;
        const p = targetPos.clone().add(new THREE.Vector3(Math.cos(ang) * 1.4, 0.6 + (i % 3) * 0.6, Math.sin(ang) * 1.4));
        V.spawnSlashArc(scene, p, i % 2 === 0 ? 1 : -1, 0xe0f2fe, 1.8, 340);
      }, 120 + i * 70);
    }
    later(() => {
      V.spawnShockRing(scene, targetPos, 0x38bdf8, 4.6, 760);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 0.9, 0)), count: 780, color: 0xe0f2fe, speed: 6.0, life: 920, size: 19 });
    }, 320);
    impactBeat(ctx, 320, 0.34, 'cavalry_charge');
  });

  reg('shingen_furinkazan', ctx => {
    const { scene, targetPos, groundY, addTexPlane } = ctx;
    const words = [
      { ch: '風', col: '#38bdf8', hex: 0x38bdf8, ox: -1.5, oz: -1.1 },
      { ch: '林', col: '#10b981', hex: 0x10b981, ox: 1.5, oz: -1.1 },
      { ch: '火', col: '#ef4444', hex: 0xef4444, ox: -1.5, oz: 1.1 },
      { ch: '山', col: '#f59e0b', hex: 0xf59e0b, ox: 1.5, oz: 1.1 }
    ];
    words.forEach((w, idx) => {
      later(() => {
        const p = new THREE.Vector3(targetPos.x + w.ox, groundY + 1.9, targetPos.z + w.oz);
        const tex = getGlyphTex(w.ch, w.col);
        V.spawnGroundDecal(scene, new THREE.Vector3(p.x, groundY, p.z), tex, 2.4, 950);
        V.spawnShockRing(scene, new THREE.Vector3(p.x, groundY, p.z), w.hex, 2.5, 520);
        V.createGpuBurst({ scene, origin: p, count: 260, color: w.hex, speed: 4.8, life: 720, size: 18 });
      }, idx * 180);
    });
    impactBeat(ctx, 540, 0.36, 'war_drum');
  });

  reg('kenshin_bishamon', ctx => {
    const { scene, targetPos, groundY } = ctx;
    const bishTex = getGlyphTex('毘', '#fde047');
    V.spawnGroundDecal(scene, targetPos, bishTex, 5.4, 1350);
    for (let i = 0; i < 3; i++) {
      later(() => {
        V.spawnSlashArc(scene, targetPos, 1, 0x7dd3fc, 3.4, 520);
        V.spawnShockRing(scene, targetPos, 0xfbbf24, 3.8 + i * 0.6, 600);
      }, 150 + i * 200);
    }
    later(() => {
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.2, 0)), count: 800, color: 0x93c5fd, speed: 5.8, life: 950, size: 20 });
    }, 350);
    impactBeat(ctx, 350, 0.36, 'blade_clash');
  });

  /* ==================== 重甲陷陣 (armor $5) ==================== */
  reg('baiqi_changping', ctx => {
    const { scene, targetPos, groundY, addTexPlane } = ctx;
    addTexPlane('earth_fissure', 6.4, 6.4, new THREE.Vector3(targetPos.x, groundY + 0.13, targetPos.z), {
      rotateX: -Math.PI / 2, spinZ: -0.9, duration: 1400, renderOrder: 22, additive: true
    });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + 0.4;
      const from = targetPos.clone().add(new THREE.Vector3(Math.cos(a) * 3.8, 0.9, Math.sin(a) * 3.8));
      later(() => {
        V.spawnRibbonTrail(scene, [from, targetPos.clone().add(new THREE.Vector3(0, 0.9, 0))], 0xdc2626, 0.35, 520);
      }, i * 80);
    }
    later(() => {
      V.spawnShockRing(scene, targetPos, 0xef4444, 4.8, 760);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 820, color: 0xdc2626, speed: 6.2, life: 980, size: 20 });
    }, 340);
    impactBeat(ctx, 340, 0.38, 'blade_clash');
  });

  reg('xiangyu_pofu', ctx => {
    const { scene, targetPos, groundY, addTexPlane } = ctx;
    V.spawnPillar(scene, targetPos, 0xe11d48, 7.6, 820);
    later(() => {
      addTexPlane('earth_fissure', 6.8, 6.8, new THREE.Vector3(targetPos.x, groundY + 0.12, targetPos.z), {
        rotateX: -Math.PI / 2, duration: 1500, renderOrder: 22, additive: true
      });
      V.spawnShockRing(scene, targetPos, 0xfbbf24, 5.4, 860);
      V.spawnShockRing(scene, targetPos, 0xe11d48, 4.0, 740);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 0.8, 0)), count: 980, color: 0xe11d48, speed: 7.4, life: 1050, size: 22 });
    }, 240);
    impactBeat(ctx, 240, 0.45, 'war_drum');
  });

  reg('yuefei_beiwei', ctx => {
    const { scene, targetPos } = ctx;
    const yueTex = getGlyphTex('岳', '#fde68a');
    V.spawnGroundDecal(scene, targetPos, yueTex, 5.2, 1300);
    V.spawnPillar(scene, targetPos, 0xfbbf24, 6.0, 880);
    later(() => {
      V.spawnShockRing(scene, targetPos, 0xfbbf24, 4.4, 740);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 720, color: 0xfde047, speed: 5.2, life: 920, size: 19 });
    }, 260);
    impactBeat(ctx, 260, 0.32, 'shield_block');
  });

  reg('honda_tonbokiri', ctx => {
    const { scene, targetPos } = ctx;
    V.spawnSlashArc(scene, targetPos, 1, 0xfbbf24, 3.8, 560);
    V.spawnSlashArc(scene, targetPos, -1, 0x10b981, 3.4, 560);
    later(() => {
      V.spawnShockRing(scene, targetPos, 0x34d399, 4.5, 740);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.1, 0)), count: 700, color: 0xfbbf24, speed: 5.4, life: 900, size: 19 });
    }, 220);
    impactBeat(ctx, 220, 0.32, 'blade_clash');
  });

  reg('guanyu_dragon_flood', ctx => {
    const { scene, targetPos } = ctx;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const a = t * Math.PI * 2.5;
      pts.push(targetPos.clone().add(new THREE.Vector3(Math.cos(a) * (1.8 - t * 0.8), 0.4 + t * 4.5, Math.sin(a) * (1.8 - t * 0.8))));
    }
    V.spawnRibbonTrail(scene, pts, 0x10b981, 0.48, 920);
    later(() => {
      V.spawnSlashArc(scene, targetPos, 1, 0x34d399, 4.0, 560);
      V.spawnShockRing(scene, targetPos, 0x06b6d4, 5.0, 820);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 840, color: 0x34d399, speed: 6.2, life: 980, size: 20 });
    }, 280);
    impactBeat(ctx, 280, 0.38, 'blade_clash');
  });

  /* ==================== 神射強弩 (air_defense $5) ==================== */
  reg('liguang_stone_arrow', ctx => {
    const { scene, casterPos, targetPos } = ctx;
    const p0 = casterPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    const p1 = targetPos.clone().add(new THREE.Vector3(0, 0.9, 0));
    V.spawnRibbonTrail(scene, [p0, p0.clone().lerp(p1, 0.5).add(new THREE.Vector3(0, 0.5, 0)), p1], 0xfef08a, 0.42, 680);
    later(() => {
      V.spawnShockRing(scene, targetPos, 0xfef08a, 4.4, 720);
      V.createGpuBurst({ scene, origin: p1, count: 780, color: 0xfef9c3, speed: 6.8, life: 900, size: 19 });
    }, 200);
    impactBeat(ctx, 200, 0.34, 'arrow_volley');
  });

  reg('yangyouji_seven_layers', ctx => {
    const { scene, casterPos, targetPos } = ctx;
    const start = casterPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    const end = targetPos.clone().add(new THREE.Vector3(0, 1.0, 0));
    V.spawnRibbonTrail(scene, [start, end], 0xfbbf24, 0.32, 850);
    for (let i = 0; i < 7; i++) {
      later(() => {
        const p = start.clone().lerp(end, (i + 1) / 7);
        V.spawnShockRing(scene, new THREE.Vector3(p.x, targetPos.y, p.z), 0xfde047, 1.6, 360);
      }, i * 75);
    }
    later(() => {
      V.createGpuBurst({ scene, origin: end, count: 720, color: 0xfde047, speed: 6.0, life: 880, size: 19 });
    }, 520);
    impactBeat(ctx, 520, 0.34, 'arrow_volley');
  });

  reg('nobunaga_three_volley', ctx => {
    const { scene, casterPos, targetPos } = ctx;
    const sealTex = getGlyphTex('布武', '#ef4444');
    V.spawnGroundDecal(scene, targetPos, sealTex, 5.0, 1400);
    for (let w = 0; w < 3; w++) {
      later(() => {
        for (let j = -1; j <= 1; j++) {
          const p0 = casterPos.clone().add(new THREE.Vector3(0, 1.2, j * 0.9));
          const p1 = targetPos.clone().add(new THREE.Vector3(0, 0.9, j * 0.7));
          V.spawnRibbonTrail(scene, [p0, p1], 0xf97316, 0.24, 340);
        }
        V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 0.9, 0)), count: 280, color: 0xf97316, speed: 5.5, life: 560, size: 17 });
      }, w * 220);
    }
    impactBeat(ctx, 440, 0.36, 'fire_attack');
  });

  reg('jumong_divine_arrow', ctx => {
    const { scene, casterPos, targetPos } = ctx;
    V.spawnPillar(scene, casterPos, 0xfbbf24, 5.5, 650);
    later(() => {
      V.spawnRibbonTrail(scene, [casterPos.clone().add(new THREE.Vector3(0, 2.0, 0)), targetPos.clone().add(new THREE.Vector3(0, 0.9, 0))], 0xfde047, 0.56, 700);
      V.spawnShockRing(scene, targetPos, 0xfbbf24, 4.8, 780);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 820, color: 0xfde047, speed: 6.4, life: 940, size: 20 });
    }, 220);
    impactBeat(ctx, 240, 0.35, 'arrow_volley');
  });

  reg('limu_ten_thousand', ctx => {
    const { scene, targetPos } = ctx;
    for (let i = 0; i < 10; i++) {
      later(() => {
        const ox = (Math.random() - 0.5) * 4.2;
        const oz = (Math.random() - 0.5) * 4.2;
        const top = targetPos.clone().add(new THREE.Vector3(ox - 1.0, 7.0, oz));
        const bot = targetPos.clone().add(new THREE.Vector3(ox, 0.3, oz));
        V.spawnRibbonTrail(scene, [top, bot], 0x93c5fd, 0.22, 420);
      }, i * 55);
    }
    later(() => {
      V.spawnShockRing(scene, targetPos, 0x60a5fa, 5.0, 800);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 0.9, 0)), count: 860, color: 0x93c5fd, speed: 5.8, life: 950, size: 19 });
    }, 420);
    impactBeat(ctx, 420, 0.34, 'arrow_volley');
  });

  /* ==================== 先登奇兵 (naval $5) ==================== */
  reg('yisunsin_turtle_ship', ctx => {
    const { scene, targetPos, groundY, addTexPlane } = ctx;
    addTexPlane('whirlpool_seal', 6.2, 6.2, new THREE.Vector3(targetPos.x, groundY + 0.13, targetPos.z), {
      rotateX: -Math.PI / 2, spinZ: -3.2, duration: 1350, renderOrder: 22, additive: true
    });
    for (let i = 0; i < 3; i++) {
      later(() => {
        const p = targetPos.clone().add(new THREE.Vector3((i - 1) * 1.4, 0.8, (i % 2 === 0 ? 1 : -1) * 0.9));
        V.spawnPillar(scene, p, 0x06b6d4, 5.4, 620);
        V.createGpuBurst({ scene, origin: p, count: 280, color: 0xf97316, speed: 5.4, life: 700, size: 18 });
      }, 160 + i * 160);
    }
    impactBeat(ctx, 320, 0.38, 'war_drum');
  });

  reg('lumeng_white_robe', ctx => {
    const { scene, targetPos } = ctx;
    V.spawnPillar(scene, targetPos, 0xe2e8f0, 4.8, 600);
    later(() => {
      V.spawnSlashArc(scene, targetPos, 1, 0xa855f7, 3.4, 480);
      V.spawnSlashArc(scene, targetPos, -1, 0xc084fc, 3.0, 480);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 740, color: 0xc084fc, speed: 5.8, life: 900, size: 19 });
    }, 240);
    impactBeat(ctx, 240, 0.32, 'blade_clash');
  });

  reg('lijing_snow_raid', ctx => {
    const { scene, casterPos, targetPos } = ctx;
    V.spawnRibbonTrail(scene, [casterPos.clone().add(new THREE.Vector3(0, 1.0, 0)), targetPos.clone().add(new THREE.Vector3(0, 1.0, 0))], 0xbae6fd, 0.46, 700);
    later(() => {
      V.spawnSlashArc(scene, targetPos, 1, 0x7dd3fc, 3.6, 480);
      V.spawnSlashArc(scene, targetPos, -1, 0xe0f2fe, 3.6, 480);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.2, 0)), count: 820, color: 0xbae6fd, speed: 6.2, life: 940, size: 20 });
    }, 240);
    impactBeat(ctx, 240, 0.34, 'cavalry_charge');
  });

  reg('xiexuan_feishui', ctx => {
    const { scene, targetPos } = ctx;
    V.spawnShockRing(scene, targetPos, 0x22d3ee, 5.2, 850);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const p0 = targetPos.clone().add(new THREE.Vector3(Math.cos(a) * 3.5, 2.2, Math.sin(a) * 3.5));
      V.spawnRibbonTrail(scene, [p0, targetPos.clone().add(new THREE.Vector3(0, 1.0, 0))], 0xe0f2fe, 0.25, 650);
    }
    later(() => {
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 780, color: 0x67e8f9, speed: 5.8, life: 920, size: 19 });
    }, 260);
    impactBeat(ctx, 260, 0.34, 'war_drum');
  });

  reg('mouri_three_arrows', ctx => {
    const { scene, casterPos, targetPos } = ctx;
    const mid = casterPos.clone().lerp(targetPos, 0.5).add(new THREE.Vector3(0, 2.2, 0));
    for (let i = -1; i <= 1; i++) {
      const p0 = casterPos.clone().add(new THREE.Vector3(0, 1.4, i * 1.4));
      V.spawnRibbonTrail(scene, [p0, mid, targetPos.clone().add(new THREE.Vector3(0, 0.9, 0))], 0x38bdf8, 0.28, 760);
    }
    later(() => {
      V.spawnShockRing(scene, targetPos, 0x38bdf8, 4.6, 760);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 760, color: 0x7dd3fc, speed: 6.0, life: 900, size: 19 });
    }, 280);
    impactBeat(ctx, 280, 0.34, 'arrow_volley');
  });

  /* ==================== 軍師奇謀 (support $5) ==================== */
  reg('zhuge_bazhen', ctx => {
    const { scene, targetPos, groundY, addTexPlane } = ctx;
    addTexPlane('bagua_seal', 6.8, 6.8, new THREE.Vector3(targetPos.x, groundY + 0.14, targetPos.z), {
      rotateX: -Math.PI / 2, spinZ: 1.6, duration: 1550, renderOrder: 22, additive: true
    });
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      later(() => {
        const p = targetPos.clone().add(new THREE.Vector3(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5));
        V.spawnPillar(scene, p, 0xfbbf24, 4.6, 800);
      }, i * 65);
    }
    later(() => {
      V.spawnShockRing(scene, targetPos, 0x34d399, 5.2, 860);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.2, 0)), count: 860, color: 0xfde047, speed: 5.2, life: 1050, size: 20, gravity: -1.4 });
    }, 480);
    impactBeat(ctx, 480, 0.34, 'strategy_gong');
  });

  reg('sunwu_thirteen', ctx => {
    const { scene, targetPos, groundY, addTexPlane } = ctx;
    addTexPlane('bagua_seal', 5.8, 5.8, new THREE.Vector3(targetPos.x, groundY + 0.13, targetPos.z), {
      rotateX: -Math.PI / 2, spinZ: -1.4, duration: 1400, renderOrder: 22, additive: true
    });
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2;
      const p0 = targetPos.clone().add(new THREE.Vector3(Math.cos(a) * 3.2, 2.2, Math.sin(a) * 3.2));
      later(() => {
        V.spawnRibbonTrail(scene, [p0, targetPos.clone().add(new THREE.Vector3(0, 0.9, 0))], 0xfbbf24, 0.18, 500);
      }, i * 45);
    }
    later(() => {
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.1, 0)), count: 780, color: 0xfbbf24, speed: 5.4, life: 920, size: 19 });
    }, 520);
    impactBeat(ctx, 520, 0.32, 'strategy_gong');
  });

  reg('hanxin_ten_sides', ctx => {
    const { scene, targetPos } = ctx;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const p = targetPos.clone().add(new THREE.Vector3(Math.cos(a) * 3.0, 0, Math.sin(a) * 3.0));
      V.spawnPillar(scene, p, 0xa855f7, 4.4, 720);
    }
    later(() => {
      V.spawnSlashArc(scene, targetPos, 1, 0xc084fc, 3.8, 500);
      V.spawnShockRing(scene, targetPos, 0xa855f7, 4.8, 760);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.1, 0)), count: 840, color: 0xc084fc, speed: 6.0, life: 960, size: 20 });
    }, 320);
    impactBeat(ctx, 320, 0.36, 'strategy_gong');
  });

  reg('zhangliang_scroll', ctx => {
    const { scene, targetPos, groundY, addTexPlane } = ctx;
    addTexPlane('bagua_seal', 5.6, 5.6, new THREE.Vector3(targetPos.x, groundY + 0.13, targetPos.z), {
      rotateX: -Math.PI / 2, spinZ: 1.8, duration: 1350, renderOrder: 22, additive: true
    });
    const scrollTex = getGlyphTex('兵法', '#fde047');
    V.spawnGroundDecal(scene, targetPos, scrollTex, 4.2, 1200);
    later(() => {
      V.spawnPillar(scene, targetPos, 0xfde047, 6.2, 740);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.2, 0)), count: 720, color: 0xfef08a, speed: 5.0, life: 900, size: 19 });
    }, 260);
    impactBeat(ctx, 260, 0.3, 'strategy_gong');
  });

  reg('toyotomi_one_night', ctx => {
    const { scene, targetPos } = ctx;
    const castleTex = getGlyphTex('太閤', '#fbbf24');
    V.spawnGroundDecal(scene, targetPos, castleTex, 5.6, 1400);
    V.spawnPillar(scene, targetPos, 0xfbbf24, 7.0, 900);
    later(() => {
      V.spawnShockRing(scene, targetPos, 0xf59e0b, 5.0, 820);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.4, 0)), count: 820, color: 0xfbbf24, speed: 5.6, life: 960, size: 20 });
    }, 260);
    impactBeat(ctx, 260, 0.34, 'strategy_gong');
  });
})();
