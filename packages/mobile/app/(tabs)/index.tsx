import { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, ActivityIndicator, StyleSheet,
} from "react-native";
import Svg, {
  Rect, Line, Text as SvgText, Defs, LinearGradient, Stop,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useWebSocket } from "../../components/useWebSocket";
import { manualRun, stopAll, getWeatherForecast, triggerMist, stopMist } from "../../lib/api";
import { loadNotificationsEnabled, loadConfig, loadToken, saveNotificationsEnabled } from "../../lib/config";
import { setAuthToken } from "../../lib/api";
import { registerForPushNotifications, notifyRunComplete, notifyRunStopped } from "../../lib/notifications";
import { Dimensions } from "react-native";
import React from "react";

const SW = Dimensions.get("window").width;

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

// ─── WMO code → emoji icon + label ──────────────────────────────────────────
function wmoIcon(code: number, isDay = true): { icon: string; label: string } {
  if (code === 0)   return { icon: isDay ? "☀️" : "🌙", label: "Clear" };
  if (code <= 2)    return { icon: isDay ? "⛅" : "🌙", label: "Partly Cloudy" };
  if (code === 3)   return { icon: "☁️",  label: "Overcast" };
  if (code <= 49)   return { icon: "🌫️",  label: "Fog" };
  if (code <= 55)   return { icon: "🌦️",  label: "Drizzle" };
  if (code <= 65)   return { icon: "🌧️",  label: "Rain" };
  if (code <= 77)   return { icon: "❄️",  label: "Snow" };
  if (code <= 82)   return { icon: "🌦️",  label: "Showers" };
  if (code <= 86)   return { icon: "🌨️",  label: "Snow Showers" };
  if (code >= 95)   return { icon: "⛈️",  label: "Thunderstorm" };
  return { icon: "🌡️", label: "Unknown" };
}

