import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Switch, Alert, StyleSheet, Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { getSchedule, updateSchedule } from "../../lib/api";

const C = {
  bg: "#030712", card: "#111827", border: "#1f2937",
  text: "#f9fafb", muted: "#9ca3af", brand: "#22c55e",
  red: "#ef4444", blue: "#3b82f6",
};

export default function Schedule() {
  const [schedule, setSchedule] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const s = await getSchedule();
      setSchedule(s);
      setDirty(false);
    } catch {
      Alert.alert("Error", "Could not load schedule");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = (updater: (s: any) => any) => {
    setSchedule((prev: any) => { const next = updater(JSON.parse(JSON.stringify(prev))); return next; });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateSchedule(schedule);
      setDirty(false);
      Alert.alert("Saved", "Schedule updated successfully");
    } catch {
      Alert.alert("Error", "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  const openTimePicker = (si: number) => {
    const st = schedule?.start_times?.[si];
    if (!st) return;
    const [hh, mm] = st.time.split(":").map(Number);
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    setPickerDate(d);
    setPickerIndex(si);
  };

  const onTimeChange = (_: any, selected?: Date) => {
    if (Platform.OS === "android") setPickerIndex(null);
    if (!selected || pickerIndex === null) return;
    const hh = selected.getHours().toString().padStart(2, "0");
    const mm = selected.getMinutes().toString().padStart(2, "0");
    update((sc) => { sc.start_times[pickerIndex].time = `${hh}:${mm}`; return sc; });
    if (Platform.OS === "android") setPickerIndex(null);
  };

  if (!schedule) {
    return (
      <View style={[s.root, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: C.muted }}>Loading schedule…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {dirty && (
        <TouchableOpacity style={s.saveBar} onPress={save} disabled={saving}>
          <Ionicons name="save" size={16} color="#fff" />
          <Text style={s.saveText}>{saving ? "Saving…" : "Save Changes"}</Text>
        </TouchableOpacity>
      )}

      {/* 14-day rotation */}
      <View style={s.card}>
        <Text style={s.cardTitle}>14-Day Rotation</Text>
        <View style={s.dayGrid}>
          {(schedule.schedule_days ?? []).map((on: boolean, i: number) => (
            <TouchableOpacity
              key={i}
              style={[s.dayBtn, on && s.dayBtnActive]}
              onPress={() => update((sc) => { sc.schedule_days[i] = !on; return sc; })}
            >
              <Text style={[s.dayNum, on && { color: "#fff" }]}>{i + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.hint}>Tap to toggle watering days</Text>
      </View>

      {/* Start times */}
      <View style={s.card}>
        <View style={s.rowBetween}>
          <Text style={s.cardTitle}>Start Times</Text>
          <TouchableOpacity
            onPress={() =>
              update((sc) => {
                sc.start_times = [...(sc.start_times ?? []), { time: "09:00", enabled: true, sets: [] }];
                return sc;
              })
            }
          >
            <Ionicons name="add-circle" size={22} color={C.brand} />
          </TouchableOpacity>
        </View>

        {(schedule.start_times ?? []).map((st: any, si: number) => (
          <View key={si} style={s.startTimeBlock}>
            <View style={s.rowBetween}>
              <TouchableOpacity onPress={() => openTimePicker(si)} style={s.timeTouchable}>
                <Text style={s.timeText}>{st.time}</Text>
                <Ionicons name="pencil" size={14} color={C.muted} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
              <View style={s.row}>
                <Switch
                  value={st.enabled}
                  onValueChange={(v) => update((sc) => { sc.start_times[si].enabled = v; return sc; })}
                  trackColor={{ false: C.border, true: C.brand }}
                  thumbColor="#fff"
                />
                <TouchableOpacity
                  style={{ marginLeft: 8 }}
                  onPress={() =>
                    update((sc) => { sc.start_times.splice(si, 1); return sc; })
                  }
                >
                  <Ionicons name="trash" size={18} color={C.red} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Zones in this start time */}
            {(st.sets ?? []).map((set: any, zi: number) => (
              <View key={zi} style={s.setRow}>
                <View style={[s.dot, { backgroundColor: C.blue }]} />
                <Text style={s.setText} numberOfLines={1}>{set.name}</Text>
                <Text style={s.setDur}>{set.duration_minutes}m</Text>
                <Text style={[s.setMode, { color: set.mode === "pulse_soak" ? C.brand : C.muted }]}>
                  {set.mode === "pulse_soak" ? "Pulse/Soak" : "Normal"}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    update((sc) => { sc.start_times[si].sets.splice(zi, 1); return sc; })
                  }
                >
                  <Ionicons name="close" size={16} color={C.muted} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={s.addZone}
              onPress={() =>
                update((sc) => {
                  sc.start_times[si].sets = [
                    ...(sc.start_times[si].sets ?? []),
                    { name: "Garden", duration_minutes: 10, mode: "normal", enabled: true },
                  ];
                  return sc;
                })
              }
            >
              <Ionicons name="add" size={14} color={C.brand} />
              <Text style={[s.addZoneText]}>Add Zone</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Mist settings */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Mist Settings</Text>
        <View style={s.rowBetween}>
          <Text style={s.label}>Auto-misting</Text>
          <Switch
            value={schedule.mist_settings?.enabled ?? false}
            onValueChange={(v) =>
              update((sc) => { sc.mist_settings = { ...(sc.mist_settings ?? {}), enabled: v }; return sc; })
            }
            trackColor={{ false: C.border, true: C.brand }}
            thumbColor="#fff"
          />
        </View>
        <View style={s.rowBetween}>
          <Text style={s.label}>Trigger Temp</Text>
          <Text style={s.value}>{schedule.mist_settings?.trigger_temp_f ?? 95}°F</Text>
        </View>
        <View style={s.rowBetween}>
          <Text style={s.label}>Duration</Text>
          <Text style={s.value}>{schedule.mist_settings?.duration_seconds ?? 60}s</Text>
        </View>
      </View>

      {/* iOS time picker inline */}
      {pickerIndex !== null && Platform.OS === "ios" && (
        <View style={s.iosPickerCard}>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>Edit Start Time</Text>
            <TouchableOpacity onPress={() => setPickerIndex(null)}>
              <Text style={{ color: C.brand, fontWeight: "600" }}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={pickerDate}
            mode="time"
            display="spinner"
            onChange={onTimeChange}
            textColor={C.text}
          />
        </View>
      )}

      {/* Android time picker modal */}
      {pickerIndex !== null && Platform.OS === "android" && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="default"
          onChange={onTimeChange}
        />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 12, borderColor: C.border, borderWidth: 1 },
  cardTitle: { color: C.text, fontWeight: "700", fontSize: 15, marginBottom: 12 },
  saveBar: { backgroundColor: "#16a34a", borderRadius: 10, padding: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 16 },
  saveText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: C.bg, borderColor: C.border, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  dayBtnActive: { backgroundColor: "#16a34a", borderColor: "#22c55e" },
  dayNum: { color: C.muted, fontWeight: "600", fontSize: 13 },
  hint: { color: C.muted, fontSize: 11, marginTop: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  startTimeBlock: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 8 },
  timeTouchable: { flexDirection: "row", alignItems: "center" },
  timeText: { color: C.text, fontWeight: "700", fontSize: 17, fontVariant: ["tabular-nums"] },
  setRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  setText: { flex: 1, color: C.text, fontSize: 13 },
  setDur: { color: C.muted, fontSize: 13, fontVariant: ["tabular-nums"] },
  setMode: { fontSize: 11, fontWeight: "500" },
  addZone: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  addZoneText: { color: C.brand, fontSize: 13 },
  label: { color: C.muted, fontSize: 14 },
  value: { color: C.text, fontSize: 14, fontWeight: "600" },
  iosPickerCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 12, borderColor: C.border, borderWidth: 1 },
});
