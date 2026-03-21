import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Linking,
  Easing,
} from "react-native";
import Svg, {
  Circle,
  Path,
  Line,
  Rect,
  G,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  ClipPath,
  Polygon,
  Ellipse,
  Text as SvgText,
} from "react-native-svg";
import { getSensors } from "../../lib/api";

const C = {
  bg: "#020810",
  card: "#0b1220",
  border: "#1a2840",
  text: "#f0f6ff",
  muted: "#4a6080",
  mutedBright: "#7a9ab8",
  brand: "#22c55e",
  blue: "#38bdf8",
  indigo: "#6366f1",
  orange: "#fb923c",
  red: "#f87171",
  yellow: "#fbbf24",
  teal: "#2dd4bf",
  green: "#4ade80",
  purple: "#c084fc",
  skyDay: "#1a3a6a",
  skyNight: "#020810",
  skyDawn: "#4a1a40",
};

const { width: SW, height: SH } = Dimensions.get("window");
const HERO_H = Math.min(SH * 0.48, 340);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function annularArcPath(cx: number, cy: number, r1: number, r2: number, startDeg: number, endDeg: number) {
  const s1 = polar(cx, cy, r1, startDeg);
  const e1 = polar(cx, cy, r1, endDeg);
  const s2 = polar(cx, cy, r2, endDeg);
  const e2 = polar(cx, cy, r2, startDeg);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return (
    `M ${s1.x} ${s1.y} A ${r1} ${r1} 0 ${large} 1 ${e1.x} ${e1.y}` +
    ` L ${s2.x} ${s2.y} A ${r2} ${r2} 0 ${large} 0 ${e2.x} ${e2.y} Z`
  );
}

function getCondition(tempF: number | null, windMph: number | null, humidity: number | null): string {
  if (tempF === null) return "unknown";
  if (windMph !== null && windMph > 25) return "windy";
  if (humidity !== null && humidity > 85) return "rainy";
  if (tempF > 85) return "sunny";
  if (tempF < 32) return "snow";
  if (humidity !== null && humidity > 65) return "cloudy";
  return "sunny";
}

function getHourOfDay() {
  return new Date().getHours();
}

function getSkyColors(condition: string) {
  const h = getHourOfDay();
  if (condition === "rainy") return { top: "#0a1428", bottom: "#1a2a44" };
  if (condition === "windy") return { top: "#0d1e3a", bottom: "#1a3050" };
  if (condition === "snow") return { top: "#1a2a50", bottom: "#2a3a60" };
  if (h >= 6 && h < 9) return { top: "#2d1b4e", bottom: "#c46b28" }; // dawn
  if (h >= 9 && h < 17) return { top: "#0e2a5a", bottom: "#1a6090" }; // day
  if (h >= 17 && h < 20) return { top: "#3a1a1a", bottom: "#8a3020" }; // dusk
  return { top: "#020810", bottom: "#0a1428" }; // night
}

// ─── SVG Sun ─────────────────────────────────────────────────────────────────

function AnimatedSun({ rotation }: { rotation: Animated.Value }) {
  const W = 160;
  const cx = W / 2;
  const cy = W / 2;
  const R = 38;
  const numRays = 16;

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={W} height={W}>
        <Defs>
          <RadialGradient id="sunCore" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#fff7aa" />
            <Stop offset="40%" stopColor="#fde047" />
            <Stop offset="80%" stopColor="#f59e0b" />
            <Stop offset="100%" stopColor="#d97706" />
          </RadialGradient>
          <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#fde047" stopOpacity="0.4" />
            <Stop offset="60%" stopColor="#f59e0b" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* Outer glow */}
        <Circle cx={cx} cy={cy} r={W / 2} fill="url(#sunGlow)" />
        {/* Rays */}
        {Array.from({ length: numRays }).map((_, i) => {
          const deg = (i / numRays) * 360;
          const inner = R + 6;
          const outerLong = R + (i % 2 === 0 ? 28 : 18);
          const p1 = polar(cx, cy, inner, deg);
          const p2 = polar(cx, cy, outerLong, deg);
          return (
            <Line
              key={i}
              x1={p1.x} y1={p1.y}
              x2={p2.x} y2={p2.y}
              stroke="#fde047"
              strokeWidth={i % 2 === 0 ? 3.5 : 2}
              strokeLinecap="round"
              opacity={i % 2 === 0 ? 0.9 : 0.6}
            />
          );
        })}
        {/* Core */}
        <Circle cx={cx} cy={cy} r={R} fill="url(#sunCore)" />
        {/* Glare */}
        <Circle cx={cx - 10} cy={cy - 10} r={10} fill="white" opacity={0.18} />
        <Circle cx={cx - 8} cy={cy - 8} r={4} fill="white" opacity={0.28} />
      </Svg>
    </Animated.View>
  );
}

// ─── SVG Moon ────────────────────────────────────────────────────────────────

function MoonSvg() {
  const W = 120;
  return (
    <Svg width={W} height={W}>
      <Defs>
        <RadialGradient id="moonGrad" cx="35%" cy="35%" r="60%">
          <Stop offset="0%" stopColor="#e2e8f0" />
          <Stop offset="50%" stopColor="#c0cce0" />
          <Stop offset="100%" stopColor="#8098b8" />
        </RadialGradient>
      </Defs>
      {/* Moon shape via clipped circles */}
      <Circle cx={55} cy={55} r={40} fill="url(#moonGrad)" />
      <Circle cx={75} cy={38} r={32} fill="#020810" />
      {/* Craters */}
      <Circle cx={40} cy={60} r={6} fill="#9ab0c8" opacity={0.3} />
      <Circle cx={55} cy={72} r={4} fill="#9ab0c8" opacity={0.25} />
      <Circle cx={35} cy={42} r={3} fill="#9ab0c8" opacity={0.2} />
      {/* Stars around moon */}
      {[[15, 20], [95, 15], [105, 65], [20, 85], [90, 88]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={1.5} fill="white" opacity={0.7} />
      ))}
    </Svg>
  );
}

