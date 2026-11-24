export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type GameOutcome = 'none' | 'level_clear' | 'defeat_boredom' | 'defeat_fired';

export type ActivityType =
  | 'idle'
  | 'work'
  | 'phone'
  | 'game'
  | 'snack'
  | 'nap'
  | 'coffee'
  | 'couch'
  | 'prank';

export type NpcRole = 'coworker' | 'manager' | 'security' | 'boss' | 'ambient';

export interface Vec2 {
  x: number;
  y: number;
}

export interface DeskProp {
  id: string;
  gx: number;
  gy: number;
  facing: 'nw' | 'se' | 'ne' | 'sw';
  isPlayerDesk?: boolean;
  occupantName?: string;
  hairColor?: string;
  shirtColor?: string;
  hasHardHat?: boolean;
}

export interface Hotspot {
  id: 'coffee' | 'couch' | 'prank';
  label: string;
  actionLabel: string;
  gx: number;
  gy: number;
  radius: number;
  cooldown: number;
  maxCooldown: number;
}

export interface TaskItem {
  id: string;
  title: string;
  progress: number; // 0 to 100
  durationSec: number;
  completed: boolean;
}

export interface Waypoint {
  gx: number;
  gy: number;
  pauseSec: number;
  lookDir?: number; // radians in grid space
}

export interface NpcState {
  id: string;
  name: string;
  role: NpcRole;
  gx: number;
  gy: number;
  dir: number; // facing angle in grid space (radians)
  speed: number;
  visionRange: number;
  visionHalfAngle: number; // radians
  waypoints: Waypoint[];
  waypointIdx: number;
  pauseTimer: number;
  alertLevel: number; // 0..1
  state: 'patrol' | 'alert' | 'distracted' | 'incoming' | 'seated_peek';
  distractTarget: Vec2 | null;
  distractTimer: number;
  peekCycleTimer: number;
  isPeeking: boolean;
  peekWindup: number; // >0 means turning head ("?")
  bubbleText: string | null;
  bubbleTimer: number;
  shirtColor: string;
  hairColor: string;
  skinColor: string;
  walkPhase: number;
  active: boolean;
}

export interface PlayerState {
  gx: number;
  gy: number;
  dir: number;
  targetPos: Vec2 | null;
  returningToDesk: boolean;
  atDesk: boolean;
  activity: ActivityType;
  pendingActivity: ActivityType | null;
  switchLockTimer: number; // wake-up / hide delay
  mood: number; // 0..100 (boredom bar: 0 = lose!)
  suspicion: number; // 0..100
  wasBeingWatched: boolean;
  caffeineTimer: number; // seconds left of espresso buff
  walkPhase: number;
  actionPhase: number;
  bubbleText: string | null;
  bubbleTimer: number;
}

export interface FloatingText {
  id: number;
  gx: number;
  gy: number;
  gz: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface Particle {
  active: boolean;
  gx: number;
  gy: number;
  gz: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  kind: 'confetti' | 'spark' | 'zzz' | 'steam' | 'crumb';
}

export interface LevelConfig {
  level: number;
  title: string;
  subtitle: string;
  taskCount: number;
  taskDurationBase: number;
  moodDrainMult: number;
  suspicionRateMult: number;
  enableSecurity: boolean;
  enableBoss: boolean;
  bossIntervalSec: number;
  bossDurationSec: number;
  npcSpeedMult: number;
}

export interface GameSimState {
  phase: GamePhase;
  outcome: GameOutcome;
  level: number;
  levelTitle: string;
  levelSubtitle: string;
  score: number;
  bestScore: number;
  bestLevel: number;
  combo: number;
  closeCalls: number;
  strikes: number;
  maxStrikes: number;
  strikeGraceTimer: number;
  elapsedSec: number;
  bossTimer: number;
  bossActiveTimer: number;
  bossWarningTimer: number;
  trauma: number; // camera shake 0..1
  hitFlashTimer: number;
  player: PlayerState;
  tasks: TaskItem[];
  npcs: NpcState[];
  hotspots: Hotspot[];
  floatingTexts: FloatingText[];
  nextFloatingId: number;
  recentEvent: SimAudioEvent | null;
}

export type SimAudioEvent =
  | 'work_tick'
  | 'slack_phone'
  | 'slack_game'
  | 'slack_snack'
  | 'slack_nap'
  | 'coffee'
  | 'prank'
  | 'spotted'
  | 'close_call'
  | 'strike'
  | 'task_done'
  | 'level_clear'
  | 'defeat'
  | 'boss_warning';

export interface HudSnapshot {
  phase: GamePhase;
  outcome: GameOutcome;
  level: number;
  levelTitle: string;
  levelSubtitle: string;
  score: number;
  bestScore: number;
  bestLevel: number;
  combo: number;
  closeCalls: number;
  strikes: number;
  maxStrikes: number;
  mood: number;
  suspicion: number;
  caffeineTimer: number;
  activity: ActivityType;
  atDesk: boolean;
  nearbyHotspot: Hotspot | null;
  bossWarning: boolean;
  bossOnFloor: boolean;
  tasksCompleted: number;
  tasksTotal: number;
  currentTaskTitle: string;
  currentTaskProgress: number;
  tasks: TaskItem[];
  elapsedSec: number;
}
