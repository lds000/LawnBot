import { cn, formatDuration } from "@/lib/utils";
import { Droplets, Pause } from "lucide-react";

interface ZoneCardProps {
  name: string;
  status: "idle" | "watering" | "soaking" | "scheduled-soon" | string;
  relayOn: boolean;
  remainingSeconds?: number;
  phase?: string;
  isActiveZone: boolean;   // true only for the zone currently running
  anyRunning: boolean;     // true if ANY zone is running
  onRun: () => void;
  onStop: () => void;
}

const STATUS_CONFIG = {
  watering: {
    label: "Watering",
    color: "text-blue-400",
    bg: "bg-blue-950 border-blue-700",
    dot: "bg-blue-400 animate-pulse",
  },
  soaking: {
    label: "Soaking",
    color: "text-purple-400",
    bg: "bg-purple-950 border-purple-700",
    dot: "bg-purple-400 animate-pulse",
  },
  "scheduled-soon": {
    label: "Soon",
    color: "text-yellow-400",
    bg: "bg-yellow-950 border-yellow-800",
    dot: "bg-yellow-400",
  },
  idle: {
    label: "Idle",
    color: "text-gray-400",
    bg: "bg-gray-900 border-gray-800",
    dot: "bg-gray-600",
  },
};

export function ZoneCard({
  name, status, remainingSeconds, phase,
  isActiveZone, anyRunning, onRun, onStop,
}: ZoneCardProps) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.idle;

  return (
    <div className={cn("rounded-xl border p-4 flex flex-col gap-3 transition-all", cfg.bg)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("w-2.5 h-2.5 rounded-full", cfg.dot)} />
          <span className="font-semibold text-sm">{name}</span>
        </div>
        <span className={cn("text-xs font-medium", cfg.color)}>{cfg.label}</span>
      </div>

      {isActiveZone && remainingSeconds != null && (
        <div className="flex items-center gap-2 text-sm">
          {phase === "soaking" ? (
            <Pause className="w-4 h-4 text-purple-400" />
          ) : (
            <Droplets className="w-4 h-4 text-blue-400" />
          )}
          <span className={cfg.color}>{formatDuration(remainingSeconds)} remaining</span>
        </div>
      )}

      <div className="flex gap-2 mt-1">
        {isActiveZone ? (
          // Only the running zone shows Stop
          <button onClick={onStop} className="btn-danger text-xs py-1.5 flex-1">
            Stop
          </button>
        ) : (
          // All other zones show Run, disabled while something else is running
          <button
            onClick={onRun}
            disabled={anyRunning}
            className="btn-primary text-xs py-1.5 flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Droplets className="w-3.5 h-3.5" /> Run
          </button>
        )}
      </div>
    </div>
  );
}
