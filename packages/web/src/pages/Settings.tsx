import { useQuery } from "@tanstack/react-query";
import { getSystemMetrics } from "@/lib/api";
import { formatDuration } from "@/lib/utils";
import { Cpu, HardDrive, Thermometer } from "lucide-react";

function MetricRow({ label, value, icon: Icon }: any) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <span className="font-medium text-sm">{value}</span>
    </div>
  );
}

export function Settings() {
  const { data: metrics } = useQuery<Record<string, number | null>>({
    queryKey: ["metrics"],
    queryFn: getSystemMetrics,
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* System metrics */}
      <div className="card">
        <h2 className="font-semibold mb-3">Controller Pi Health</h2>
        {metrics ? (
          <div>
            <MetricRow
              label="CPU Temperature"
              value={metrics.cpu_temp_c != null ? `${metrics.cpu_temp_c.toFixed(1)}°C` : "—"}
              icon={Thermometer}
            />
            <MetricRow
              label="CPU Usage"
              value={metrics.cpu_percent != null ? `${metrics.cpu_percent.toFixed(1)}%` : "—"}
              icon={Cpu}
            />
            <MetricRow
              label="Memory Usage"
              value={metrics.memory_percent != null ? `${metrics.memory_percent.toFixed(1)}%` : "—"}
              icon={Cpu}
            />
            <MetricRow
              label="Disk Usage"
              value={metrics.disk_percent != null ? `${metrics.disk_percent.toFixed(1)}%` : "—"}
              icon={HardDrive}
            />
            <MetricRow
              label="Uptime"
              value={metrics.uptime_seconds != null ? formatDuration(metrics.uptime_seconds) : "—"}
              icon={Cpu}
            />
          </div>
        ) : (
          <div className="text-gray-500 text-sm">Loading…</div>
        )}
      </div>

      {/* Connection info */}
      <div className="card">
        <h2 className="font-semibold mb-3">Connection</h2>
        <div className="text-sm text-gray-400 space-y-2">
          <p>Controller Pi: <span className="text-gray-200 font-mono">raspberrypi.local:8000</span></p>
          <p>Sensor Pi: <span className="text-gray-200 font-mono">100.117.254.20:8001</span></p>
          <p>MQTT Broker: <span className="text-gray-200 font-mono">raspberrypi.local:1883</span></p>
        </div>
      </div>

      {/* About */}
      <div className="card">
        <h2 className="font-semibold mb-3">About</h2>
        <div className="text-sm text-gray-400 space-y-1">
          <p>LawnBot Controller <span className="text-gray-200">v2.0.0</span></p>
          <p>FastAPI + React + Expo</p>
        </div>
      </div>
    </div>
  );
}
