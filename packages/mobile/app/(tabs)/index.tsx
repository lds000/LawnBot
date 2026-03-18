import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, ActivityIndicator, StyleSheet, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useWebSocket } from "../../components/useWebSocket";
import { manualRun, stopAll } from "../../lib/api";

const COLORS = {
  bg: "#030712",
  card: "#111827",
  border: "#1f2937",
  text: "#f9fafb",
  muted: "#9ca3af",
  brand: "#22c55e",
  blue: "#3b82f6",
  red: "#ef4444",
  yellow: "#f59e0b",
  purple: "#a855f7",
};

function ZoneCard({ zone, currentRun, onRun, onStop }: any) {
  const isActive = currentRun?.zone_name === zone.name;
  const phase = isActive ? currentRun.phase : "idle";
  const remaining = isActive ? currentRun.remaining_seconds : 0;

  const phaseColor = phase === "watering" ? COLORS.blue
    : phase === "soaking" ? COLORS.purple
    : COLORS.muted;

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const timeStr = remaining > 0 ? `${mm}:${ss.toString().padStart(2, "0")}` : null;

  return (
    <View style={[s.card, isActive && { borderColor: phaseColor, borderWidth: 1.5 }]}>
      <View style={s.row}>
        <View style={[s.dot, { backgroundColor: isActive ? phaseColor : COLORS.border }]} />
        <Text style={s.zoneName}>{zone.name}</Text>
        {isActive && (
          <Text style={[s.phaseLabel, { color: phaseColor }]}>
            {phase.charAt(0).toUpperCase() + phase.slice(1)}
          </Text>
        )}
      </View>

      {timeStr && (
        <Text style={[s.timerText, { color: phaseColor }]}>{timeStr}</Text>
      )}

      <View style={s.btnRow}>
        {!isActive ? (
          <TouchableOpacity style={s.runBtn} onPress={() => onRun(zone.name)}>
            <Ionicons name="water" size={14} color="#fff" />
            <Text style={s.btnText}>Run</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.stopBtn} onPress={onStop}>
            <Text style={s.btnText}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function Dashboard() {
  const { data: status, status: wsStatus } = useWebSocket<any>();
  const [runModal, setRunModal] = useState<string | null>(null);
  const [duration, setDuration] = useState("10");
  const [loading, setLoading] = useState(false);

  const zones: any[] = status?.zone_states ?? [];
  const current = status?.current_run;

  const handleRun = useCallback(async () => {
    if (!runModal) return;
    setLoading(true);
    try {
      await manualRun(runModal, Number(duration));
      setRunModal(null);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to start run");
    } finally {
      setLoading(false);
    }
  }, [runModal, duration]);

  const handleStop = useCallback(async () => {
    try {
      await stopAll();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to stop");
    }
  }, []);

  const statusColor = wsStatus === "connected" ? COLORS.brand
    : wsStatus === "connecting" ? COLORS.yellow
    : COLORS.red;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Connection status */}
      <View style={[s.connBadge, { backgroundColor: statusColor + "22" }]}>
        <View style={[s.dot, { backgroundColor: statusColor }]} />
        <Text style={[s.connText, { color: statusColor }]}>
          {wsStatus === "connected" ? "Live" : wsStatus === "connecting" ? "Connecting…" : "Offline"}
        </Text>
      </View>

      {/* Active run banner */}
      {current && (
        <View style={s.activeBanner}>
          <View>
            <Text style={s.bannerTitle}>{current.zone_name}</Text>
            <Text style={s.bannerSub}>
              {current.phase} — {Math.floor(current.remaining_seconds / 60)}:{(current.remaining_seconds % 60).toString().padStart(2, "0")} remaining
            </Text>
          </View>
          <TouchableOpacity style={s.stopBtn} onPress={handleStop}>
            <Text style={s.btnText}>Stop All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Schedule info */}
      <View style={s.infoRow}>
        <View style={s.infoCard}>
          <Text style={s.infoLabel}>Today</Text>
          <Text style={[s.infoValue, { color: status?.today_is_watering_day ? COLORS.brand : COLORS.muted }]}>
            {status?.today_is_watering_day ? "Watering Day" : "Rest Day"}
          </Text>
        </View>
        {status?.next_run && (
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>Next Run</Text>
            <Text style={s.infoValue} numberOfLines={1}>{status.next_run.set_name}</Text>
            <Text style={s.infoMuted}>
              {new Date(status.next_run.scheduled_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        )}
      </View>

      {/* Zones */}
      <Text style={s.sectionLabel}>Zones</Text>
      {zones.length === 0 && (
        <Text style={s.muted}>Waiting for connection…</Text>
      )}
      {zones.map((z: any) => (
        <ZoneCard
          key={z.name}
          zone={z}
          currentRun={current}
          onRun={(name: string) => setRunModal(name)}
          onStop={handleStop}
        />
      ))}

      {/* Emergency stop */}
      {!current && (
        <TouchableOpacity
          style={[s.stopBtn, { marginTop: 16, padding: 14, borderRadius: 12 }]}
          onPress={handleStop}
        >
          <Text style={[s.btnText, { fontSize: 14 }]}>Emergency Stop</Text>
        </TouchableOpacity>
      )}

      {/* Manual run modal */}
      <Modal visible={!!runModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Run {runModal}</Text>
            <Text style={s.modalLabel}>Duration (minutes)</Text>
            <TextInput
              style={s.input}
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
              placeholderTextColor={COLORS.muted}
            />
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.runBtn, { flex: 1, justifyContent: "center" }]}
                onPress={() => setRunModal(null)}
              >
                <Text style={s.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.runBtn, { flex: 1, justifyContent: "center", opacity: loading ? 0.6 : 1 }]}
                onPress={handleRun}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name="water" size={14} color="#fff" />
                    <Text style={s.btnText}>Start</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, borderColor: COLORS.border, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  zoneName: { color: COLORS.text, fontWeight: "600", fontSize: 15, flex: 1 },
  phaseLabel: { fontSize: 12, fontWeight: "500" },
  timerText: { fontSize: 22, fontWeight: "700", marginBottom: 8, fontVariant: ["tabular-nums"] },
  btnRow: { flexDirection: "row", gap: 8 },
  runBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#16a34a", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  stopBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.red, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  connBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: "flex-start", marginBottom: 16 },
  connText: { fontSize: 12, fontWeight: "600" },
  activeBanner: { backgroundColor: "#1e3a5f", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderColor: COLORS.blue, borderWidth: 1 },
  bannerTitle: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
  bannerSub: { color: "#93c5fd", fontSize: 13, marginTop: 2 },
  infoRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  infoCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 12, borderColor: COLORS.border, borderWidth: 1 },
  infoLabel: { color: COLORS.muted, fontSize: 11, marginBottom: 4 },
  infoValue: { color: COLORS.text, fontWeight: "600", fontSize: 14 },
  infoMuted: { color: COLORS.muted, fontSize: 12 },
  sectionLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.8 },
  muted: { color: COLORS.muted, textAlign: "center", padding: 20 },
  overlay: { flex: 1, backgroundColor: "#000000bb", justifyContent: "center", alignItems: "center" },
  modal: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, width: "80%", gap: 12 },
  modalTitle: { color: COLORS.text, fontSize: 17, fontWeight: "700" },
  modalLabel: { color: COLORS.muted, fontSize: 13 },
  input: { backgroundColor: COLORS.bg, borderColor: COLORS.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, fontSize: 16 },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
});
