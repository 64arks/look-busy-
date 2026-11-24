import {
  clampToWalkable,
  createHotspots,
  createNpcsForLevel,
  createTasksForLevel,
  getLevelConfig,
  PLAYER_DESK_FACING,
  PLAYER_DESK_POS,
} from './levels';
import {
  ActivityType,
  GameSimState,
  Hotspot,
  HudSnapshot,
  NpcState,
  SimAudioEvent,
  Vec2,
} from './types';

export const ACTIVITY_META: Record<
  ActivityType,
  {
    label: string;
    shortLabel: string;
    moodRate: number; // per second
    riskFactor: number; // detection speed multiplier
    rangeBonus: number; // extra vision range multiplier
    scoreRate: number;
    hideDelay: number;
    isForbidden: boolean;
  }
> = {
  idle: {
    label: 'Daydream',
    shortLabel: 'Idle',
    moodRate: -3.0,
    riskFactor: 0,
    rangeBonus: 1.0,
    scoreRate: 0,
    hideDelay: 0,
    isForbidden: false,
  },
  work: {
    label: 'Look Busy',
    shortLabel: 'Work',
    moodRate: -7.5,
    riskFactor: 0,
    rangeBonus: 1.0,
    scoreRate: 12,
    hideDelay: 0,
    isForbidden: false,
  },
  phone: {
    label: 'Scroll Phone',
    shortLabel: 'Phone',
    moodRate: 14.5,
    riskFactor: 1.0,
    rangeBonus: 1.0,
    scoreRate: 22,
    hideDelay: 0.08,
    isForbidden: true,
  },
  game: {
    label: 'Pocket Game',
    shortLabel: 'Game',
    moodRate: 20.0,
    riskFactor: 1.25,
    rangeBonus: 1.18,
    scoreRate: 34,
    hideDelay: 0.14,
    isForbidden: true,
  },
  snack: {
    label: 'Secret Snack',
    shortLabel: 'Snack',
    moodRate: 23.0,
    riskFactor: 1.2,
    rangeBonus: 1.12,
    scoreRate: 28,
    hideDelay: 0.16,
    isForbidden: true,
  },
  nap: {
    label: 'Power Nap',
    shortLabel: 'Nap',
    moodRate: 29.0,
    riskFactor: 1.45,
    rangeBonus: 1.28,
    scoreRate: 40,
    hideDelay: 0.38,
    isForbidden: true,
  },
  coffee: {
    label: 'Espresso',
    shortLabel: 'Coffee',
    moodRate: 18.0,
    riskFactor: 0.35,
    rangeBonus: 0.9,
    scoreRate: 20,
    hideDelay: 0,
    isForbidden: false,
  },
  couch: {
    label: 'Lounge',
    shortLabel: 'Couch',
    moodRate: 34.0,
    riskFactor: 1.5,
    rangeBonus: 1.3,
    scoreRate: 45,
    hideDelay: 0.15,
    isForbidden: true,
  },
  prank: {
    label: 'Paper Jam',
    shortLabel: 'Prank',
    moodRate: 12.0,
    riskFactor: 1.1,
    rangeBonus: 1.0,
    scoreRate: 60,
    hideDelay: 0,
    isForbidden: true,
  },
};

