import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSystemMetrics, getLocation, updateLocation, clearHistory, setAuthToken } from "@/lib/api";
import { formatDuration } from "@/lib/utils";
import { Cpu, HardDrive, Thermometer, MapPin, Trash2, Key, CheckCircle2 } from "lucide-react";

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
  const qc = useQueryClient();
  const { data: metrics } = useQuery<Record<string, number | null>>({
    queryKey: ["metrics"],
    queryFn: getSystemMetrics,
    refetchInterval: 15000,
  });

  const { data: locationData } = useQuery({
    queryKey: ["location"],
    queryFn: getLocation,
  });

  // Location form
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [tz, setTz] = useState("");
  const [locationSaved, setLocationSaved] = useState(false);

  useEffect(() => {
    if (locationData) {
      setLat(String(locationData.latitude));
      setLon(String(locationData.longitude));
      setTz(locationData.timezone);
    }
  }, [locationData]);

  const locationMutation = useMutation({
    mutationFn: () => updateLocation({ latitude: parseFloat(lat), longitude: parseFloat(lon), timezone: tz }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["location"] });
      setLocationSaved(true);
      setTimeout(() => setLocationSaved(false), 2000);
    },
  });

  // Clear history
  const [clearConfirm, setClearConfirm] = useState(false);
  const clearMutation = useMutation({
    mutationFn: clearHistory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] });
      setClearConfirm(false);
    },
  });

  // API token
  const [token, setToken] = useState(() => localStorage.getItem("api_token") ?? "");
  const [tokenSaved, setTokenSaved] = useState(false);

  function saveToken() {
    localStorage.setItem("api_token", token);
    setAuthToken(token || null);
    setTokenSaved(true);
    setTimeout(() => setTokenSaved(false), 2000);
  }

  // Load saved token on mount
  useEffect(() => {
    const saved = localStorage.getItem("api_token");
    if (saved) setAuthToken(saved);
  }, []);

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

      {/* Weather location */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-sky-400" />
          <h2 className="font-semibold">Weather Location</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Latitude</label>
            <input
              type="number"
              step="0.001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              placeholder="43.615"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Longitude</label>
            <input
              type="number"
              step="0.001"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              placeholder="-116.202"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Timezone</label>
          <input
            type="text"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            placeholder="America/Denver"
          />
        </div>
        <button
          className="btn-primary w-full"
          onClick={() => locationMutation.mutate()}
          disabled={locationMutation.isPending}
        >
          {locationSaved ? (
            <><CheckCircle2 className="w-4 h-4" /> Saved</>
          ) : (
            "Save Location"
          )}
        </button>
      </div>

      {/* API Token */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-yellow-400" />
          <h2 className="font-semibold">API Auth Token</h2>
        </div>
        <p className="text-xs text-gray-400">
          Set a Bearer token on the Pi to require auth for all control endpoints.
          Leave empty to disable auth.
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono"
          placeholder="Enter token (empty = no auth)"
        />
        <button className="btn-primary w-full" onClick={saveToken}>
          {tokenSaved ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : "Save Token"}
        </button>
      </div>

      {/* Clear history */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-400" />
          <h2 className="font-semibold">Danger Zone</h2>
        </div>
        {!clearConfirm ? (
          <button
            className="btn-danger w-full"
            onClick={() => setClearConfirm(true)}
          >
            <Trash2 className="w-4 h-4" /> Clear All History
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-red-400">This will permanently delete all watering history. Are you sure?</p>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setClearConfirm(false)}>Cancel</button>
              <button
                className="btn-danger flex-1"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
              >
                Yes, Delete All
              </button>
            </div>
          </div>
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
