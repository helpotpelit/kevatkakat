export type EnemyType = 'normal' | 'frozen' | 'fast';
export type PowerUpType = 'bag' | 'cleanup';
export type GameState = 'start' | 'playing' | 'waveComplete' | 'gameOver';

export interface Position {
  x: number;
  y: number;
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  type: EnemyType;
  hp: number;
  width: number;
  height: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  emoji?: string;
}

export interface PowerUp {
  id: number;
  x: number;
  y: number;
  type: PowerUpType;
  width: number;
  height: number;
}

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameData {
  state: GameState;
  score: number;
  lives: number;
  wave: number;
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  particles: Particle[];
  powerUps: PowerUp[];
  fireRateBoost: number; // ms remaining
  muted: boolean;
  direction: number; // enemy movement direction
  enemySpeed: number;
  lastShot: number;
  fireRate: number;
  nextId: number;
}
