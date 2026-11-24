import React from 'react';

interface TitleScreenProps {
  bestScore: number;
  bestLevel: number;
  onStart: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  bestScore,
  bestLevel,
  onStart,
  muted,
  onToggleMute,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
      {/* Subtle radial vignette for contrast over live animated office */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(28,17,11,0.72) 0%, rgba(28,17,11,0.18) 44%, rgba(28,17,11,0.82) 100%)',
        }}
      />

      {/* Top Header Row: Title Plaque centered + Mute button top-right */}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="w-[44px] hidden sm:block" aria-hidden="true" />
        <div className="flex-1 flex justify-center">
          <svg
            viewBox="0 0 360 104"
            className="w-[265px] sm:w-[330px] h-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.45)]"
            role="img"
            aria-label="Look Busy!"
          >
            <rect x="14" y="10" width="332" height="84" rx="18" fill="#5c3c24" stroke="#2b1d14" strokeWidth="4" />
            <rect x="22" y="17" width="316" height="70" rx="12" fill="#fff8ed" stroke="#d97706" strokeWidth="2.5" />
            <circle cx="36" cy="30" r="3.5" fill="#d97706" />
            <circle cx="324" cy="30" r="3.5" fill="#d97706" />
            <circle cx="36" cy="74" r="3.5" fill="#d97706" />
            <circle cx="324" cy="74" r="3.5" fill="#d97706" />
            <text
              x="180"
              y="58"
              textAnchor="middle"
              fill="#2b1d14"
              fontFamily="Bricolage Grotesque, sans-serif"
              fontWeight="800"
              fontSize="38"
              letterSpacing="-0.5"
            >
              LOOK BUSY!
            </text>
            <text
              x="180"
              y="77"
              textAnchor="middle"
              fill="#b45309"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="700"
              fontSize="11"
              letterSpacing="2"
            >
              SLACK OFF · DODGE THE BOSS
            </text>
          </svg>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          className="pointer-events-auto min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#fff8ed]/95 text-[#2b1d14] border-2 border-[#5c3c24] shadow-md hover:bg-white active:scale-95 transition-transform cursor-pointer"
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
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex-1" aria-hidden="true" />

      {/* Bottom CTA & Compact Rule Summary */}
      <div className="relative z-10 flex flex-col items-center gap-3 pb-2">
        <p className="max-w-md text-center text-sm sm:text-base font-medium text-[#fef3c7] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] px-2">
          Finish office tasks to level up, keep your Mood above 0% by slacking off, and snap back to work before anyone catches you.
        </p>

        {bestScore > 0 && (
          <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-[#fde68a] tabular-nums">
            <span>Best Score: {bestScore.toLocaleString()}</span>
            <span aria-hidden="true">·</span>
            <span>Highest Shift: {bestLevel}</span>
          </div>
        )}

        <button
          type="button"
          data-start="true"
          onClick={(e) => {
            e.currentTarget.blur();
            onStart();
          }}
          className="pointer-events-auto min-h-[52px] px-10 py-3.5 rounded-2xl bg-[#f97316] hover:bg-[#ea580c] text-white font-display font-bold text-xl tracking-tight border-b-4 border-[#9a3412] shadow-[0_10px_24px_rgba(0,0,0,0.45)] active:translate-y-0.5 active:border-b-2 transition-all cursor-pointer whitespace-nowrap"
        >
          Start Shift
        </button>

        <p className="text-xs text-[#e7d5be]/90 text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
          Tap Buttons or 1–5 to Act · Tap Floor / WASD to Sneak · Esc to Pause
        </p>
      </div>
    </div>
  );
};