// ─── Cloud SVG ───────────────────────────────────────────────────────────────

function CloudSvg({ opacity = 1, scale = 1, color = "#c8d8f0" }: { opacity?: number; scale?: number; color?: string }) {
  return (
    <Svg width={140 * scale} height={80 * scale}>
      <Defs>
        <LinearGradient id="cloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </LinearGradient>
      </Defs>
      <G opacity={opacity} scale={scale} origin="70,40">
        {/* Cloud body using overlapping circles */}
        <Ellipse cx={70} cy={52} rx={60} ry={20} fill="url(#cloudGrad)" />
        <Circle cx={45} cy={40} r={24} fill={color} opacity={0.9} />
        <Circle cx={70} cy={32} r={28} fill={color} opacity={0.95} />
        <Circle cx={98} cy={42} r={20} fill={color} opacity={0.88} />
        {/* Glare */}
        <Circle cx={62} cy={26} r={8} fill="white" opacity={0.12} />
      </G>
    </Svg>
  );
}

// ─── Rain Drops ──────────────────────────────────────────────────────────────

function RainSvg({ windAngle = 15 }: { windAngle?: number }) {
  const drops: [number, number][] = [
    [30, 20], [55, 10], [80, 30], [105, 15], [130, 25],
    [20, 55], [45, 45], [70, 60], [95, 50], [120, 65],
    [35, 90], [60, 80], [85, 95], [110, 85],
  ];
  return (
    <Svg width={SW} height={160}>
      {drops.map(([x, y], i) => {
        const len = 14 + (i % 3) * 4;
        const rad = (windAngle * Math.PI) / 180;
        return (
          <Line
            key={i}
            x1={x} y1={y}
            x2={x + len * Math.sin(rad)} y2={y + len * Math.cos(rad)}
            stroke={C.blue}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.55 + (i % 4) * 0.1}
          />
        );
      })}
    </Svg>
  );
}

// ─── Snow Flakes ─────────────────────────────────────────────────────────────

function SnowSvg() {
  const flakes: [number, number, number][] = [
    [30, 20, 8], [70, 40, 12], [110, 15, 6], [150, 50, 10], [50, 80, 7],
    [90, 70, 9], [140, 90, 5], [20, 100, 11], [170, 30, 6],
  ];
  return (
    <Svg width={SW} height={160}>
      {flakes.map(([x, y, r], i) => (
        <G key={i}>
          {[0, 60, 120].map((deg) => {
            const p1 = polar(x, y, r, deg);
            const p2 = polar(x, y, r, deg + 180);
            return <Line key={deg} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="white" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />;
          })}
          <Circle cx={x} cy={y} r={2} fill="white" opacity={0.8} />
        </G>
      ))}
    </Svg>
  );
}

// ─── Wind Streaks ─────────────────────────────────────────────────────────────

function WindStreaksSvg({ windDeg }: { windDeg: number | null }) {
  const angle = windDeg ?? 270;
  const rad = ((angle - 90) * Math.PI) / 180;
  const lines = [
    { y: 25, len: 80, op: 0.7 },
    { y: 50, len: 120, op: 0.55 },
    { y: 75, len: 60, op: 0.45 },
    { y: 100, len: 100, op: 0.65 },
    { y: 125, len: 75, op: 0.5 },
  ];
  return (
    <Svg width={SW} height={150}>
      {lines.map(({ y, len, op }, i) => {
        const startX = 20 + i * 30;
        const ex = startX + len * Math.cos(rad);
        const ey = y + len * Math.sin(rad);
        return (
          <Path
            key={i}
            d={`M ${startX} ${y} Q ${(startX + ex) / 2} ${(y + ey) / 2 - 10} ${ex} ${ey}`}
            fill="none"
            stroke={C.teal}
            strokeWidth={i % 2 === 0 ? 2.5 : 1.5}
            strokeLinecap="round"
            opacity={op}
          />
        );
      })}
    </Svg>
  );
}

// ─── HERO WEATHER CARD ────────────────────────────────────────────────────────

