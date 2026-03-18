import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { getSensors } from "../../lib/api";

const C = {
  bg: "#030712", card: "#111827", border: "#1f2937",
  text: "#f9fafb", muted: "#9ca3af", brand: "#22c55e",
  orange: "#f97316", blue: "#38bdf8", purple: "#a78bfa", teal: "#34d399",
};

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

export default function Sensors() {
  const [sensors, setSensors] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSensors(await getSensors());
    } catch {
      // pass
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
  refreshBtn: { backgroundColor: C.card, borderRadius: 10, padding: 14, alignItems: "center", borderColor: C.border, borderWidth: 1 },
  refreshText: { color: C.brand, fontWeight: "600", fontSize: 15 },
});
