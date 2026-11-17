'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 (TopWarlords)
   Phase 4：$4 招牌專屬 3D 特效（25 位）
   ===================================================== */
(function () {
  if (typeof window === 'undefined' || !window.MusouVfx) return;
  const V = window.MusouVfx;
  const reg = (k, fn) => V.registerSignature(k, fn);

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
    ctx.font = '900 112px "Noto Serif TC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillText(text, 128, 134);
    const tex = new THREE.CanvasTexture(c);
    glyphCache.set(key, tex);
    return tex;
  }

  function impact(ctx, delay = 240, shake = 0.28, sfx = 'blade_clash') {
    setTimeout(() => {
      ctx.triggerHitStop?.(75);
      ctx.triggerCameraShake?.(shake);
      ctx.playFieldSound?.(sfx, ctx.target, 0.68);
    }, delay);
  }

  /* ==================== 奔雷突騎 (air $4) ==================== */
  reg('wei_wugang_wall', ctx => {
    const { scene, casterPos, targetPos } = ctx;
    for (let i = -1; i <= 1; i++) {
      const p0 = casterPos.clone().add(new THREE.Vector3(0, 0.8, i * 1.1));
      const p1 = targetPos.clone().add(new THREE.Vector3(0, 0.8, i * 1.1));
      V.spawnRibbonTrail(scene, [p0, p1], 0xfbbf24, 0.36, 720);
    }
    setTimeout(() => {
      V.spawnShockRing(scene, targetPos, 0xf59e0b, 4.2, 700);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 0.9, 0)), count: 600, color: 0xfbbf24, speed: 5.5, life: 850, size: 18 });
    }, 240);
    impact(ctx, 240, 0.3, 'cavalry_charge');
  });

  reg('zhaoyun_seven_charges', ctx => {
    const { scene, targetPos } = ctx;
    for (let i = 0; i < 7; i++) {
      setTimeout(() => {
        const off = new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.5 + (i % 3) * 0.4, (Math.random() - 0.5) * 1.6);
        V.spawnSlashArc(scene, targetPos.clone().add(off), i % 2 === 0 ? 1 : -1, 0xe0f2fe, 2.2, 320);
      }, i * 65);
    }
    setTimeout(() => {
      V.spawnPillar(scene, targetPos, 0x7dd3fc, 6.0, 620);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 660, color: 0xbae6fd, speed: 6.2, life: 880, size: 19 });
    }, 440);
    impact(ctx, 440, 0.32, 'blade_clash');
  });

  reg('zhangliao_xiaoyao', ctx => {
    const { scene, targetPos } = ctx;
    V.spawnSlashArc(scene, targetPos, 1, 0xa855f7, 3.2, 460);
    V.spawnSlashArc(scene, targetPos, -1, 0x38bdf8, 3.2, 460);
    setTimeout(() => {
      V.spawnShockRing(scene, targetPos, 0xa855f7, 4.4, 700);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 640, color: 0xc084fc, speed: 6.0, life: 880, size: 19 });
    }, 220);
    impact(ctx, 220, 0.32, 'cavalry_charge');
  });

  reg('chen_white_robe', ctx => {
    const { scene, casterPos, targetPos } = ctx;
    V.spawnRibbonTrail(scene, [casterPos.clone().add(new THREE.Vector3(0, 1, 0)), targetPos.clone().add(new THREE.Vector3(0, 1, 0))], 0xf8fafc, 0.52, 700);
    setTimeout(() => {
      V.spawnShockRing(scene, targetPos, 0xe2e8f0, 4.4, 740);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.1, 0)), count: 640, color: 0xf1f5f9, speed: 5.4, life: 920, size: 18, gravity: -1.4 });
    }, 220);
    impact(ctx, 220, 0.28, 'cavalry_charge');
  });

  reg('kim_hwarang_oath', ctx => {
    const { scene, targetPos } = ctx;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const top = targetPos.clone().add(new THREE.Vector3(Math.cos(a) * 1.4, 5.2, Math.sin(a) * 1.4));
      const bot = targetPos.clone().add(new THREE.Vector3(Math.cos(a) * 0.8, 0.3, Math.sin(a) * 0.8));
      setTimeout(() => V.spawnRibbonTrail(scene, [top, bot], 0xfbbf24, 0.22, 420), i * 55);
    }
    setTimeout(() => {
      V.spawnShockRing(scene, targetPos, 0xfde047, 4.2, 720);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 600, color: 0xfde047, speed: 5.4, life: 880, size: 18 });
    }, 320);
    impact(ctx, 320, 0.3, 'blade_clash');
  });

  /* ==================== 重甲陷陣 (armor $4) ==================== */
  reg('wangjian_qin_legion', ctx => {
    const { scene, targetPos } = ctx;
    for (let i = -1; i <= 1; i++) {
      V.spawnPillar(scene, targetPos.clone().add(new THREE.Vector3(i * 1.2, 0, 0)), 0xf59e0b, 4.8, 720);
    }
    setTimeout(() => {
      V.spawnShockRing(scene, targetPos, 0xd97706, 4.2, 700);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 0.9, 0)), count: 560, color: 0xfbbf24, speed: 4.8, life: 840, size: 18 });
    }, 240);
    impact(ctx, 240, 0.28, 'war_drum');
  });

  reg('lianpo_rampart', ctx => {
    const { scene, targetPos } = ctx;
    V.spawnGroundDecal(scene, targetPos, getGlyphTex('堅壁', '#10b981'), 4.8, 1200);
    V.spawnShockRing(scene, targetPos, 0x10b981, 3.8, 720);
    V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 0.8, 0)), count: 520, color: 0x34d399, speed: 4.5, life: 860, size: 18 });
    impact(ctx, 200, 0.26, 'shield_block');
  });

  reg('zhangfei_roar', ctx => {
    const { scene, targetPos } = ctx;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        V.spawnShockRing(scene, targetPos, 0xef4444, 3.2 + i * 0.9, 540);
      }, i * 110);
    }
    V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 640, color: 0xf87171, speed: 6.4, life: 860, size: 20 });
    impact(ctx, 180, 0.36, 'war_drum');
  });

  reg('shimazu_retreat_charge', ctx => {
    const { scene, targetPos } = ctx;
    V.spawnSlashArc(scene, targetPos, 1, 0xe11d48, 3.6, 500);
    V.spawnPillar(scene, targetPos, 0x991b1b, 5.4, 650);
    V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 620, color: 0xf43f5e, speed: 5.8, life: 880, size: 19 });
    impact(ctx, 220, 0.32, 'blade_clash');
  });

  reg('zhouyafu_xiliu', ctx => {
    const { scene, targetPos } = ctx;
    V.spawnGroundDecal(scene, targetPos, getGlyphTex('細柳', '#34d399'), 4.8, 1250);
    V.spawnShockRing(scene, targetPos, 0x10b981, 4.0, 740);
    V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 540, color: 0x6ee7b7, speed: 4.4, life: 860, size: 18 });
    impact(ctx, 200, 0.26, 'shield_block');
  });

  /* ==================== 神射強弩 (air_defense $4) ==================== */
  reg('mengtian_great_wall', ctx => {
    const { scene, casterPos, targetPos } = ctx;
    V.spawnGroundDecal(scene, casterPos, getGlyphTex('秦', '#fbbf24'), 4.4, 1100);
    for (let i = -2; i <= 2; i++) {
      const p0 = casterPos.clone().add(new THREE.Vector3(0, 1.4, i * 0.7));
      const p1 = targetPos.clone().add(new THREE.Vector3(0, 0.9, i * 0.5));
      V.spawnRibbonTrail(scene, [p0, p1], 0xfbbf24, 0.2, 540);
    }
    setTimeout(() => V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 0.9, 0)), count: 580, color: 0xfde047, speed: 5.5, life: 840, size: 18 }), 200);
    impact(ctx, 200, 0.28, 'arrow_volley');
  });

  reg('huangzhong_dingjun', ctx => {
    const { scene, casterPos, targetPos } = ctx;
    V.spawnPillar(scene, casterPos, 0xf97316, 4.5, 520);
    setTimeout(() => {
      V.spawnRibbonTrail(scene, [casterPos.clone().add(new THREE.Vector3(0, 1.5, 0)), targetPos.clone().add(new THREE.Vector3(0, 0.9, 0))], 0xf97316, 0.44, 620);
      V.spawnShockRing(scene, targetPos, 0xfbbf24, 4.2, 700);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 660, color: 0xfb923c, speed: 6.2, life: 880, size: 19 });
    }, 180);
    impact(ctx, 200, 0.32, 'arrow_volley');
  });

  reg('han_huangtiandang', ctx => {
    const { scene, targetPos } = ctx;
    V.spawnShockRing(scene, targetPos, 0x06b6d4, 4.4, 720);
    for (let i = 0; i < 3; i++) {
      setTimeout(() => V.spawnPillar(scene, targetPos.clone().add(new THREE.Vector3((i - 1) * 1.1, 0, 0)), 0xf97316, 4.6, 540), i * 100);
    }
    V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 0.9, 0)), count: 600, color: 0x38bdf8, speed: 5.6, life: 860, size: 18 });
    impact(ctx, 240, 0.3, 'arrow_volley');
  });

  reg('saika_yatagarasu', ctx => {
    const { scene, casterPos, targetPos } = ctx;
    for (let w = 0; w < 3; w++) {
      setTimeout(() => {
        V.spawnRibbonTrail(scene, [casterPos.clone().add(new THREE.Vector3(0, 1.3, (w - 1) * 0.6)), targetPos.clone().add(new THREE.Vector3(0, 0.9, 0))], 0xf97316, 0.25, 360);
        V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 220, color: 0xfbbf24, speed: 5.4, life: 560, size: 17 });
      }, w * 140);
    }
    impact(ctx, 280, 0.3, 'fire_attack');
  });

  reg('hulu_eagle_shot', ctx => {
    const { scene, casterPos, targetPos } = ctx;
    const sky = targetPos.clone().add(new THREE.Vector3(0, 6.2, 0));
    V.spawnRibbonTrail(scene, [casterPos.clone().add(new THREE.Vector3(0, 1.4, 0)), sky, targetPos.clone().add(new THREE.Vector3(0, 0.8, 0))], 0xfef08a, 0.32, 680);
    setTimeout(() => {
      V.spawnShockRing(scene, targetPos, 0xfde047, 3.8, 660);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.2, 0)), count: 580, color: 0xfef08a, speed: 5.8, life: 860, size: 18 });
    }, 240);
    impact(ctx, 240, 0.28, 'arrow_volley');
  });

  /* ==================== 先登奇兵 (naval $4) ==================== */
  reg('dengai_cliff_drop', ctx => {
    const { scene, targetPos } = ctx;
    const top = targetPos.clone().add(new THREE.Vector3(-1.8, 7.5, 0));
    V.spawnRibbonTrail(scene, [top, targetPos.clone().add(new THREE.Vector3(0, 0.5, 0))], 0x10b981, 0.45, 580);
    setTimeout(() => {
      V.spawnShockRing(scene, targetPos, 0x34d399, 4.4, 720);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 0.8, 0)), count: 640, color: 0x34d399, speed: 6.0, life: 880, size: 19 });
    }, 220);
    impact(ctx, 220, 0.34, 'blade_clash');
  });

  reg('kuki_ironclad', ctx => {
    const { scene, targetPos } = ctx;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const p = targetPos.clone().add(new THREE.Vector3((i - 1) * 1.2, 0.9, 0));
        V.spawnShockRing(scene, new THREE.Vector3(p.x, targetPos.y, p.z), 0xf97316, 3.0, 520);
        V.createGpuBurst({ scene, origin: p, count: 240, color: 0xf97316, speed: 5.5, life: 680, size: 18 });
      }, i * 160);
    }
    impact(ctx, 320, 0.34, 'fire_attack');
  });

  reg('luxun_burning_camps', ctx => {
    const { scene, targetPos } = ctx;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const p = targetPos.clone().add(new THREE.Vector3((i - 2) * 0.95, 0, (i % 2 === 0 ? 0.6 : -0.6)));
        V.spawnPillar(scene, p, 0xf97316, 4.6, 680);
        V.createGpuBurst({ scene, origin: p.clone().add(new THREE.Vector3(0, 0.8, 0)), count: 160, color: 0xfb923c, speed: 4.8, life: 700, size: 17 });
      }, i * 95);
    }
    impact(ctx, 320, 0.32, 'fire_attack');
  });

  reg('weiyan_ziwu', ctx => {
    const { scene, targetPos } = ctx;
    V.spawnSlashArc(scene, targetPos, 1, 0xa855f7, 3.4, 480);
    V.spawnSlashArc(scene, targetPos, -1, 0x10b981, 2.8, 480);
    V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 620, color: 0xc084fc, speed: 5.8, life: 860, size: 19 });
    impact(ctx, 200, 0.32, 'blade_clash');
  });

  reg('xuhuang_ten_rings', ctx => {
    const { scene, targetPos } = ctx;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => V.spawnShockRing(scene, targetPos, 0xfbbf24, 2.0 + i * 0.8, 480), i * 85);
    }
    setTimeout(() => {
      V.spawnSlashArc(scene, targetPos, 1, 0xf43f5e, 3.5, 480);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 600, color: 0xfbbf24, speed: 5.6, life: 860, size: 19 });
    }, 260);
    impact(ctx, 260, 0.32, 'blade_clash');
  });

  /* ==================== 軍師奇謀 (support $4) ==================== */
  reg('caocao_wuchao', ctx => {
    const { scene, targetPos } = ctx;
    V.spawnGroundDecal(scene, targetPos, getGlyphTex('魏', '#a855f7'), 5.0, 1300);
    V.spawnPillar(scene, targetPos, 0xf97316, 5.8, 780);
    V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 640, color: 0xf97316, speed: 5.5, life: 900, size: 19 });
    impact(ctx, 240, 0.32, 'strategy_gong');
  });

  reg('wuqi_wuzu', ctx => {
    const { scene, targetPos } = ctx;
    for (let i = -1; i <= 1; i++) {
      V.spawnPillar(scene, targetPos.clone().add(new THREE.Vector3(0, 0, i * 1.1)), 0x38bdf8, 4.8, 720);
    }
    V.spawnShockRing(scene, targetPos, 0x38bdf8, 4.2, 720);
    V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 560, color: 0x7dd3fc, speed: 5.0, life: 860, size: 18 });
    impact(ctx, 220, 0.28, 'strategy_gong');
  });

  reg('leyi_five_states', ctx => {
    const { scene, targetPos } = ctx;
    const cols = [0xef4444, 0xfbbf24, 0x10b981, 0x38bdf8, 0xa855f7];
    cols.forEach((col, i) => {
      const a = (i / 5) * Math.PI * 2;
      const p0 = targetPos.clone().add(new THREE.Vector3(Math.cos(a) * 3.0, 2.0, Math.sin(a) * 3.0));
      V.spawnRibbonTrail(scene, [p0, targetPos.clone().add(new THREE.Vector3(0, 1.0, 0))], col, 0.24, 640);
    });
    setTimeout(() => {
      V.spawnPillar(scene, targetPos, 0xfbbf24, 6.2, 720);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.2, 0)), count: 620, color: 0xfde047, speed: 5.4, life: 880, size: 19 });
    }, 260);
    impact(ctx, 260, 0.3, 'strategy_gong');
  });

  reg('liubowen_poyang', ctx => {
    const { scene, targetPos, groundY, addTexPlane } = ctx;
    addTexPlane('bagua_seal', 5.6, 5.6, new THREE.Vector3(targetPos.x, groundY + 0.13, targetPos.z), {
      rotateX: -Math.PI / 2, spinZ: 1.5, duration: 1200, renderOrder: 22, additive: true
    });
    setTimeout(() => {
      V.spawnPillar(scene, targetPos, 0xf59e0b, 6.4, 720);
      V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.2, 0)), count: 600, color: 0xfbbf24, speed: 5.6, life: 900, size: 19 });
    }, 240);
    impact(ctx, 240, 0.3, 'strategy_gong');
  });

  reg('tokugawa_sekigahara', ctx => {
    const { scene, targetPos } = ctx;
    V.spawnGroundDecal(scene, targetPos, getGlyphTex('葵', '#fbbf24'), 5.2, 1300);
    V.spawnShockRing(scene, targetPos, 0x10b981, 4.4, 760);
    V.createGpuBurst({ scene, origin: targetPos.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 560, color: 0xfde047, speed: 4.8, life: 900, size: 18, gravity: -1.2 });
    impact(ctx, 220, 0.28, 'strategy_gong');
  });
})();
