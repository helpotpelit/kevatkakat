import { useRef, useEffect, useCallback, useState } from 'react';
import { GameData, GameState } from '../game/types';
import { createInitialState, spawnWave, update, render, getCanvasSize } from '../game/engine';
import { Volume2, VolumeX } from 'lucide-react';
import FloatingText from './FloatingText';

const { w: GAME_W, h: GAME_H } = getCanvasSize();

function getHighScore(): number {
  try { return parseInt(localStorage.getItem('kevatkakat_highscore') || '0', 10) || 0; } catch { return 0; }
}
function setHighScore(s: number) {
  try { localStorage.setItem('kevatkakat_highscore', String(s)); } catch {}
}

const START_PHRASES = ['Kakat pois! 💪', 'Kevätsiivous käynnissä 🧹', 'Loska lentää! 🌊'];
const POWERUP_PHRASES = ['Pussi käteen! 🛍️', 'Katupölybonus! ✨', 'Kevätsiivous käynnissä 🧹'];
const WAVE_PHRASES = ['Puisto pelastettu! 🌳', 'Aurinko paistaa! ☀️', 'Kakat pois! 💪'];
const DANGER_PHRASES = ['Kevät yllätti taas! 😱', 'Loska lentää! 🌊', 'Varo kakaa! 💩'];
const GAMEOVER_WIN_PHRASES = ['Puisto pelastettu! 🎉', 'Aurinko paistaa! ☀️', 'Kevätsiivous valmis! ✅'];
const GAMEOVER_LOSE_PHRASES = ['Kevät yllätti taas 😅', 'Loska voitti 🌊', 'Kakat jäi... 💩'];

function pick(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)]; }