function HeroWeatherCard({
  condition, tempF, humidity, windMph, windDeg, windLabel, description,
}: {
  condition: string;
  tempF: number | null;
  humidity: number | null;
  windMph: number | null;
  windDeg: number | null;
  windLabel: string;
  description: string;
}) {
  const sunRotation = useRef(new Animated.Value(0)).current;
  const cloudSlide = useRef(new Animated.Value(0)).current;
  const rainDrop = useRef(new Animated.Value(0)).current;
  const snowFloat = useRef(new Animated.Value(0)).current;
  const windWave = useRef(new Animated.Value(0)).current;
  const h = getHourOfDay();
  const isNight = h < 6 || h >= 21;

  useEffect(() => {
    // Sun spin — slow, 30 s per revolution
    Animated.loop(
      Animated.timing(sunRotation, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Cloud gentle drift
    Animated.loop(
      Animated.sequence([
        Animated.timing(cloudSlide, { toValue: 18, duration: 5000, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        Animated.timing(cloudSlide, { toValue: -18, duration: 5000, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
      ])
    ).start();

    // Rain drop fall
    Animated.loop(
      Animated.timing(rainDrop, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Snow float
    Animated.loop(
      Animated.sequence([
        Animated.timing(snowFloat, { toValue: 12, duration: 3000, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        Animated.timing(snowFloat, { toValue: -12, duration: 3000, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
      ])
    ).start();

    // Wind pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(windWave, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(windWave, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const sky = getSkyColors(condition);

  return (
    <View style={hero.card}>
      {/* Sky gradient background */}
      <Svg width={SW} height={HERO_H} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={sky.top} />
            <Stop offset="100%" stopColor={sky.bottom} />
          </LinearGradient>
          {/* Subtle horizon glow */}
          <RadialGradient id="horizGlow" cx="50%" cy="100%" r="60%">
            <Stop offset="0%" stopColor={condition === "sunny" && !isNight ? "#3a6090" : "#0a1020"} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={sky.top} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={SW} height={HERO_H} fill="url(#skyGrad)" />
        <Rect x={0} y={0} width={SW} height={HERO_H} fill="url(#horizGlow)" />
        {/* Subtle star field at night */}
        {isNight && [
          [40, 20], [90, 10], [150, 30], [200, 8], [280, 25], [320, 12],
          [60, 55], [180, 45], [260, 60], [350, 40], [110, 80], [310, 75],
        ].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={1 + (i % 3) * 0.5} fill="white" opacity={0.5 + (i % 4) * 0.12} />
        ))}
      </Svg>

      {/* Weather illustration */}
      <View style={hero.illustrationRow}>
        {/* Main celestial body */}
        <View style={hero.celestialWrap}>
          {isNight ? (
            <MoonSvg />
          ) : (
            (condition === "sunny" || condition === "windy") ? (
              <AnimatedSun rotation={sunRotation} />
            ) : (
              <View style={{ opacity: 0.6 }}>
                <AnimatedSun rotation={sunRotation} />
              </View>
            )
          )}
        </View>

        {/* Clouds (for cloudy/rainy/windy) */}
        {(condition === "cloudy" || condition === "rainy" || condition === "windy") && (
          <View style={hero.cloudLayer}>
            <Animated.View style={{ transform: [{ translateX: cloudSlide }] }}>
              <CloudSvg opacity={0.9} scale={1.1} color={condition === "rainy" ? "#5a6a80" : "#8aa8cc"} />
            </Animated.View>
            <Animated.View style={[hero.cloud2, { transform: [{ translateX: Animated.multiply(cloudSlide, -0.6) }] }]}>
              <CloudSvg opacity={0.7} scale={0.8} color={condition === "rainy" ? "#7a8a9a" : "#a0bcd8"} />
            </Animated.View>
          </View>
        )}

        {/* Rain */}
        {condition === "rainy" && (
          <Animated.View style={[hero.precipLayer, {
            transform: [{
              translateY: rainDrop.interpolate({ inputRange: [0, 1], outputRange: [0, 20] })
            }],
            opacity: rainDrop.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 0.9, 0] }),
          }]}>
            <RainSvg windAngle={windDeg != null ? (windDeg % 90) * 0.25 : 15} />
          </Animated.View>
        )}

        {/* Snow */}
        {condition === "snow" && (
          <Animated.View style={[hero.precipLayer, { transform: [{ translateX: snowFloat }] }]}>
            <SnowSvg />
          </Animated.View>
        )}

        {/* Wind streaks */}
        {condition === "windy" && (
          <Animated.View style={[hero.windLayer, {
            opacity: windWave.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            transform: [{ translateX: windWave.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) }],
          }]}>
            <WindStreaksSvg windDeg={windDeg} />
          </Animated.View>
        )}
      </View>

      {/* Big temperature readout */}
      <View style={hero.readout}>
        <Text style={hero.tempGiant}>{tempF != null ? `${tempF}°` : "—°"}</Text>
        <Text style={hero.conditionLabel}>{description}</Text>

        {/* Pill stats row */}
        <View style={hero.pillRow}>
          {humidity != null && (
            <View style={hero.pill}>
              <Text style={hero.pillIcon}>💧</Text>
              <Text style={hero.pillText}>{humidity.toFixed(0)}%</Text>
            </View>
          )}
          {windMph != null && (
            <View style={hero.pill}>
              <Text style={hero.pillIcon}>💨</Text>
              <Text style={hero.pillText}>{windMph.toFixed(1)} mph {windLabel}</Text>
            </View>
          )}
          {tempF != null && (
            <View style={hero.pill}>
              <Text style={hero.pillIcon}>🌡️</Text>
              <Text style={hero.pillText}>{(((tempF - 32) * 5) / 9).toFixed(1)}°C</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Wind Rose Compass ───────────────────────────────────────────────────────

function WindRoseCard({ windDeg, windMph, windLabel, beaufort }: {
  windDeg: number | null;
  windMph: number | null;
  windLabel: string;
  beaufort: string | null;
}) {
  const size = SW - 32;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 18;
  const needleDeg = windDeg ?? 0;

  const cardinals = [
    { label: "N", deg: 0, color: "#f87171", fs: 16 },
    { label: "NE", deg: 45, color: "#7a9ab8", fs: 10 },
    { label: "E", deg: 90, color: "#90b0cc", fs: 14 },
    { label: "SE", deg: 135, color: "#7a9ab8", fs: 10 },
    { label: "S", deg: 180, color: "#90b0cc", fs: 14 },
    { label: "SW", deg: 225, color: "#7a9ab8", fs: 10 },
    { label: "W", deg: 270, color: "#90b0cc", fs: 14 },
    { label: "NW", deg: 315, color: "#7a9ab8", fs: 10 },
  ];

  const speedRings = [0.25, 0.50, 0.75, 1.0];

  return (
    <View style={gCard.card}>
      <Text style={gCard.title}>Wind Direction & Speed</Text>

      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="compassBg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#0f1e38" />
            <Stop offset="100%" stopColor="#060e18" />
          </RadialGradient>
          <RadialGradient id="windGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={C.teal} stopOpacity="0.2" />
            <Stop offset="100%" stopColor={C.teal} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="hubGrad" cx="40%" cy="35%" r="60%">
            <Stop offset="0%" stopColor="#5a7090" />
            <Stop offset="40%" stopColor="#2a3a50" />
            <Stop offset="100%" stopColor="#0d1828" />
          </RadialGradient>
          <LinearGradient id="needleRed" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#c0392b" />
            <Stop offset="50%" stopColor="#e74c3c" />
            <Stop offset="100%" stopColor="#ff6b6b" />
          </LinearGradient>
          <LinearGradient id="needleWhite2" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#c0d0e0" />
            <Stop offset="50%" stopColor="#f0f8ff" />
            <Stop offset="100%" stopColor="#c0d0e0" />
          </LinearGradient>
        </Defs>

        {/* Background disc */}
        <Circle cx={cx} cy={cy} r={R + 12} fill="#0b1828" stroke="#1a2a40" strokeWidth={2} />
        <Circle cx={cx} cy={cy} r={R} fill="url(#compassBg)" />

        {/* Concentric speed rings */}
        {speedRings.map((f, i) => (
          <Circle
            key={i}
            cx={cx} cy={cy}
            r={R * f}
            fill="none"
            stroke={i === speedRings.length - 1 ? "#1e3050" : "#131e30"}
            strokeWidth={i === speedRings.length - 1 ? 1.5 : 1}
            strokeDasharray={i < 2 ? "4 8" : undefined}
          />
        ))}

        {/* Cross hairs */}
        {[0, 90].map((d) => {
          const p1 = polar(cx, cy, R * 0.98, d);
          const p2 = polar(cx, cy, R * 0.98, d + 180);
          return <Line key={d} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke="#1a2e4a" strokeWidth={1} />;
        })}

        {/* Degree ticks - 72 every 5° */}
        {Array.from({ length: 72 }).map((_, i) => {
          const d = i * 5;
          const is45 = d % 45 === 0;
          const is10 = d % 10 === 0;
          const outer = R - 1;
          const inner = is45 ? outer - 22 : is10 ? outer - 14 : outer - 7;
          const p1 = polar(cx, cy, outer, d);
          const p2 = polar(cx, cy, inner, d);
          return (
            <Line key={i}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={is45 ? "#7ab0d0" : is10 ? "#3a5070" : "#1e3048"}
              strokeWidth={is45 ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* Cardinal labels */}
        {cardinals.map(({ label, deg: d, color, fs }) => {
          const lr = R - (label.length === 1 ? 36 : 30);
          const pos = polar(cx, cy, lr, d);
          return (
            <SvgText key={label} x={pos.x} y={pos.y + fs / 3}
              fontSize={fs} fill={color} textAnchor="middle" fontWeight="700">
              {label}
            </SvgText>
          );
        })}

        {/* Wind direction glow halo */}
        {windDeg != null && (
          <Circle
            cx={polar(cx, cy, R * 0.62, needleDeg).x}
            cy={polar(cx, cy, R * 0.62, needleDeg).y}
            r={R * 0.12}
            fill={C.teal}
            opacity={0.18}
          />
        )}

        {/* Compass needle */}
        {(() => {
          const tipR = polar(cx, cy, R * 0.72, needleDeg);
          const tailR = polar(cx, cy, R * 0.20, needleDeg + 180);
          const w1R = polar(cx, cy, R * 0.05, needleDeg - 90);
          const w2R = polar(cx, cy, R * 0.05, needleDeg + 90);
          return (
            <G>
              <Polygon
                points={`${tipR.x + 2},${tipR.y + 2} ${w1R.x + 2},${w1R.y + 2} ${tailR.x + 2},${tailR.y + 2} ${w2R.x + 2},${w2R.y + 2}`}
                fill="#000" opacity={0.35}
              />
              <Polygon
                points={`${tipR.x},${tipR.y} ${w1R.x},${w1R.y} ${cx},${cy} ${w2R.x},${w2R.y}`}
                fill="url(#needleRed)"
              />
              <Polygon
                points={`${tailR.x},${tailR.y} ${w1R.x},${w1R.y} ${cx},${cy} ${w2R.x},${w2R.y}`}
                fill="url(#needleWhite2)"
                opacity={0.85}
              />
            </G>
          );
        })()}

        {/* Hub */}
        <Circle cx={cx} cy={cy} r={R * 0.08} fill="url(#hubGrad)" />
        <Circle cx={cx} cy={cy} r={R * 0.08} fill="none" stroke="#5a8aaa" strokeWidth={1.5} />
        <Circle cx={cx} cy={cy} r={R * 0.03} fill="#c0d8f0" />

        {/* Direction readout in center */}
        <SvgText x={cx} y={cy + R * 0.38} fontSize={22} fill={C.teal} textAnchor="middle" fontWeight="800">
          {windLabel}
        </SvgText>
        <SvgText x={cx} y={cy + R * 0.55} fontSize={13} fill={C.mutedBright} textAnchor="middle" fontWeight="600">
          {windMph != null ? `${windMph.toFixed(1)} mph` : "—"}
        </SvgText>
        {beaufort && (
          <SvgText x={cx} y={cy + R * 0.72} fontSize={11} fill={C.muted} textAnchor="middle">
            {beaufort}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}

// ─── Gauge (shared bezel/needle) ─────────────────────────────────────────────

function GaugeFace({ size, cx, cy, R, children }: {
  size: number; cx: number; cy: number; R: number; children: React.ReactNode;
}) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="bezelGrad" cx="50%" cy="50%" r="50%">
          <Stop offset="70%" stopColor="#1a2e50" />
          <Stop offset="88%" stopColor="#0d1a30" />
          <Stop offset="95%" stopColor="#233560" />
          <Stop offset="100%" stopColor="#0a1020" />
        </RadialGradient>
        <RadialGradient id="faceGrad" cx="50%" cy="38%" r="60%">
          <Stop offset="0%" stopColor="#1a2840" />
          <Stop offset="60%" stopColor="#0d1828" />
          <Stop offset="100%" stopColor="#060e18" />
        </RadialGradient>
        <RadialGradient id="hubGrad2" cx="40%" cy="35%" r="60%">
          <Stop offset="0%" stopColor="#5a7090" />
          <Stop offset="40%" stopColor="#2a3a50" />
          <Stop offset="100%" stopColor="#0d1828" />
        </RadialGradient>
        <LinearGradient id="needleWht" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#c0d0e0" />
          <Stop offset="50%" stopColor="#f0f8ff" />
          <Stop offset="100%" stopColor="#c0d0e0" />
        </LinearGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={R + 10} fill="url(#bezelGrad)" />
      <Circle cx={cx} cy={cy} r={R + 7} fill="none" stroke="#3a5880" strokeWidth={1.5} strokeOpacity={0.4} />
      <Circle cx={cx} cy={cy} r={R + 10} fill="none" stroke="#0a1020" strokeWidth={2} />
      <Circle cx={cx} cy={cy} r={R} fill="url(#faceGrad)" />
      <Circle cx={cx} cy={cy} r={R} fill="none" stroke="#2a4060" strokeWidth={2} />
      <Circle cx={cx} cy={cy} r={R - 3} fill="none" stroke="#1a2a40" strokeWidth={1} strokeOpacity={0.5} />
      {children}
      <Path
        d={`M ${cx - R * 0.7} ${cy - R * 0.85} A ${R * 0.9} ${R * 0.9} 0 0 1 ${cx + R * 0.7} ${cy - R * 0.85}`}
        fill="none" stroke="white" strokeWidth={R * 0.3} strokeOpacity={0.04} strokeLinecap="round"
      />
    </Svg>
  );
}

function GaugeNeedle({ cx, cy, R, angleDeg }: { cx: number; cy: number; R: number; angleDeg: number }) {
  const tip = polar(cx, cy, R * 0.78, angleDeg);
  const tail = polar(cx, cy, R * 0.22, angleDeg + 180);
  const w1 = polar(cx, cy, R * 0.045, angleDeg - 90);
  const w2 = polar(cx, cy, R * 0.045, angleDeg + 90);
  const tw1 = polar(cx, cy, R * 0.028, angleDeg - 90);
  const tw2 = polar(cx, cy, R * 0.028, angleDeg + 90);
  return (
    <G>
      <Polygon
        points={`${tip.x + 2},${tip.y + 2} ${w1.x + 2},${w1.y + 2} ${tail.x + 2},${tail.y + 2} ${w2.x + 2},${w2.y + 2}`}
        fill="#000000" opacity={0.35}
      />
      <Polygon
        points={`${tip.x},${tip.y} ${w1.x},${w1.y} ${tw1.x},${tw1.y} ${tail.x},${tail.y} ${tw2.x},${tw2.y} ${w2.x},${w2.y}`}
        fill="url(#needleWht)"
      />
      <Polygon points={`${tw1.x},${tw1.y} ${tail.x},${tail.y} ${tw2.x},${tw2.y}`} fill="#1a2840" opacity={0.85} />
      <Circle cx={cx} cy={cy} r={R * 0.08} fill="url(#hubGrad2)" />
      <Circle cx={cx} cy={cy} r={R * 0.08} fill="none" stroke="#5a8aaa" strokeWidth={1.5} />
      <Circle cx={cx} cy={cy} r={R * 0.03} fill="#c0d8f0" />
    </G>
  );
}

interface CircularGaugeProps {
  title: string;
  value: number | null;
  valueLabel: string;
  subLabel: string;
  unit: string;
  min: number;
  max: number;
  startDeg?: number;
  endDeg?: number;
  zones?: { end: number; color: string }[];
  labelSteps?: number[];
  color: string;
  extraLabel?: string;
}

function CircularGauge({
  title, value, valueLabel, subLabel, unit,
  min, max, startDeg = 135, endDeg = 405,
  zones = [], labelSteps = [], color, extraLabel,
}: CircularGaugeProps) {
  const size = SW - 32;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 14;

  const sweep = endDeg - startDeg;
  const clamp = Math.min(max, Math.max(min, value ?? min));
  const frac = (clamp - min) / (max - min);
  const needleDeg = startDeg + frac * sweep;

  return (
    <View style={gCard.card}>
      <Text style={gCard.title}>{title}</Text>
      <GaugeFace size={size} cx={cx} cy={cy} R={R}>
        <Defs>
          <RadialGradient id={`activeGlow_${title}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {zones.map((zone, i) => {
          const prevEnd = i === 0 ? min : zones[i - 1].end;
          const zStartDeg = startDeg + ((prevEnd - min) / (max - min)) * sweep;
          const zEndDeg = startDeg + ((zone.end - min) / (max - min)) * sweep;
          return (
            <Path key={i} d={annularArcPath(cx, cy, R - 18, R - 6, zStartDeg, zEndDeg)}
              fill={zone.color} opacity={0.22} />
          );
        })}

        <Path d={arcPath(cx, cy, R - 12, startDeg, endDeg)} fill="none"
          stroke="#1a2a3a" strokeWidth={12} strokeLinecap="butt" />

        {value != null && (
          <Path d={arcPath(cx, cy, R - 12, startDeg, needleDeg)} fill="none"
            stroke={color} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
        )}
        {value != null && (
          <Path d={arcPath(cx, cy, R - 12, startDeg, needleDeg)} fill="none"
            stroke={color} strokeWidth={14} strokeLinecap="round" opacity={0.12} />
        )}

        {Array.from({ length: 61 }).map((_, i) => {
          const td = startDeg + (i / 60) * sweep;
          const isMajor = i % 5 === 0;
          const p1 = polar(cx, cy, R - 1, td);
          const p2 = polar(cx, cy, R - (isMajor ? 18 : 10), td);
          return (
            <Line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={isMajor ? "#8ab0d0" : "#2a4060"}
              strokeWidth={isMajor ? 2 : 1} strokeLinecap="round" />
          );
        })}

        {labelSteps.map((v) => {
          const td = startDeg + ((v - min) / (max - min)) * sweep;
          const pos = polar(cx, cy, R - 32, td);
          return (
            <SvgText key={v} x={pos.x} y={pos.y + 4} fontSize={10}
              fill="#7a9ab8" textAnchor="middle" fontWeight="600">{v}</SvgText>
          );
        })}

        <SvgText x={cx} y={cy + R * 0.38} fontSize={12} fill="#4a6880"
          textAnchor="middle" fontWeight="600" letterSpacing={2}>
          {unit.toUpperCase()}
        </SvgText>

        <GaugeNeedle cx={cx} cy={cy} R={R} angleDeg={needleDeg} />

        <Rect x={cx - 36} y={cy + R * 0.46} width={72} height={26} rx={5} ry={5}
          fill="#060e18" stroke="#2a4060" strokeWidth={1} />
        <SvgText x={cx} y={cy + R * 0.46 + 17} fontSize={14} fill={color}
          textAnchor="middle" fontWeight="800">{valueLabel}</SvgText>
      </GaugeFace>

      {extraLabel != null && <Text style={[gCard.sub, { color }]}>{extraLabel}</Text>}
      {subLabel != null && <Text style={gCard.sub}>{subLabel}</Text>}
    </View>
  );
}

// ─── Thermometer ─────────────────────────────────────────────────────────────

function Thermometer({ tempF }: { tempF: number | null }) {
  const W = 120;
  const H = 340;
  const cx = 40;
  const TUBE_W = 18;
  const BULB_R = 26;
  const tubeTop = 20;
  const tubeBottom = H - BULB_R * 2 - 12;
  const tubeH = tubeBottom - tubeTop;
  const MIN_F = -20;
  const MAX_F = 130;

  const clamp = Math.min(MAX_F, Math.max(MIN_F, tempF ?? MIN_F));
  const fillFrac = (clamp - MIN_F) / (MAX_F - MIN_F);
  const fillHeight = fillFrac * tubeH;
  const fillTop = tubeBottom - fillHeight;

  const liquidColor =
    clamp < 32 ? C.blue : clamp < 50 ? C.teal : clamp < 75 ? C.brand : clamp < 95 ? C.yellow : C.red;

  const bulbCy = tubeBottom + BULB_R + 4;
  const ticks: { f: number; major: boolean }[] = [];
  for (let f = MIN_F; f <= MAX_F; f += 5) ticks.push({ f, major: f % 20 === 0 });
  const fToY = (f: number) => tubeBottom - ((f - MIN_F) / (MAX_F - MIN_F)) * tubeH;

  return (
    <View style={gCard.card}>
      <Text style={gCard.title}>Temperature</Text>
      <Svg width={W + 60} height={H + 20}>
        <Defs>
          <LinearGradient id="tubeBg2" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#0d1a2e" />
            <Stop offset="35%" stopColor="#162035" />
            <Stop offset="100%" stopColor="#0d1a2e" />
          </LinearGradient>
          <LinearGradient id="liquidGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={liquidColor} stopOpacity="0.7" />
            <Stop offset="40%" stopColor={liquidColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={liquidColor} stopOpacity="0.6" />
          </LinearGradient>
          <RadialGradient id="bulbGrad2" cx="38%" cy="38%" r="55%">
            <Stop offset="0%" stopColor={liquidColor} stopOpacity="0.95" />
            <Stop offset="100%" stopColor={liquidColor} stopOpacity="0.5" />
          </RadialGradient>
          <ClipPath id="tubeClip2">
            <Rect x={cx - TUBE_W / 2 + 2} y={tubeTop} width={TUBE_W - 4}
              height={tubeBottom - tubeTop + BULB_R} rx={(TUBE_W - 4) / 2} />
          </ClipPath>
        </Defs>
        <Rect x={cx - TUBE_W / 2} y={tubeTop} width={TUBE_W} height={tubeBottom - tubeTop}
          rx={TUBE_W / 2} fill="url(#tubeBg2)" stroke="#2a4060" strokeWidth={1.5} />
        {tempF != null && (
          <Rect x={cx - TUBE_W / 2 + 3} y={fillTop} width={TUBE_W - 6} height={fillHeight + BULB_R}
            rx={(TUBE_W - 6) / 2} fill="url(#liquidGrad2)" clipPath="url(#tubeClip2)" />
        )}
        <Rect x={cx - TUBE_W / 2 + 2} y={tubeTop + 4} width={TUBE_W / 3}
          height={tubeBottom - tubeTop - 8} rx={2} fill="white" opacity={0.08} />
        {ticks.map(({ f, major }) => {
          const y = fToY(f);
          const tickLen = major ? 18 : 10;
          return (
            <G key={f}>
              <Line x1={cx + TUBE_W / 2 + 2} y1={y} x2={cx + TUBE_W / 2 + 2 + tickLen} y2={y}
                stroke={major ? "#8ab0d0" : "#2a4060"} strokeWidth={major ? 1.5 : 1} strokeLinecap="round" />
              {major && (
                <SvgText x={cx + TUBE_W / 2 + tickLen + 8} y={y + 4}
                  fontSize={11} fill="#7a9ab8" fontWeight="600">{f}°</SvgText>
              )}
            </G>
          );
        })}
        <Circle cx={cx} cy={bulbCy} r={BULB_R} fill="#0a1628" stroke="#2a4060" strokeWidth={2} />
        <Circle cx={cx} cy={bulbCy} r={BULB_R - 4} fill="url(#bulbGrad2)" />
        <Circle cx={cx - 7} cy={bulbCy - 7} r={6} fill="white" opacity={0.12} />
        <Circle cx={cx - 5} cy={bulbCy - 5} r={2.5} fill="white" opacity={0.22} />
      </Svg>
      <Text style={[gCard.value, { color: liquidColor }]}>{tempF != null ? `${tempF}°F` : "—"}</Text>
      <Text style={gCard.sub}>{tempF != null ? `${(((tempF - 32) * 5) / 9).toFixed(1)}°C` : "Celsius"}</Text>
    </View>
  );
}

// ─── Radar Link Card ──────────────────────────────────────────────────────────

function RadarLinkCard() {
  const links = [
    {
      label: "NOAA Radar Loop",
      desc: "National Weather Service radar",
      url: "https://radar.weather.gov/",
      icon: "🛰️",
      color: C.blue,
    },
    {
      label: "Weather Underground",
      desc: "Hyper-local PWS data",
      url: "https://www.wunderground.com/",
      icon: "🌡️",
      color: C.yellow,
    },
    {
      label: "Windy.com",
      desc: "Global wind & storm map",
      url: "https://www.windy.com/",
      icon: "💨",
      color: C.teal,
    },
    {
      label: "Rain Viewer",
      desc: "Worldwide rain radar",
      url: "https://www.rainviewer.com/map.html",
      icon: "🌧️",
      color: C.purple,
    },
  ];

  return (
    <View style={radar.card}>
      <Text style={radar.title}>🌐  Weather Resources</Text>
      {links.map((l) => (
        <TouchableOpacity
          key={l.url}
          style={[radar.row, { borderLeftColor: l.color }]}
          onPress={() => Linking.openURL(l.url)}
          activeOpacity={0.7}
        >
          <Text style={radar.rowIcon}>{l.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[radar.rowLabel, { color: l.color }]}>{l.label}</Text>
            <Text style={radar.rowDesc}>{l.desc}</Text>
          </View>
          <Text style={radar.arrow}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

export default function WeatherDashboard() {
  const [sensors, setSensors] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSensors();
      setSensors(data);
      setLastUpdated(new Date());
    } catch {
      // pass
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  const env = sensors?.environment?.data ?? sensors?.environment;
  const fp = sensors?.flow_pressure?.data ?? sensors?.flow_pressure;
  const online = sensors?.online ?? false;

  const tempF = env?.temperature_c != null
    ? parseFloat(((env.temperature_c * 9) / 5 + 32).toFixed(1))
    : null;
  const humidity: number | null = env?.humidity_percent ?? null;
  const pressurePsi: number | null = fp?.pressure_psi ?? null;
  const windMph: number | null = env?.wind_speed_ms != null
    ? parseFloat((env.wind_speed_ms * 2.237).toFixed(1))
    : null;
  const windDeg: number | null = env?.wind_direction_deg ?? null;
  const windLabel: string = env?.wind_direction_compass ?? (windDeg != null ? `${windDeg.toFixed(0)}°` : "—");

  const condition = getCondition(tempF, windMph, humidity);

  const conditionDesc: Record<string, string> = {
    sunny: "Clear & Sunny",
    cloudy: "Partly Cloudy",
    rainy: "Rainy",
    windy: "Windy",
    snow: "Snow",
    unknown: "Connecting…",
  };

  const beaufort = (() => {
    if (windMph == null) return null;
    const scale = [
      [0, "Calm"], [1, "Light Air"], [4, "Light Breeze"], [8, "Gentle"],
      [13, "Moderate"], [19, "Fresh"], [25, "Strong"], [32, "Near Gale"],
      [39, "Gale"], [47, "Strong Gale"], [55, "Storm"],
    ] as [number, string][];
    return [...scale].reverse().find(([s]) => windMph >= s)?.[1] ?? "Calm";
  })();

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Weather Station</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {timeStr && <Text style={s.updated}>Updated {timeStr}</Text>}
          <View style={[s.badge, { backgroundColor: (online ? C.brand : C.red) + "22" }]}>
            <View style={[s.dot, { backgroundColor: online ? C.brand : C.red }]} />
            <Text style={[s.badgeText, { color: online ? C.brand : C.red }]}>
              {online ? "Live" : "Offline"}
            </Text>
          </View>
        </View>
      </View>

      {/* Hero current conditions card */}
      <HeroWeatherCard
        condition={condition}
        tempF={tempF}
        humidity={humidity}
        windMph={windMph}
        windDeg={windDeg}
        windLabel={windLabel}
        description={conditionDesc[condition] ?? "—"}
      />

      {/* Wind rose + speed compass */}
      <WindRoseCard windDeg={windDeg} windMph={windMph} windLabel={windLabel} beaufort={beaufort} />

      {/* Thermometer */}
      <Thermometer tempF={tempF} />

      {/* Humidity gauge */}
      <CircularGauge
        title="Humidity"
        value={humidity}
        valueLabel={humidity != null ? `${humidity.toFixed(0)}%` : "—"}
        subLabel="Relative Humidity"
        unit="%RH"
        min={0} max={100}
        zones={[
          { end: 30, color: C.orange },
          { end: 60, color: C.teal },
          { end: 100, color: C.blue },
        ]}
        labelSteps={[0, 25, 50, 75, 100]}
        color={
          (humidity ?? 50) < 30 ? C.orange
            : (humidity ?? 50) > 80 ? C.blue
              : C.teal
        }
      />

      {/* Wind speed gauge */}
      <CircularGauge
        title="Wind Speed"
        value={windMph}
        valueLabel={windMph != null ? `${windMph.toFixed(1)}` : "—"}
        subLabel="mph"
        unit="MPH"
        min={0} max={60}
        zones={[
          { end: 10, color: C.teal },
          { end: 25, color: C.yellow },
          { end: 40, color: C.orange },
          { end: 60, color: C.red },
        ]}
        labelSteps={[0, 15, 30, 45, 60]}
        color={
          (windMph ?? 0) < 10 ? C.teal
            : (windMph ?? 0) < 25 ? C.yellow
              : (windMph ?? 0) < 40 ? C.orange
                : C.red
        }
        extraLabel={beaufort ?? undefined}
      />

      {/* Pressure gauge */}
      <CircularGauge
        title="Water Pressure"
        value={pressurePsi}
        valueLabel={pressurePsi != null ? `${pressurePsi.toFixed(1)}` : "—"}
        subLabel="PSI"
        unit="PSI"
        min={0} max={150}
        zones={[
          { end: 70, color: C.brand },
          { end: 100, color: C.yellow },
          { end: 150, color: C.red },
        ]}
        labelSteps={[0, 25, 50, 75, 100, 125, 150]}
        color={
          (pressurePsi ?? 0) < 70 ? C.brand
            : (pressurePsi ?? 0) < 100 ? C.yellow
              : C.red
        }
      />

      {/* Radar / weather links */}
      <RadarLinkCard />

      <TouchableOpacity style={s.refreshBtn} onPress={load} disabled={loading}>
        <Text style={s.refreshText}>{loading ? "Refreshing…" : "↺  Refresh"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 48 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 6,
  },
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  updated: { color: C.muted, fontSize: 11 },
  refreshBtn: {
    backgroundColor: "#0b1220", borderRadius: 12, padding: 15,
    alignItems: "center", borderColor: C.border, borderWidth: 1,
    marginTop: 4, marginHorizontal: 16, marginBottom: 16,
  },
  refreshText: { color: C.brand, fontWeight: "700", fontSize: 15 },
});

const hero = StyleSheet.create({
  card: {
    height: HERO_H,
    marginHorizontal: 0,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: C.card,
  },
  illustrationRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  celestialWrap: {
    position: "absolute",
    top: HERO_H * 0.04,
    right: SW * 0.06,
  },
  cloudLayer: {
    position: "absolute",
    top: HERO_H * 0.1,
    left: 0,
    right: 0,
  },
  cloud2: {
    position: "absolute",
    top: HERO_H * 0.22,
    left: SW * 0.3,
  },
  precipLayer: {
    position: "absolute",
    top: HERO_H * 0.38,
    left: 0,
  },
  windLayer: {
    position: "absolute",
    top: HERO_H * 0.3,
    left: 0,
  },
  readout: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  tempGiant: {
    fontSize: 88,
    fontWeight: "900",
    color: C.text,
    lineHeight: 92,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  conditionLabel: {
    fontSize: 20,
    fontWeight: "700",
    color: C.mutedBright,
    marginBottom: 10,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(10,18,32,0.65)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.2)",
  },
  pillIcon: { fontSize: 14 },
  pillText: { color: C.text, fontSize: 13, fontWeight: "600" },
});

const gCard = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  title: {
    color: C.mutedBright,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  value: {
    color: C.text,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 8,
  },
  sub: { color: C.muted, fontSize: 13, marginTop: 2, marginBottom: 4 },
});

const radar = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  title: {
    color: C.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    marginBottom: 8,
    backgroundColor: "#0f1e38",
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  rowIcon: { fontSize: 22 },
  rowLabel: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  rowDesc: { fontSize: 12, color: C.muted },
  arrow: { color: C.mutedBright, fontSize: 22, paddingRight: 10 },
});
