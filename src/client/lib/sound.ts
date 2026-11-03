import { getSettings } from './settings';

/** 所有音效都即時合成，不需要載入任何音檔。 */
let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!getSettings().sound) return null;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

function knock(ctx: AudioContext, at: number, frequency: number, volume: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, at);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.45, at + 0.09);
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + 0.13);
}

function chime(ctx: AudioContext, at: number, frequency: number, length: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, at + length);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + length + 0.02);
}

export type SoundName = 'select' | 'move' | 'capture' | 'check' | 'win' | 'lose' | 'notice';

export function playSound(name: SoundName): void {
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  switch (name) {
    case 'select':
      knock(ctx, now, 520, 0.08);
      break;
    case 'move':
      knock(ctx, now, 300, 0.32);
      break;
    case 'capture':
      knock(ctx, now, 300, 0.36);
      knock(ctx, now + 0.05, 190, 0.34);
      break;
    case 'check':
      knock(ctx, now, 300, 0.3);
      chime(ctx, now + 0.05, 740, 0.35);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((tone, index) => chime(ctx, now + index * 0.12, tone, 0.5));
      break;
    case 'lose':
      [392, 330].forEach((tone, index) => chime(ctx, now + index * 0.18, tone, 0.5));
      break;
    case 'notice':
      chime(ctx, now, 660, 0.25);
      break;
  }
}
