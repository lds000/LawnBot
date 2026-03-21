import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ZoneCard } from "@/components/ZoneCard";
import { Gauge } from "@/components/Gauge";
import { manualRun, stopAll, getWeatherForecast, triggerMist, stopMist } from "@/lib/api";
import { formatDateTime, formatDuration, tempCtoF } from "@/lib/utils";
import { AlertTriangle, Droplets, CloudRain, Wind } from "lucide-react";

// ─── WMO weather-code → icon + label ─────────────────────────────────────────
function wmoIcon(code: number, isDay = true): { icon: string; label: string } {
  if (code === 0)              return { icon: isDay ? "☀️" : "🌙", label: "Clear" };
  if (code <= 2)               return { icon: isDay ? "⛅" : "🌙", label: "Partly Cloudy" };
  if (code === 3)              return { icon: "☁️",  label: "Overcast" };
  if (code <= 49)              return { icon: "🌫️",  label: "Fog" };
  if (code <= 55)              return { icon: "🌦️",  label: "Drizzle" };
  if (code <= 65)              return { icon: "🌧️",  label: "Rain" };
  if (code <= 77)              return { icon: "❄️",  label: "Snow" };
  if (code <= 82)              return { icon: "🌦️",  label: "Showers" };
  if (code <= 86)              return { icon: "🌨️",  label: "Snow Showers" };
  if (code >= 95)              return { icon: "⛈️",  label: "Thunderstorm" };
  return { icon: "🌡️", label: "Unknown" };
}