function windDirLabel(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ─── Forecast Strip ──────────────────────────────────────────────────────────
function ForecastStrip() {
  const [forecast, setForecast] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getWeatherForecast()
      .then(setForecast)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <View style={fc.card}>
        <Text style={fc.sectionLabel}>FORECAST</Text>
        <Text style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: 12 }}>
          Forecast unavailable — check network
        </Text>
      </View>
    );
  }

  if (!forecast) {
    return (
      <View style={[fc.card, { height: 180, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={COLORS.brand} />
      </View>
    );
  }

  const now = new Date();
  const hourNow = now.getHours();
  const c = forecast.current;
  const hourly = forecast.hourly;
  const daily = forecast.daily;

  const isDay = hourNow >= 6 && hourNow < 20;
  const { icon: curIcon, label: curLabel } = wmoIcon(c.weather_code, isDay);

  // Next 8 hourly slots from now
  const hourIndices: number[] = [];
  for (let i = 0; i < hourly.time.length && hourIndices.length < 8; i++) {
    if (new Date(hourly.time[i]) >= now) hourIndices.push(i);
  }

  // SVG bar chart dimensions
  const chartW = SW - 32 - 16; // card padding
  const chartH = 90;
  const barW = (chartW - 16) / hourIndices.length;
  const temps: number[] = hourIndices.map((i) => hourly.temperature_2m[i]);
  const pops: number[] = hourIndices.map((i) => hourly.precipitation_probability[i]);
  const minT = Math.min(...temps) - 2;
  const maxT = Math.max(...temps) + 2;
  const range = maxT - minT || 1;

  // 3-day daily summary
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const days = [0, 1, 2].map((d) => ({
    label: d === 0 ? "Today" : d === 1 ? "Tmrw" : dayNames[new Date(daily.time[d] + "T12:00:00").getDay()],
    hi:    Math.round(daily.temperature_2m_max[d]),
    lo:    Math.round(daily.temperature_2m_min[d]),
    pop:   daily.precipitation_probability_max[d],
    code:  daily.weather_code[d],
  }));

  return (
    <View style={fc.card}>
      <Text style={fc.sectionLabel}>FORECAST</Text>

      {/* Current conditions row */}
      <View style={fc.currentRow}>
        <Text style={fc.bigIcon}>{curIcon}</Text>
        <View>
          <Text style={fc.bigTemp}>{Math.round(c.temperature_2m)}°<Text style={fc.unit}>F</Text></Text>
          <Text style={fc.condLabel}>{curLabel}</Text>
          <Text style={fc.condSub}>
            Feels {Math.round(c.apparent_temperature)}°  ·  {windDirLabel(c.wind_direction_10m)} {Math.round(c.wind_speed_10m)} mph
          </Text>
        </View>
      </View>

      {/* Hourly SVG chart */}
      <View style={{ marginTop: 8 }}>
        <Svg width={chartW} height={chartH + 36}>
          <Defs>
            <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#fb923c" stopOpacity="0.5" />
            </LinearGradient>
            <LinearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
              <Stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((frac, i) => (
            <Line
              key={i}
              x1={8} y1={frac * chartH}
              x2={chartW - 8} y2={frac * chartH}
              stroke="#1f2937" strokeWidth={1} strokeDasharray="4,4"
            />
          ))}

          {hourIndices.map((idx, col) => {
            const t = new Date(hourly.time[idx]);
            const h = t.getHours();
            const isFutureDay = h >= 0 && h < 6 && col > 0;
            const label = h === 0 ? dayNames[t.getDay()]
              : h === 12 ? "NOON"
              : h < 12 ? `${h}AM` : `${h - 12}PM`;
            const temp = temps[col];
            const pop = pops[col];
            const barH = Math.max(4, ((temp - minT) / range) * (chartH - 24));
            const barY = chartH - barH;
            const cx = 8 + col * barW + barW / 2;
            const barX = 8 + col * barW + barW * 0.15;
            const bW = barW * 0.7;
            const isNoon = h === 12;

            return (
              <React.Fragment key={idx}>
                {/* Rain probability mini bar (behind temp bar) */}
                {pop > 10 && (
                  <Rect
                    x={barX} y={chartH - (pop / 100) * (chartH * 0.4)}
                    width={bW} height={(pop / 100) * (chartH * 0.4)}
                    rx={3} fill="url(#rainGrad)"
                  />
                )}
                {/* Temp bar */}
                <Rect
                  x={barX} y={barY}
                  width={bW} height={barH}
                  rx={4} fill="url(#barGrad)"
                />
                {/* Temp label above bar */}
                <SvgText
                  x={cx} y={barY - 3}
                  fontSize={9} fill="#f9fafb"
                  textAnchor="middle" fontWeight="700"
                >
                  {Math.round(temp)}°
                </SvgText>
                {/* Hour label below */}
                <SvgText
                  x={cx} y={chartH + 14}
                  fontSize={9}
                  fill={isNoon ? "#60a5fa" : isFutureDay ? "#a78bfa" : "#6b7280"}
                  textAnchor="middle" fontWeight="600"
                >
                  {label}
                </SvgText>
                {/* Rain % label */}
                {pop > 20 && (
                  <SvgText
                    x={cx} y={chartH + 26}
                    fontSize={8} fill="#38bdf8"
                    textAnchor="middle" fontWeight="600"
                  >
                    {pop}%
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      </View>

      {/* 3-day summary */}
      <View style={fc.dailyRow}>
        {days.map((d, i) => {
          const { icon } = wmoIcon(d.code, true);
          return (
            <View key={i} style={fc.dayCell}>
              <Text style={fc.dayLabel}>{d.label}</Text>
              <Text style={fc.dayIcon}>{icon}</Text>
              <View style={{ flexDirection: "row", gap: 4, alignItems: "baseline" }}>
                <Text style={fc.dayHi}>{d.hi}°</Text>
                <Text style={fc.dayLo}>{d.lo}°</Text>
              </View>
              {d.pop > 0 && (
                <Text style={fc.dayPop}>{d.pop}%</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

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
  const [mistLoading, setMistLoading] = useState(false);
  const prevRunRef = useRef<any>(null);
  const notificationsEnabledRef = useRef(true);

  // Load config + token on mount
  useEffect(() => {
    loadConfig();
    loadToken().then((t) => { if (t) setAuthToken(t); });
    loadNotificationsEnabled().then((v) => { notificationsEnabledRef.current = v; });
    registerForPushNotifications();
  }, []);

  // Detect run state transitions for push notifications
  useEffect(() => {
    if (!notificationsEnabledRef.current) return;
    const prev = prevRunRef.current;
    const curr = status?.current_run ?? null;
    if (prev && !curr) {
      // Run just ended
      const wasCompleted = status?.last_completed_run?.completed;
      if (wasCompleted) {
        notifyRunComplete(prev.zone_name, prev.total_seconds - (prev.remaining_seconds ?? 0)).catch(() => {});
      } else {
        notifyRunStopped(prev.zone_name).catch(() => {});
      }
    }
    prevRunRef.current = curr;
  }, [status?.current_run]);

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

  const handleMist = useCallback(async () => {
    setMistLoading(true);
    try {
      if (status?.is_misting) {
        await stopMist();
      } else {
        await triggerMist();
      }
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Mist control failed");
    } finally {
      setMistLoading(false);
    }
  }, [status?.is_misting]);

  const statusColor = wsStatus === "connected" ? COLORS.brand
    : wsStatus === "connecting" ? COLORS.yellow
    : COLORS.red;

  // Extract plant/soil sensor
  const plant = (status as any)?.sensors?.plant?.data ?? (status as any)?.sensors?.plant;
  const soilMoisture: number | null = plant?.moisture ?? null;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Connection status */}
      <View style={[s.connBadge, { backgroundColor: statusColor + "22" }]}>
        <View style={[s.dot, { backgroundColor: statusColor }]} />
        <Text style={[s.connText, { color: statusColor }]}>
          {wsStatus === "connected" ? "Live" : wsStatus === "connecting" ? "Connecting…" : "Offline"}
        </Text>
      </View>

      {/* Rain skip banner */}
      {status?.rain_skip_active && (
        <View style={s.rainSkipBanner}>
          <Ionicons name="rainy" size={16} color="#38bdf8" />
          <Text style={s.rainSkipText}>Rain Skip Active — watering skipped today</Text>
        </View>
      )}

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

      {/* Mist + emergency stop row */}
      <View style={s.controlRow}>
        <TouchableOpacity
          style={[s.mistBtn, status?.is_misting && s.mistBtnActive]}
          onPress={handleMist}
          disabled={mistLoading || !!current}
        >
          {mistLoading ? <ActivityIndicator color="#fff" size="small" /> : (
            <>
              <Ionicons name="water-outline" size={14} color="#fff" />
              <Text style={s.btnText}>{status?.is_misting ? "Stop Mist" : "Mist Now"}</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[s.stopBtn, { flex: 1 }]} onPress={handleStop}>
          <Ionicons name="warning-outline" size={14} color="#fff" />
          <Text style={s.btnText}>Emergency Stop</Text>
        </TouchableOpacity>
      </View>

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
        {soilMoisture != null && (
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>Soil</Text>
            <Text style={[s.infoValue, { color: soilMoisture > 70 ? COLORS.blue : soilMoisture < 30 ? COLORS.yellow : COLORS.brand }]}>
              {soilMoisture.toFixed(0)}%
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

      {/* Today's forecast + weekly summary */}
      <ForecastStrip />

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
  mistBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0e7490", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, flex: 1 },
  mistBtnActive: { backgroundColor: "#0c4a6e" },
  controlRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  connBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: "flex-start", marginBottom: 16 },
  connText: { fontSize: 12, fontWeight: "600" },
  activeBanner: { backgroundColor: "#1e3a5f", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderColor: COLORS.blue, borderWidth: 1 },
  bannerTitle: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
  bannerSub: { color: "#93c5fd", fontSize: 13, marginTop: 2 },
  rainSkipBanner: { backgroundColor: "#0c4a6e", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, borderColor: "#0ea5e9", borderWidth: 1 },
  rainSkipText: { color: "#7dd3fc", fontSize: 13, fontWeight: "600", flex: 1 },
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

const fc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16,
    marginTop: 20, borderColor: COLORS.border, borderWidth: 1,
  },
  sectionLabel: {
    color: COLORS.muted, fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10,
  },
  currentRow: {
    flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4,
  },
  bigIcon: { fontSize: 48, lineHeight: 54 },
  bigTemp: { color: "#fde047", fontSize: 36, fontWeight: "900" },
  unit: { color: "#9ca3af", fontSize: 18, fontWeight: "600" },
  condLabel: { color: COLORS.text, fontSize: 14, fontWeight: "600", marginTop: 2 },
  condSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  dailyRow: {
    flexDirection: "row", marginTop: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10,
  },
  dayCell: {
    flex: 1, alignItems: "center", gap: 2,
    borderRightWidth: 1, borderRightColor: COLORS.border,
  },
  dayLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "700" },
  dayIcon: { fontSize: 22 },
  dayHi: { color: "#fb923c", fontSize: 14, fontWeight: "800" },
  dayLo: { color: COLORS.muted, fontSize: 12 },
  dayPop: { color: "#38bdf8", fontSize: 11, fontWeight: "600" },
});
