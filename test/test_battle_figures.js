'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../js/libs/three.min.js');
const context = vm.createContext({ THREE });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'battle-figures.js'), 'utf8') +
  '\nthis.figures = BattleFigures;', context);
const { figures } = context;
const cats = ['air', 'armor', 'air_defense', 'naval', 'support'];
const silhouettes = [];

for (const cat of cats) {
  const token = {
    cat, lowPower: false, mesh: new THREE.Group(), formationRig: new THREE.Group(),
    attackUntil: 0, currentHp: 100, maxHp: 100
  };
  const ranks = figures.createRanks(token, 48, i => ({ x: (i % 6 - 2.5) * 0.42, z: -Math.floor(i / 6) * 0.5 }));
  assert.equal(ranks.userData.soldierCount, 48);
  assert.equal(ranks.children.length, cat === 'air' ? 10 : 5);
  const body = ranks.children[0];
  body.geometry.computeBoundingBox();
  assert(body.geometry.boundingBox.max.y < 0.9, 'Heads must not use oversized cartoon proportions');
  for (const mesh of ranks.children) {
    assert.equal(mesh.count, 48);
    assert.equal(mesh.geometry.attributes.position.count, mesh.geometry.attributes.color.count);
    for (const attr of ['position', 'normal', 'color']) {
      assert([...mesh.geometry.attributes[attr].array].every(Number.isFinite));
    }
    assert(mesh.userData.standingMatrices.every(matrix => matrix.elements.every(Number.isFinite)));
  }
  silhouettes.push(ranks.children.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count, 0));
  const leg = ranks.children.find(mesh => mesh.userData.part === 'leftLeg');
  const before = Array.from(leg.instanceMatrix.array);
  figures.animate(ranks, token, 1000, true, false, () => 0);
  assert.notDeepEqual(Array.from(leg.instanceMatrix.array), before, 'Marching must articulate legs, not translate a rigid crowd');
  const moving = Array.from(leg.instanceMatrix.array);
  figures.animate(ranks, token, 1150, true, false, () => 0);
  assert.notDeepEqual(Array.from(leg.instanceMatrix.array), moving);
  const arm = ranks.children.find(mesh => mesh.userData.part === 'rightArm');
  figures.animate(ranks, token, 1300, false, false, () => 0);
  const idle = Array.from(arm.instanceMatrix.array);
  token.attackUntil = 2500;
  figures.animate(ranks, token, 1500, false, false, () => 0);
  assert.notDeepEqual(Array.from(arm.instanceMatrix.array), idle, 'Attack must articulate the weapon arm');
  figures.animate(ranks, token, 1700, false, false, () => 0.3);
  assert(Math.abs(body.instanceMatrix.array[13] - 0.3 - (cat === 'air' ? 0.57 * 0.94 : 0)) < 0.001,
    'Figures must follow the actual terrain height');
  token.currentHp = 50;
  token.visualHp = 90;
  figures.animate(ranks, token, 1800, false, false, () => 0);
  assert(ranks.userData.losses < 24, 'Casualties must follow interpolated visual HP, not jump to the final damage');
  token.visualHp = 50;
  figures.animate(ranks, token, 1900, false, false, () => 0);
  assert.equal(ranks.userData.casualtyAt.filter(value => value !== null).length, 24);
  figures.animate(ranks, token, 2500, false, false, () => 0);
  const fallen = new THREE.Matrix4().fromArray(body.instanceMatrix.array, 0);
  const standing = new THREE.Matrix4().fromArray(body.instanceMatrix.array, 47 * 16);
  assert(Math.abs(fallen.elements[13] - 0.035) < 0.001);
  assert(Math.abs(fallen.elements[5]) < 0.01 && standing.elements[5] > 0.9,
    'Casualties must lie down while survivors remain standing');
  assert(standing.elements[14] > body.userData.standingMatrices[47].elements[14] + 0.1,
    'Surviving ranks must step forward into gaps left by casualties');
  token.currentHp = 100;
  figures.animate(ranks, token, 2600, false, false, () => 0);
  assert.equal(ranks.userData.losses, 24, 'Recovering HP must not resurrect casualties or move ranks backwards');
  const readyArm = Array.from(arm.instanceMatrix.array);
  figures.animate(ranks, token, 2800, true, true, () => 0, 0.82);
  assert.notDeepEqual(Array.from(arm.instanceMatrix.array), readyArm,
    'Every battalion role must fight continuously while the army advances');
  if (['air_defense', 'support'].includes(cat)) {
    figures.animate(ranks, token, 3000, false, true, () => 0, 0.82);
    const firstBacklinePose = Array.from(arm.instanceMatrix.array);
    figures.animate(ranks, token, 3350, false, true, () => 0, 0.82);
    assert.notDeepEqual(Array.from(arm.instanceMatrix.array), firstBacklinePose,
      `${cat} must keep a recognizable combat gesture while holding its position`);
  }
  figures.fall(ranks, token, 0.1, () => 0.3);
  assert(Math.abs(body.instanceMatrix.array[13] - 0.335) < 0.001,
    'Previously fallen soldiers must not stand up during defeat');
  assert.notEqual(body.instanceMatrix.array[28 * 16 + 5], body.instanceMatrix.array[27 * 16 + 5],
    'Surviving soldiers must collapse in staggered groups, not synchronously');
  figures.fall(ranks, token, 1, () => 0.3);
  assert(ranks.children.every(mesh => Array.from({ length: mesh.count }, (_, i) =>
    mesh.instanceMatrix.array[i * 16 + 13]).every(height => Math.abs(height - 0.335) < 0.001)),
    'Every part must settle on the actual terrain instead of sinking underground');
  ranks.children.forEach(mesh => mesh.dispose());
  ranks.userData.material.dispose();
}
assert.equal(new Set(silhouettes).size, 5, 'All five roles must use distinct equipment geometry');
for (const side of ['A', 'B']) {
  const reserves = figures.createReserveRanks(384, side);
  assert.equal(reserves.count, 384);
  assert(reserves.geometry.attributes.position.count / 3 <= 100, 'Distant reserves must use simplified geometry');
  assert([...reserves.geometry.attributes.normal.array].every(Number.isFinite));
  assert.equal(reserves.userData.reserveSide, side);
  reserves.geometry.dispose();
  reserves.material.dispose();
  reserves.dispose();
}
console.log('PASS: five original troop silhouettes, complete mounts, articulated gait/attacks, finite geometry, terrain grounding.');
