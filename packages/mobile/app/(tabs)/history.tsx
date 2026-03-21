import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, ScrollView } from "react-native";
import { getHistory } from "../../lib/api";

const C = {
  bg: "#030712", card: "#111827", border: "#1f2937",
  text: "#f9fafb", muted: "#9ca3af", brand: "#22c55e",
  blue: "#3b82f6", red: "#ef4444", yellow: "#f59e0b",
  purple: "#a78bfa", orange: "#f97316",
};

const ZONE_COLORS = [C.brand, C.blue, C.yellow, C.purple, C.orange, "#34d399", "#e879f9", "#38bdf8"];

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function buildZoneData(history: any[]) {
  const map = new Map<string, number>();
  for (const h of history) {
    const name = h.set_name ?? "Unknown";
    map.set(name, (map.get(name) ?? 0) + (h.duration_seconds ?? 0));
  }
  const entries = Array.from(map.entries())
    .map(([zone, sec]) => ({ zone, minutes: sec / 60 }))
    .sort((a, b) => b.minutes - a.minutes);
  const max = entries[0]?.minutes ?? 1;
  return entries.map((e) => ({ ...e, pct: e.minutes / max }));
}

function buildDailyData(history: any[]) {
  const map = new Map<string, number>();
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toLocaleDateString([], { month: "short", day: "numeric" });
    map.set(key, 0);
  }
  for (const h of history) {
    const d = new Date(h.start_time);
    const key = d.toLocaleDateString([], { month: "short", day: "numeric" });
    if (map.has(key)) {
      map.set(key, (map.get(key) ?? 0) + (h.duration_seconds ?? 0));
    }
  }
  const entries = Array.from(map.entries()).map(([date, sec]) => ({ date, minutes: sec / 60 }));
  const max = Math.max(...entries.map((e) => e.minutes), 1);
  return entries.map((e) => ({ ...e, pct: e.minutes / max }));
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[s.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function DailyBars({ data }: { data: { date: string; minutes: number; pct: number }[] }) {
  const BAR_H = 80;
  return (
    <View style={s.chartCard}>
      <Text style={s.chartTitle}>Daily Water Time (last 7 days)</Text>
      <View style={s.dailyChart}>
        {data.map((d, i) => (
          <View key={i} style={s.barCol}>
            <Text style={s.barLabel}>{d.minutes > 0 ? `${d.minutes.toFixed(0)}m` : ""}</Text>
            <View style={[s.barTrack, { height: BAR_H }]}>
              <View
                style={[
                  s.barFill,
                  {
                    height: Math.max(d.pct * BAR_H, d.minutes > 0 ? 4 : 0),
                    backgroundColor: C.brand,
                  },
                ]}
              />
            </View>
            <Text style={s.barDate}>{d.date.split(" ")[1]}</Text>
            <Text style={s.barDateMo}>{d.date.split(" ")[0]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ZoneBars({ data }: { data: { zone: string; minutes: number; pct: number }[] }) {
  return (
    <View style={s.chartCard}>
      <Text style={s.chartTitle}>Total Time by Zone</Text>
      {data.map((d, i) => (
        <View key={i} style={s.zoneRow}>
          <Text style={s.zoneName} numberOfLines={1}>{d.zone}</Text>
          <View style={s.zoneTrack}>
            <View style={[s.zoneFill, { width: `${d.pct * 100}%` as any, backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length] }]} />
          </View>
          <Text style={s.zoneDur}>{d.minutes.toFixed(0)}m</Text>
        </View>
      ))}
    </View>
  );
}

function Summary({ history }: { history: any[] }) {
  const totalRuns = history.length;
  const totalSec = history.reduce((s, h) => s + (h.duration_seconds ?? 0), 0);
  const completionRate = totalRuns > 0
    ? Math.round((history.filter((h) => h.completed).length / totalRuns) * 100)
    : 0;
  const totalLitres = history.reduce((s: number, h: any) => s + (h.estimated_litres ?? 0), 0);

  const dailyData = buildDailyData(history);
  const zoneData = buildZoneData(history);

  return (
    <View style={s.summary}>
      <View style={s.statRow}>
        <StatCard label="Total Runs" value={String(totalRuns)} color={C.brand} />
        <StatCard label="Water Time" value={formatDuration(totalSec)} color={C.blue} />
        <StatCard label="Complete" value={`${completionRate}%`} color={C.purple} />
        {totalLitres > 0 && (
          <StatCard label="Est. Litres" value={`${totalLitres.toFixed(0)}L`} color={C.blue} />
        )}
      </View>
      {totalRuns > 0 && (
        <>
          <DailyBars data={dailyData} />
          {zoneData.length > 0 && <ZoneBars data={zoneData} />}
        </>
      )}
    </View>
  );
}

export default function History() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHistory(100);
      setHistory(data);
    } catch {
      // pass
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const renderItem = ({ item }: { item: any }) => {
    const start = new Date(item.start_time);
    const dateStr = start.toLocaleDateString([], { month: "short", day: "numeric" });
    const timeStr = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const statusBadge = item.skip_reason === "rain_skip"
      ? { text: "Rain Skip", style: s.badgeBlue }
      : item.skip_reason === "soil_moisture"
      ? { text: "Soil Wet", style: s.badgeGray }
      : item.completed
      ? { text: "Done", style: s.badgeGreen }
      : { text: "Stopped", style: s.badgeYellow };

    return (
      <View style={s.row}>
        <View style={s.rowLeft}>
          <Text style={s.setName}>{item.set_name}</Text>
          <Text style={s.meta}>{dateStr} · {timeStr}</Text>
          {item.estimated_litres != null && item.estimated_litres > 0 && (
            <Text style={s.litres}>{item.estimated_litres.toFixed(1)} L</Text>
          )}
        </View>
        <View style={s.rowRight}>
          <Text style={s.dur}>
            {item.skip_reason ? "—" : item.duration_seconds ? formatDuration(item.duration_seconds) : "—"}
          </Text>
          <View style={[s.badge, statusBadge.style]}>
            <Text style={s.badgeText}>{statusBadge.text}</Text>
          </View>
          {item.is_manual && (
            <View style={[s.badge, s.badgeBlue]}>
              <Text style={s.badgeText}>Manual</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <FlatList
      style={s.root}
      data={history}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      contentContainerStyle={s.list}
      refreshing={loading}
      onRefresh={load}
      ListHeaderComponent={history.length > 0 ? <Summary history={history} /> : null}
      ListEmptyComponent={
        loading ? null : <Text style={s.empty}>No watering history yet.</Text>
      }
      ItemSeparatorComponent={() => <View style={s.sep} />}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  list: { padding: 16, paddingBottom: 40 },

  // Summary
  summary: { marginBottom: 20, gap: 12 },
  statRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 10, padding: 10,
    borderColor: C.border, borderWidth: 1,
  },
  statValue: { fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 10, color: C.muted, marginTop: 2 },

  // Daily bar chart
  chartCard: { backgroundColor: C.card, borderRadius: 10, padding: 14, borderColor: C.border, borderWidth: 1 },
  chartTitle: { fontSize: 11, color: C.muted, fontWeight: "600", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  dailyChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  barCol: { flex: 1, alignItems: "center" },
  barLabel: { fontSize: 8, color: C.muted, marginBottom: 3, height: 12 },
  barTrack: { width: "60%", justifyContent: "flex-end", backgroundColor: "#1f2937", borderRadius: 3 },
  barFill: { width: "100%", borderRadius: 3 },
  barDate: { fontSize: 9, color: C.text, marginTop: 4, fontWeight: "600" },
  barDateMo: { fontSize: 9, color: C.muted },

  // Zone bar chart
  zoneRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  zoneName: { width: 72, fontSize: 11, color: C.text, fontWeight: "500" },
  zoneTrack: { flex: 1, height: 12, backgroundColor: "#1f2937", borderRadius: 6, overflow: "hidden" },
  zoneFill: { height: "100%", borderRadius: 6 },
  zoneDur: { width: 30, fontSize: 11, color: C.muted, textAlign: "right" },

  // History rows
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: C.card, borderRadius: 10, borderColor: C.border, borderWidth: 1 },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  setName: { color: C.text, fontWeight: "600", fontSize: 14 },
  meta: { color: C.muted, fontSize: 12, marginTop: 2 },
  dur: { color: C.text, fontWeight: "700", fontSize: 16, fontVariant: ["tabular-nums"] },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeGreen: { backgroundColor: "#14532d" },
  badgeBlue: { backgroundColor: "#1e3a5f" },
  badgeGray: { backgroundColor: "#374151" },
  badgeYellow: { backgroundColor: "#451a03" },
  badgeText: { fontSize: 10, fontWeight: "600", color: "#d1fae5" },
  litres: { color: C.blue, fontSize: 11, marginTop: 2 },
  sep: { height: 8 },
  empty: { color: C.muted, textAlign: "center", padding: 40 },
});
