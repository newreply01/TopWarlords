'use strict';

/* Original, reusable field-scale figures. No third-party character meshes or textures. */
const BattleFigures = (() => {
  const geometries = new Map();
  const steel = 0x5d6362, edge = 0x92958f, leather = 0x6a5139, skin = 0xbb9475;
  const wood = 0x6c563b, cloth = 0x6a6e5c, dark = 0x303531;

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
          box([0.23, 0.36, 0.035], wood, [-0.02, -0.17, 0.13]);
          [-0.112, 0.072].forEach(x => box([0.014, 0.36, 0.012], edge, [x, -0.17, 0.154]));
          box([0.21, 0.021, 0.012], steel, [-0.02, -0.17, 0.155]);
        } else {
          shaft(0.115, 0.115, 0.03, wood, [-0.02, -0.15, 0.13], [Math.PI / 2, 0, 0]);
          ellipsoid([0.035, 0.035, 0.025], edge, [-0.02, -0.15, 0.154]);
        }
      } else if (left && cat === 'air_defense') {
        add(new THREE.TorusGeometry(0.20, 0.008, 4, 16, Math.PI), wood,
          [0, -0.17, 0.14], [0.8, 1.4, 1], [0, 0, -Math.PI / 2]);
        box([0.003, 0.53, 0.003], 0xb7ac8e, [0, -0.17, 0.14]);
      } else if (!left && (heavy || mounted)) {
        shaft(0.007, 0.009, mounted ? 1.18 : 1.02, wood, [0.015, 0.17, 0.16], [mounted ? 1.05 : 0.25, 0, 0]);
        add(new THREE.ConeGeometry(0.023, 0.14, 4), edge,
          [0.015, mounted ? 0.49 : 0.73, mounted ? 0.70 : 0.30], [1, 1, 0.45], [mounted ? 1.05 : 0.25, 0, 0]);
      } else if (!left && cat === 'naval') {
        box([0.026, 0.35, 0.008], edge, [0, -0.01, 0.11], [0.25, 0, -0.12]);
        box([0.085, 0.014, 0.018], steel, [0, -0.18, 0.075]);
      } else if (!left && robe) {
        box([0.09, 0.16, 0.018], wood, [0, -0.17, 0.09]);
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
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0.2 });
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
    const placements = Array.from({ length: count }, (_, i) => {
      const offset = offsetFor(i, count);
      return {
        x: offset.x * (mounted ? 1.15 : 0.95),
        z: offset.z * (mounted ? 1.30 : 0.95),
        scale: 0.94 + (i % 5) * 0.025
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
        transform.rotation.set(0, ((i % 3) - 1) * 0.025, 0);
        transform.scale.setScalar(scale);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
        const tint = new THREE.Color(i % 3 === 0 ? 0xf2eee3 : i % 3 === 1 ? 0xd9ddd5 : 0xe5dfd1).convertSRGBToLinear();
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
      new THREE.BoxGeometry(0.012, 1.15, 0.012).translate(0.15, 0.57, 0)
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
      color: side === 'A' ? 0x555f60 : 0x6a584b
    }), count);
    mesh.userData.reserveSide = side;
    return mesh;
  }

  const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  const animationRotation = new THREE.Quaternion(), matrix = new THREE.Matrix4(), axis = new THREE.Vector3(1, 0, 0);
  function fallenMatrix(base, progress, index, groundOffset, result, advance) {
    base.decompose(position, rotation, scale);
    const angle = progress * Math.PI / 2;
    const height = position.y;
    position.y = height * Math.cos(angle) + 0.035 * progress + groundOffset;
    position.z += height * Math.sin(angle) + advance;
    position.x += ((index % 3) - 1) * 0.035 * progress;
    animationRotation.setFromAxisAngle(axis, angle);
    rotation.premultiply(animationRotation);
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
    if (now - ranks.userData.animationAt < (token.lowPower ? 66 : 40)) return;
    const dt = Math.min(0.1, (now - ranks.userData.animationAt) / 1000);
    ranks.userData.animationAt = now;
    const mounted = token.cat === 'air';
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
    const nextAdvance = Math.min(targetAdvance, ranks.userData.advance + dt * 1.1);
    moving = moving || nextAdvance - ranks.userData.advance > 0.001;
    ranks.userData.advance = nextAdvance;
    const heights = groundOffsets(ranks, token, terrainHeight);
    ranks.userData.groundOffsets = heights;
    ranks.children.forEach(mesh => {
      const part = mesh.userData.part;
      mesh.userData.standingMatrices.forEach((base, i) => {
        const casualtyAt = ranks.userData.casualtyAt[i];
        if (casualtyAt !== null) {
          fallenMatrix(base, Math.min(1, (now - casualtyAt) / 550), i, heights[i], matrix,
            ranks.userData.casualtyAdvance[i]);
          mesh.setMatrixAt(i, matrix);
          return;
        }
        const phase = now * (moving ? (mounted ? 0.015 : 0.009) : 0.004) + i * 1.71 + attackPhaseOffset;
        const gait = moving ? Math.sin(phase) : 0;
        let angle = 0;
        if (part.endsWith('Leg')) {
          angle = gait * (part === 'leftLeg' ? 0.46 : -0.46);
          if (fighting && !moving && ['air_defense', 'support'].includes(token.cat)) {
            angle += Math.sin(phase + attackPhaseOffset) * (part === 'leftLeg' ? 0.09 : -0.09);
          }
        }
        else if (part.startsWith('horseLeg')) angle = Math.sin(phase + (part.endsWith('FL') || part.endsWith('BR') ? 0 : Math.PI)) * (moving ? 0.48 : 0.012);
        else if (part.endsWith('Arm')) {
          angle = gait * (part === 'leftArm' ? -0.30 : 0.30);
          const striking = fighting && Math.sin(now * 0.006 + attackPhaseOffset + Math.floor(i / 6) * 0.72) > 0.15;
          if (attack || (striking && token.cat !== 'support')) angle -= 0.45 + Math.sin(now * 0.009 + i * 1.1 + attackPhaseOffset) * 0.35;
          if (token.cat === 'air_defense' && (attack || striking)) angle = -1.05 + Math.sin(now * 0.004 + i) * 0.18;
          if (token.cat === 'support' && fighting) {
            const castBeat = Math.max(0, Math.sin(now * 0.004 + i * 0.8 + attackPhaseOffset));
            const armDirection = part === 'leftArm' ? 1 : -1;
            angle = armDirection * (0.25 + castBeat * 0.42);
          }
        }
        base.decompose(position, rotation, scale);
        position.y += heights[i];
        position.z += ranks.userData.advance;
        if (mounted && moving) position.y += Math.sin(phase * 2) * 0.018;
        if (part === 'body' && fighting) {
          const sway = token.cat === 'support' ? 0.075 : 0.045;
          angle = Math.sin(now * 0.003 + i * 1.7 + attackPhaseOffset) * sway;
        }
        animationRotation.setFromAxisAngle(axis, angle);
        rotation.multiply(animationRotation);
        matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  return { createRanks, createReserveRanks, animate, fall };
})();