export function createInitialSimState(
  level = 1,
  bestScore = 0,
  bestLevel = 1,
  carryScore = 0,
): GameSimState {
  const config = getLevelConfig(level);
  return {
    phase: 'title',
    outcome: 'none',
    level,
    levelTitle: config.title,
    levelSubtitle: config.subtitle,
    score: carryScore,
    bestScore: Math.max(bestScore, carryScore),
    bestLevel: Math.max(bestLevel, level),
    combo: 1,
    closeCalls: 0,
    strikes: 0,
    maxStrikes: 3,
    strikeGraceTimer: 0,
    elapsedSec: 0,
    bossTimer: config.enableBoss ? config.bossIntervalSec * 0.7 : 999,
    bossActiveTimer: 0,
    bossWarningTimer: 0,
    trauma: 0,
    hitFlashTimer: 0,
    player: {
      gx: PLAYER_DESK_POS.x,
      gy: PLAYER_DESK_POS.y,
      dir: PLAYER_DESK_FACING,
      targetPos: null,
      returningToDesk: false,
      atDesk: true,
      activity: 'work',
      pendingActivity: null,
      switchLockTimer: 0,
      mood: 82,
      suspicion: 0,
      wasBeingWatched: false,
      caffeineTimer: 0,
      walkPhase: 0,
      actionPhase: 0,
      bubbleText: null,
      bubbleTimer: 0,
    },
    tasks: createTasksForLevel(config),
    npcs: createNpcsForLevel(config),
    hotspots: createHotspots(),
    floatingTexts: [],
    nextFloatingId: 1,
    recentEvent: null,
  };
}

export function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function isPointInVisionCone(
  originX: number,
  originY: number,
  dir: number,
  range: number,
  halfAngle: number,
  targetX: number,
  targetY: number,
): boolean {
  const dx = targetX - originX;
  const dy = targetY - originY;
  const distSq = dx * dx + dy * dy;
  if (distSq > range * range) return false;
  if (distSq < 0.25) return true;
  const angleToTarget = Math.atan2(dy, dx);
  const diff = Math.abs(normalizeAngle(angleToTarget - dir));
  return diff <= halfAngle;
}

export function gridToIso(gx: number, gy: number, tileW = 64, tileH = 34): Vec2 {
  return {
    x: (gx - gy) * (tileW * 0.5),
    y: (gx + gy) * (tileH * 0.5),
  };
}

export function isoToGrid(ix: number, iy: number, tileW = 64, tileH = 34): Vec2 {
  const hw = tileW * 0.5;
  const hh = tileH * 0.5;
  const gx = (ix / hw + iy / hh) * 0.5;
  const gy = (iy / hh - ix / hw) * 0.5;
  return { x: gx, y: gy };
}

export function findNearbyHotspot(sim: GameSimState): Hotspot | null {
  for (const h of sim.hotspots) {
    const dx = sim.player.gx - h.gx;
    const dy = sim.player.gy - h.gy;
    if (dx * dx + dy * dy <= h.radius * h.radius) {
      return h;
    }
  }
  return null;
}

function addFloatingText(
  sim: GameSimState,
  gx: number,
  gy: number,
  text: string,
  color: string,
  gz = 1.2,
): void {
  sim.floatingTexts.push({
    id: sim.nextFloatingId++,
    gx,
    gy,
    gz,
    text,
    color,
    life: 1.25,
    maxLife: 1.25,
  });
  if (sim.floatingTexts.length > 16) {
    sim.floatingTexts.shift();
  }
}

export function setPlayerActivity(sim: GameSimState, next: ActivityType): void {
  if (sim.phase !== 'playing') return;
  const p = sim.player;

  if (next === 'work') {
    if (!p.atDesk) {
      p.returningToDesk = true;
      p.targetPos = { x: PLAYER_DESK_POS.x, y: PLAYER_DESK_POS.y };
      p.activity = 'idle';
      p.pendingActivity = 'work';
      p.bubbleText = 'Back to desk!';
      p.bubbleTimer = 0.9;
      return;
    }
    if (p.activity !== 'work') {
      const currentDelay = ACTIVITY_META[p.activity].hideDelay;
      if (currentDelay > 0 && p.switchLockTimer <= 0) {
        p.pendingActivity = 'work';
        p.switchLockTimer = currentDelay;
        return;
      }
      p.activity = 'work';
      p.pendingActivity = null;
      p.switchLockTimer = 0;
      p.dir = PLAYER_DESK_FACING;
    }
    return;
  }

  // Slacking activities at desk or in place
  if (next === 'phone' || next === 'game' || next === 'snack' || next === 'nap') {
    p.returningToDesk = false;
    p.targetPos = null;
    p.pendingActivity = null;
    p.switchLockTimer = 0;
    p.activity = next;
    const icons: Record<string, string> = {
      phone: '📱 Meme time!',
      game: '🎮 High score!',
      snack: '🍩 Cronch!',
      nap: '💤 Zzz...',
    };
    p.bubbleText = icons[next] || null;
    p.bubbleTimer = 1.1;
    const audioMap: Record<string, SimAudioEvent> = {
      phone: 'slack_phone',
      game: 'slack_game',
      snack: 'slack_snack',
      nap: 'slack_nap',
    };
    sim.recentEvent = audioMap[next] || null;
  }
}

