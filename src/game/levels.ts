import { DeskProp, Hotspot, LevelConfig, NpcState, TaskItem, Vec2 } from './types';

export const GRID_COLS = 12;
export const GRID_ROWS = 10;

export const PLAYER_DESK_POS: Vec2 = { x: 3.35, y: 4.1 };
export const PLAYER_DESK_FACING = Math.PI; // facing left toward monitor

const TASK_TITLES = [
  'Q4 Expense Sheet',
  'Reply to 42 Emails',
  'TPS Cover Reports',
  'Align Slide Decks',
  'Quarterly Audit',
  'Calendar Reshuffle',
  'Client Invoice Batch',
  'Budget Forecast',
];

export const OFFICE_DESKS: DeskProp[] = [
  // Upper-left cubicle bank (matches reference top-left cluster)
  { id: 'd1', gx: 1.7, gy: 2.3, facing: 'se', occupantName: 'Elena', shirtColor: '#7c6cf0', hairColor: '#2c1e16' },
  { id: 'd2', gx: 2.7, gy: 2.3, facing: 'nw', occupantName: 'Chloe', shirtColor: '#84cc16', hairColor: '#d97706' },
  { id: 'd3', gx: 1.7, gy: 4.1, facing: 'se', occupantName: 'Marcus', shirtColor: '#475569', hairColor: '#1e1b18' },
  {
    id: 'player_desk',
    gx: 2.7,
    gy: 4.1,
    facing: 'nw',
    isPlayerDesk: true,
    shirtColor: '#f97316',
    hairColor: '#3b2416',
  },
  // Lower-right desk bank (matches reference right-hand cluster)
  { id: 'd5', gx: 6.8, gy: 5.0, facing: 'se', occupantName: 'Noah', shirtColor: '#64748b', hairColor: '#292524' },
  { id: 'd6', gx: 7.8, gy: 5.0, facing: 'nw', occupantName: 'Maya', shirtColor: '#a3e635', hairColor: '#78350f' },
  { id: 'd7', gx: 6.8, gy: 6.8, facing: 'se', occupantName: 'Liam', shirtColor: '#ec4899', hairColor: '#451a03' },
  {
    id: 'd8',
    gx: 7.8,
    gy: 6.8,
    facing: 'nw',
    occupantName: 'Bob',
    shirtColor: '#94a3b8',
    hairColor: '#1c1917',
    hasHardHat: true,
  },
  // Bottom-left reception desk staff (matches reference white L-reception)
  { id: 'rec1', gx: 2.0, gy: 8.2, facing: 'se', occupantName: 'Claire', shirtColor: '#334155', hairColor: '#451a03' },
  { id: 'rec2', gx: 3.1, gy: 8.4, facing: 'se', occupantName: 'Ruby', shirtColor: '#fb923c', hairColor: '#7c2d12' },
];

// Rectangular walkable blockers in grid coordinates (minX, minY, maxX, maxY)
export const OBSTACLE_BOXES: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  // Upper-left desk block
  { x1: 1.15, y1: 1.8, x2: 3.15, y2: 4.65 },
  // Lower-right desk block
  { x1: 6.25, y1: 4.5, x2: 8.35, y2: 7.35 },
  // Reception counter
  { x1: 1.1, y1: 7.55, x2: 3.9, y2: 9.0 },
  // Top-left plants
  { x1: 0.2, y1: 0.2, x2: 1.5, y2: 1.3 },
];

export function isWalkable(gx: number, gy: number): boolean {
  if (gx < 0.6 || gx > GRID_COLS - 0.6 || gy < 0.8 || gy > GRID_ROWS - 0.6) {
    return false;
  }
  for (const box of OBSTACLE_BOXES) {
    if (gx >= box.x1 && gx <= box.x2 && gy >= box.y1 && gy <= box.y2) {
      return false;
    }
  }
  return true;
}

export function clampToWalkable(gx: number, gy: number, prevX: number, prevY: number): Vec2 {
  const clampedX = Math.max(0.65, Math.min(GRID_COLS - 0.65, gx));
  const clampedY = Math.max(0.85, Math.min(GRID_ROWS - 0.65, gy));
  if (isWalkable(clampedX, clampedY)) {
    return { x: clampedX, y: clampedY };
  }
  if (isWalkable(clampedX, prevY)) {
    return { x: clampedX, y: prevY };
  }
  if (isWalkable(prevX, clampedY)) {
    return { x: prevX, y: clampedY };
  }
  return { x: prevX, y: prevY };
}

