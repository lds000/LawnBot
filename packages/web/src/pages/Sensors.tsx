import { useQuery } from "@tanstack/react-query";
import { getSensorsLatest, getSensorHistory } from "@/lib/api";
import { tempCtoF } from "@/lib/utils";
import { Gauge } from "@/components/Gauge";
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

  const { data: envHistory = [] } = useQuery({
    queryKey: ["sensor-history-environment"],
    queryFn: () => getSensorHistory("environment", 60),
    refetchInterval: 30000,
  });

  const { data: flowHistory = [] } = useQuery({
    queryKey: ["sensor-history-flow"],
    queryFn: () => getSensorHistory("flow", 60),
    refetchInterval: 30000,
  });

  const env = latest?.environment?.data ?? latest?.environment;
  const fp = latest?.flow_pressure?.data ?? latest?.flow_pressure;
  const online = latest?.online ?? false;

  // Normalize field names — sensor Pi uses "temperature", "wind_speed", etc.
  const tempC: number | null = env?.temperature_c ?? env?.temperature ?? null;
  const humidity: number | null = env?.humidity_percent ?? env?.humidity ?? null;
  const windMs: number | null = env?.wind_speed_ms ?? env?.wind_speed ?? null;
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

      {/* Live gauges */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-400 mb-4">Live Readings</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-2">
          <Gauge
            value={tempC != null ? tempCtoF(tempC) : null}
            min={30} max={120} label="Air Temp" unit="°F" color="#f97316"
          />
          <Gauge
            value={humidity}
            max={100} label="Humidity" unit="%" color="#38bdf8"
          />
          <Gauge
            value={pressurePsi}
            max={80} label="Pressure" unit="PSI" color="#a78bfa"
          />
          <Gauge
            value={windMs != null ? +(windMs * 2.237).toFixed(1) : null}
            max={30} label="Wind" unit="mph" color="#34d399"
          />
        </div>
      </div>

      {/* Wind direction */}
      {windCompass && (
        <div className="card flex items-center gap-4">
          <div className="text-4xl font-bold text-gray-300">{windCompass}</div>
          <div>
            <div className="text-sm text-gray-400">Wind Direction</div>
            <div className="text-lg font-semibold">{windDeg?.toFixed(0)}°</div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="card space-y-6">
        <h2 className="text-sm font-medium text-gray-400">Trends (last 60 readings)</h2>
        <SensorChart
          data={envHistory}
          dataKey="temperature_c"
          color="#f97316"
          label="Temperature (°C)"
        />
        <SensorChart
          data={envHistory}
          dataKey="humidity_percent"
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
          dataKey="flow_rate_lpm"
          color="#34d399"
          label="Flow Rate (L/min)"
        />
      </div>
    </div>
  );
}