export function triggerHotspotAction(sim: GameSimState, hotspotId: Hotspot['id']): boolean {
  if (sim.phase !== 'playing') return false;
  const h = sim.hotspots.find((item) => item.id === hotspotId);
  if (!h || h.cooldown > 0) return false;

  const p = sim.player;
  const dx = p.gx - h.gx;
  const dy = p.gy - h.gy;
  if (dx * dx + dy * dy > h.radius * h.radius) {
    // Walk there automatically!
    p.returningToDesk = false;
    p.targetPos = { x: h.gx, y: h.gy };
    p.pendingActivity = hotspotId;
    return true;
  }

  if (hotspotId === 'coffee') {
    h.cooldown = h.maxCooldown;
    p.caffeineTimer = 10.0;
    p.mood = Math.min(100, p.mood + 18);
    sim.score += 120;
    p.bubbleText = '☕ Espresso Rush!';
    p.bubbleTimer = 1.4;
    addFloatingText(sim, p.gx, p.gy, '+2x Work Speed!', '#f59e0b');
    sim.recentEvent = 'coffee';
    return true;
  }

  if (hotspotId === 'couch') {
    p.activity = 'couch';
    p.bubbleText = '🛋️ So comfy...';
    p.bubbleTimer = 1.2;
    sim.recentEvent = 'slack_nap';
    return true;
  }

  if (hotspotId === 'prank') {
    h.cooldown = h.maxCooldown;
    sim.score += 180;
    p.mood = Math.min(100, p.mood + 14);
    p.bubbleText = '🖨️ Paper Jam!';
    p.bubbleTimer = 1.3;
    addFloatingText(sim, h.gx, h.gy, 'Distracted Crew! +180', '#38bdf8');
    sim.recentEvent = 'prank';
    // Distract coworker & manager toward printer
    for (const npc of sim.npcs) {
      if (npc.active && (npc.role === 'coworker' || npc.role === 'manager')) {
        npc.state = 'distracted';
        npc.distractTarget = { x: h.gx - 0.5, y: h.gy - 0.5 };
        npc.distractTimer = 6.5;
        npc.bubbleText = 'What jammed?!';
        npc.bubbleTimer = 2.0;
      }
    }
    return true;
  }

  return false;
}

export function setMoveTarget(sim: GameSimState, gx: number, gy: number): void {
  if (sim.phase !== 'playing') return;
  const clamped = clampToWalkable(gx, gy, sim.player.gx, sim.player.gy);
  sim.player.targetPos = clamped;
  sim.player.returningToDesk = false;
  sim.player.pendingActivity = null;
  if (sim.player.activity !== 'idle') {
    sim.player.activity = 'idle';
  }
}

export function movePlayerByAxis(sim: GameSimState, ax: number, ay: number, dt: number): void {
  if (sim.phase !== 'playing') return;
  if (Math.abs(ax) < 0.01 && Math.abs(ay) < 0.01) return;
  const p = sim.player;
  const len = Math.hypot(ax, ay);
  const nx = ax / len;
  const ny = ay / len;
  const speed = p.caffeineTimer > 0 ? 4.1 : 3.2;

  p.targetPos = null;
  p.returningToDesk = false;
  p.pendingActivity = null;
  p.activity = 'idle';

  const nextPos = clampToWalkable(p.gx + nx * speed * dt, p.gy + ny * speed * dt, p.gx, p.gy);
  p.gx = nextPos.x;
  p.gy = nextPos.y;
  p.dir = Math.atan2(ny, nx);
  p.walkPhase += speed * dt * 4.5;

  const deskDist = Math.hypot(p.gx - PLAYER_DESK_POS.x, p.gy - PLAYER_DESK_POS.y);
  p.atDesk = deskDist < 0.55;
}