export function getLevelConfig(level: number): LevelConfig {
  const titles = [
    'Intern Bullpen',
    'Open Floor Hustle',
    'Executive Audit',
    'Crunch Quarter',
    'Overtime Marathon',
  ];
  const subtitles = [
    'Dodging Brad & Ms. Vance',
    'Security Guard joins the floor',
    'Mr. Sterling starts surprise visits',
    'Faster patrols, tighter deadlines',
    'Maximum corporate chaos',
  ];
  const idx = Math.min(level - 1, titles.length - 1);
  return {
    level,
    title: level <= titles.length ? titles[idx] : `Promotion Tier ${level}`,
    subtitle: level <= subtitles.length ? subtitles[idx] : 'Survive endless executive scrutiny',
    taskCount: Math.min(6, 2 + level),
    taskDurationBase: Math.max(4.5, 5.5 + level * 0.6),
    moodDrainMult: 1 + (level - 1) * 0.12,
    suspicionRateMult: 1 + (level - 1) * 0.14,
    enableSecurity: level >= 2,
    enableBoss: level >= 3,
    bossIntervalSec: Math.max(11, 18 - level * 1.4),
    bossDurationSec: Math.min(11, 7 + level * 0.6),
    npcSpeedMult: 1 + (level - 1) * 0.08,
  };
}

export function createTasksForLevel(config: LevelConfig): TaskItem[] {
  const tasks: TaskItem[] = [];
  for (let i = 0; i < config.taskCount; i++) {
    const title = TASK_TITLES[(config.level * 2 + i) % TASK_TITLES.length];
    tasks.push({
      id: `task-${config.level}-${i}`,
      title,
      progress: 0,
      durationSec: config.taskDurationBase + i * 0.8,
      completed: false,
    });
  }
  return tasks;
}

export function createHotspots(): Hotspot[] {
  return [
    {
      id: 'coffee',
      label: 'Espresso Bar',
      actionLabel: 'Grab Coffee (2x Work)',
      gx: 7.4,
      gy: 2.0,
      radius: 1.05,
      cooldown: 0,
      maxCooldown: 16,
    },
    {
      id: 'couch',
      label: 'Break Couch',
      actionLabel: 'Lounge (Mega Mood)',
      gx: 9.7,
      gy: 2.2,
      radius: 1.15,
      cooldown: 0,
      maxCooldown: 0,
    },
    {
      id: 'prank',
      label: 'Copy Printer',
      actionLabel: 'Jam Printer (Distract!)',
      gx: 5.2,
      gy: 8.2,
      radius: 1.1,
      cooldown: 0,
      maxCooldown: 18,
    },
  ];
}

