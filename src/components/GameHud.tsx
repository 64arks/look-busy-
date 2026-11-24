import React from 'react';
import { ActivityType, Hotspot, HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onSelectActivity: (act: ActivityType) => void;
  onTriggerHotspot: (id: Hotspot['id']) => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
}

const ACTIVITIES: Array<{
  id: Exclude<ActivityType, 'idle' | 'coffee' | 'couch' | 'prank'>;
  label: string;
  hint: string;
  keyNum: string;
  activeBg: string;
  ring: string;
}> = [
  {
    id: 'work',
    label: 'Work',
    hint: 'Tasks',
    keyNum: '1',
    activeBg: 'bg-emerald-600 text-white border-emerald-900',
    ring: 'hover:bg-emerald-50',
  },
  {
    id: 'phone',
    label: 'Phone',
    hint: '+Mood',
    keyNum: '2',
    activeBg: 'bg-sky-600 text-white border-sky-900',
    ring: 'hover:bg-sky-50',
  },
  {
    id: 'game',
    label: 'Game',
    hint: '++Mood',
    keyNum: '3',
    activeBg: 'bg-violet-600 text-white border-violet-900',
    ring: 'hover:bg-violet-50',
  },
  {
    id: 'snack',
    label: 'Snack',
    hint: '++Mood',
    keyNum: '4',
    activeBg: 'bg-amber-600 text-white border-amber-900',
    ring: 'hover:bg-amber-50',
  },
  {
    id: 'nap',
    label: 'Nap',
    hint: '+++Mood',
    keyNum: '5',
    activeBg: 'bg-rose-600 text-white border-rose-900',
    ring: 'hover:bg-rose-50',
  },
];