function updateNpcPatrol(npc: NpcState, dt: number): void {
  if (!npc.active) return;

  if (npc.bubbleTimer > 0) {
    npc.bubbleTimer = Math.max(0, npc.bubbleTimer - dt);
    if (npc.bubbleTimer === 0) npc.bubbleText = null;
  }

  // Distracted by printer prank
  if (npc.state === 'distracted' && npc.distractTarget) {
    npc.distractTimer -= dt;
    const dx = npc.distractTarget.x - npc.gx;
    const dy = npc.distractTarget.y - npc.gy;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.35) {
      const step = Math.min(dist, npc.speed * 1.15 * dt);
      npc.gx += (dx / dist) * step;
      npc.gy += (dy / dist) * step;
      npc.dir = Math.atan2(dy, dx);
      npc.walkPhase += step * 4.5;
    } else {
      npc.dir = Math.atan2(dy, dx);
    }
    if (npc.distractTimer <= 0) {
      npc.state = 'patrol';
      npc.distractTarget = null;
    }
    return;
  }

  // Pause at waypoint
  if (npc.pauseTimer > 0) {
    npc.pauseTimer = Math.max(0, npc.pauseTimer - dt);
    const wp = npc.waypoints[npc.waypointIdx];
    if (wp?.lookDir !== undefined) {
      const diff = normalizeAngle(wp.lookDir - npc.dir);
      npc.dir = normalizeAngle(npc.dir + diff * Math.min(1, dt * 6));
    }
    return;
  }

  if (npc.waypoints.length === 0) return;
  const target = npc.waypoints[npc.waypointIdx];
  const dx = target.gx - npc.gx;
  const dy = target.gy - npc.gy;
  const dist = Math.hypot(dx, dy);

  if (dist < 0.12) {
    npc.pauseTimer = target.pauseSec;
    npc.waypointIdx = (npc.waypointIdx + 1) % npc.waypoints.length;
    if (npc.role === 'boss' && npc.waypointIdx === 0) {
      // Finished boss patrol loop
      npc.active = false;
    }
    return;
  }

  const step = Math.min(dist, npc.speed * dt);
  npc.gx += (dx / dist) * step;
  npc.gy += (dy / dist) * step;
  const targetAngle = Math.atan2(dy, dx);
  const angleDiff = normalizeAngle(targetAngle - npc.dir);
  npc.dir = normalizeAngle(npc.dir + angleDiff * Math.min(1, dt * 8));
  npc.walkPhase += step * 4.5;
}

