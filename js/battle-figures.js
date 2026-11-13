'use strict';

/* Original, reusable field-scale figures. No third-party character meshes or textures. */
const BattleFigures = (() => {
  const geometries = new Map();
  const steel = 0x737d84, edge = 0xd2d8de, gold = 0xd4a64a, leather = 0x6b4b32, skin = 0xbb9475;
  const wood = 0x6c4c2f, cloth = 0x565e63, dark = 0x262a2d;

  function geometryFor(cat, part) {
    const key = `${cat}:${part}`;
    if (geometries.has(key)) return geometries.get(key);
    const pieces = [];
    function add(geometry, color, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
      const object = new THREE.Object3D();
      object.position.set(...position);
      object.scale.set(...scale);
      object.rotation.set(...rotation);
      object.updateMatrix();
      const source = geometry.index ? geometry.toNonIndexed() : geometry;
      source.applyMatrix4(object.matrix);
      const colors = new Float32Array(source.attributes.position.count * 3);
      const tint = new THREE.Color(color).convertSRGBToLinear();
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = tint.r; colors[i + 1] = tint.g; colors[i + 2] = tint.b;
      }
      source.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      pieces.push(source);
      if (source !== geometry) geometry.dispose();
    }
    const box = (size, color, position, rotation) =>
      add(new THREE.BoxGeometry(...size), color, position, [1, 1, 1], rotation);
    const ellipsoid = (size, color, position, rotation) =>
      add(new THREE.SphereGeometry(1, 8, 6), color, position, size, rotation);
    const shaft = (top, bottom, height, color, position, rotation) =>
      add(new THREE.CylinderGeometry(top, bottom, height, 7), color, position, [1, 1, 1], rotation);
    const mounted = cat === 'air';
    const robe = cat === 'support';
    const heavy = cat === 'armor';
    const bodyColor = robe ? 0x4c5f59 : heavy || mounted ? steel : leather;

    if (part === 'body') {
      shaft(0.105, 0.085, 0.24, bodyColor, [0, 0.53, 0]);
      ellipsoid([0.113, 0.085, 0.06], bodyColor, [0, 0.62, 0]);
      box([0.18, 0.032, 0.12], leather, [0, 0.415, 0]);
      box([0.025, 0.03, 0.014], edge, [0, 0.415, 0.068]);
      shaft(0.027, 0.03, 0.04, skin, [0, 0.69, 0]);
      ellipsoid([0.048, 0.062, 0.046], skin, [0, 0.75, 0.008]);
      if (robe) {
        shaft(0.086, 0.135, 0.30, bodyColor, [0, 0.26, 0]);
        box([0.08, 0.05, 0.07], dark, [0, 0.817, 0]);
        box([0.027, 0.25, 0.018], dark, [0, 0.55, 0.065]);
      } else {
        add(new THREE.SphereGeometry(0.056, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.58),
          steel, [0, 0.772, 0], [1, 0.85, 1.05]);
        box([0.011, 0.065, 0.013], edge, [0, 0.751, 0.052]);
        box([0.105, 0.053, 0.018], steel, [0, 0.714, -0.045]);
        [-1, 1].forEach(side => {
          box([0.021, 0.059, 0.034], steel, [side * 0.044, 0.723, 0]);
          ellipsoid([heavy ? 0.065 : 0.05, 0.043, 0.069], bodyColor, [side * 0.12, 0.635, 0]);
        });
        for (let row = 0; row < (heavy ? 6 : 4); row++) {
          for (let col = 0; col < 5; col++) {
            box([0.033, 0.027, 0.009], row % 2 ? bodyColor : heavy || mounted ? edge : wood,
              [(col - 2) * 0.036, 0.63 - row * 0.034, 0.065]);
          }
        }
        for (let panel = -1; panel <= 1; panel++) {
          box([0.065, 0.135, 0.027], heavy ? steel : cloth, [panel * 0.066, 0.34, 0.058], [-0.12, 0, panel * -0.08]);
        }
      }
      if (mounted) {
        box([0.16, 0.04, 0.2], leather, [0, 0.39, 0]);
      }
      if (cat === 'air_defense') {
        box([0.08, 0.22, 0.07], leather, [0.07, 0.52, -0.09], [0, 0, -0.18]);
        for (let arrow = 0; arrow < 3; arrow++) {
          shaft(0.004, 0.004, 0.32, wood, [0.055 + arrow * 0.018, 0.61, -0.09], [0, 0, -0.18]);
        }
      }
    } else if (part === 'leftLeg' || part === 'rightLeg') {
      const side = part === 'leftLeg' ? -1 : 1;
      shaft(0.037, 0.03, 0.17, cloth, [0, -0.075, mounted ? 0.01 : 0]);
      ellipsoid([0.034, 0.034, 0.034], steel, [0, -0.17, 0.008]);
      shaft(0.032, 0.022, 0.15, leather, [0, -0.245, 0]);
      box([0.049, 0.045, 0.095], dark, [0, -0.325, 0.02]);
      if (mounted) box([0.02, 0.055, 0.04], edge, [side * 0.035, -0.29, 0.02]);
    } else if (part === 'leftArm' || part === 'rightArm') {
      const left = part === 'leftArm';
      shaft(0.031, 0.027, 0.16, heavy || mounted ? steel : robe ? bodyColor : cloth, [0, -0.075, 0]);
      shaft(0.025, 0.021, 0.13, leather, [0, -0.18, 0.045], [-0.55, 0, 0]);
      ellipsoid([0.024, 0.03, 0.025], skin, [0, -0.24, 0.08]);
      if (left && (heavy || cat === 'naval')) {
        if (heavy) {
          box([0.24, 0.38, 0.035], cloth, [-0.02, -0.17, 0.13]);
          [-0.116, 0.076].forEach(x => box([0.015, 0.38, 0.012], gold, [x, -0.17, 0.155]));
          box([0.22, 0.024, 0.014], gold, [-0.02, -0.17, 0.156]);
          ellipsoid([0.038, 0.038, 0.02], gold, [-0.02, -0.17, 0.16]);
        } else {
          shaft(0.125, 0.125, 0.03, cloth, [-0.02, -0.15, 0.13], [Math.PI / 2, 0, 0]);
          ellipsoid([0.042, 0.042, 0.028], gold, [-0.02, -0.15, 0.156]);
        }
      } else if (left && cat === 'air_defense') {
        add(new THREE.TorusGeometry(0.21, 0.009, 4, 16, Math.PI), wood,
          [0, -0.17, 0.14], [0.8, 1.4, 1], [0, 0, -Math.PI / 2]);
        box([0.003, 0.55, 0.003], 0xd6cbb0, [0, -0.17, 0.14]);
      } else if (!left && (heavy || mounted)) {
        shaft(0.007, 0.009, mounted ? 1.28 : 1.12, wood, [0.015, 0.21, 0.16], [mounted ? 1.02 : 0.24, 0, 0]);
        add(new THREE.ConeGeometry(0.028, 0.17, 4), edge,
          [0.015, mounted ? 0.56 : 0.80, mounted ? 0.78 : 0.32], [1, 1, 0.45], [mounted ? 1.02 : 0.24, 0, 0]);
      } else if (!left && cat === 'naval') {
        box([0.032, 0.40, 0.009], edge, [0, 0.01, 0.12], [0.25, 0, -0.12]);
        box([0.095, 0.018, 0.022], gold, [0, -0.18, 0.075]);
      } else if (!left && robe) {
        box([0.11, 0.19, 0.018], gold, [0, -0.17, 0.09]);
      }
    } else if (part === 'horse') {
      ellipsoid([0.18, 0.25, 0.43], leather, [0, 0.64, -0.05]);
      ellipsoid([0.17, 0.23, 0.22], leather, [0, 0.66, -0.32]);
      ellipsoid([0.12, 0.33, 0.17], leather, [0, 0.88, 0.30], [-0.38, 0, 0]);
      ellipsoid([0.09, 0.18, 0.12], leather, [0, 1.12, 0.44], [-0.6, 0, 0]);
      ellipsoid([0.075, 0.075, 0.12], dark, [0, 1.02, 0.55]);
      [-1, 1].forEach(side => {
        add(new THREE.ConeGeometry(0.027, 0.12, 5), leather, [side * 0.055, 1.29, 0.40]);
        ellipsoid([0.012, 0.012, 0.008], 0x111510, [side * 0.084, 1.15, 0.49]);
      });
      box([0.027, 0.34, 0.035], dark, [0, 0.97, 0.19], [-0.35, 0, 0]);
      shaft(0.025, 0.012, 0.43, dark, [0, 0.58, -0.49], [0.36, 0, 0]);
      box([0.30, 0.045, 0.32], cloth, [0, 0.89, -0.08]);
      box([0.20, 0.055, 0.22], leather, [0, 0.94, -0.08]);
      box([0.018, 0.30, 0.036], leather, [-0.183, 0.64, -0.06]);
      box([0.018, 0.30, 0.036], leather, [0.183, 0.64, -0.06]);
    } else if (part.startsWith('horseLeg')) {
      shaft(0.045, 0.025, 0.25, leather, [0, -0.10, 0]);
      ellipsoid([0.03, 0.037, 0.033], leather, [0, -0.23, 0.012]);
      shaft(0.025, 0.018, 0.23, leather, [0, -0.35, 0.015]);
      box([0.052, 0.065, 0.075], dark, [0, -0.48, 0.03]);
    } else {
      throw new Error(`Unknown figure part: ${part}`);
    }
    const merged = new THREE.BufferGeometry();
    for (const attribute of ['position', 'normal', 'color']) {
      const size = pieces.reduce((sum, piece) => sum + piece.attributes[attribute].array.length, 0);
      const values = new Float32Array(size);
      let offset = 0;
      pieces.forEach(piece => {
        values.set(piece.attributes[attribute].array, offset);
        offset += piece.attributes[attribute].array.length;
      });
      merged.setAttribute(attribute, new THREE.BufferAttribute(values, 3));
    }
    pieces.forEach(piece => piece.dispose());
    merged.computeBoundingSphere();
    geometries.set(key, merged);
    return merged;
  }

  function createRanks(token, count, offsetFor) {
    const ranks = new THREE.Group();
    const mounted = token.cat === 'air';
    const parts = ['body', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm'];
    if (mounted) parts.push('horse', 'horseLegFL', 'horseLegFR', 'horseLegBL', 'horseLegBR');
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0.48 });
    const transform = new THREE.Object3D();
    const mounts = {
      body: [0, mounted ? 0.57 : 0, 0],
      leftLeg: [mounted ? -0.19 : -0.055, mounted ? 0.94 : 0.36, 0],
      rightLeg: [mounted ? 0.19 : 0.055, mounted ? 0.94 : 0.36, 0],
      leftArm: [-0.132, mounted ? 1.19 : 0.62, 0],
      rightArm: [0.132, mounted ? 1.19 : 0.62, 0],
      horse: [0, 0, 0],
      horseLegFL: [-0.13, 0.53, 0.24], horseLegFR: [0.13, 0.53, 0.24],
      horseLegBL: [-0.13, 0.53, -0.32], horseLegBR: [0.13, 0.53, -0.32]
    };
    const isSideB = token.side === 'B';
    const sidePalette = isSideB
      ? [0xdc9a80, 0xc77e66, 0xead4ba]
      : [0x9fc7dc, 0x86b2ca, 0xd8e8f2];
    const placements = Array.from({ length: count }, (_, i) => {
      const offset = offsetFor(i, count);
      const jitterX = Math.sin(i * 19.3 + 1.7) * 0.055;
      const jitterZ = Math.cos(i * 11.7 + 0.9) * 0.055;
      return {
        x: offset.x * (mounted ? 1.22 : 1.05) + (i === 0 ? 0 : jitterX),
        z: offset.z * (mounted ? 1.36 : 1.04) + (i === 0 ? 0 : jitterZ),
        scale: 0.94 + (i % 5) * 0.028
      };
    });
    parts.forEach(part => {
      const mesh = new THREE.InstancedMesh(geometryFor(token.cat, part), material, count);
      mesh.castShadow = !token.lowPower && (part === 'body' || part === 'horse');
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData.part = part;
      mesh.userData.pivot = new THREE.Vector3(...mounts[part]);
      mesh.userData.standingMatrices = placements.map(({ x, z, scale }, i) => {
        transform.position.set(x + mounts[part][0] * scale, mounts[part][1] * scale, z + mounts[part][2] * scale);
        transform.rotation.set(0, ((i % 5) - 2) * 0.045, 0);
        transform.scale.setScalar(scale);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
        const tint = new THREE.Color(sidePalette[i % sidePalette.length]).convertSRGBToLinear();
        mesh.setColorAt(i, tint);
        return transform.matrix.clone();
      });
      ranks.add(mesh);
    });
    ranks.userData.isBattalionRanks = true;
    ranks.userData.soldierCount = count;
    ranks.userData.originalFigures = true;
    ranks.userData.placements = placements;
    ranks.userData.animationAt = 0;
    ranks.userData.casualtyAt = Array(count).fill(null);
    ranks.userData.losses = 0;
    ranks.userData.casualtyAdvance = Array(count).fill(0);
    ranks.userData.advance = 0;
    ranks.userData.frontZ = Math.max(...placements.map(placement => placement.z));
    ranks.userData.material = material;
    return ranks;
  }

  function createReserveRanks(count, side) {
    const pieces = [
      new THREE.BoxGeometry(0.18, 0.36, 0.11).translate(0, 0.46, 0),
      new THREE.SphereGeometry(0.065, 5, 3).translate(0, 0.72, 0),
      new THREE.BoxGeometry(0.055, 0.30, 0.07).translate(-0.055, 0.15, 0),
      new THREE.BoxGeometry(0.055, 0.30, 0.07).translate(0.055, 0.15, 0),
      new THREE.BoxGeometry(0.014, 1.25, 0.014).translate(0.15, 0.62, 0),
      new THREE.BoxGeometry(0.01, 0.32, 0.16).translate(0.15, 1.05, -0.08)
    ].map(geometry => {
      if (!geometry.index) return geometry;
      const source = geometry.toNonIndexed();
      geometry.dispose();
      return source;
    });
    const geometry = new THREE.BufferGeometry();
    for (const name of ['position', 'normal']) {
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(
        pieces.flatMap(piece => Array.from(piece.attributes[name].array)), 3));
    }
    pieces.forEach(piece => piece.dispose());
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({
      color: new THREE.Color(side === 'A' ? 0x1e2c3d : 0x4c1a18).convertSRGBToLinear()
    }), count);
    mesh.userData.reserveSide = side;
    return mesh;
  }

  const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  const animationRotation = new THREE.Quaternion(), twistRotation = new THREE.Quaternion(), matrix = new THREE.Matrix4();
  const axis = new THREE.Vector3(1, 0, 0), upAxis = new THREE.Vector3(0, 1, 0);
  function fallenMatrix(base, progress, index, groundOffset, result, advance) {
    base.decompose(position, rotation, scale);
    const angle = progress * Math.PI / 2;
    const height = position.y;
    const sprawlYaw = (((index % 5) - 2) * 0.32 + (index % 2 ? 0.14 : -0.14)) * progress;
    position.y = height * Math.cos(angle) + 0.035 * progress + groundOffset;
    position.z += height * Math.sin(angle) * Math.cos(sprawlYaw) + advance;
    position.x += ((index % 5) - 2) * 0.048 * progress + Math.sin(sprawlYaw) * height * 0.35;
    animationRotation.setFromAxisAngle(axis, angle);
    rotation.premultiply(animationRotation);
    twistRotation.setFromAxisAngle(upAxis, sprawlYaw);
    rotation.premultiply(twistRotation);
    result.compose(position, rotation, scale);
    return result;
  }

  function groundOffsets(ranks, token, terrainHeight) {
    const yaw = token.formationRig.rotation.y;
    return ranks.userData.placements.map(({ x, z }, i) => {
      z += ranks.userData.casualtyAt[i] === null ? ranks.userData.advance : ranks.userData.casualtyAdvance[i];
      return terrainHeight(token.mesh.position.x + x * Math.cos(yaw) + z * Math.sin(yaw),
        token.mesh.position.z - x * Math.sin(yaw) + z * Math.cos(yaw)) - token.mesh.position.y;
    });
  }

  function fall(ranks, token, progress, terrainHeight) {
    const heights = groundOffsets(ranks, token, terrainHeight);
    ranks.userData.groundOffsets = heights;
    ranks.children.forEach(mesh => {
      mesh.userData.standingMatrices.forEach((base, i) => {
        const fallen = ranks.userData.casualtyAt[i] !== null;
        const stagger = (i % 7) * 0.055;
        const collapse = Math.max(0, Math.min(1, (progress - stagger) / (1 - stagger)));
        fallenMatrix(base, fallen ? 1 : collapse, i, heights[i], matrix,
          fallen ? ranks.userData.casualtyAdvance[i] : ranks.userData.advance);
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  function animate(ranks, token, now, moving, fighting, terrainHeight, attackPhaseOffset = 0) {
    if (now - ranks.userData.animationAt < (token.lowPower ? 55 : 24)) return;
    const dt = Math.min(0.1, (now - ranks.userData.animationAt) / 1000);
    ranks.userData.animationAt = now;
    const mounted = token.cat === 'air';
    const isBackline = ['air_defense', 'support'].includes(token.cat);
    const attack = token.attackUntil > now;
    const losses = Math.max(ranks.userData.losses,
      Math.floor(ranks.userData.soldierCount * Math.min(0.9, 1 - (token.visualHp ?? token.currentHp) / token.maxHp)));
    ranks.userData.losses = losses;
    for (let i = 0; i < losses; i++) {
      if (ranks.userData.casualtyAt[i] === null) {
        ranks.userData.casualtyAt[i] = now;
        ranks.userData.casualtyAdvance[i] = ranks.userData.advance;
      }
    }
    const survivorFront = Math.max(...ranks.userData.placements.slice(losses).map(placement => placement.z));
    const targetAdvance = Math.max(0, ranks.userData.frontZ - survivorFront);
    const nextAdvance = Math.min(targetAdvance, ranks.userData.advance + dt * 1.45);
    moving = moving || nextAdvance - ranks.userData.advance > 0.001;
    ranks.userData.advance = nextAdvance;
    const heights = groundOffsets(ranks, token, terrainHeight);
    ranks.userData.groundOffsets = heights;
    ranks.children.forEach(mesh => {
      const part = mesh.userData.part;
      mesh.userData.standingMatrices.forEach((base, i) => {
        const casualtyAt = ranks.userData.casualtyAt[i];
        if (casualtyAt !== null) {
          fallenMatrix(base, Math.min(1, (now - casualtyAt) / 420), i, heights[i], matrix,
            ranks.userData.casualtyAdvance[i]);
          mesh.setMatrixAt(i, matrix);
          return;
        }
        const phase = now * (moving ? (mounted ? 0.017 : 0.0115) : 0.0055) + i * 1.71 + attackPhaseOffset;
        const skirmishPhase = now * 0.0095 + i * 1.37 + attackPhaseOffset;
        const strikeWave = Math.sin(now * 0.012 + i * 1.28 + attackPhaseOffset);
        const gait = moving ? Math.sin(phase) : (fighting && !isBackline ? Math.sin(skirmishPhase) * 0.65 : 0);
        let angle = 0;
        let torsoYaw = 0;
        let lungeZ = 0;
        if (fighting && !isBackline && !moving) {
          lungeZ = Math.max(0, strikeWave) * (mounted ? 0.24 : 0.16);
        }
        if (part.endsWith('Leg')) {
          angle = gait * (part === 'leftLeg' ? 0.54 : -0.54);
          if (fighting && !moving && isBackline) {
            angle += Math.sin(phase + attackPhaseOffset) * (part === 'leftLeg' ? 0.1 : -0.1);
          }
        }
        else if (part.startsWith('horseLeg')) {
          const horseActive = moving || (fighting && !isBackline);
          const rearBoost = attack && (part === 'horseLegFL' || part === 'horseLegFR') ? -0.35 : 0;
          angle = rearBoost + Math.sin(phase + (part.endsWith('FL') || part.endsWith('BR') ? 0 : Math.PI)) * (horseActive ? 0.64 : 0.04);
        }
        else if (part.endsWith('Arm')) {
          angle = gait * (part === 'leftArm' ? -0.36 : 0.36);
          const striking = fighting && Math.sin(now * 0.0085 + attackPhaseOffset + (i % 7) * 0.85) > -0.25;
          if (part === 'rightArm') {
            if (attack) {
              angle -= 1.05 + Math.sin(now * 0.016 + i * 1.35 + attackPhaseOffset) * 0.72;
            } else if (striking && token.cat !== 'support') {
              angle -= 0.74 + strikeWave * 0.62;
            }
          } else if (part === 'leftArm' && fighting && !isBackline) {
            angle -= 0.30 + Math.cos(now * 0.009 + i * 0.95 + attackPhaseOffset) * 0.32;
          }
          if (token.cat === 'air_defense' && (attack || striking)) {
            angle = part === 'leftArm' ? -0.95 : (-1.12 + Math.sin(now * 0.006 + i) * 0.28);
          }
          if (token.cat === 'support' && fighting) {
            const castBeat = Math.max(0, Math.sin(now * 0.0055 + i * 0.8 + attackPhaseOffset));
            const armDirection = part === 'leftArm' ? 1 : -1;
            angle = armDirection * (0.32 + castBeat * 0.62);
          }
        }
        base.decompose(position, rotation, scale);
        position.y += heights[i];
        position.z += ranks.userData.advance + lungeZ;
        if (mounted && (moving || fighting)) {
          position.y += Math.abs(Math.sin(phase * 1.8)) * (attack ? 0.055 : 0.025);
        }
        if (part === 'body' && fighting) {
          const sway = token.cat === 'support' ? 0.09 : isBackline ? 0.05 : 0.12;
          angle = Math.sin(now * 0.007 + i * 1.45 + attackPhaseOffset) * sway;
          if (!isBackline) torsoYaw = Math.cos(now * 0.011 + i * 1.25 + attackPhaseOffset) * 0.22;
        }
        animationRotation.setFromAxisAngle(axis, angle);
        rotation.multiply(animationRotation);
        if (torsoYaw !== 0) {
          twistRotation.setFromAxisAngle(upAxis, torsoYaw);
          rotation.multiply(twistRotation);
        }
        matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  function mergePartGeometries(entries) {
    const prepped = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    let totalVerts = 0;

    for (const item of entries) {
      const g = item.geo.index ? item.geo.toNonIndexed() : item.geo.clone();
      item.geo.dispose();
      const pos = item.pos || [0, 0, 0];
      const rot = item.rot || [0, 0, 0];
      const sc = item.scale || [1, 1, 1];
      p.set(pos[0], pos[1], pos[2]);
      e.set(rot[0], rot[1], rot[2]);
      q.setFromEuler(e);
      s.set(sc[0], sc[1], sc[2]);
      m.compose(p, q, s);
      g.applyMatrix4(m);
      const count = g.attributes.position.count;
      totalVerts += count;
      prepped.push({ g, count });
    }

    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    let offset3 = 0;
    let offset2 = 0;
    for (const { g, count } of prepped) {
      positions.set(g.attributes.position.array, offset3);
      if (g.attributes.normal) normals.set(g.attributes.normal.array, offset3);
      if (g.attributes.uv) uvs.set(g.attributes.uv.array, offset2);
      offset3 += count * 3;
      offset2 += count * 2;
      g.dispose();
    }

    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    out.computeBoundingSphere();
    return out;
  }

  function createCommanderHero(token) {
    const isSideB = token.side === 'B';
    const cat = token.cat || 'armor';
    const mounted = cat === 'air';
    const isElite = (token.cost || 3) >= 4;
    const primaryCol = isSideB ? 0x991b1b : 0x1d4ed8;
    const trimCol = isElite ? 0xf59e0b : (isSideB ? 0xd97706 : 0x38bdf8);
    const armorCol = isElite ? 0x475569 : 0x64748b;
    const horseCol = isSideB ? 0x3b1510 : 0x1e293b;

    const root = new THREE.Group();
    root.userData.isCommanderHero = true;
    const heroScale = isElite ? 1.24 : 1.14;
    const riderBaseY = mounted ? 0.72 : 0.0;

    const armorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(armorCol).convertSRGBToLinear(), roughness: 0.34, metalness: 0.74 });
    const trimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(trimCol).convertSRGBToLinear(), roughness: 0.28, metalness: 0.84, emissive: new THREE.Color(trimCol).convertSRGBToLinear(), emissiveIntensity: 0.12 });
    const clothMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(primaryCol).convertSRGBToLinear(), roughness: 0.65, metalness: 0.12, side: THREE.DoubleSide });
    const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(skin).convertSRGBToLinear(), roughness: 0.78 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.18, metalness: 0.92, emissive: isElite ? trimCol : 0x64748b, emissiveIntensity: isElite ? 0.18 : 0.08 });

    const bodyGrp = new THREE.Group();
    bodyGrp.scale.setScalar(heroScale);
    bodyGrp.position.y = riderBaseY;
    root.add(bodyGrp);

    // 合併軀幹、頭盔與肩甲為單一 Mesh 以嚴控 Draw Calls
    const armorParts = [];
    if (cat !== 'support') {
      armorParts.push({ geo: new THREE.CylinderGeometry(0.115, 0.095, 0.34, 8), pos: [0, 0.50, 0] });
      armorParts.push({ geo: new THREE.SphereGeometry(0.076, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), pos: [0, 0.77, 0] });
    }
    const trimParts = [{ geo: new THREE.BoxGeometry(0.22, 0.22, 0.14), pos: [0, 0.53, 0.02] }];
    if (cat === 'support') {
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.095, 0.36, 8), clothMat);
      robe.position.set(0, 0.49, 0);
      bodyGrp.add(robe);
      trimParts.push({ geo: new THREE.CylinderGeometry(0.055, 0.072, 0.10, 6), pos: [0, 0.84, 0] });
    } else if (isElite) {
      trimParts.push({ geo: new THREE.ConeGeometry(0.016, 0.28, 5), pos: [-0.05, 0.90, -0.07], rot: [-0.62, 0, 0.22] });
      trimParts.push({ geo: new THREE.ConeGeometry(0.016, 0.28, 5), pos: [0.05, 0.90, -0.07], rot: [-0.62, 0, -0.22] });
    } else {
      trimParts.push({ geo: new THREE.ConeGeometry(0.022, 0.14, 5), pos: [0, 0.88, -0.02] });
    }
    if (armorParts.length) {
      const armorMesh = new THREE.Mesh(mergePartGeometries(armorParts), armorMat);
      bodyGrp.add(armorMesh);
    }
    bodyGrp.add(new THREE.Mesh(mergePartGeometries(trimParts), trimMat));

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 6), skinMat);
    head.position.set(0, 0.75, 0.01);
    bodyGrp.add(head);

    // 飄揚大將披風
    const capePivot = new THREE.Group();
    capePivot.position.set(0, 0.64, -0.08);
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.60, 2, 3), clothMat);
    cape.position.set(0, -0.28, -0.04);
    cape.rotation.x = 0.22;
    capePivot.add(cape);
    bodyGrp.add(capePivot);

    // 右手大將神兵 (合併手臂與兵刃)
    const rightArm = new THREE.Group();
    rightArm.position.set(0.15, 0.60, 0.02);
    const armParts = [{ geo: new THREE.CylinderGeometry(0.032, 0.026, 0.24, 6), pos: [0, -0.10, 0] }];
    if (cat === 'air' || cat === 'armor') {
      armParts.push({ geo: new THREE.CylinderGeometry(0.013, 0.015, 1.50, 6), pos: [0, 0.34, 0.14], rot: [0.45, 0, 0] });
      rightArm.add(new THREE.Mesh(mergePartGeometries(armParts), armorMat));
      const bladeParts = [
        { geo: new THREE.ConeGeometry(0.048, 0.30, 4), pos: [0, 0.96, 0.46], rot: [0.45, 0, 0] },
        { geo: new THREE.BoxGeometry(0.18, 0.04, 0.02), pos: [0, 0.84, 0.40], rot: [0.45, 0, 0] }
      ];
      rightArm.add(new THREE.Mesh(mergePartGeometries(bladeParts), bladeMat));
    } else if (cat === 'naval') {
      rightArm.add(new THREE.Mesh(mergePartGeometries(armParts), armorMat));
      const saber = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.66, 0.016), bladeMat);
      saber.position.set(0, 0.16, 0.18);
      saber.rotation.x = 0.4;
      rightArm.add(saber);
    } else if (cat === 'support') {
      rightArm.add(new THREE.Mesh(mergePartGeometries(armParts), clothMat));
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.02, 0.02, 7, 1, false, 0, Math.PI), bladeMat);
      fan.position.set(0, -0.14, 0.18);
      fan.rotation.set(0.7, 0, Math.PI / 2);
      rightArm.add(fan);
    } else {
      rightArm.add(new THREE.Mesh(mergePartGeometries(armParts), armorMat));
    }
    bodyGrp.add(rightArm);

    // 左手戰盾 / 寶弓
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.15, 0.60, 0.02);
    if (cat === 'air_defense') {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 5, 14, Math.PI), trimMat);
      bow.position.set(0, -0.08, 0.16);
      bow.rotation.z = -Math.PI / 2;
      leftArm.add(bow);
    } else if (cat !== 'support') {
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 8), trimMat);
      shield.rotation.x = Math.PI / 2;
      shield.position.set(0, -0.14, 0.15);
      leftArm.add(shield);
    }
    bodyGrp.add(leftArm);

    let horseGrp = null;
    if (mounted) {
      horseGrp = new THREE.Group();
      const horseMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(horseCol).convertSRGBToLinear(), roughness: 0.55, metalness: 0.25 });
      const horseParts = [
        { geo: new THREE.CylinderGeometry(0.20, 0.20, 0.84, 8), pos: [0, 0.68, 0], rot: [Math.PI / 2, 0, 0] },
        { geo: new THREE.BoxGeometry(0.16, 0.42, 0.22), pos: [0, 0.94, 0.36], rot: [-0.42, 0, 0] },
        ...[[-0.14, 0.28], [0.14, 0.28], [-0.14, -0.28], [0.14, -0.28]].map(([lx, lz]) => ({
          geo: new THREE.CylinderGeometry(0.04, 0.025, 0.62, 6), pos: [lx, 0.31, lz]
        }))
      ];
      const horseMesh = new THREE.Mesh(mergePartGeometries(horseParts), horseMat);
      horseMesh.castShadow = true;
      horseGrp.add(horseMesh);
      const caparison = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.30, 0.72), clothMat);
      caparison.position.set(0, 0.66, 0);
      horseGrp.add(caparison);
      const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.28), trimMat);
      hHead.position.set(0, 1.09, 0.50);
      hHead.rotation.x = -0.35;
      horseGrp.add(hHead);
      root.add(horseGrp);
    }

    root.userData.parts = { bodyGrp, rightArm, leftArm, capePivot, horseGrp };
    return root;
  }

  function animateCommander(hero, token, now, moving, fighting, advanceZ, terrainHeight) {
    if (!hero || !hero.userData.parts) return;
    const { bodyGrp, rightArm, leftArm, capePivot, horseGrp } = hero.userData.parts;
    const yaw = token.formationRig.rotation.y;
    const ranged = token.cat === 'air_defense' || token.cat === 'support';
    const frontZ = (token.cat === 'air' ? 0.86 : ranged ? 0.24 : 0.68) + (advanceZ || 0);
    hero.position.set(0, 0, frontZ);
    const localGround = terrainHeight(
      token.mesh.position.x + frontZ * Math.sin(yaw),
      token.mesh.position.z + frontZ * Math.cos(yaw)
    ) - token.mesh.position.y;
    const attack = token.attackUntil > now;
    const pulse = now * 0.011 + (token.attackPhaseOffset || 0);
    hero.position.y = localGround + (horseGrp && (moving || fighting) ? Math.abs(Math.sin(pulse)) * (attack ? 0.14 : 0.04) : 0);
    if (horseGrp && attack) horseGrp.rotation.x = -0.18 + Math.sin(pulse * 1.4) * 0.12;
    else if (horseGrp) horseGrp.rotation.x = moving ? Math.sin(pulse) * 0.06 : 0;

    capePivot.rotation.x = 0.25 + (moving ? 0.38 : 0.14) + Math.sin(now * 0.009 + (token.attackPhaseOffset || 0)) * 0.16;
    if (attack) {
      rightArm.rotation.x = -1.25 + Math.sin(pulse * 1.5) * 0.82;
      bodyGrp.rotation.y = Math.cos(pulse * 1.5) * 0.32;
    } else if (fighting) {
      rightArm.rotation.x = token.cat === 'support'
        ? -0.45 + Math.sin(now * 0.005) * 0.45
        : (-0.65 + Math.sin(pulse * 0.85) * 0.55);
      leftArm.rotation.x = token.cat === 'air_defense' ? -0.9 : (-0.28 + Math.cos(pulse * 0.8) * 0.2);
      bodyGrp.rotation.y = Math.sin(pulse * 0.65) * 0.14;
    } else {
      rightArm.rotation.x = moving ? Math.sin(pulse) * 0.35 : 0;
      leftArm.rotation.x = 0;
      bodyGrp.rotation.y = 0;
    }
  }

  function fallCommander(hero, progress) {
    if (!hero) return;
    hero.rotation.x = progress * (Math.PI / 2);
    hero.rotation.z = progress * 0.22;
    hero.position.y = (hero.userData.parts?.horseGrp ? 0.16 : 0.08) * progress;
  }

  return { createRanks, createReserveRanks, animate, fall, createCommanderHero, animateCommander, fallCommander };
})();
