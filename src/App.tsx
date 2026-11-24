import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { StatusModal } from './components/StatusModal';
import { TitleScreen } from './components/TitleScreen';
import { soundEngine } from './game/audio';
import { PLAYER_DESK_POS } from './game/levels';
import { OfficeRenderer } from './game/renderer';
import {
  buildHudSnapshot,
  createInitialSimState,
  findNearbyHotspot,
  movePlayerByAxis,
  setMoveTarget,
  setPlayerActivity,
  stepSimulation,
  triggerHotspotAction,
} from './game/rules';
import { ActivityType, GameSimState, Hotspot, HudSnapshot } from './game/types';

const STORAGE_KEY = 'look_busy_office_save_v1';

function loadBestStats(): { bestScore: number; bestLevel: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bestScore: 0, bestLevel: 1 };
    const parsed = JSON.parse(raw) as { bestScore?: number; bestLevel?: number };
    return {
      bestScore: Number.isFinite(parsed.bestScore) ? Number(parsed.bestScore) : 0,
      bestLevel: Number.isFinite(parsed.bestLevel) ? Math.max(1, Number(parsed.bestLevel)) : 1,
    };
  } catch {
    return { bestScore: 0, bestLevel: 1 };
  }
}

function saveBestStats(bestScore: number, bestLevel: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bestScore, bestLevel }));
  } catch {
    // ignore storage errors
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<OfficeRenderer>(new OfficeRenderer());
  const keysPressedRef = useRef<Set<string>>(new Set());

  const initialBest = useRef(loadBestStats());
  const simRef = useRef<GameSimState>(
    createInitialSimState(1, initialBest.current.bestScore, initialBest.current.bestLevel, 0),
  );

  const [hud, setHud] = useState<HudSnapshot>(() => buildHudSnapshot(simRef.current));
  const [muted, setMuted] = useState<boolean>(false);

  const syncHudImmediate = useCallback(() => {
    const sim = simRef.current;
    document.body.dataset.state = sim.phase;
    setHud(buildHudSnapshot(sim));
    saveBestStats(sim.bestScore, sim.bestLevel);
  }, []);

  const startNewGame = useCallback(
    (level = 1, carryScore = 0) => {
      soundEngine.unlock();
      const sim = simRef.current;
      const nextSim = createInitialSimState(level, sim.bestScore, sim.bestLevel, carryScore);
      nextSim.phase = 'playing';
      simRef.current = nextSim;
      keysPressedRef.current.clear();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      canvasRef.current?.focus();
      syncHudImmediate();
    },
    [syncHudImmediate],
  );

  const handleStartFromTitle = useCallback(() => {
    startNewGame(1, 0);
  }, [startNewGame]);

  const handleNextLevel = useCallback(() => {
    const sim = simRef.current;
    startNewGame(sim.level + 1, Math.round(sim.score));
  }, [startNewGame]);

  const handleRestartShift = useCallback(() => {
    const sim = simRef.current;
    const baseScore = sim.outcome === 'level_clear' ? Math.round(sim.score) : 0;
    const targetLevel = sim.outcome === 'defeat_boredom' || sim.outcome === 'defeat_fired' ? 1 : sim.level;
    startNewGame(targetLevel, targetLevel === 1 ? 0 : baseScore);
  }, [startNewGame]);

  const handleBackToTitle = useCallback(() => {
    const sim = simRef.current;
    const nextSim = createInitialSimState(1, sim.bestScore, sim.bestLevel, 0);
    nextSim.phase = 'title';
    simRef.current = nextSim;
    keysPressedRef.current.clear();
    syncHudImmediate();
  }, [syncHudImmediate]);

  const handleTogglePause = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase === 'playing') {
      sim.phase = 'paused';
      keysPressedRef.current.clear();
      syncHudImmediate();
    } else if (sim.phase === 'paused') {
      sim.phase = 'playing';
      keysPressedRef.current.clear();
      canvasRef.current?.focus();
      syncHudImmediate();
    }
  }, [syncHudImmediate]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  }, []);

  const handleSelectActivity = useCallback(
    (act: ActivityType) => {
      soundEngine.unlock();
      const sim = simRef.current;
      setPlayerActivity(sim, act);
      if (sim.recentEvent) {
        soundEngine.playEvent(sim.recentEvent);
        sim.recentEvent = null;
      }
      syncHudImmediate();
    },
    [syncHudImmediate],
  );

  const handleTriggerHotspot = useCallback(
    (id: Hotspot['id']) => {
      soundEngine.unlock();
      const sim = simRef.current;
      const triggered = triggerHotspotAction(sim, id);
      if (triggered && sim.recentEvent) {
        soundEngine.playEvent(sim.recentEvent);
        sim.recentEvent = null;
      }
      syncHudImmediate();
    },
    [syncHudImmediate],
  );

  // Check ?autostart=1 on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startNewGame(1, 0);
    } else {
      document.body.dataset.state = simRef.current.phase;
    }
  }, [startNewGame]);

  // Unified keyboard listener & blur cleanup
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const sim = simRef.current;

      if (sim.phase === 'title') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          handleStartFromTitle();
        }
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        if (sim.phase === 'playing' || sim.phase === 'paused') {
          e.preventDefault();
          handleTogglePause();
          return;
        }
      }

      if (code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (sim.phase !== 'playing') {
        if (sim.phase === 'gameover' && code === 'Enter') {
          e.preventDefault();
          if (sim.outcome === 'level_clear') handleNextLevel();
          else handleRestartShift();
        }
        return;
      }

      keysPressedRef.current.add(code);

      if (code === 'Digit1' || code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
        e.preventDefault();
        handleSelectActivity('work');
      } else if (code === 'Digit2') {
        handleSelectActivity('phone');
      } else if (code === 'Digit3') {
        handleSelectActivity('game');
      } else if (code === 'Digit4') {
        handleSelectActivity('snack');
      } else if (code === 'Digit5') {
        handleSelectActivity('nap');
      } else if (code === 'KeyE') {
        const nearby = findNearbyHotspot(sim);
        if (nearby) handleTriggerHotspot(nearby.id);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.code);
    };

    const clearHeldInputs = () => {
      keysPressedRef.current.clear();
    };

    const onVisibility = () => {
      if (document.hidden) clearHeldInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeldInputs);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeldInputs);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [
    handleNextLevel,
    handleRestartShift,
    handleSelectActivity,
    handleStartFromTitle,
    handleToggleMute,
    handleTogglePause,
    handleTriggerHotspot,
  ]);

  // Isolated 60Hz Canvas simulation & render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastMs = performance.now();
    let hudSyncAccum = 0;
    let prevPhase = simRef.current.phase;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(320, rect.width || window.innerWidth);
      height = Math.max(320, rect.height || window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (nowMs: number) => {
      const rawDt = (nowMs - lastMs) / 1000;
      lastMs = nowMs;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);
      const sim = simRef.current;
      const renderer = rendererRef.current;

      // Apply held keyboard movement in isometric space
      if (sim.phase === 'playing') {
        const keys = keysPressedRef.current;
        let screenX = 0;
        let screenY = 0;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) screenX -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) screenX += 1;
        if (keys.has('KeyW') || keys.has('ArrowUp')) screenY -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) screenY += 1;

        if (screenX !== 0 || screenY !== 0) {
          // Convert screen-aligned WASD to isometric grid axes
          const gx = screenX + screenY;
          const gy = screenY - screenX;
          movePlayerByAxis(sim, gx, gy, dt);
        }
      }

      const audioEvent = stepSimulation(sim, dt);
      if (audioEvent) {
        soundEngine.playEvent(audioEvent);
        if (audioEvent === 'task_done' || audioEvent === 'level_clear') {
          renderer.spawnBurst(sim.player.gx, sim.player.gy, 18, 'confetti', [
            '#10b981',
            '#fbbf24',
            '#38bdf8',
            '#f472b6',
          ]);
        } else if (audioEvent === 'strike') {
          renderer.spawnBurst(sim.player.gx, sim.player.gy, 14, 'spark', ['#ef4444', '#f97316']);
        } else if (audioEvent === 'close_call') {
          renderer.spawnBurst(sim.player.gx, sim.player.gy, 10, 'spark', ['#fbbf24', '#fef08a']);
        }
      }

      renderer.updateParticles(dt, sim);
      renderer.render(ctx, width, height, sim, nowMs / 1000);

      hudSyncAccum += dt;
      if (sim.phase !== prevPhase || (sim.phase === 'playing' && hudSyncAccum >= 0.12)) {
        prevPhase = sim.phase;
        hudSyncAccum = 0;
        document.body.dataset.state = sim.phase;
        setHud(buildHudSnapshot(sim));
        if (sim.phase === 'gameover') {
          saveBestStats(sim.bestScore, sim.bestLevel);
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      soundEngine.unlock();
      const sim = simRef.current;
      if (sim.phase !== 'playing') return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const gridPt = rendererRef.current.screenToGrid(sx, sy, rect.width, rect.height, sim);

      // Check if user tapped a hotspot directly
      for (const h of sim.hotspots) {
        if (Math.hypot(gridPt.x - h.gx, gridPt.y - h.gy) < 1.15) {
          handleTriggerHotspot(h.id);
          return;
        }
      }

      // Check if user tapped their own desk
      if (Math.hypot(gridPt.x - PLAYER_DESK_POS.x, gridPt.y - PLAYER_DESK_POS.y) < 1.1) {
        handleSelectActivity('work');
        return;
      }

      setMoveTarget(sim, gridPt.x, gridPt.y);
      syncHudImmediate();
    },
    [handleSelectActivity, handleTriggerHotspot, syncHudImmediate],
  );

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#23160f]">
      <canvas
        ref={canvasRef}
        data-testid="office-canvas"
        tabIndex={0}
        onPointerDown={handleCanvasPointerDown}
        className="block w-full h-full outline-none cursor-pointer"
        aria-label="Isometric office playfield"
      />

      {hud.phase === 'title' && (
        <TitleScreen
          bestScore={hud.bestScore}
          bestLevel={hud.bestLevel}
          onStart={handleStartFromTitle}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {(hud.phase === 'playing' || hud.phase === 'paused' || hud.phase === 'gameover') && (
        <GameHud
          hud={hud}
          muted={muted}
          onSelectActivity={handleSelectActivity}
          onTriggerHotspot={handleTriggerHotspot}
          onTogglePause={handleTogglePause}
          onToggleMute={handleToggleMute}
        />
      )}

      <StatusModal
        hud={hud}
        onResume={handleTogglePause}
        onNextLevel={handleNextLevel}
        onRestartShift={handleRestartShift}
        onBackToTitle={handleBackToTitle}
      />
    </main>
  );
}