function windDirLabel(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ─── WU-style forecast strip ─────────────────────────────────────────────────
function WUStrip() {
  const { data, isError } = useQuery({
    queryKey: ["wu-forecast"],
    queryFn: getWeatherForecast,
    refetchInterval: 10 * 60 * 1000, // every 10 min
    staleTime: 5 * 60 * 1000,
  });

  if (isError) return (
    <div className="card text-xs text-gray-500 text-center py-4">
      Forecast unavailable — check network
    </div>
  );
  if (!data) return (
    <div className="card animate-pulse h-24 bg-gray-900" />
  );

  const c = data.current;
  const hourly = data.hourly;
  const daily  = data.daily;

  const now = new Date();
  const hourNow = now.getHours();

  // pick next 8 hours from hourly
  const todayStr = now.toISOString().slice(0, 10);
  const hourIndices: number[] = [];
  for (let i = 0; i < hourly.time.length && hourIndices.length < 8; i++) {
    const t = new Date(hourly.time[i]);
    if (t >= now) hourIndices.push(i);
  }

  const { icon: curIcon, label: curLabel } = wmoIcon(c.weather_code, hourNow >= 6 && hourNow < 20);

  // daily: today + next 2
  const days = [0, 1, 2].map((d) => ({
    date:    new Date(daily.time[d] + "T12:00:00"),
    hi:      Math.round(daily.temperature_2m_max[d]),
    lo:      Math.round(daily.temperature_2m_min[d]),
    pop:     daily.precipitation_probability_max[d],
    precip:  daily.precipitation_sum[d].toFixed(2),
    code:    daily.weather_code[d],
  }));

  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return (
    <div className="card overflow-hidden p-0">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/60">
        <img src="https://www.wunderground.com/static/i/logo/logo-wu.svg"
          alt="Weather Underground" className="h-4 opacity-70"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <span className="text-xs text-gray-500 font-medium">Local Forecast</span>
        <a href="https://www.wunderground.com/weather/us/id/boise/KIDBOISE760"
          target="_blank" rel="noopener noreferrer"
          className="ml-auto text-xs text-sky-500 hover:text-sky-400 no-underline">
          Full forecast ›
        </a>
      </div>

      <div className="flex flex-col sm:flex-row gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-800">

        {/* Current conditions block */}
        <div className="flex items-center gap-4 px-5 py-4 min-w-[200px]">
          <div style={{ fontSize: 52, lineHeight: 1 }}>{curIcon}</div>
          <div>
            <div className="text-4xl font-black tabular-nums text-yellow-300">
              {Math.round(c.temperature_2m)}°<span className="text-xl font-semibold text-gray-400">F</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Feels like {Math.round(c.apparent_temperature)}°</div>
            <div className="text-xs text-gray-500 mt-1 font-medium italic">{curLabel}</div>
            <div className="text-xs text-gray-500 mt-1">
              {windDirLabel(c.wind_direction_10m)} {Math.round(c.wind_speed_10m)} mph
            </div>
          </div>
        </div>

        {/* Hourly strip */}
        <div className="flex-1 overflow-x-auto px-3 py-3">
          <div className="flex gap-0 min-w-max">
            {hourIndices.map((idx) => {
              const t = new Date(hourly.time[idx]);
              const h = t.getHours();
              const isDay = h >= 6 && h < 20;
              const { icon } = wmoIcon(hourly.weather_code[idx], isDay);
              const label = h === 0 ? dayNames[t.getDay()]
                : h === 12 ? "NOON"
                : h < 12 ? `${h}AM` : `${h - 12}PM`;
              const isNoon = h === 12;
              const isMidnight = h === 0;
              return (
                <div key={idx}
                  className="flex flex-col items-center px-2.5 py-1 rounded-lg hover:bg-gray-800/60 transition-colors min-w-[52px]">
                  <div className="text-[10px] font-semibold text-gray-500 mb-1"
                    style={{ color: isNoon ? "#60a5fa" : isMidnight ? "#a78bfa" : undefined }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 22 }}>{icon}</div>
                  <div className="text-xs font-bold text-gray-200 mt-1 tabular-nums">
                    {Math.round(hourly.temperature_2m[idx])}°
                  </div>
                  {hourly.precipitation_probability[idx] > 20 && (
                    <div className="text-[10px] text-sky-400 font-semibold mt-0.5">
                      {hourly.precipitation_probability[idx]}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time axis line */}
          <div className="relative mt-1 h-[2px] bg-gray-800 rounded mx-1">
            <div className="absolute left-0 top-0 h-full bg-sky-600 rounded"
              style={{ width: `${(hourNow % 3) / 3 * 12.5}%` }} />
          </div>
        </div>
      </div>

      {/* 3-day daily summary */}
      <div className="grid grid-cols-3 divide-x divide-gray-800 border-t border-gray-800">
        {days.map((d, i) => {
          const { icon } = wmoIcon(d.code, true);
          const label = i === 0 ? "Tonight" : i === 1 ? "Tomorrow" : dayNames[d.date.getDay()];
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div style={{ fontSize: 28 }}>{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-gray-300">{label}</div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-sm font-black text-orange-300 tabular-nums">{d.hi}°</span>
                  <span className="text-xs text-gray-500 tabular-nums">{d.lo}°</span>
                </div>
                <div className="text-[10px] text-sky-400 mt-0.5">
                  {d.pop}% / {d.precip} in
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

  const mistMutation = useMutation({
    mutationFn: () => (status?.is_misting ? stopMist() : triggerMist()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["status"] }),
  });

  const _envRaw = sensors?.environment?.data ?? sensors?.environment;
  const fp = sensors?.flow_pressure?.data ?? sensors?.flow_pressure;
  const plantRaw = sensors?.plant?.data ?? sensors?.plant;
  // Normalize field names — sensor Pi uses "temperature" / "wind_speed" (no _c / _ms suffix)
  const env = _envRaw ? {
    temperature_c:        _envRaw.temperature_c     ?? _envRaw.temperature     ?? null,
    humidity_percent:     _envRaw.humidity_percent  ?? _envRaw.humidity        ?? null,
    wind_speed_ms:        _envRaw.wind_speed_ms     ?? _envRaw.wind_speed      ?? null,
    wind_direction_deg:   _envRaw.wind_direction_deg   ?? null,
    wind_direction_compass: _envRaw.wind_direction_compass ?? null,
  } : null;
  const soilMoisture: number | null = plantRaw?.moisture ?? null;
  const zones: any[] = status?.zone_states ?? [];
  const current = status?.current_run;

  return (
    <div className="space-y-6">
      {/* Rain skip banner */}
      {status?.rain_skip_active && (
        <div className="card bg-sky-950 border-sky-700 flex items-center gap-3 py-3">
          <CloudRain className="w-5 h-5 text-sky-400" />
          <div>
            <div className="font-semibold text-sky-200">Rain Skip Active</div>
            <div className="text-sm text-sky-400">Today's watering skipped due to rain forecast</div>
          </div>
        </div>
      )}

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

      {/* Active mist banner */}
      {status?.is_misting && !current && (
        <div className="card bg-cyan-950 border-cyan-700 flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <Wind className="w-5 h-5 text-cyan-400 animate-pulse" />
            <div className="font-semibold text-cyan-200">Misting Active</div>
          </div>
          <button
            className="btn-ghost text-cyan-400 border-cyan-700"
            onClick={() => mistMutation.mutate()}
            disabled={mistMutation.isPending}
          >
            Stop Mist
          </button>
        </div>
      )}

      {/* Controls row */}
      <div className="flex items-center justify-between gap-3">
        {/* Mist Now button */}
        <button
          className="btn-ghost text-cyan-400 border-cyan-800 hover:bg-cyan-900/30"
          onClick={() => mistMutation.mutate()}
          disabled={mistMutation.isPending || !!current}
          title={current ? "Stop current run first" : "Trigger mist cycle"}
        >
          <Wind className="w-4 h-4" /> {status?.is_misting ? "Stop Mist" : "Mist Now"}
        </button>

        {/* Emergency stop */}
        <button
          className="btn-danger opacity-60 hover:opacity-100"
          onClick={() => stopMutation.mutate()}
        >
          <AlertTriangle className="w-4 h-4" /> Emergency Stop
        </button>
      </div>

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
        <div className="card grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 py-6 px-6 overflow-visible">
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
          <Gauge
            value={soilMoisture}
            max={100} label="Soil Moisture" unit="%"
            color="#b45309"
          />
        </div>
      </div>

      {/* Weather forecast strip */}
      <WUStrip />

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
