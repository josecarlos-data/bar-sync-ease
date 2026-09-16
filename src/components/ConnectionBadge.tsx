import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

export function ConnectionBadge() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        online ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
      }`}
    >
      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {online ? "En línea" : "Sin conexión"}
    </span>
  );
}
