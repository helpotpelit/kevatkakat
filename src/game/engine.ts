import { GameData, Enemy, EnemyType, Particle, PowerUp } from './types';
import * as sounds from './sounds';

const CANVAS_W = 400;
const CANVAS_H = 600;
const PLAYER_W = 40;
const PLAYER_H = 40;
const BULLET_W = 6;
const BULLET_H = 14;
const ENEMY_SIZE = 32;
const POWERUP_SIZE = 28;
const BASE_FIRE_RATE = 300;
const BOOST_FIRE_RATE = 120;
const MAX_WAVES = 5;
const DEBUG_WAVES = false; // set to true for wave-completion debug logging

export function getCanvasSize() {
  return { w: CANVAS_W, h: CANVAS_H };
}

export function createInitialState(): GameData {
  return {
    state: 'start',
    score: 0,
    lives: 3,
    wave: 1,
    player: { x: CANVAS_W / 2 - PLAYER_W / 2, y: CANVAS_H - PLAYER_H - 60, width: PLAYER_W, height: PLAYER_H },
    enemies: [],
    bullets: [],
    particles: [],
    powerUps: [],
    fireRateBoost: 0,
    muted: false,
    direction: 1,
    enemySpeed: 1,
    lastShot: 0,
    fireRate: BASE_FIRE_RATE,
    nextId: 1,
  };
}

export function spawnWave(game: GameData): GameData {
  const wave = game.wave;
  const rows = 3 + Math.min(wave - 1, 2);
  const cols = 7;
  const enemies: Enemy[] = [];
  let id = game.nextId;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let type: EnemyType = 'normal';
      let hp = 1;
      
      // Mix in frozen and fast types based on wave
      if (wave >= 2 && r === 0) {
        type = 'frozen';
        hp = 2;
      }
      if (wave >= 3 && r === 1 && c % 3 === 0) {
        type = 'fast';
        hp = 1;
      }
      if (wave >= 4 && r <= 1) {
        type = 'frozen';
        hp = 2;
      }
      if (wave >= 5 && r === 2 && c % 2 === 0) {
        type = 'fast';
        hp = 1;
      }

      enemies.push({
        id: id++,
        x: 30 + c * (ENEMY_SIZE + 14),
        y: 40 + r * (ENEMY_SIZE + 10),
        type,
        hp,
        width: ENEMY_SIZE,
        height: ENEMY_SIZE,
      });
    }
  }

  return {
    ...game,
    enemies,
    bullets: [],
    powerUps: [],
    direction: 1,
    enemySpeed: 0.5 + wave * 0.3,
    fireRate: BASE_FIRE_RATE,
    fireRateBoost: 0,
    nextId: id,
  };
}

function rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function spawnParticles(x: number, y: number, color: string, count: number, emoji?: string): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color,
      size: 3 + Math.random() * 4,
      emoji,
    });
  }
  return particles;
}

