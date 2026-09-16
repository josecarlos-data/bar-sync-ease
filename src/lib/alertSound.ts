let ctx: AudioContext | null = null;

/** Debe llamarse desde un gesto del usuario para desbloquear el audio. */
export async function unlockAlertSound(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    ctx = ctx ?? new Ctor();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

export function alertSoundReady(): boolean {
  return !!ctx && ctx.state === "running";
}

/** Pitido corto + vibración. */
export function playAlert() {
  if (typeof window === "undefined") return;
  try {
    navigator.vibrate?.([180, 90, 180]);
  } catch {
    /* sin vibración */
  }
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  [0, 0.28].forEach((offset) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now + offset);
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.24);
  });
}
