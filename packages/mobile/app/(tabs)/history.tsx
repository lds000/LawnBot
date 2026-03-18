import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { getHistory } from "../../lib/api";

const C = {
  bg: "#030712", card: "#111827", border: "#1f2937",
  text: "#f9fafb", muted: "#9ca3af", brand: "#22c55e",
  blue: "#3b82f6", red: "#ef4444", yellow: "#f59e0b",
};

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
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

    return (
      <View style={s.row}>
        <View style={s.rowLeft}>
          <Text style={s.setName}>{item.set_name}</Text>
          <Text style={s.meta}>{dateStr} · {timeStr}</Text>
        </View>
        <View style={s.rowRight}>
          <Text style={s.dur}>
            {item.duration_seconds ? formatDuration(item.duration_seconds) : "—"}
          </Text>
          <View style={[s.badge, item.completed ? s.badgeGreen : s.badgeYellow]}>
            <Text style={s.badgeText}>{item.completed ? "Done" : "Stopped"}</Text>
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
    <View style={s.root}>
      <FlatList
        data={history}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={
          <Text style={s.empty}>No watering history yet.</Text>
        }
        ItemSeparatorComponent={() => <View style={s.sep} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  list: { padding: 16, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: C.card, borderRadius: 10, borderColor: C.border, borderWidth: 1 },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  setName: { color: C.text, fontWeight: "600", fontSize: 14 },
  meta: { color: C.muted, fontSize: 12, marginTop: 2 },
  dur: { color: C.text, fontWeight: "700", fontSize: 16, fontVariant: ["tabular-nums"] },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeGreen: { backgroundColor: "#14532d" },
  badgeBlue: { backgroundColor: "#1e3a5f" },
  badgeYellow: { backgroundColor: "#451a03" },
  badgeText: { fontSize: 10, fontWeight: "600", color: "#d1fae5" },
  sep: { height: 8 },
  empty: { color: C.muted, textAlign: "center", padding: 40 },
});
