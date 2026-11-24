import React from 'react';
import { HudSnapshot } from '../game/types';

interface StatusModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onNextLevel: () => void;
  onRestartShift: () => void;
  onBackToTitle: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  hud,
  onResume,
  onNextLevel,
  onRestartShift,
  onBackToTitle,
}) => {
  if (hud.phase !== 'paused' && hud.phase !== 'gameover') {
    return null;
  }

  const isPaused = hud.phase === 'paused';
  const isLevelClear = hud.phase === 'gameover' && hud.outcome === 'level_clear';
  const isBoredOut = hud.phase === 'gameover' && hud.outcome === 'defeat_boredom';

  const heading = isPaused
    ? 'Coffee Break (Paused)'
    : isLevelClear
      ? `Shift ${hud.level} Cleared!`
      : isBoredOut
        ? 'Bored to Sleep!'
        : 'You Are Fired!';

  const subcopy = isPaused
    ? `${hud.levelTitle} · ${hud.levelSubtitle}`
    : isLevelClear
      ? 'You finished all office tasks without losing your mind.'
      : isBoredOut
        ? 'Your Mood hit 0% and you passed out face-first on your keyboard.'
        : '3 HR Strikes! Management caught you slacking one too many times.';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#1a100a]/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-title"
    >
      <div className="w-full max-w-md bg-[#fff8ed] border-[3px] border-[#5c3c24] rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.55)] text-center">
        <div
          className={`inline-block text-xs font-extrabold uppercase tracking-widest mb-1.5 ${
            isLevelClear
              ? 'text-emerald-700'
              : isPaused
                ? 'text-[#9a5b25]'
                : 'text-rose-700'
          }`}
        >
          {isPaused ? 'Shift On Hold' : isLevelClear ? 'Promotion Unlocked' : 'Shift Ended'}
        </div>

        <h2
          id="status-modal-title"
          className="font-display font-extrabold text-3xl text-[#2b1d14] tracking-tight"
        >
          {heading}
        </h2>

        <p className="mt-2 text-sm font-medium text-[#5c3c24] leading-relaxed">
          {subcopy}
        </p>

        {/* 3 Clean Tabular Stat Tiles */}
        <div className="grid grid-cols-3 gap-2.5 mt-5">
          <div className="bg-[#f5ead8] border border-[#d7be9e] rounded-2xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#7c5333]">
              Score
            </div>
            <div className="font-display font-extrabold text-xl text-[#2b1d14] tabular-nums mt-0.5">
              {hud.score.toLocaleString()}
            </div>
          </div>
          <div className="bg-[#f5ead8] border border-[#d7be9e] rounded-2xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#7c5333]">
              Tasks
            </div>
            <div className="font-display font-extrabold text-xl text-[#2b1d14] tabular-nums mt-0.5">
              {hud.tasksCompleted}/{hud.tasksTotal}
            </div>
          </div>
          <div className="bg-[#f5ead8] border border-[#d7be9e] rounded-2xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#7c5333]">
              Close Calls
            </div>
            <div className="font-display font-extrabold text-xl text-[#2b1d14] tabular-nums mt-0.5">
              {hud.closeCalls}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs font-semibold text-[#7c5333] tabular-nums">
          Best Score: {hud.bestScore.toLocaleString()} · Highest Shift: {hud.bestLevel}
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col gap-2.5 mt-5">
          {isPaused && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onResume();
              }}
              className="min-h-[48px] w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-bold text-lg border-b-4 border-emerald-900 active:translate-y-0.5 transition-all cursor-pointer"
            >
              Resume Shift
            </button>
          )}

          {isLevelClear && (
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onNextLevel();
              }}
              className="min-h-[48px] w-full rounded-2xl bg-[#f97316] hover:bg-[#ea580c] text-white font-display font-bold text-lg border-b-4 border-[#9a3412] active:translate-y-0.5 transition-all cursor-pointer"
            >
              Start Shift {hud.level + 1}
            </button>
          )}

          {!isPaused && !isLevelClear && (
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestartShift();
              }}
              className="min-h-[48px] w-full rounded-2xl bg-[#f97316] hover:bg-[#ea580c] text-white font-display font-bold text-lg border-b-4 border-[#9a3412] active:translate-y-0.5 transition-all cursor-pointer"
            >
              Try Again
            </button>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestartShift();
              }}
              className="min-h-[44px] rounded-xl bg-[#f5ead8] hover:bg-[#ebd7ba] text-[#2b1d14] font-semibold text-sm border border-[#c9a982] cursor-pointer"
            >
              Restart
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onBackToTitle();
              }}
              className="min-h-[44px] rounded-xl bg-[#f5ead8] hover:bg-[#ebd7ba] text-[#2b1d14] font-semibold text-sm border border-[#c9a982] cursor-pointer"
            >
              Title Screen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