interface Popup { id: number; text: string; x: number; y: number; }

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameData>(createInitialState());
  const inputRef = useRef({ left: false, right: false, shoot: false });
  const rafRef = useRef<number>(0);
  const [highScore, setHighScoreState] = useState(getHighScore());
  const touchRef = useRef<{ startX: number; currentX: number; active: boolean }>({ startX: 0, currentX: 0, active: false });
  const popupIdRef = useRef(0);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevPowerUpCountRef = useRef(0);
  const prevLivesRef = useRef(3);

  const [uiState, setUiState] = useState<{ state: GameState; score: number; lives: number; wave: number; muted: boolean; fireRateBoost: number }>({
    state: 'start', score: 0, lives: 3, wave: 1, muted: false, fireRateBoost: 0,
  });

  const showPopup = useCallback((text: string, x?: number, y?: number) => {
    const id = ++popupIdRef.current;
    const px = x ?? 30 + Math.random() * 60; // percentage
    const py = y ?? 20 + Math.random() * 40;
    setPopups(prev => [...prev.slice(-4), { id, text, x: px, y: py }]);
    setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 1800);
  }, []);

  const showBanner = useCallback((text: string, duration = 2000) => {
    setBanner(text);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setBanner(null), duration);
  }, []);

  const syncUI = useCallback(() => {
    const g = gameRef.current;
    setUiState(prev => {
      if (prev.state === g.state && prev.score === g.score && prev.lives === g.lives && prev.wave === g.wave && prev.muted === g.muted && prev.fireRateBoost === g.fireRateBoost) return prev;

      // Detect transitions for phrases
      if (g.state === 'gameOver' && prev.state !== 'gameOver') {
        const hs = getHighScore();
        if (g.score > hs) { setHighScore(g.score); setHighScoreState(g.score); }
        showBanner(g.lives > 0 ? pick(GAMEOVER_WIN_PHRASES) : pick(GAMEOVER_LOSE_PHRASES), 3000);
      }
      if (g.state === 'waveComplete' && prev.state !== 'waveComplete') {
        showBanner(pick(WAVE_PHRASES), 2500);
      }
      // Danger: lost a life
      if (g.lives < prevLivesRef.current && g.state === 'playing') {
        showPopup(pick(DANGER_PHRASES), 50, 50);
      }
      prevLivesRef.current = g.lives;

      // Power-up collected (fireRateBoost jumped up or powerups decreased)
      if (g.fireRateBoost > 0 && prev.fireRateBoost === 0) {
        showPopup(pick(POWERUP_PHRASES));
      }

      return { state: g.state, score: g.score, lives: g.lives, wave: g.wave, muted: g.muted, fireRateBoost: g.fireRateBoost };
    });
  }, [showPopup, showBanner]);

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

    if (gameRef.current.state === 'playing') {
      inputRef.current.shoot = true;
    }

    if (touchRef.current.active) {
      const delta = touchRef.current.currentX - touchRef.current.startX;
      const threshold = 8;
      inputRef.current.left = delta < -threshold;
      inputRef.current.right = delta > threshold;
      if (Math.abs(delta) > threshold) {
        touchRef.current.startX = touchRef.current.currentX;
      }
    }

    // Track cleanup power-up usage via enemy count drop
    const enemiesBefore = gameRef.current.enemies.length;
    gameRef.current = update(gameRef.current, 16, inputRef.current);
    const enemiesAfter = gameRef.current.enemies.length;
    if (enemiesBefore - enemiesAfter >= 4) {
      showPopup('Katupölybonus! ✨', 50, 35);
    }

    render(ctx, gameRef.current, scale);
    syncUI();

    rafRef.current = requestAnimationFrame(gameLoop);
  }, [getScale, syncUI, showPopup]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameLoop]);

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

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      touchRef.current = { startX: touch.clientX, currentX: touch.clientX, active: true };
    };
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (touchRef.current.active) {
        touchRef.current.currentX = e.touches[0].clientX;
      }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      touchRef.current.active = false;
      inputRef.current.left = false;
      inputRef.current.right = false;
    };

    const el = document.getElementById('game-touch-zone');
    if (el) {
      el.addEventListener('touchstart', handleTouchStart, { passive: false });
      el.addEventListener('touchmove', handleTouchMove, { passive: false });
      el.addEventListener('touchend', handleTouchEnd, { passive: false });
      el.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }
    return () => {
      if (el) {
        el.removeEventListener('touchstart', handleTouchStart);
        el.removeEventListener('touchmove', handleTouchMove);
        el.removeEventListener('touchend', handleTouchEnd);
        el.removeEventListener('touchcancel', handleTouchEnd);
      }
    };
  }, []);

  useEffect(() => {
    const prevent = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, []);

  const startGame = useCallback(() => {
    const prevScore = gameRef.current.score;
    if (prevScore > highScore) {
      setHighScore(prevScore);
      setHighScoreState(prevScore);
    }
    const g = createInitialState();
    g.state = 'playing';
    gameRef.current = spawnWave(g);
    prevLivesRef.current = 3;
    syncUI();
    showBanner(pick(START_PHRASES), 2000);
  }, [syncUI, highScore, showBanner]);

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

  const { state, score, lives, wave, muted, fireRateBoost } = uiState;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-spring-sky select-none overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Compact HUD */}
      <div className="w-full max-w-[420px] flex items-center justify-between px-3 py-1 font-display text-xs font-bold text-foreground"
           style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <span>❤️ {lives}</span>
        <span>Aalto {wave}/5</span>
        <span>⭐ {score}</span>
        <button onClick={toggleMute} className="p-1 rounded-lg bg-card/60 backdrop-blur">
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      {/* Canvas */}
      <div className="relative w-full max-w-[420px] flex-1 rounded-2xl overflow-hidden shadow-xl border-2 border-primary/30">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ imageRendering: 'auto' }}
        />

        {/* Floating popup texts */}
        {popups.map(p => (
          <FloatingText key={p.id} text={p.text} x={p.x} y={p.y} />
        ))}

        {/* Animated banner */}
        {banner && (
          <div className="absolute top-12 left-4 right-4 flex justify-center pointer-events-none z-20 animate-fade-in">
            <div className="px-4 py-2 bg-secondary/90 backdrop-blur-sm rounded-full shadow-lg font-display font-bold text-secondary-foreground text-sm">
              {banner}
            </div>
          </div>
        )}

        {/* Start screen overlay */}
        {state === 'start' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/40 backdrop-blur-sm">
            <h1 className="text-5xl font-display font-bold text-secondary drop-shadow-lg mb-2 animate-scale-in">Kevätkakat</h1>
            <p className="text-primary-foreground font-body text-base mb-2 text-center px-4 drop-shadow animate-fade-in">
              Pelasta puisto kevään ylläreiltä
            </p>
            <p className="text-primary-foreground/60 font-body text-xs mb-4 text-center px-6 drop-shadow animate-fade-in">
              Vedä sormea vasemmalle/oikealle liikkuaksesi. Ammunta on automaattista!
            </p>
            {highScore > 0 && (
              <p className="text-primary-foreground/80 font-body text-sm mb-4 drop-shadow animate-fade-in">🏆 Ennätys: {highScore}</p>
            )}
            <button
              onClick={startGame}
              className="px-8 py-3 bg-primary text-primary-foreground font-display font-bold text-xl rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform animate-scale-in"
            >
              🌿 Aloita peli
            </button>
          </div>
        )}

        {/* Wave complete overlay */}
        {state === 'waveComplete' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/30 backdrop-blur-sm">
            <p className="text-3xl font-display font-bold text-secondary drop-shadow-lg mb-2 animate-scale-in">Aalto {wave} selvitetty!</p>
            <p className="text-primary-foreground font-body mb-6 drop-shadow animate-fade-in">Puisto hetkeksi turvassa</p>
            <button
              onClick={nextWave}
              className="px-8 py-3 bg-primary text-primary-foreground font-display font-bold text-lg rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform animate-scale-in"
            >
              Seuraava aalto →
            </button>
          </div>
        )}

        {/* Game over overlay */}
        {state === 'gameOver' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/50 backdrop-blur-sm">
            <p className="text-3xl font-display font-bold text-destructive drop-shadow-lg mb-2 animate-scale-in">
              {lives > 0 ? '🎉 Voitit pelin!' : 'Kevät voitti tällä kertaa'}
            </p>
            <p className="text-primary-foreground font-body text-xl mb-1 drop-shadow animate-fade-in">Pisteet: {score}</p>
            {score >= highScore && score > 0 && (
              <p className="text-secondary font-display font-bold text-lg mb-1 drop-shadow animate-pulse">🏆 Uusi ennätys!</p>
            )}
            {highScore > 0 && score < highScore && (
              <p className="text-primary-foreground/70 font-body text-sm mb-1 drop-shadow animate-fade-in">Ennätys: {highScore}</p>
            )}
            <button
              onClick={startGame}
              className="mt-4 px-8 py-3 bg-secondary text-secondary-foreground font-display font-bold text-lg rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform animate-scale-in"
            >
              🔄 Pelaa uudelleen
            </button>
          </div>
        )}

        {/* Touch control zone */}
        <div
          id="game-touch-zone"
          className="absolute bottom-0 left-0 right-0 pointer-events-auto"
          style={{ height: '30%', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="absolute top-0 left-4 right-4 h-px bg-primary-foreground/15 rounded-full" />
          {state === 'playing' && (
            <p className="absolute top-2 left-0 right-0 text-center text-primary-foreground/30 font-body text-[10px] pointer-events-none select-none">
              ← vedä liikkuaksesi →
            </p>
          )}
        </div>
      </div>

      {/* Fire rate boost indicator */}
      {state === 'playing' && fireRateBoost > 0 && (
        <div className="mt-1 px-3 py-0.5 bg-secondary/80 rounded-full font-body text-xs text-secondary-foreground font-bold animate-pulse">
          ⚡ Tulinopeus!
        </div>
      )}
    </div>
  );
}
