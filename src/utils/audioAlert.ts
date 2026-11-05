/**
 * Simple synthesized kitchen timer sound using browser Web Audio API
 */
export function playTimerAlarm() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // Play 3 pleasant melody beeps
    const beeps = [
      { freq: 880, start: 0, duration: 0.15 },
      { freq: 880, start: 0.25, duration: 0.15 },
      { freq: 1174.66, start: 0.5, duration: 0.35 },
    ];

    beeps.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    });
  } catch (e) {
    console.warn('Could not play audio alarm', e);
  }
}