export function stepSimulation(
  sim: GameSimState,
  rawDt: number,
): SimAudioEvent | null {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  sim.recentEvent = null;

  // Ambient title-screen background motion
  if (sim.phase === 'title') {
    for (const npc of sim.npcs) {
      if (npc.role === 'coworker' || npc.role === 'manager') {
        npc.active = true;
        updateNpcPatrol(npc, dt * 0.75);
      }
    }
    sim.player.actionPhase += dt * 4;
    return null;
  }

  if (sim.phase !== 'playing') {
    return null;
  }

  const config = getLevelConfig(sim.level);
  const p = sim.player;
  sim.elapsedSec += dt;
  sim.trauma = Math.max(0, sim.trauma - dt * 1.9);
  sim.hitFlashTimer = Math.max(0, sim.hitFlashTimer - dt);
  sim.strikeGraceTimer = Math.max(0, sim.strikeGraceTimer - dt);

  if (p.caffeineTimer > 0) {
    p.caffeineTimer = Math.max(0, p.caffeineTimer - dt);
  }
  if (p.bubbleTimer > 0) {
    p.bubbleTimer = Math.max(0, p.bubbleTimer - dt);
    if (p.bubbleTimer === 0) p.bubbleText = null;
  }

  // Update hotspot cooldowns
  for (const h of sim.hotspots) {
    if (h.cooldown > 0) {
      h.cooldown = Math.max(0, h.cooldown - dt);
    }
  }

  // Update floating texts
  for (let i = sim.floatingTexts.length - 1; i >= 0; i--) {
    const ft = sim.floatingTexts[i];
    ft.life -= dt;
    ft.gz += dt * 0.65;
    if (ft.life <= 0) {
      sim.floatingTexts.splice(i, 1);
    }
  }

  // Handle pending hide/wake-up lock
  if (p.switchLockTimer > 0) {
    p.switchLockTimer = Math.max(0, p.switchLockTimer - dt);
    if (p.switchLockTimer === 0 && p.pendingActivity === 'work') {
      p.activity = 'work';
      p.pendingActivity = null;
      p.dir = PLAYER_DESK_FACING;
    }
  }

  // Auto-move toward tap target or desk
  if (p.targetPos) {
    const dx = p.targetPos.x - p.gx;
    const dy = p.targetPos.y - p.gy;
    const dist = Math.hypot(dx, dy);
    const moveSpeed = (p.returningToDesk ? 4.4 : 3.4) * (p.caffeineTimer > 0 ? 1.25 : 1);

    if (dist < 0.14) {
      p.gx = p.targetPos.x;
      p.gy = p.targetPos.y;
      p.targetPos = null;
      const arrivedAtDesk = Math.hypot(p.gx - PLAYER_DESK_POS.x, p.gy - PLAYER_DESK_POS.y) < 0.55;
      p.atDesk = arrivedAtDesk;
      if (p.returningToDesk) {
        p.returningToDesk = false;
        p.activity = 'work';
        p.pendingActivity = null;
        p.dir = PLAYER_DESK_FACING;
      } else if (
        p.pendingActivity === 'coffee' ||
        p.pendingActivity === 'couch' ||
        p.pendingActivity === 'prank'
      ) {
        const pendingHotspot = p.pendingActivity;
        p.pendingActivity = null;
        triggerHotspotAction(sim, pendingHotspot);
      }
    } else {
      const step = Math.min(dist, moveSpeed * dt);
      const next = clampToWalkable(p.gx + (dx / dist) * step, p.gy + (dy / dist) * step, p.gx, p.gy);
      p.gx = next.x;
      p.gy = next.y;
      p.dir = Math.atan2(dy, dx);
      p.walkPhase += step * 4.5;
      p.atDesk = Math.hypot(p.gx - PLAYER_DESK_POS.x, p.gy - PLAYER_DESK_POS.y) < 0.55;
    }
  } else {
    p.atDesk = Math.hypot(p.gx - PLAYER_DESK_POS.x, p.gy - PLAYER_DESK_POS.y) < 0.55;
  }

  p.actionPhase += dt * (p.activity === 'work' ? 12 : 5);

  // Mood (Anti-Boredom) & Task Progress
  const meta = ACTIVITY_META[p.activity];
  let moodDelta = meta.moodRate * dt;
  if (meta.moodRate < 0) {
    moodDelta *= config.moodDrainMult;
    if (p.caffeineTimer > 0) {
      moodDelta *= 0.45; // Espresso halves boredom drain!
    }
  }
  p.mood = Math.max(0, Math.min(100, p.mood + moodDelta));

  if (meta.scoreRate > 0) {
    sim.score += meta.scoreRate * dt * sim.combo;
  }

  // Work progresses active task (must be at desk!)
  if (p.activity === 'work' && p.atDesk) {
    const activeTask = sim.tasks.find((t) => !t.completed);
    if (activeTask) {
      const speedMult = p.caffeineTimer > 0 ? 2.0 : 1.0;
      const pctPerSec = (100 / activeTask.durationSec) * speedMult;
      activeTask.progress = Math.min(100, activeTask.progress + pctPerSec * dt);
      if (activeTask.progress >= 100) {
        activeTask.completed = true;
        sim.score += 300 * sim.level;
        addFloatingText(sim, p.gx, p.gy, `Task Done! +${300 * sim.level}`, '#10b981');
        sim.recentEvent = 'task_done';
      }
    }
  }

  // Boss surprise inspection timer (Level 3+)
  if (config.enableBoss) {
    const boss = sim.npcs.find((n) => n.role === 'boss');
    if (boss) {
      if (!boss.active && sim.bossWarningTimer <= 0) {
        sim.bossTimer -= dt;
        if (sim.bossTimer <= 0) {
          sim.bossWarningTimer = 1.8;
          sim.recentEvent = 'boss_warning';
        }
      } else if (sim.bossWarningTimer > 0) {
        sim.bossWarningTimer = Math.max(0, sim.bossWarningTimer - dt);
        if (sim.bossWarningTimer === 0) {
          boss.active = true;
          boss.gx = 6.2;
          boss.gy = 1.0;
          boss.waypointIdx = 0;
          boss.pauseTimer = 0;
          boss.bubbleText = 'Inspection!';
          boss.bubbleTimer = 2.0;
          sim.bossActiveTimer = config.bossDurationSec;
        }
      } else if (boss.active) {
        sim.bossActiveTimer -= dt;
        if (sim.bossActiveTimer <= 0) {
          boss.active = false;
          sim.bossTimer = config.bossIntervalSec;
        }
      }
    }
  }

  // Update NPCs and compute stealth detection
  let watcherCount = 0;
  let maxSuspicionRate = 0;
  const isCaughtSlacking = meta.isForbidden || (!p.atDesk && p.activity !== 'coffee');

  for (const npc of sim.npcs) {
    updateNpcPatrol(npc, dt);
    if (!npc.active || npc.state === 'distracted') {
      npc.alertLevel = Math.max(0, npc.alertLevel - dt * 2.5);
      continue;
    }

    const effectiveRange = npc.visionRange * meta.rangeBonus;
    const seesPlayer = isPointInVisionCone(
      npc.gx,
      npc.gy,
      npc.dir,
      effectiveRange,
      npc.visionHalfAngle,
      p.gx,
      p.gy,
    );

    if (seesPlayer && isCaughtSlacking && sim.strikeGraceTimer <= 0) {
      watcherCount++;
      npc.alertLevel = Math.min(1, npc.alertLevel + dt * 3.0);
      const roleMult =
        npc.role === 'boss' ? 1.85 : npc.role === 'security' ? 1.35 : npc.role === 'manager' ? 1.2 : 1.0;
      const rate = 68 * Math.max(0.75, meta.riskFactor) * roleMult * config.suspicionRateMult;
      if (rate > maxSuspicionRate) maxSuspicionRate = rate;
      if (!npc.bubbleText) {
        npc.bubbleText = npc.role === 'boss' ? 'EXCUSE ME?!' : 'Hey!!';
        npc.bubbleTimer = 0.8;
      }
    } else {
      npc.alertLevel = Math.max(0, npc.alertLevel - dt * 2.2);
    }
  }

  if (watcherCount > 0) {
    if (!p.wasBeingWatched && p.suspicion < 20) {
      sim.recentEvent = 'spotted';
    }
    p.wasBeingWatched = true;
    p.suspicion = Math.min(100, p.suspicion + maxSuspicionRate * dt);
  } else {
    // Close call bonus if player hid just in time!
    if (p.wasBeingWatched && p.suspicion >= 35 && p.suspicion < 100) {
      sim.closeCalls += 1;
      sim.combo = Math.min(5, sim.combo + 1);
      const bonus = 150 * sim.combo;
      sim.score += bonus;
      addFloatingText(sim, p.gx, p.gy, `Close Call! +${bonus}`, '#fbbf24');
      sim.recentEvent = 'close_call';
    }
    p.wasBeingWatched = false;
    p.suspicion = Math.max(0, p.suspicion - 52 * dt);
  }

  // Update best score
  if (sim.score > sim.bestScore) {
    sim.bestScore = Math.floor(sim.score);
  }

  // Check BUSTED (Suspicion 100%)
  if (p.suspicion >= 100) {
    sim.strikes += 1;
    sim.combo = 1;
    p.suspicion = 0;
    p.wasBeingWatched = false;
    p.mood = Math.max(12, p.mood - 18);
    sim.trauma = 0.85;
    sim.hitFlashTimer = 0.25;
    sim.strikeGraceTimer = 2.4;

    // Snap player back to working at desk
    p.gx = PLAYER_DESK_POS.x;
    p.gy = PLAYER_DESK_POS.y;
    p.atDesk = true;
    p.targetPos = null;
    p.returningToDesk = false;
    p.activity = 'work';
    p.pendingActivity = null;
    p.switchLockTimer = 0;
    p.dir = PLAYER_DESK_FACING;
    p.bubbleText = '😬 Sorry!!';
    p.bubbleTimer = 1.4;

    if (sim.strikes >= sim.maxStrikes) {
      sim.phase = 'gameover';
      sim.outcome = 'defeat_fired';
      sim.recentEvent = 'defeat';
      return sim.recentEvent;
    }

    addFloatingText(sim, p.gx, p.gy, `HR Strike ${sim.strikes}/${sim.maxStrikes}!`, '#ef4444');
    sim.recentEvent = 'strike';
  }

  // Check BOREDOM LOSS (Mood <= 0)
  if (p.mood <= 0) {
    p.mood = 0;
    sim.phase = 'gameover';
    sim.outcome = 'defeat_boredom';
    sim.trauma = 0.7;
    sim.recentEvent = 'defeat';
    return sim.recentEvent;
  }

  // Check LEVEL CLEAR (All tasks completed)
  if (sim.tasks.every((t) => t.completed)) {
    sim.phase = 'gameover';
    sim.outcome = 'level_clear';
    sim.score += 500 * sim.level;
    if (sim.score > sim.bestScore) sim.bestScore = Math.floor(sim.score);
    if (sim.level + 1 > sim.bestLevel) sim.bestLevel = sim.level + 1;
    sim.recentEvent = 'level_clear';
    return sim.recentEvent;
  }

  return sim.recentEvent;
}

