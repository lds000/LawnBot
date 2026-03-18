import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, CalendarDays, History, Activity, Settings, Droplets } from "lucide-react";
import { ConnectionBadge } from "./ConnectionBadge";
import type { WsStatus } from "@/hooks/useWebSocket";
const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/history", label: "History", icon: History },
  { to: "/sensors", label: "Sensors", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

interface NavbarProps {
  wsStatus: WsStatus;
}

export function Navbar({ wsStatus }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
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

        <ConnectionBadge status={wsStatus} />
      </div>
    </nav>
  );
}