export function createNpcsForLevel(config: LevelConfig): NpcState[] {
  const sm = config.npcSpeedMult;
  const npcs: NpcState[] = [
    // 1. Snitch Coworker (Brad) - sits across / wanders near upper-left aisle
    {
      id: 'npc-coworker',
      name: 'Brad (Snitch)',
      role: 'coworker',
      gx: 4.35,
      gy: 2.6,
      dir: Math.PI * 0.65,
      speed: 1.05 * sm,
      visionRange: 2.6,
      visionHalfAngle: 0.58,
      waypoints: [
        { gx: 4.35, gy: 2.6, pauseSec: 2.8, lookDir: Math.PI * 0.65 },
        { gx: 4.35, gy: 4.2, pauseSec: 2.1, lookDir: Math.PI },
        { gx: 5.1, gy: 5.2, pauseSec: 1.6, lookDir: Math.PI * 0.85 },
        { gx: 4.35, gy: 3.1, pauseSec: 2.4, lookDir: Math.PI * 0.5 },
      ],
      waypointIdx: 0,
      pauseTimer: 1.4,
      alertLevel: 0,
      state: 'patrol',
      distractTarget: null,
      distractTimer: 0,
      peekCycleTimer: 4.0,
      isPeeking: false,
      peekWindup: 0,
      bubbleText: null,
      bubbleTimer: 0,
      shirtColor: '#38bdf8',
      hairColor: '#92400e',
      skinColor: '#f6c8a8',
      walkPhase: 0,
      active: true,
    },
    // 2. Floor Manager (Ms. Vance) - patrols main aisles
    {
      id: 'npc-manager',
      name: 'Ms. Vance',
      role: 'manager',
      gx: 5.4,
      gy: 2.1,
      dir: Math.PI * 0.5,
      speed: 1.35 * sm,
      visionRange: 3.2,
      visionHalfAngle: 0.52,
      waypoints: [
        { gx: 5.4, gy: 2.1, pauseSec: 1.1, lookDir: Math.PI * 0.75 },
        { gx: 5.4, gy: 5.5, pauseSec: 1.3, lookDir: Math.PI },
        { gx: 3.8, gy: 6.2, pauseSec: 1.4, lookDir: -Math.PI * 0.5 },
        { gx: 5.5, gy: 7.2, pauseSec: 1.0, lookDir: 0 },
        { gx: 9.2, gy: 4.2, pauseSec: 1.2, lookDir: Math.PI },
        { gx: 5.6, gy: 3.4, pauseSec: 1.1, lookDir: Math.PI },
      ],
      waypointIdx: 1,
      pauseTimer: 0.6,
      alertLevel: 0,
      state: 'patrol',
      distractTarget: null,
      distractTimer: 0,
      peekCycleTimer: 0,
      isPeeking: false,
      peekWindup: 0,
      bubbleText: null,
      bubbleTimer: 0,
      shirtColor: '#6366f1',
      hairColor: '#1e1b18',
      skinColor: '#eab696',
      walkPhase: 0,
      active: true,
    },
    // 3. Security Guard (Officer Hank) - Level 2+
    {
      id: 'npc-security',
      name: 'Officer Hank',
      role: 'security',
      gx: 9.2,
      gy: 3.4,
      dir: Math.PI,
      speed: 1.15 * sm,
      visionRange: 3.9,
      visionHalfAngle: 0.44,
      waypoints: [
        { gx: 9.2, gy: 3.4, pauseSec: 1.2, lookDir: -Math.PI * 0.6 },
        { gx: 6.6, gy: 3.4, pauseSec: 1.0, lookDir: Math.PI },
        { gx: 4.7, gy: 5.4, pauseSec: 1.4, lookDir: Math.PI * 0.85 },
        { gx: 4.7, gy: 7.4, pauseSec: 1.1, lookDir: Math.PI * 0.2 },
        { gx: 9.0, gy: 8.1, pauseSec: 1.3, lookDir: -Math.PI * 0.5 },
      ],
      waypointIdx: 1,
      pauseTimer: 0.8,
      alertLevel: 0,
      state: 'patrol',
      distractTarget: null,
      distractTimer: 0,
      peekCycleTimer: 0,
      isPeeking: false,
      peekWindup: 0,
      bubbleText: null,
      bubbleTimer: 0,
      shirtColor: '#1e3a8a',
      hairColor: '#57534e',
      skinColor: '#d99b78',
      walkPhase: 0,
      active: config.enableSecurity,
    },
    // 4. The Boss (Mr. Sterling) - Level 3+ Surprise Inspections
    {
      id: 'npc-boss',
      name: 'Mr. Sterling',
      role: 'boss',
      gx: 6.2,
      gy: 1.0,
      dir: Math.PI * 0.5,
      speed: 1.65 * sm,
      visionRange: 3.7,
      visionHalfAngle: 0.62,
      waypoints: [
        { gx: 5.2, gy: 2.3, pauseSec: 0.9, lookDir: Math.PI * 0.75 },
        { gx: 4.1, gy: 4.8, pauseSec: 1.4, lookDir: -Math.PI * 0.75 },
        { gx: 5.7, gy: 6.5, pauseSec: 1.0, lookDir: 0 },
        { gx: 6.2, gy: 1.2, pauseSec: 0.4, lookDir: Math.PI * 0.5 },
      ],
      waypointIdx: 0,
      pauseTimer: 0,
      alertLevel: 0,
      state: 'patrol',
      distractTarget: null,
      distractTimer: 0,
      peekCycleTimer: 0,
      isPeeking: false,
      peekWindup: 0,
      bubbleText: null,
      bubbleTimer: 0,
      shirtColor: '#18181b',
      hairColor: '#cbd5e1',
      skinColor: '#f2c1a0',
      walkPhase: 0,
      active: false, // Spawns during surprise inspection
    },
  ];

  return npcs;
}
