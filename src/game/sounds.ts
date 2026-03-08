const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.1) {
  if (!audioCtx) return;
  try {
    audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

export function playShoot() {
  playTone(800, 0.08, 'square', 0.06);
}

export function playHit() {
  playTone(300, 0.15, 'sawtooth', 0.08);
  setTimeout(() => playTone(200, 0.1, 'sawtooth', 0.05), 50);
}

export function playPowerUp() {
  playTone(500, 0.1, 'sine', 0.08);
  setTimeout(() => playTone(700, 0.1, 'sine', 0.08), 80);
  setTimeout(() => playTone(900, 0.15, 'sine', 0.08), 160);
}

export function playLoseLife() {
  playTone(400, 0.2, 'sawtooth', 0.1);
  setTimeout(() => playTone(200, 0.3, 'sawtooth', 0.1), 150);
}

export function playGameOver() {
  playTone(300, 0.3, 'sawtooth', 0.1);
  setTimeout(() => playTone(200, 0.3, 'sawtooth', 0.1), 200);
  setTimeout(() => playTone(100, 0.5, 'sawtooth', 0.1), 400);
}

export function playWaveComplete() {
  playTone(600, 0.1, 'sine', 0.08);
  setTimeout(() => playTone(800, 0.1, 'sine', 0.08), 100);
  setTimeout(() => playTone(1000, 0.2, 'sine', 0.08), 200);
}
