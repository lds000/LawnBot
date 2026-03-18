import type { WsStatus } from "@/hooks/useWebSocket";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

interface ConnectionBadgeProps {
  status: WsStatus;
}

export function ConnectionBadge({ status }: ConnectionBadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium",
        status === "connected" && "bg-green-900/50 text-green-400",
        status === "connecting" && "bg-yellow-900/50 text-yellow-400",
        status === "disconnected" && "bg-red-900/50 text-red-400"
      )}
    >
      {status === "connected" && <Wifi className="w-3.5 h-3.5" />}
      {status === "connecting" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {status === "disconnected" && <WifiOff className="w-3.5 h-3.5" />}
      {status === "connected" ? "Live" : status === "connecting" ? "Connecting…" : "Offline"}
    </div>
  );
}
