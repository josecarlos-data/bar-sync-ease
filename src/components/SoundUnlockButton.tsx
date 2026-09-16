import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { alertSoundReady, unlockAlertSound, playAlert } from "@/lib/alertSound";

export function SoundUnlockButton() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(alertSoundReady());
  }, []);

  async function enable() {
    const ok = await unlockAlertSound();
    setReady(ok);
    if (ok) playAlert();
  }

  if (ready) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-success/15 px-3 py-2 text-sm font-semibold text-success">
        <Volume2 className="h-4 w-4" /> Avisos sonoros activos
      </p>
    );
  }

  return (
    <button
      onClick={enable}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-3 text-sm font-semibold"
    >
      <VolumeX className="h-4 w-4" /> Activar avisos sonoros
    </button>
  );
}
