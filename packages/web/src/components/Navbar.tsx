import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { tempCtoF } from "@/lib/utils";
import {
  LayoutDashboard, CalendarDays, History, Activity, Settings,
  Droplets, CloudSun, Thermometer, Wind, Gauge,
} from "lucide-react";
import { ConnectionBadge } from "./ConnectionBadge";
import type { WsStatus } from "@/hooks/useWebSocket";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/history", label: "History", icon: History },
  { to: "/sensors", label: "Sensors", icon: Activity },
  { to: "/weather", label: "Weather", icon: CloudSun },
  { to: "/settings", label: "Settings", icon: Settings },
];

interface NavbarProps {
  wsStatus: WsStatus;
  sensors?: Record<string, any>;
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function Navbar({ wsStatus, sensors }: NavbarProps) {
  const now = useClock();

  const env = sensors?.environment?.data ?? sensors?.environment ?? null;
  const fp  = sensors?.flow_pressure?.data ?? sensors?.flow_pressure ?? null;

  const tempC: number | null  = env?.temperature_c ?? env?.temperature ?? null;
  const tempF  = tempC != null ? tempCtoF(tempC) : null;
  const humidity: number | null = env?.humidity_percent ?? env?.humidity ?? null;
  const windMs: number | null   = env?.wind_speed_ms ?? env?.wind_speed ?? null;
  const windMph = windMs != null ? +(windMs * 2.237).toFixed(1) : null;
  const windLabel: string | null = env?.wind_direction_compass ?? null;
  const pressurePsi: number | null = fp?.pressure_psi ?? null;

  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800">
      {/* Weather / time strip */}
      <div className="border-b border-gray-800/60 bg-gray-900/60">
        <div className="max-w-6xl mx-auto px-4 h-9 flex items-center gap-4 text-xs">
          {/* Clock */}
          <span className="font-mono font-semibold text-gray-200 tabular-nums">{timeStr}</span>
          <span className="text-gray-500">{dateStr}</span>

          <span className="text-gray-700">|</span>

          {/* Weather stats */}
          {tempF != null ? (
            <span className="flex items-center gap-1 text-orange-400">
              <Thermometer className="w-3 h-3" />
              {tempF.toFixed(1)}°F
            </span>
          ) : (
            <span className="text-gray-600 flex items-center gap-1">
              <Thermometer className="w-3 h-3" />—
            </span>
          )}

          {humidity != null ? (
            <span className="flex items-center gap-1 text-sky-400">
              <Droplets className="w-3 h-3" />
              {humidity.toFixed(0)}%
            </span>
          ) : (
            <span className="text-gray-600 flex items-center gap-1">
              <Droplets className="w-3 h-3" />—
            </span>
          )}

          {windMph != null ? (
            <span className="flex items-center gap-1 text-teal-400">
              <Wind className="w-3 h-3" />
              {windMph} mph{windLabel ? ` ${windLabel}` : ""}
            </span>
          ) : (
            <span className="text-gray-600 flex items-center gap-1">
              <Wind className="w-3 h-3" />—
            </span>
          )}

          {pressurePsi != null && (
            <span className="flex items-center gap-1 text-violet-400">
              <Gauge className="w-3 h-3" />
              {pressurePsi.toFixed(1)} psi
            </span>
          )}

          <span className="ml-auto">
            <ConnectionBadge status={wsStatus} />
          </span>
        </div>
      </div>

      {/* Nav row */}
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-brand-500">
          <Droplets className="w-5 h-5" />
          <span>LawnBot</span>
        </div>

        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-brand-900/50 text-brand-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                )
              }
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
