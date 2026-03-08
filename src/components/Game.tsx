import { useRef, useEffect, useCallback, useState } from 'react';
import { GameData, GameState } from '../game/types';
import { createInitialState, spawnWave, update, render, getCanvasSize } from '../game/engine';
import { Volume2, VolumeX } from 'lucide-react';

const { w: GAME_W, h: GAME_H } = getCanvasSize();

function getHighScore(): number {
  try { return parseInt(localStorage.getItem('kevatkakat_highscore') || '0', 10) || 0; } catch { return 0; }
}
function setHighScore(s: number) {
  try { localStorage.setItem('kevatkakat_highscore', String(s)); } catch {}
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameData>(createInitialState());
  const inputRef = useRef({ left: false, right: false, shoot: false });
  const rafRef = useRef<number>(0);
  const [highScore, setHighScoreState] = useState(getHighScore());

  const [uiState, setUiState] = useState<{ state: GameState; score: number; lives: number; wave: number; muted: boolean }>({
    state: 'start', score: 0, lives: 3, wave: 1, muted: false,
  });

  const syncUI = useCallback(() => {
    const g = gameRef.current;
    setUiState(prev => {
      if (prev.state === g.state && prev.score === g.score && prev.lives === g.lives && prev.wave === g.wave && prev.muted === g.muted) return prev;
      return { state: g.state, score: g.score, lives: g.lives, wave: g.wave, muted: g.muted };
    });
  }, []);

  const getScale = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    return canvas.clientWidth / GAME_W;
  }, []);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = getScale();
    canvas.width = GAME_W * scale * window.devicePixelRatio;
    canvas.height = GAME_H * scale * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    gameRef.current = update(gameRef.current, 16, inputRef.current);
    render(ctx, gameRef.current, scale);
    syncUI();

    rafRef.current = requestAnimationFrame(gameLoop);
  }, [getScale, syncUI]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameLoop]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') inputRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') inputRef.current.right = true;
      if (e.key === ' ' || e.key === 'ArrowUp') { inputRef.current.shoot = true; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') inputRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') inputRef.current.right = false;
      if (e.key === ' ' || e.key === 'ArrowUp') inputRef.current.shoot = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const startGame = useCallback(() => {
    // Save high score from previous game if any
    const prevScore = gameRef.current.score;
    if (prevScore > highScore) {
      setHighScore(prevScore);
      setHighScoreState(prevScore);
    }
    const g = createInitialState();
    g.state = 'playing';
    gameRef.current = spawnWave(g);
    syncUI();
  }, [syncUI, highScore]);

  const nextWave = useCallback(() => {
    const g = gameRef.current;
    const next = { ...g, state: 'playing' as const, wave: g.wave + 1 };
    gameRef.current = spawnWave(next);
    syncUI();
  }, [syncUI]);

  const toggleMute = useCallback(() => {
    gameRef.current.muted = !gameRef.current.muted;
    syncUI();
  }, [syncUI]);

  const touchStart = (action: 'left' | 'right' | 'shoot') => {
    inputRef.current[action] = true;
  };
  const touchEnd = (action: 'left' | 'right' | 'shoot') => {
    inputRef.current[action] = false;
  };

  const { state, score, lives, wave, muted } = uiState;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-spring-sky select-none overflow-hidden">
      {/* HUD */}
      <div className="w-full max-w-[420px] flex items-center justify-between px-3 py-2 font-display text-sm font-bold text-foreground">
        <span>❤️ {lives}</span>
        <span>Aalto {wave}/5</span>
        <span>⭐ {score}</span>
        <button onClick={toggleMute} className="p-1 rounded-lg bg-card/60 backdrop-blur">
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Canvas */}
      <div className="relative w-full max-w-[420px] aspect-[2/3] rounded-2xl overflow-hidden shadow-xl border-2 border-primary/30">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ imageRendering: 'auto' }}
        />

        {/* Start screen overlay */}
        {state === 'start' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/40 backdrop-blur-sm">
            <h1 className="text-5xl font-display font-bold text-secondary drop-shadow-lg mb-2">Kevätkakat</h1>
            <p className="text-primary-foreground font-body text-base mb-4 text-center px-4 drop-shadow">
              Pelasta puisto kevään ylläreiltä
            </p>
            {highScore > 0 && (
              <p className="text-primary-foreground/80 font-body text-sm mb-4 drop-shadow">🏆 Ennätys: {highScore}</p>
            )}
            <button
              onClick={startGame}
              className="px-8 py-3 bg-primary text-primary-foreground font-display font-bold text-xl rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              🌿 Aloita peli
            </button>
          </div>
        )}

        {/* Wave complete overlay */}
        {state === 'waveComplete' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/30 backdrop-blur-sm">
            <p className="text-3xl font-display font-bold text-secondary drop-shadow-lg mb-2">Aalto {wave} selvitetty!</p>
            <p className="text-primary-foreground font-body mb-6 drop-shadow">Puisto hetkeksi turvassa</p>
            <button
              onClick={nextWave}
              className="px-8 py-3 bg-primary text-primary-foreground font-display font-bold text-lg rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              Seuraava aalto →
            </button>
          </div>
        )}

        {/* Game over overlay */}
        {state === 'gameOver' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/50 backdrop-blur-sm">
            <p className="text-3xl font-display font-bold text-destructive drop-shadow-lg mb-2">
              {lives > 0 ? '🎉 Voitit pelin!' : 'Kevät voitti tällä kertaa'}
            </p>
            <p className="text-primary-foreground font-body text-xl mb-1 drop-shadow">Pisteet: {score}</p>
            {score >= highScore && score > 0 && (
              <p className="text-secondary font-display font-bold text-lg mb-1 drop-shadow animate-pulse">🏆 Uusi ennätys!</p>
            )}
            {highScore > 0 && score < highScore && (
              <p className="text-primary-foreground/70 font-body text-sm mb-1 drop-shadow">Ennätys: {highScore}</p>
            )}
            <button
              onClick={startGame}
              className="mt-4 px-8 py-3 bg-secondary text-secondary-foreground font-display font-bold text-lg rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              🔄 Pelaa uudelleen
            </button>
          </div>
        )}
      </div>

      {/* Touch controls */}
      <div className="w-full max-w-[420px] flex items-center justify-between gap-2 mt-3 px-2">
        <div className="flex gap-2">
          <button
            onTouchStart={() => touchStart('left')}
            onTouchEnd={() => touchEnd('left')}
            onMouseDown={() => touchStart('left')}
            onMouseUp={() => touchEnd('left')}
            onMouseLeave={() => touchEnd('left')}
            className="w-16 h-16 rounded-2xl bg-primary/80 text-primary-foreground text-2xl font-bold shadow-md active:scale-90 transition-transform select-none"
          >
            ◀
          </button>
          <button
            onTouchStart={() => touchStart('right')}
            onTouchEnd={() => touchEnd('right')}
            onMouseDown={() => touchStart('right')}
            onMouseUp={() => touchEnd('right')}
            onMouseLeave={() => touchEnd('right')}
            className="w-16 h-16 rounded-2xl bg-primary/80 text-primary-foreground text-2xl font-bold shadow-md active:scale-90 transition-transform select-none"
          >
            ▶
          </button>
        </div>
        <button
          onTouchStart={() => touchStart('shoot')}
          onTouchEnd={() => touchEnd('shoot')}
          onMouseDown={() => touchStart('shoot')}
          onMouseUp={() => touchEnd('shoot')}
          onMouseLeave={() => touchEnd('shoot')}
          className="w-20 h-16 rounded-2xl bg-secondary text-secondary-foreground text-lg font-display font-bold shadow-md active:scale-90 transition-transform select-none"
        >
          🌿 Ammu
        </button>
      </div>

      {/* Fire rate boost indicator */}
      {uiState.state === 'playing' && gameRef.current.fireRateBoost > 0 && (
        <div className="mt-2 px-3 py-1 bg-secondary/80 rounded-full font-body text-sm text-secondary-foreground font-bold animate-pulse">
          ⚡ Tulinopeus!
        </div>
      )}
    </div>
  );
}
