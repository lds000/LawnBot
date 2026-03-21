import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Switch, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  loadConfig, saveConfig, loadToken, loadNotificationsEnabled,
  saveNotificationsEnabled, DEFAULT_PI_HOST, DEFAULT_PI_PORT,
} from "../../lib/config";
import { setAuthToken, getLocation, updateLocation, clearHistory, getSystemMetrics } from "../../lib/api";
import { registerForPushNotifications } from "../../lib/notifications";

const C = {
  bg: "#030712", card: "#111827", border: "#1f2937",
  text: "#f9fafb", muted: "#9ca3af", brand: "#22c55e",
  red: "#ef4444", blue: "#3b82f6", yellow: "#f59e0b",
};

function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Settings() {
  const [piHost, setPiHost] = useState(DEFAULT_PI_HOST);
  const [piPort, setPiPort] = useState(String(DEFAULT_PI_PORT));
  const [token, setToken] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [locationData, setLocationData] = useState<any>(null);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [tz, setTz] = useState("");
  const [saving, setSaving] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);

  const load = useCallback(async () => {
    await loadConfig();
    const t = await loadToken();
    const ne = await loadNotificationsEnabled();
    setToken(t);
    setNotificationsEnabled(ne);
    try {
      const m = await getSystemMetrics();
      setMetrics(m);
    } catch { /* offline */ }
    try {
      const loc = await getLocation();
      setLocationData(loc);
      setLat(String(loc.latitude));
      setLon(String(loc.longitude));
      setTz(loc.timezone);
    } catch { /* offline */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSaveConnection = async () => {
    setSaving(true);
    try {
      await saveConfig(piHost, parseInt(piPort, 10), token);
      setAuthToken(token || null);
      Alert.alert("Saved", "Connection settings updated. Restart the app for changes to take effect.");
    } catch {
      Alert.alert("Error", "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocation = async () => {
    setLocationSaving(true);
    try {
      await updateLocation({ latitude: parseFloat(lat), longitude: parseFloat(lon), timezone: tz });
      Alert.alert("Saved", "Weather location updated");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to save location");
    } finally {
      setLocationSaving(false);
    }
  };

  const handleToggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    await saveNotificationsEnabled(val);
    if (val) {
      const granted = await registerForPushNotifications();
      if (!granted) {
        Alert.alert("Permission Denied", "Please enable notifications in your device settings.");
        setNotificationsEnabled(false);
        await saveNotificationsEnabled(false);
      }
    }
  };

  const handleClearHistory = async () => {
    setClearLoading(true);
    try {
      await clearHistory();
      setClearConfirm(false);
      Alert.alert("Done", "History cleared");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to clear history");
    } finally {
      setClearLoading(false);
    }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Settings</Text>

      {/* Pi health metrics */}
      {metrics && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Controller Pi Health</Text>
          {[
            { label: "CPU Temp", value: metrics.cpu_temp_c != null ? `${metrics.cpu_temp_c.toFixed(1)}°C` : "—" },
            { label: "CPU Usage", value: metrics.cpu_percent != null ? `${metrics.cpu_percent.toFixed(1)}%` : "—" },
            { label: "Memory", value: metrics.memory_percent != null ? `${metrics.memory_percent.toFixed(1)}%` : "—" },
            { label: "Disk", value: metrics.disk_percent != null ? `${metrics.disk_percent.toFixed(1)}%` : "—" },
            { label: "Uptime", value: metrics.uptime_seconds != null ? formatUptime(metrics.uptime_seconds) : "—" },
          ].map((row) => (
            <View key={row.label} style={s.metricRow}>
              <Text style={s.metricLabel}>{row.label}</Text>
              <Text style={s.metricValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Connection settings */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Controller Pi Connection</Text>
        <Text style={s.fieldLabel}>Host / IP</Text>
        <TextInput
          style={s.input}
          value={piHost}
          onChangeText={setPiHost}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={C.muted}
          placeholder="raspberrypi.local or 100.x.x.x"
        />
        <Text style={s.fieldLabel}>Port</Text>
        <TextInput
          style={s.input}
          value={piPort}
          onChangeText={setPiPort}
          keyboardType="number-pad"
          placeholderTextColor={C.muted}
          placeholder="8000"
        />
        <Text style={s.fieldLabel}>API Token (leave empty to disable auth)</Text>
        <TextInput
          style={s.input}
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholderTextColor={C.muted}
          placeholder="Bearer token"
        />
        <TouchableOpacity style={s.saveBtn} onPress={handleSaveConnection} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : (
            <Text style={s.saveBtnText}>Save Connection</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Weather location */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Weather Location</Text>
        <Text style={s.fieldLabel}>Latitude</Text>
        <TextInput
          style={s.input}
          value={lat}
          onChangeText={setLat}
          keyboardType="numbers-and-punctuation"
          placeholderTextColor={C.muted}
          placeholder="43.615"
        />
        <Text style={s.fieldLabel}>Longitude</Text>
        <TextInput
          style={s.input}
          value={lon}
          onChangeText={setLon}
          keyboardType="numbers-and-punctuation"
          placeholderTextColor={C.muted}
          placeholder="-116.202"
        />
        <Text style={s.fieldLabel}>Timezone</Text>
        <TextInput
          style={s.input}
          value={tz}
          onChangeText={setTz}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={C.muted}
          placeholder="America/Denver"
        />
        <TouchableOpacity style={s.saveBtn} onPress={handleSaveLocation} disabled={locationSaving}>
          {locationSaving ? <ActivityIndicator color="#fff" size="small" /> : (
            <Text style={s.saveBtnText}>Save Location</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Notifications</Text>
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>Run complete / stopped alerts</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: C.border, true: C.brand }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Danger zone */}
      <View style={[s.card, { borderColor: C.red + "44" }]}>
        <Text style={[s.cardTitle, { color: C.red }]}>Danger Zone</Text>
        {!clearConfirm ? (
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: C.red }]}
            onPress={() => setClearConfirm(true)}
          >
            <Ionicons name="trash" size={14} color="#fff" />
            <Text style={s.saveBtnText}>Clear All History</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={{ color: C.red, fontSize: 13 }}>
              This will permanently delete all watering history. Are you sure?
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[s.saveBtn, { flex: 1, backgroundColor: C.border }]}
                onPress={() => setClearConfirm(false)}
              >
                <Text style={s.saveBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { flex: 1, backgroundColor: C.red }]}
                onPress={handleClearHistory}
                disabled={clearLoading}
              >
                {clearLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={s.saveBtnText}>Yes, Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* About */}
      <View style={s.card}>
        <Text style={s.cardTitle}>About</Text>
        <Text style={{ color: C.muted, fontSize: 13 }}>LawnBot v2.0.0 · FastAPI + React + Expo</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  pageTitle: { color: C.text, fontWeight: "700", fontSize: 20, marginBottom: 16 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 12, borderColor: C.border, borderWidth: 1, gap: 8 },
  cardTitle: { color: C.text, fontWeight: "700", fontSize: 15, marginBottom: 4 },
  fieldLabel: { color: C.muted, fontSize: 12 },
  input: {
    backgroundColor: C.bg, borderColor: C.border, borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: C.text, fontSize: 14,
  },
  saveBtn: {
    backgroundColor: "#16a34a", borderRadius: 8, padding: 12,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  metricRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  metricLabel: { color: C.muted, fontSize: 13 },
  metricValue: { color: C.text, fontSize: 13, fontWeight: "600" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchLabel: { color: C.text, fontSize: 14, flex: 1, marginRight: 8 },
});
