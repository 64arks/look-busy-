import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHudSnapshot,
  createInitialSimState,
  gridToIso,
  isoToGrid,
  isPointInVisionCone,
  setPlayerActivity,
  stepSimulation,
  triggerHotspotAction,
} from './rules';

test('buildHudSnapshot returns finite mood, suspicion, and score numbers', () => {
  const sim = createInitialSimState(1);
  sim.phase = 'playing';
  const hud = buildHudSnapshot(sim);
  assert.equal(Number.isFinite(hud.mood), true);
  assert.equal(Number.isFinite(hud.suspicion), true);
  assert.equal(hud.mood, 82);
  assert.equal(hud.suspicion, 0);
});

test('isometric projection round-trips cleanly', () => {
  const iso = gridToIso(4.5, 6.25);
  const back = isoToGrid(iso.x, iso.y);
  assert.ok(Math.abs(back.x - 4.5) < 1e-6);
  assert.ok(Math.abs(back.y - 6.25) < 1e-6);
});

test('vision cone detects target inside cone and ignores target behind NPC', () => {
  assert.equal(isPointInVisionCone(5, 5, 0, 3, 0.5, 7, 5.1), true);
  assert.equal(isPointInVisionCone(5, 5, 0, 3, 0.5, 3, 5), false);
  assert.equal(isPointInVisionCone(5, 5, 0, 3, 0.5, 9, 5), false);
});

test('working progresses tasks while draining mood, and completing all tasks clears level', () => {
  const sim = createInitialSimState(1);
  sim.phase = 'playing';
  // Freeze NPCs out of sight
  for (const n of sim.npcs) n.active = false;

  const startMood = sim.player.mood;
  setPlayerActivity(sim, 'work');

  for (let i = 0; i < 40; i++) {
    stepSimulation(sim, 0.05);
  }
  assert.ok(sim.player.mood < startMood, 'Working should drain mood');
  assert.ok(sim.tasks[0].progress > 0, 'Working at desk should advance current task');

  // Keep mood high and finish all tasks
  for (let i = 0; i < 1200; i++) {
    sim.player.mood = 80;
    stepSimulation(sim, 0.05);
    if ((sim.phase as string) === 'gameover') break;
  }
  assert.equal(sim.phase, 'gameover');
  assert.equal(sim.outcome, 'level_clear');
});

test('slacking restores mood and increases score', () => {
  const sim = createInitialSimState(1);
  sim.phase = 'playing';
  for (const n of sim.npcs) n.active = false;
  sim.player.mood = 40;
  const startScore = sim.score;

  setPlayerActivity(sim, 'game');
  for (let i = 0; i < 20; i++) {
    stepSimulation(sim, 0.05);
  }
  assert.ok(sim.player.mood > 50, 'Playing pocket game should boost mood');
  assert.ok(sim.score > startScore, 'Slacking should earn score');
});

test('mood reaching 0 loses the round from boredom', () => {
  const sim = createInitialSimState(1);
  sim.phase = 'playing';
  for (const n of sim.npcs) n.active = false;
  sim.player.mood = 0.2;
  setPlayerActivity(sim, 'work');

  stepSimulation(sim, 0.05);
  assert.equal(sim.phase, 'gameover');
  assert.equal(sim.outcome, 'defeat_boredom');
});

test('being caught slacking builds suspicion, triggers strikes, and fires at 3 strikes', () => {
  const sim = createInitialSimState(1);
  sim.phase = 'playing';
  const manager = sim.npcs.find((n) => n.role === 'manager')!;
  manager.active = true;
  manager.gx = sim.player.gx + 1.2;
  manager.gy = sim.player.gy;
  manager.dir = Math.PI; // looking directly at player
  manager.pauseTimer = 10;

  setPlayerActivity(sim, 'nap');
  for (let i = 0; i < 60; i++) {
    sim.player.mood = 90;
    stepSimulation(sim, 0.05);
    if (sim.strikes > 0) break;
  }
  assert.equal(sim.strikes, 1);

  // Trigger 2nd and 3rd strikes
  sim.strikes = 2;
  sim.strikeGraceTimer = 0;
  setPlayerActivity(sim, 'nap');
  for (let i = 0; i < 60; i++) {
    sim.player.mood = 90;
    stepSimulation(sim, 0.05);
    if ((sim.phase as string) === 'gameover') break;
  }
  assert.equal(sim.strikes, 3);
  assert.equal(sim.phase, 'gameover');
  assert.equal(sim.outcome, 'defeat_fired');
});

test('printer prank distracts coworker and manager', () => {
  const sim = createInitialSimState(1);
  sim.phase = 'playing';
  const prankSpot = sim.hotspots.find((h) => h.id === 'prank')!;
  sim.player.gx = prankSpot.gx;
  sim.player.gy = prankSpot.gy;

  const triggered = triggerHotspotAction(sim, 'prank');
  assert.equal(triggered, true);
  const coworker = sim.npcs.find((n) => n.role === 'coworker')!;
  const manager = sim.npcs.find((n) => n.role === 'manager')!;
  assert.equal(coworker.state, 'distracted');
  assert.equal(manager.state, 'distracted');
});