export function buildHudSnapshot(sim: GameSimState): HudSnapshot {
  const doneCount = sim.tasks.filter((t) => t.completed).length;
  const activeTask = sim.tasks.find((t) => !t.completed) ?? sim.tasks[sim.tasks.length - 1];
  const boss = sim.npcs.find((n) => n.role === 'boss');

  return {
    phase: sim.phase,
    outcome: sim.outcome,
    level: sim.level,
    levelTitle: sim.levelTitle,
    levelSubtitle: sim.levelSubtitle,
    score: Math.round(sim.score),
    bestScore: Math.round(sim.bestScore),
    bestLevel: sim.bestLevel,
    combo: sim.combo,
    closeCalls: sim.closeCalls,
    strikes: sim.strikes,
    maxStrikes: sim.maxStrikes,
    mood: Math.round(sim.player.mood),
    suspicion: Math.round(sim.player.suspicion),
    caffeineTimer: Number(sim.player.caffeineTimer.toFixed(1)),
    activity: sim.player.activity,
    atDesk: sim.player.atDesk,
    nearbyHotspot: findNearbyHotspot(sim),
    bossWarning: sim.bossWarningTimer > 0,
    bossOnFloor: Boolean(boss?.active),
    tasksCompleted: doneCount,
    tasksTotal: sim.tasks.length,
    currentTaskTitle: activeTask ? activeTask.title : 'All Tasks Done',
    currentTaskProgress: activeTask ? Math.round(activeTask.progress) : 100,
    tasks: sim.tasks.map((t) => ({ ...t })),
    elapsedSec: Math.round(sim.elapsedSec),
  };
}
