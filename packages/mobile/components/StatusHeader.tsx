import { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getSensors } from "../lib/api";

const COLORS = {
  bg: "#030712",
  card: "#0f172a",
  border: "#1f2937",
  text: "#f9fafb",
  muted: "#6b7280",
  brand: "#22c55e",
  blue: "#60a5fa",
  yellow: "#fbbf24",
  teal: "#2dd4bf",
};

function getWeatherIcon(
  tempF: number | null,
  windMph: number | null,
  humidity: number | null
): { name: React.ComponentProps<typeof Ionicons>["name"]; color: string } {
  if (tempF === null) return { name: "cloud-offline-outline", color: COLORS.muted };
  if (windMph !== null && windMph > 20) return { name: "thunderstorm-outline", color: COLORS.yellow };
  if (humidity !== null && humidity > 85) return { name: "rainy-outline", color: COLORS.blue };
  if (tempF > 85) return { name: "sunny-outline", color: COLORS.yellow };
  if (tempF < 32) return { name: "snow-outline", color: "#bfdbfe" };
  if (humidity !== null && humidity > 65) return { name: "partly-sunny-outline", color: COLORS.yellow };
  return { name: "sunny-outline", color: COLORS.yellow };
}

function WindDir({ deg }: { deg: number | null }) {
  if (deg === null) return null;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const label = dirs[Math.round(deg / 45) % 8];
  return <Text style={hdr.statValue}>{label}</Text>;
}

export default function StatusHeader() {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(new Date());
  const [sensors, setSensors] = useState<Record<string, any> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clock — tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Sensor poll every 15 s
  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const data = await getSensors();
        if (active) setSensors(data as Record<string, any>);
      } catch {
        // silently ignore when Pi is unreachable
      } finally {
        if (active) pollRef.current = setTimeout(poll, 15_000);
      }
    }
    poll();
    return () => {
      active = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const env = sensors?.environment?.data ?? sensors?.environment ?? null;
  const fp = sensors?.flow_pressure?.data ?? sensors?.flow_pressure ?? null;
  const online = sensors?.online ?? false;

  const tempF =
    env?.temperature_c != null
      ? parseFloat(((env.temperature_c * 9) / 5 + 32).toFixed(1))
      : null;
  const humidity = env?.humidity_percent ?? null;
  const windMph =
    env?.wind_speed_ms != null
      ? parseFloat((env.wind_speed_ms * 2.237).toFixed(1))
      : null;
  const windDeg = env?.wind_direction_deg ?? null;
  const pressurePsi = fp?.pressure_psi ?? null;

  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const { name: iconName, color: iconColor } = getWeatherIcon(tempF, windMph, humidity);

  return (
    <View style={[hdr.bar, { paddingTop: insets.top + 8 }]}>
      {/* Left — clock */}
      <View style={hdr.clockBlock}>
        <Text style={hdr.timeText}>{timeStr}</Text>
        <Text style={hdr.dateText}>{dateStr}</Text>
      </View>

      {/* Divider */}
      <View style={hdr.divider} />

      {/* Weather icon */}
      <Ionicons name={iconName} size={22} color={iconColor} style={{ marginHorizontal: 6 }} />

      {/* Stats */}
      <View style={hdr.statsRow}>
        {tempF !== null ? (
          <StatPill icon="thermometer-outline" value={`${tempF}°F`} color={COLORS.yellow} />
        ) : (
          <StatPill icon="thermometer-outline" value="—" color={COLORS.muted} />
        )}

        {humidity !== null ? (
          <StatPill icon="water-outline" value={`${humidity.toFixed(0)}%`} color={COLORS.blue} />
        ) : (
          <StatPill icon="water-outline" value="—" color={COLORS.muted} />
        )}

        {windMph !== null ? (
          <View style={hdr.statPill}>
            <Ionicons name="flag-outline" size={12} color={COLORS.teal} />
            <Text style={[hdr.statValue, { color: COLORS.teal }]}>
              {windMph} mph{" "}
            </Text>
            <WindDir deg={windDeg} />
          </View>
        ) : (
          <StatPill icon="flag-outline" value="—" color={COLORS.muted} />
        )}

        {pressurePsi !== null && (
          <StatPill
            icon="speedometer-outline"
            value={`${pressurePsi.toFixed(1)} psi`}
            color="#c4b5fd"
          />
        )}
      </View>

      {/* Online dot */}
      <View
        style={[
          hdr.onlineDot,
          { backgroundColor: online ? COLORS.brand : COLORS.muted },
        ]}
      />
    </View>
  );
}

function StatPill({
  icon,
  value,
  color,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
  color: string;
}) {
  return (
    <View style={hdr.statPill}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[hdr.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const hdr = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 6,
    flexWrap: "nowrap",
  },
  clockBlock: {
    alignItems: "flex-start",
    minWidth: 90,
  },
  timeText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.3,
  },
  dateText: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 1,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    flex: 1,
    gap: 6,
    alignItems: "center",
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#1f2937",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 2,
  },
});
