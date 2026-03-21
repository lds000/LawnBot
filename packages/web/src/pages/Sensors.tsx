import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getSensorsLatest, getSensorHistory } from "@/lib/api";
import { tempCtoF } from "@/lib/utils";
import { SharedDefs, Thermometer, Compass, CircularGauge } from "@/components/Instruments";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid
} from "recharts";

function SensorChart({ data, dataKey, color, label }: { data: any[]; dataKey: string; color: string; label: string }) {
  if (!data?.length) return <div className="text-gray-500 text-sm">No data</div>;
  const formatted = data.map((d: any) => ({
    ...d,
    time: new Date(d.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));
  return (
    <div>
      <div className="text-xs text-gray-400 mb-2">{label}</div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} width={36} />
          <Tooltip
            contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
            labelStyle={{ color: "#9ca3af" }}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sensors() {
  const { data: latest } = useQuery<Record<string, any>>({
    queryKey: ["sensors-latest"],
    queryFn: getSensorsLatest,
    refetchInterval: 5000,
  });

  const { data: envHistoryRaw = [] } = useQuery({
    queryKey: ["sensor-history-environment"],
    queryFn: () => getSensorHistory("environment", 60),
    refetchInterval: 30000,
  });

  const { data: flowHistoryRaw = [] } = useQuery({
    queryKey: ["sensor-history-flow"],
    queryFn: () => getSensorHistory("flow", 60),
    refetchInterval: 30000,
  });

  // Unwrap MQTT envelope: each history record is {recorded_at, seq, device, data: {...}}
  const envHistory = envHistoryRaw.map((r: any) => {
    const d = r.data ?? r;
    return {
      recorded_at: r.recorded_at,
      ...d,
      // pre-convert to °F for the chart
      temperature_f: d.temperature != null ? +((d.temperature * 9/5) + 32).toFixed(1) : null,
    };
  });
  const flowHistory = flowHistoryRaw.map((r: any) => ({
    recorded_at: r.recorded_at,
    ...(r.data ?? r),
  }));

  const env = latest?.environment?.data ?? latest?.environment;
  const fp = latest?.flow_pressure?.data ?? latest?.flow_pressure;
  const online = latest?.online ?? false;

  const tempC: number | null = env?.temperature ?? null;
  const humidity: number | null = env?.humidity ?? null;
  const windMs: number | null = env?.wind_speed ?? null;
  const windDeg: number | null = env?.wind_direction_deg ?? null;
  const windCompass: string | null = env?.wind_direction_compass ?? null;
  const pressurePsi: number | null = fp?.pressure_psi ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sensors</h1>
        <span className={`badge ${online ? "badge-green" : "badge-red"}`}>
          {online ? "Sensor Pi Online" : "Sensor Pi Offline"}
        </span>
      </div>

      {/* Shared SVG defs for instruments */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <SharedDefs />
      </svg>

      {/* Live instrument gauges — scaled to 55% so all 5 fit in one row */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-400 mb-4">Live Readings</h2>
        <div className="flex flex-wrap justify-center items-start gap-2 py-2">
          {(
            [
              { w: 190, h: 260, title: "Temperature",   el: <Thermometer tempF={tempC != null ? tempCtoF(tempC) : null} compact hideTitle /> },
              { w: 260, h: 310, title: "Wind Direction", el: <Compass deg={windDeg} label={windCompass ?? (windDeg != null ? `${windDeg.toFixed(0)}°` : "—")} hideTitle /> },
              { w: 260, h: 310, title: "Wind Speed",     el: <CircularGauge value={windMs != null ? +(windMs * 2.237).toFixed(1) : null} min={0} max={60} title="Wind Speed" unit="mph" zones={[{end:10,color:"#2dd4bf"},{end:25,color:"#fbbf24"},{end:40,color:"#fb923c"},{end:60,color:"#f87171"}]} labelSteps={[0,15,30,45,60]} hideTitle /> },
              { w: 260, h: 310, title: "Water Pressure", el: <CircularGauge value={pressurePsi} min={0} max={150} title="Water Pressure" unit="PSI" zones={[{end:70,color:"#22c55e"},{end:100,color:"#fbbf24"},{end:150,color:"#f87171"}]} labelSteps={[0,25,50,75,100,125,150]} hideTitle /> },
              { w: 260, h: 310, title: "Humidity",       el: <CircularGauge value={humidity} min={0} max={100} title="Humidity" unit="%RH" zones={[{end:30,color:"#fb923c"},{end:80,color:"#2dd4bf"},{end:100,color:"#38bdf8"}]} labelSteps={[0,25,50,75,100]} hideTitle /> },
            ] as { w: number; h: number; title: string; el: React.ReactNode }[]
          ).map(({ w, h, title, el }, i) => (
            <div key={i} className="flex flex-col items-center" style={{ width: w * 0.55, flexShrink: 0 }}>
              <div className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">{title}</div>
              <div style={{ width: w * 0.55, height: h * 0.55, overflow: "hidden" }}>
                <div style={{ transform: "scale(0.55)", transformOrigin: "top left", width: w, height: h }}>
                  {el}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="card space-y-6">
        <h2 className="text-sm font-medium text-gray-400">Trends (last 60 readings)</h2>
        <SensorChart
          data={envHistory}
          dataKey="temperature_f"
          color="#f97316"
          label="Temperature (°F)"
        />
        <SensorChart
          data={envHistory}
          dataKey="humidity"
          color="#38bdf8"
          label="Humidity (%)"
        />
        <SensorChart
          data={flowHistory}
          dataKey="pressure_psi"
          color="#a78bfa"
          label="Pressure (PSI)"
        />
        <SensorChart
          data={flowHistory}
          dataKey="flow_litres"
          color="#34d399"
          label="Flow Rate (L/s)"
        />
      </div>
    </div>
  );
}
