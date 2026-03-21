import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { getSensors, getSensorHistory } from "../../lib/api";

const C = {
  bg: "#030712", card: "#111827", border: "#1f2937",
  text: "#f9fafb", muted: "#9ca3af", brand: "#22c55e",
  orange: "#f97316", blue: "#38bdf8", purple: "#a78bfa", teal: "#34d399",
};

const SCREEN_W = Dimensions.get("window").width;

function MetricTile({ label, value, unit, color }: { label: string; value: string | null; unit: string; color: string }) {
  return (
    <View style={[s.tile, { borderColor: color + "44" }]}>
      <Text style={[s.tileValue, { color }]}>{value ?? "—"}</Text>
      <Text style={s.tileUnit}>{unit}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

function toCelsius(c: number | null): number | null {
  return c;
}
function toFahrenheit(c: number | null): string | null {
  if (c == null) return null;
  return ((c * 9) / 5 + 32).toFixed(0);
}
function toMph(ms: number | null): string | null {
  if (ms == null) return null;
  return (ms * 2.237).toFixed(1);
}

// SVG-style polyline sparkline using React Native Views
function Sparkline({
  values,
  color,
  height = 48,
}: {
  values: number[];
  color: string;
  height?: number;
}) {
  const width = SCREEN_W - 32 - 28; // card padding
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }));

  // Render as a series of thin vertical bars (simpler, no SVG dep)
  return (
    <View style={{ width, height, flexDirection: "row", alignItems: "flex-end" }}>
      {pts.map((pt, i) => {
        const barH = Math.max(((pt.y === 0 ? height : height - pt.y) / height) * height, 2);
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: barH,
              backgroundColor: color,
              opacity: 0.75,
              marginHorizontal: 0.5,
              borderRadius: 1,
            }}
          />
        );
      })}
    </View>
  );
}

