import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ZoneCard } from "@/components/ZoneCard";
import { Gauge } from "@/components/Gauge";
import { manualRun, stopAll } from "@/lib/api";
import { formatDateTime, formatDuration, tempCtoF } from "@/lib/utils";
import { AlertTriangle, Droplets } from "lucide-react";

interface DashboardProps {
  status: any;
  sensors: any;
}

export function Dashboard({ status, sensors }: DashboardProps) {
  const [runDialogZone, setRunDialogZone] = useState<string | null>(null);
  const [runDuration, setRunDuration] = useState(10);
  const qc = useQueryClient();

  const runMutation = useMutation({
    mutationFn: ({ zone, duration }: { zone: string; duration: number }) =>
      manualRun(zone, duration),
    onSuccess: () => { setRunDialogZone(null); qc.invalidateQueries({ queryKey: ["status"] }); },
  });

  const stopMutation = useMutation({
    mutationFn: stopAll,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["status"] }),
  });

  const _envRaw = sensors?.environment?.data ?? sensors?.environment;
  const fp = sensors?.flow_pressure?.data ?? sensors?.flow_pressure;
  // Normalize field names — sensor Pi uses "temperature" / "wind_speed" (no _c / _ms suffix)
  const env = _envRaw ? {
    temperature_c:        _envRaw.temperature_c     ?? _envRaw.temperature     ?? null,
    humidity_percent:     _envRaw.humidity_percent  ?? _envRaw.humidity        ?? null,
    wind_speed_ms:        _envRaw.wind_speed_ms     ?? _envRaw.wind_speed      ?? null,
    wind_direction_deg:   _envRaw.wind_direction_deg   ?? null,
    wind_direction_compass: _envRaw.wind_direction_compass ?? null,
  } : null;
  const zones: any[] = status?.zone_states ?? [];
  const current = status?.current_run;

  return (
    <div className="space-y-6">
      {/* Current run banner */}
      {current && (
        <div className="card bg-blue-950 border-blue-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Droplets className="w-5 h-5 text-blue-400 animate-pulse" />
            <div>
              <div className="font-semibold">{current.zone_name}</div>
              <div className="text-sm text-blue-300">
                {current.phase} — {formatDuration(current.remaining_seconds)} remaining
                {current.phase_detail ? ` (${current.phase_detail})` : ""}
              </div>
            </div>
          </div>
          <button
            className="btn-danger"
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
          >
            Stop All
          </button>
        </div>
      )}

      {/* Emergency stop (always visible) */}
      {!current && (
        <div className="flex justify-end">
          <button
            className="btn-danger opacity-60 hover:opacity-100"
            onClick={() => stopMutation.mutate()}
          >
            <AlertTriangle className="w-4 h-4" /> Emergency Stop
          </button>
        </div>
      )}

      {/* Zone cards */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 mb-3">Zones</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {zones.map((z: any) => (
            <ZoneCard
              key={z.name}
              name={z.name}
              status={current?.zone_name === z.name ? current.phase : z.status}
              relayOn={z.relay_on}
              isActiveZone={!!(current && current.zone_name === z.name)}
              anyRunning={!!current}
              remainingSeconds={current?.zone_name === z.name ? current.remaining_seconds : undefined}
              phase={current?.zone_name === z.name ? current.phase : undefined}
              onRun={() => setRunDialogZone(z.name)}
              onStop={() => stopMutation.mutate()}
            />
          ))}
        </div>
      </div>

      {/* Sensor gauges */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 mb-3">Sensors</h2>
        <div className="card grid grid-cols-2 sm:grid-cols-4 gap-6 py-6">
          <Gauge
            value={env?.temperature_c != null ? tempCtoF(env.temperature_c) : null}
            max={120} min={30}
            label="Temperature" unit="°F"
            color="#f97316"
          />
          <Gauge
            value={env?.humidity_percent ?? null}
            max={100} label="Humidity" unit="%"
            color="#38bdf8"
          />
          <Gauge
            value={fp?.pressure_psi ?? null}
            max={80} label="Pressure" unit="PSI"
            color="#a78bfa"
          />
          <Gauge
            value={env?.wind_speed_ms != null ? +(env.wind_speed_ms * 2.237).toFixed(1) : null}
            max={30} label="Wind" unit="mph"
            color="#34d399"
          />
        </div>
      </div>

      {/* Schedule info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <div className="text-xs text-gray-500 mb-1">Today</div>
          <div className="font-semibold">
            {status?.today_is_watering_day ? (
              <span className="text-brand-400">Watering Day</span>
            ) : (
              <span className="text-gray-400">Rest Day</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Schedule day {(status?.schedule_day_index ?? 0) + 1} of 14
          </div>
        </div>
        {status?.next_run && (
          <div className="card">
            <div className="text-xs text-gray-500 mb-1">Next Run</div>
            <div className="font-semibold">{status.next_run.set_name}</div>
            <div className="text-xs text-gray-400 mt-1">
              {formatDateTime(status.next_run.scheduled_time)}
            </div>
          </div>
        )}
      </div>

      {/* Manual run dialog */}
      {runDialogZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="card w-80 space-y-4">
            <h3 className="font-semibold">Run {runDialogZone}</h3>
            <div>
              <label className="text-sm text-gray-400">Duration (minutes)</label>
              <input
                type="number"
                min={1} max={60}
                value={runDuration}
                onChange={(e) => setRunDuration(Number(e.target.value))}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setRunDialogZone(null)}>Cancel</button>
              <button
                className="btn-primary flex-1"
                disabled={runMutation.isPending}
                onClick={() => runMutation.mutate({ zone: runDialogZone!, duration: runDuration })}
              >
                <Droplets className="w-4 h-4" /> Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
