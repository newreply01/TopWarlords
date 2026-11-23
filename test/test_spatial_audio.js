'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nodes = [];
function node(kind) {
  const result = {
    kind, values: {}, disconnected: false,
    connect() {}, disconnect() { this.disconnected = true; }, start() {},
    stop() { this.stopped = true; this.onended(); }
  };
  for (const key of ['gain', 'frequency', 'pan', 'playbackRate']) {
    result[key] = { setValueAtTime(value) { result.values[key] = value; } };
  }
  nodes.push(result);
  return result;
}
const window = { requestIdleCallback() {}, addEventListener() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'sound.js'), 'utf8'), {
  window, localStorage: { getItem() { return null; } }, performance: { now: () => 10000 }
});
const engine = window.SoundEngine;
engine.init = () => {};
engine.enabled = true;
engine.buffers.blade_clash_1 = {};
engine.ctx = {
  currentTime: 0,
  createBufferSource: () => node('source'),
  createGain: () => node('gain'),
  createBiquadFilter: () => node('filter'),
  createStereoPanner: () => node('pan')
};
engine.sfxBus = {};
engine._triggerBuffer('blade_clash_1', { gain: 0.8, distance: 8, pan: -0.5 });
const near = nodes.find(n => n.kind === 'gain').values.gain;
nodes.forEach(n => { if (n.kind === 'source') n.onended(); });
assert(nodes.every(n => n.disconnected), 'Finished spatial voices must disconnect their audio nodes');
nodes.length = 0;
engine._triggerBuffer('blade_clash_1', { gain: 0.8, distance: 30, pan: 0.7 });
assert(nodes.find(n => n.kind === 'gain').values.gain < near * 0.5);
assert(nodes.find(n => n.kind === 'filter').values.frequency < 4000);
assert.equal(nodes.find(n => n.kind === 'pan').values.pan, 0.7);
engine._triggerBuffer('blade_clash_1', { gain: 0.8, distance: 30, pan: 0.7, spatial: true });
assert.equal(engine.spatialSources.size, 1);
engine.stopSpatial();
assert.equal(engine.spatialSources.size, 0);
assert(nodes.some(n => n.kind === 'source' && n.stopped));
assert.throws(() => engine.playSpatial('blade_clash', 'A', { distance: NaN, pan: 0 }), /finite/);
engine.enabled = false;
const before = nodes.length;
engine.playSpatial('blade_clash', 'A', { distance: 10, pan: 0 });
assert.equal(nodes.length, before, 'Muted battle ambience must not start new voices');
engine.enabled = true;
let call;
engine._triggerBuffer = (key, options) => { call = { key, options }; return true; };
engine.playSpatial('shield_block', 'B', { distance: 18, pan: 3, gain: 0.3 });
assert.equal(call.key, 'shield_block');
assert.equal(call.options.pan, 1);
assert.equal(call.options.distance, 18);
assert(call.options.gain > 0 && call.options.gain < 0.3);
call = null;
engine.playSpatial('shield_block', 'B', { distance: 18, pan: 0 });
assert.equal(call, null, 'Spatial cues must respect existing per-clip rate limits');

// 驗證勝利凱旋歡呼音景（人聲共振峰聲浪＋節奏音效與 stopFinale 完整清理）
const finaleCalls = [];
engine.buffers.war_horn = {};
engine.buffers.war_drum = {};
engine.buffers.victory = {};
engine.buffers.defeat = {};
engine.buffers.strategy_gong = {};
engine.buffers.shield_block = {};
engine.sfxBus = { id: 'sfxBus' };
engine.bgmBus = { gain: { setValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} } };
engine.ctx.sampleRate = 44100;
engine.ctx.createBuffer = (ch, len, sr) => ({
  sampleRate: sr,
  length: len,
  getChannelData: () => new Float32Array(len)
});
nodes.length = 0;
engine._triggerBuffer = (key, opts) => { finaleCalls.push({ key, opts }); return true; };
engine.playBattleFinale('victory', 'A');
assert(finaleCalls.some(c => c.key === 'war_horn') && finaleCalls.some(c => c.key === 'war_drum'),
  'Victory finale must immediately trigger horn and drum');
assert(engine.finaleNodes.size === 3, 'Victory finale must spawn 3 crowd cheer noise waves');
assert(nodes.some(n => n.kind === 'filter') && nodes.some(n => n.kind === 'pan'),
  'Crowd cheer waves must route through formant bandpass/lowpass filters and stereo panners');
engine.stopFinale();
assert.equal(engine.finaleNodes.size, 0, 'stopFinale must stop and disconnect all cheer waves');
assert(nodes.filter(n => n.kind === 'source').every(n => n.stopped && n.disconnected),
  'Every finale noise source must stop and disconnect cleanly');
engine.playBattleFinale('defeat', 'B');
assert.equal(engine.finaleNodes.size, 2, 'Defeat finale must spawn 2 distant enemy cheer waves');
engine.stopFinale();
engine.playBattleFinale('draw', 'draw');
assert(finaleCalls.some(c => c.key === 'strategy_gong'), 'Draw finale must sound the strategy gong');
engine.stopFinale();

console.log('PASS: spatial gain, distance filtering, panning, mute, rate limits and node cleanup.');