export function update(game: GameData, dt: number, input: { left: boolean; right: boolean; shoot: boolean }): GameData {
  if (game.state !== 'playing') return game;

  let { player, enemies, bullets, particles, powerUps, score, lives, wave, direction, enemySpeed, fireRateBoost, lastShot, fireRate, nextId, muted } = { ...game };
  
  // Clone arrays
  enemies = [...enemies];
  bullets = [...bullets];
  particles = [...particles];
  powerUps = [...powerUps];
  player = { ...player };

  const now = performance.now();
  const speed = 4;

  // Player movement
  if (input.left) player.x = Math.max(0, player.x - speed);
  if (input.right) player.x = Math.min(CANVAS_W - player.width, player.x + speed);

  // Shooting
  const currentFireRate = fireRateBoost > 0 ? BOOST_FIRE_RATE : fireRate;
  if (input.shoot && now - lastShot > currentFireRate) {
    bullets.push({
      id: nextId++,
      x: player.x + player.width / 2 - BULLET_W / 2,
      y: player.y - BULLET_H,
      width: BULLET_W,
      height: BULLET_H,
    });
    lastShot = now;
    if (!muted) sounds.playShoot();
  }

  // Fire rate boost countdown
  if (fireRateBoost > 0) {
    fireRateBoost = Math.max(0, fireRateBoost - 16);
  }

  // Move bullets
  bullets = bullets.map(b => ({ ...b, y: b.y - 7 })).filter(b => b.y > -20);

  // Move enemies
  let hitEdge = false;
  const fastMultiplier = 1.8;
  
  enemies = enemies.map(e => {
    const spd = e.type === 'fast' ? enemySpeed * fastMultiplier : enemySpeed;
    const newX = e.x + direction * spd;
    if (newX <= 0 || newX + e.width >= CANVAS_W) hitEdge = true;
    return { ...e, x: newX };
  });

  if (hitEdge) {
    direction = -direction;
    enemies = enemies.map(e => ({ ...e, y: e.y + 12 }));
  }

  // Bullet-enemy collisions
  const bulletsToRemove = new Set<number>();
  const enemiesToRemove = new Set<number>();

  for (const b of bullets) {
    for (const e of enemies) {
      if (!bulletsToRemove.has(b.id) && !enemiesToRemove.has(e.id) && e.hp > 0 && rectsOverlap(b, e)) {
        bulletsToRemove.add(b.id);
        e.hp--;
        if (e.hp <= 0) {
          enemiesToRemove.add(e.id);
          score += e.type === 'frozen' ? 20 : e.type === 'fast' ? 15 : 10;
          
          const emoji = e.type === 'frozen' ? '🧊' : '💩';
          particles.push(...spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#8B6914', 8, emoji));
          
          if (!muted) sounds.playHit();

          if (Math.random() < 0.12) {
            const pType = Math.random() < 0.5 ? 'bag' : 'cleanup';
            powerUps.push({
              id: nextId++,
              x: e.x,
              y: e.y,
              type: pType,
              width: POWERUP_SIZE,
              height: POWERUP_SIZE,
            });
          }
        } else {
          particles.push(...spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#ADD8E6', 4));
        }
      }
    }
  }

  bullets = bullets.filter(b => !bulletsToRemove.has(b.id));
  // Remove dead enemies: both tracked Set AND any with hp <= 0 as safety net
  enemies = enemies.filter(e => !enemiesToRemove.has(e.id) && e.hp > 0);

  // Move power-ups
  powerUps = powerUps.map(p => ({ ...p, y: p.y + 2 })).filter(p => p.y < CANVAS_H + 30);

  // Player-powerup collision
  powerUps = powerUps.filter(p => {
    if (rectsOverlap(player, p)) {
      if (p.type === 'bag') {
        fireRateBoost = 5000;
      } else if (p.type === 'cleanup') {
        const alive = enemies.filter(e => e.hp > 0);
        const toDestroy = alive.slice(0, Math.min(5, alive.length));
        for (const e of toDestroy) {
          e.hp = 0;
          particles.push(...spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#8B6914', 6, '💩'));
          score += 10;
        }
        enemies = enemies.filter(e => e.hp > 0);
      }
      if (!muted) sounds.playPowerUp();
      return false;
    }
    return true;
  });

  // Final safety: purge any dead enemies before wave check
  enemies = enemies.filter(e => e.hp > 0);

  // Enemies reaching bottom
  const reachedBottom = enemies.some(e => e.y + e.height >= player.y);
  if (reachedBottom) {
    lives--;
    if (!muted) sounds.playLoseLife();
    if (lives <= 0) {
      if (!muted) sounds.playGameOver();
      return { ...game, state: 'gameOver', score, lives: 0, particles };
    }
    return {
      ...game,
      ...spawnWave({ ...game, score, lives, wave }),
      score,
      lives,
      particles,
    };
  }

  // Update particles
  particles = particles.map(p => ({
    ...p,
    x: p.x + p.vx,
    y: p.y + p.vy,
    vy: p.vy + 0.1,
    life: p.life - 1,
  })).filter(p => p.life > 0);

  // Wave complete check — only when zero living enemies remain
  const aliveEnemies = enemies.filter(e => e.hp > 0);
  if (DEBUG_WAVES && enemies.length === 0) {
    console.log(`[Wave Debug] enemies.length=${enemies.length}, alive=${aliveEnemies.length}, wave=${wave}`);
  }
  if (aliveEnemies.length === 0 && enemies.length === 0) {
    if (wave >= MAX_WAVES) {
      return { ...game, state: 'gameOver', score, lives, wave, particles, enemies: [], bullets: [] };
    }
    if (!muted) sounds.playWaveComplete();
    return {
      ...game,
      state: 'waveComplete',
      score,
      lives,
      wave,
      particles,
      enemies: [],
      bullets: [],
      player,
      fireRateBoost,
      nextId,
    };
  }

  return {
    ...game,
    player,
    enemies,
    bullets,
    particles,
    powerUps,
    score,
    lives,
    wave,
    direction,
    enemySpeed,
    fireRateBoost,
    lastShot,
    fireRate,
    nextId,
    muted,
  };
}

export function render(ctx: CanvasRenderingContext2D, game: GameData, scale: number) {
  const w = CANVAS_W;
  const h = CANVAS_H;

  ctx.save();
  ctx.scale(scale, scale);

  // Background - spring park
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, '#87CEEB');
  skyGrad.addColorStop(0.5, '#B5E8D5');
  skyGrad.addColorStop(1, '#7CB342');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Sun
  ctx.fillStyle = '#FFE082';
  ctx.beginPath();
  ctx.arc(50, 40, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFF9C4';
  ctx.beginPath();
  ctx.arc(50, 40, 18, 0, Math.PI * 2);
  ctx.fill();

  // Snow patches
  ctx.fillStyle = 'rgba(240, 248, 255, 0.6)';
  ctx.beginPath();
  ctx.ellipse(80, h - 45, 40, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(300, h - 50, 50, 10, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(200, h - 35, 30, 8, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Puddles
  ctx.fillStyle = 'rgba(100, 181, 246, 0.4)';
  ctx.beginPath();
  ctx.ellipse(150, h - 55, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(350, h - 40, 15, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Path
  ctx.fillStyle = 'rgba(161, 136, 127, 0.5)';
  ctx.fillRect(170, h - 65, 60, 65);

  // Ground line
  ctx.fillStyle = '#5D8C3E';
  ctx.fillRect(0, h - 30, w, 30);

  // Enemies
  for (const e of game.enemies) {
    ctx.font = `${e.width - 4}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (e.type === 'normal') {
      ctx.fillText('💩', e.x + e.width / 2, e.y + e.height / 2);
    } else if (e.type === 'frozen') {
      ctx.fillText('🥶', e.x + e.width / 2, e.y + e.height / 2 - 2);
      ctx.font = `${e.width - 12}px serif`;
      ctx.fillText('💩', e.x + e.width / 2, e.y + e.height / 2 + 4);
    } else if (e.type === 'fast') {
      ctx.fillText('💩', e.x + e.width / 2, e.y + e.height / 2);
      ctx.font = '10px serif';
      ctx.fillText('🪰', e.x + e.width / 2 - 8, e.y + 4);
      ctx.fillText('🪰', e.x + e.width / 2 + 8, e.y + 8);
    }
  }

  // Bullets
  ctx.fillStyle = '#43A047';
  for (const b of game.bullets) {
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, 3);
    ctx.fill();
    // Glow
    ctx.fillStyle = 'rgba(67, 160, 71, 0.3)';
    ctx.beginPath();
    ctx.roundRect(b.x - 2, b.y - 2, b.width + 4, b.height + 4, 5);
    ctx.fill();
    ctx.fillStyle = '#43A047';
  }

  // Power-ups
  for (const p of game.powerUps) {
    ctx.font = `${p.width - 4}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.type === 'bag' ? '🛍️' : '🧹', p.x + p.width / 2, p.y + p.height / 2);
  }

  // Particles
  for (const p of game.particles) {
    const alpha = p.life / p.maxLife;
    if (p.emoji) {
      ctx.globalAlpha = alpha;
      ctx.font = `${p.size * 2}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.emoji, p.x, p.y);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Player
  ctx.font = `${game.player.width - 4}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🧑‍🌾', game.player.x + game.player.width / 2, game.player.y + game.player.height / 2);

  // Fire rate boost indicator
  if (game.fireRateBoost > 0) {
    ctx.fillStyle = 'rgba(255,235,59,0.3)';
    ctx.beginPath();
    ctx.arc(game.player.x + game.player.width / 2, game.player.y + game.player.height / 2, 25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