function ActivityIcon({ id }: { id: string }) {
  switch (id) {
    case 'work':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="13" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      );
    case 'phone':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="7" y="2" width="10" height="20" rx="2.5" />
          <path d="M11 18h2" />
        </svg>
      );
    case 'game':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="4" />
          <path d="M7 12h4M9 10v4" />
          <circle cx="16.5" cy="11" r="1" fill="currentColor" />
          <circle cx="14.5" cy="13" r="1" fill="currentColor" />
        </svg>
      );
    case 'snack':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M7 8l1 1M16 9l-1 1M15 16l-1-1" />
        </svg>
      );
    case 'nap':
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h7l-7 8h7" />
          <path d="M14 10h6l-6 7h6" />
        </svg>
      );
  }
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  muted,
  onSelectActivity,
  onTriggerHotspot,
  onTogglePause,
  onToggleMute,
}) => {
  const moodStatus =
    hud.mood <= 25 ? 'BORED!' : hud.mood <= 55 ? 'MEH' : 'HYPED';
  const moodColor =
    hud.mood <= 25
      ? 'bg-rose-500'
      : hud.mood <= 55
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-between p-2.5 sm:p-4 pointer-events-none">
      {/* Top Perimeter HUD */}
      <div className="flex items-start justify-between gap-2 w-full max-w-6xl mx-auto">
        {/* Top-Left: Mood (Anti-Boredom) + HR Strikes */}
        <div className="pointer-events-auto flex flex-col gap-1.5 bg-[#fff8ed]/95 border-2 border-[#5c3c24] rounded-2xl px-3 py-2 shadow-[0_6px_16px_rgba(0,0,0,0.3)] min-w-[164px] sm:min-w-[220px]">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#2b1d14]">
            <span className="flex items-center gap-1.5">
              <span className="uppercase tracking-wider text-[10px] text-[#7c5333]">Mood</span>
              <span
                className={
                  hud.mood <= 25
                    ? 'text-rose-600'
                    : hud.mood <= 55
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                }
              >
                {moodStatus}
              </span>
            </span>
            <span className="font-display text-sm tabular-nums">{hud.mood}%</span>
          </div>

          <div className="w-full h-2.5 bg-[#e7d5be] rounded-full overflow-hidden border border-[#b8926a]">
            <div
              className={`h-full ${moodColor}`}
              style={{ width: `${Math.max(0, Math.min(100, hud.mood))}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c5333]">
              HR Strikes
            </span>
            <div className="flex items-center gap-1" aria-label={`${hud.strikes} of ${hud.maxStrikes} HR strikes`}>
              {Array.from({ length: hud.maxStrikes }).map((_, idx) => {
                const filled = idx < hud.strikes;
                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-extrabold border ${
                      filled
                        ? 'bg-rose-600 text-white border-rose-900'
                        : 'bg-[#f5ead8] text-[#9b7549] border-[#c9a982]'
                    }`}
                  >
                    {filled ? '!' : '·'}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top-Center: Task Progress (compact on mobile, inline on desktop) */}
        <div className="hidden sm:flex flex-col gap-1 bg-[#fff8ed]/95 border-2 border-[#5c3c24] rounded-2xl px-4 py-2 shadow-[0_6px_16px_rgba(0,0,0,0.3)] min-w-[230px]">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#2b1d14]">
            <span className="truncate max-w-[165px]">{hud.currentTaskTitle}</span>
            <span className="tabular-nums text-[#7c5333]">
              {hud.tasksCompleted}/{hud.tasksTotal}
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#e7d5be] rounded-full overflow-hidden border border-[#b8926a]">
            <div
              className="h-full bg-emerald-600"
              style={{ width: `${hud.currentTaskProgress}%` }}
            />
          </div>
        </div>

        {/* Top-Right: Shift/Score + Mute & Pause */}
        <div className="flex items-start gap-1.5 sm:gap-2">
          <div className="pointer-events-auto flex flex-col items-end bg-[#fff8ed]/95 border-2 border-[#5c3c24] rounded-2xl px-3 py-2 shadow-[0_6px_16px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7c5333] tabular-nums">
              <span>Shift {hud.level}</span>
              {hud.combo > 1 && <span className="text-[#d97706]">· {hud.combo}x</span>}
              {hud.caffeineTimer > 0 && (
                <span className="text-amber-700">· ☕ {hud.caffeineTimer.toFixed(0)}s</span>
              )}
            </div>
            <div className="font-display font-extrabold text-lg sm:text-xl leading-tight text-[#2b1d14] tabular-nums">
              {hud.score.toLocaleString()}
            </div>
            {/* Mobile compact task counter */}
            <div className="sm:hidden text-[10px] font-bold text-emerald-700 tabular-nums">
              Tasks {hud.tasksCompleted}/{hud.tasksTotal} ({hud.currentTaskProgress}%)
            </div>
          </div>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="pointer-events-auto min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#fff8ed]/95 text-[#2b1d14] border-2 border-[#5c3c24] shadow-[0_6px_16px_rgba(0,0,0,0.3)] hover:bg-white active:scale-95 transition-transform cursor-pointer"
          >
            {muted ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePause();
            }}
            aria-label="Pause game"
            className="pointer-events-auto min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#fff8ed]/95 text-[#2b1d14] border-2 border-[#5c3c24] shadow-[0_6px_16px_rgba(0,0,0,0.3)] hover:bg-white active:scale-95 transition-transform cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Transient Alert Banner (Boss Incoming / Spotted!) */}
      <div className="flex flex-col items-center gap-2 pointer-events-none">
        {hud.bossWarning && (
          <div className="bg-rose-600 text-white font-display font-extrabold text-sm sm:text-base px-4 py-1.5 rounded-xl border-2 border-rose-950 shadow-lg animate-bounce">
            BOSS INCOMING — LOOK BUSY!
          </div>
        )}
        {!hud.bossWarning && hud.suspicion > 35 && (
          <div className="bg-amber-500 text-[#1f1712] font-display font-extrabold text-xs sm:text-sm px-3.5 py-1 rounded-xl border-2 border-[#5c3c24] shadow-md tabular-nums">
            SUSPICION {hud.suspicion}% — HIT WORK!
          </div>
        )}
      </div>

      {/* Bottom Thumb-Zone Dock */}
      <div className="flex flex-col items-center gap-2 w-full max-w-xl mx-auto">
        {/* Contextual Hotspot Action when near Coffee / Couch / Printer */}
        {hud.nearbyHotspot && hud.nearbyHotspot.cooldown <= 0 && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerHotspot(hud.nearbyHotspot!.id);
            }}
            className="pointer-events-auto min-h-[44px] px-5 py-2 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-[#1f1712] font-display font-bold text-sm border-2 border-[#78350f] shadow-lg active:scale-95 transition-transform cursor-pointer whitespace-nowrap"
          >
            {hud.nearbyHotspot.actionLabel}
          </button>
        )}

        {/* Primary 5-Activity Dock */}
        <div className="pointer-events-auto grid grid-cols-5 gap-1.5 sm:gap-2 w-full bg-[#fff8ed]/95 border-2 border-[#5c3c24] rounded-2xl p-1.5 sm:p-2 shadow-[0_10px_24px_rgba(0,0,0,0.4)]">
          {ACTIVITIES.map((act) => {
            const isActive = hud.activity === act.id;
            return (
              <button
                key={act.id}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelectActivity(act.id);
                }}
                aria-pressed={isActive}
                className={`min-h-[50px] sm:min-h-[54px] flex flex-col items-center justify-center rounded-xl border-b-2 px-1 py-1.5 transition-all cursor-pointer active:scale-95 ${
                  isActive
                    ? `${act.activeBg} shadow-inner`
                    : `bg-[#f6ead7] text-[#2b1d14] border-[#cbb190] ${act.ring}`
                }`}
              >
                <ActivityIcon id={act.id} />
                <span className="text-[11px] sm:text-xs font-bold leading-tight mt-0.5 whitespace-nowrap">
                  {act.label}
                </span>
                <span
                  className={`text-[9px] font-semibold leading-none mt-0.5 whitespace-nowrap ${
                    isActive ? 'text-white/90' : 'text-[#7c5333]'
                  }`}
                >
                  {act.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