function HistoryChart({
  label,
  data,
  field,
  color,
  unit,
  transform,
}: {
  label: string;
  data: Record<string, unknown>[];
  field: string;
  color: string;
  unit: string;
  transform?: (v: number) => number;
}) {
  if (!data.length) return null;
  const reversed = [...data].reverse();
  const values = reversed
    .map((r) => {
      const v = r[field] as number | null | undefined;
      if (v == null) return null;
      return transform ? transform(v) : v;
    })
    .filter((v): v is number => v != null);

  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const latest = values[values.length - 1];
  const latestLabel = `${latest.toFixed(1)}${unit}`;

  // Label times: first and last
  const firstTime = new Date(reversed[0].recorded_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const lastTime = new Date(reversed[reversed.length - 1].recorded_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={s.histCard}>
      <View style={s.histHeader}>
        <Text style={s.histLabel}>{label}</Text>
        <Text style={[s.histLatest, { color }]}>{latestLabel}</Text>
      </View>
      <Sparkline values={values} color={color} height={56} />
      <View style={s.histFooter}>
        <Text style={s.histTime}>{firstTime}</Text>
        <Text style={s.histRange}>
          {min.toFixed(1)}–{max.toFixed(1)}{unit}
        </Text>
        <Text style={s.histTime}>{lastTime}</Text>
      </View>
    </View>
  );
}

export default function Sensors() {
  const [sensors, setSensors] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [envHistory, setEnvHistory] = useState<Record<string, unknown>[]>([]);
  const [flowHistory, setFlowHistory] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [latest, envH, flowH] = await Promise.allSettled([
        getSensors(),
        getSensorHistory("environment", 60),
        getSensorHistory("flow", 60),
      ]);
      if (latest.status === "fulfilled") setSensors(latest.value);
      if (envH.status === "fulfilled") setEnvHistory(envH.value);
      if (flowH.status === "fulfilled") setFlowHistory(flowH.value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const env = sensors?.environment?.data ?? sensors?.environment;
  const fp = sensors?.flow_pressure?.data ?? sensors?.flow_pressure;
  const plant = sensors?.plant?.data ?? sensors?.plant;
  const online = sensors?.online ?? false;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.title}>Sensors</Text>
        <View style={[s.badge, { backgroundColor: (online ? C.brand : "#ef4444") + "22" }]}>
          <View style={[s.dot, { backgroundColor: online ? C.brand : "#ef4444" }]} />
          <Text style={[s.badgeText, { color: online ? C.brand : "#ef4444" }]}>
            {online ? "Sensor Pi Online" : "Offline"}
          </Text>
        </View>
      </View>

      <View style={s.grid}>
        <MetricTile
          label="Air Temp"
          value={toFahrenheit(env?.temperature_c ?? null)}
          unit="°F"
          color={C.orange}
        />
        <MetricTile
          label="Humidity"
          value={env?.humidity_percent != null ? env.humidity_percent.toFixed(0) : null}
          unit="%"
          color={C.blue}
        />
        <MetricTile
          label="Pressure"
          value={fp?.pressure_psi != null ? fp.pressure_psi.toFixed(1) : null}
          unit="PSI"
          color={C.purple}
        />
        <MetricTile
          label="Wind"
          value={toMph(env?.wind_speed_ms ?? null)}
          unit="mph"
          color={C.teal}
        />
        {fp?.flow_rate_lpm != null && (
          <MetricTile
            label="Flow Rate"
            value={fp.flow_rate_lpm.toFixed(2)}
            unit="L/min"
            color={C.blue}
          />
        )}
        {plant?.moisture != null && (
          <MetricTile
            label="Moisture"
            value={plant.moisture.toFixed(0)}
            unit="%"
            color={C.brand}
          />
        )}
      </View>

      {env?.wind_direction_compass && (
        <View style={s.windCard}>
          <Text style={s.windDir}>{env.wind_direction_compass}</Text>
          <Text style={s.windDeg}>{env.wind_direction_deg?.toFixed(0)}°</Text>
          <Text style={s.tileLabel}>Wind Direction</Text>
        </View>
      )}

      {envHistory.length > 1 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Last {envHistory.length} Readings</Text>
          <HistoryChart
            label="Temperature"
            data={envHistory}
            field="temperature_c"
            color={C.orange}
            unit="°F"
            transform={(c) => (c * 9) / 5 + 32}
          />
          <HistoryChart
            label="Humidity"
            data={envHistory}
            field="humidity_percent"
            color={C.blue}
            unit="%"
          />
          {envHistory.some((r) => r.wind_speed_ms != null) && (
            <HistoryChart
              label="Wind Speed"
              data={envHistory}
              field="wind_speed_ms"
              color={C.teal}
              unit=" mph"
              transform={(v) => v * 2.237}
            />
          )}
        </View>
      )}

      {flowHistory.length > 1 && (
        <View style={s.section}>
          {flowHistory[0]?.pressure_psi != null && (
            <HistoryChart
              label="Pressure"
              data={flowHistory}
              field="pressure_psi"
              color={C.purple}
              unit=" PSI"
            />
          )}
          {flowHistory[0]?.flow_rate_lpm != null && (
            <HistoryChart
              label="Flow Rate"
              data={flowHistory}
              field="flow_rate_lpm"
              color={C.blue}
              unit=" L/min"
            />
          )}
        </View>
      )}

      <TouchableOpacity style={s.refreshBtn} onPress={load} disabled={loading}>
        <Text style={s.refreshText}>{loading ? "Refreshing…" : "Refresh"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  tile: { flex: 1, minWidth: "44%", backgroundColor: C.card, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1 },
  tileValue: { fontSize: 28, fontWeight: "800", fontVariant: ["tabular-nums"] },
  tileUnit: { color: C.muted, fontSize: 12, marginTop: 1 },
  tileLabel: { color: C.muted, fontSize: 11, marginTop: 4 },
  windCard: { backgroundColor: C.card, borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 12, borderColor: C.border, borderWidth: 1 },
  windDir: { fontSize: 40, fontWeight: "800", color: C.teal },
  windDeg: { fontSize: 20, color: C.text, fontWeight: "700" },

  // History section
  section: { gap: 10, marginBottom: 12 },
  sectionTitle: { fontSize: 11, color: C.muted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  histCard: { backgroundColor: C.card, borderRadius: 10, padding: 14, borderColor: C.border, borderWidth: 1 },
  histHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  histLabel: { fontSize: 12, color: C.text, fontWeight: "600" },
  histLatest: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  histFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  histTime: { fontSize: 9, color: C.muted },
  histRange: { fontSize: 9, color: C.muted },

  refreshBtn: { backgroundColor: C.card, borderRadius: 10, padding: 14, alignItems: "center", borderColor: C.border, borderWidth: 1 },
  refreshText: { color: C.brand, fontWeight: "600", fontSize: 15 },
});
