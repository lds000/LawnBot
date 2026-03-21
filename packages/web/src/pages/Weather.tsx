import { useQuery } from "@tanstack/react-query";
import { getSensorsLatest } from "@/lib/api";
import { tempCtoF } from "@/lib/utils";
import { SharedDefs, Thermometer, Compass, CircularGauge } from "@/components/Instruments";

// ─── helpers ──────────────────────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
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

function getHour() { return new Date().getHours(); }

function getSkyGradient(condition: string) {
  const h = getHour();
  if (condition === "rainy")  return ["#0a1428", "#1e304a"];
  if (condition === "windy")  return ["#0d1e3a", "#1a3050"];
  if (condition === "snow")   return ["#1a2a50", "#2a3a60"];
  if (h >= 6  && h < 9)  return ["#2d1b4e", "#c46b28"]; // dawn
  if (h >= 9  && h < 17) return ["#0e2a5a", "#1a6090"]; // day
  if (h >= 17 && h < 20) return ["#3a1a1a", "#8a3020"]; // dusk
  return ["#020810", "#0a1428"]; // night
}

const conditionLabel: Record<string, string> = {
  sunny: "Clear & Sunny",
  cloudy: "Partly Cloudy",
  rainy: "Rainy",
  windy: "Windy",
  snow: "Snow",
  unknown: "Connecting…",
};

// ─── Sun SVG (CSS spin on outer rays) ────────────────────────────────────────

function SunSvg({ size = 180 }: { size?: number }) {
  const cx = size / 2, cy = size / 2, R = size * 0.22;
  const numRays = 16;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id="wSunCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fff7aa" />
          <stop offset="40%"  stopColor="#fde047" />
          <stop offset="80%"  stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id="wSunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fde047" stopOpacity="0.35" />
          <stop offset="60%"  stopColor="#f59e0b" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Glow */}
      <circle cx={cx} cy={cy} r={size / 2} fill="url(#wSunGlow)" />
      {/* Spinning rays group */}
      <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: "spinSun 30s linear infinite" }}>
        {Array.from({ length: numRays }).map((_, i) => {
          const deg = (i / numRays) * 360;
          const inner = R + 5;
          const outer = R + (i % 2 === 0 ? 30 : 18);
          const p1 = polar(cx, cy, inner, deg);
          const p2 = polar(cx, cy, outer, deg);
          return (
            <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#fde047" strokeWidth={i % 2 === 0 ? 3.5 : 2}
              strokeLinecap="round" opacity={i % 2 === 0 ? 0.9 : 0.55} />
          );
        })}
      </g>
      {/* Core */}
      <circle cx={cx} cy={cy} r={R} fill="url(#wSunCore)" />
      <circle cx={cx - R * 0.28} cy={cy - R * 0.28} r={R * 0.28} fill="white" opacity={0.15} />
      <circle cx={cx - R * 0.22} cy={cy - R * 0.22} r={R * 0.1}  fill="white" opacity={0.25} />
    </svg>
  );
}

// ─── Moon SVG ─────────────────────────────────────────────────────────────────

function MoonSvg({ size = 140 }: { size?: number }) {
  const stars: [number, number, number][] = [[18,22,1.8],[108,18,1.4],[120,70,1.2],[22,95,1.6],[95,100,1]];
  return (
    <svg width={size} height={size} viewBox="0 0 130 130">
      <defs>
        <radialGradient id="wMoon" cx="35%" cy="35%" r="60%">
          <stop offset="0%"   stopColor="#e2e8f0" />
          <stop offset="50%"  stopColor="#c0cce0" />
          <stop offset="100%" stopColor="#8098b8" />
        </radialGradient>
      </defs>
      <circle cx={60} cy={65} r={42} fill="url(#wMoon)" />
      <circle cx={82} cy={42} r={34} fill="#020810" />
      <circle cx={44} cy={72} r={7}  fill="#9ab0c8" opacity={0.28} />
      <circle cx={60} cy={84} r={5}  fill="#9ab0c8" opacity={0.22} />
      <circle cx={38} cy={48} r={3.5} fill="#9ab0c8" opacity={0.18} />
      {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="white" opacity={0.65} />)}
    </svg>
  );
}

// ─── Cloud SVG ───────────────────────────────────────────────────────────────

function CloudSvg({ opacity = 1, scale = 1, dark = false }: { opacity?: number; scale?: number; dark?: boolean }) {
  const col = dark ? "#4a5a70" : "#a8c4e0";
  return (
    <svg width={160 * scale} height={90 * scale} viewBox="0 0 160 90" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="wCloud" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={col} stopOpacity="0.96" />
          <stop offset="100%" stopColor={col} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <g opacity={opacity}>
        <ellipse cx={80} cy={62} rx={68} ry={22} fill="url(#wCloud)" />
        <circle cx={50} cy={48} r={26} fill={col} opacity={0.92} />
        <circle cx={80} cy={38} r={32} fill={col} opacity={0.97} />
        <circle cx={110} cy={50} r={22} fill={col} opacity={0.88} />
        <circle cx={68} cy={32} r={9}  fill="white" opacity={0.1} />
      </g>
    </svg>
  );
}

// ─── Rain SVG ────────────────────────────────────────────────────────────────

function RainSvg({ windAngle = 15 }: { windAngle?: number }) {
  const drops: [number, number][] = [
    [60,10],[120,5],[200,18],[280,8],[360,22],[440,14],
    [80,50],[160,42],[240,55],[320,48],[400,58],
    [40,90],[140,82],[220,95],[300,88],[380,100],
  ];
  const rad = (windAngle * Math.PI) / 180;
  return (
    <svg width="100%" height="120" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0 }}>
      <g style={{ animation: "rainFall 1.1s linear infinite" }}>
        {drops.map(([x, y], i) => {
          const len = 13 + (i % 3) * 5;
          return (
            <line key={i}
              x1={x} y1={y}
              x2={x + len * Math.sin(rad)} y2={y + len * Math.cos(rad)}
              stroke="#60a5fa" strokeWidth={1.5} strokeLinecap="round"
              opacity={0.4 + (i % 4) * 0.12} />
          );
        })}
      </g>
    </svg>
  );
}

// ─── Snow SVG ────────────────────────────────────────────────────────────────

function SnowSvg() {
  const flakes: [number, number, number][] = [
    [60,20,10],[140,40,14],[240,15,8],[340,55,12],[440,30,9],
    [90,75,8],[200,85,11],[310,70,7],[410,90,10],
  ];
  return (
    <svg width="100%" height="120" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0 }}>
      <g style={{ animation: "snowDrift 4s ease-in-out infinite alternate" }}>
        {flakes.map(([x, y, r], i) => (
          <g key={i}>
            {[0, 60, 120].map((deg) => {
              const p1 = polar(x, y, r, deg);
              const p2 = polar(x, y, r, deg + 180);
              return <line key={deg} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke="white" strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />;
            })}
            <circle cx={x} cy={y} r={2.2} fill="white" opacity={0.85} />
          </g>
        ))}
      </g>
    </svg>
  );
}

// ─── Wind Streaks SVG ────────────────────────────────────────────────────────

function WindSvg({ windDeg }: { windDeg: number | null }) {
  const angle = windDeg ?? 270;
  const rad = ((angle - 90) * Math.PI) / 180;
  const lines = [
    { y: 20, x: 40,  len: 90,  op: 0.65 },
    { y: 48, x: 10,  len: 140, op: 0.5 },
    { y: 75, x: 80,  len: 70,  op: 0.42 },
    { y: 30, x: 200, len: 110, op: 0.6 },
    { y: 62, x: 300, len: 80,  op: 0.48 },
    { y: 18, x: 380, len: 95,  op: 0.55 },
    { y: 85, x: 180, len: 60,  op: 0.38 },
  ];
  return (
    <svg width="100%" height="110" viewBox="0 0 500 110" preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0 }}>
      <g style={{ animation: "windPulse 2s ease-in-out infinite alternate" }}>
        {lines.map(({ y, x, len, op }, i) => {
          const ex = x + len * Math.cos(rad);
          const ey = y + len * Math.sin(rad);
          const mx = (x + ex) / 2;
          const my = (y + ey) / 2 - 12;
          return (
            <path key={i} d={`M ${x} ${y} Q ${mx} ${my} ${ex} ${ey}`}
              fill="none" stroke="#2dd4bf"
              strokeWidth={i % 2 === 0 ? 2.5 : 1.5}
              strokeLinecap="round" opacity={op} />
          );
        })}
      </g>
    </svg>
  );
}

// ─── Star field ──────────────────────────────────────────────────────────────

function Stars() {
  const pts: [number, number, number][] = [
    [8,5,1.2],[18,2,0.9],[30,8,1],[45,3,1.3],[60,10,0.8],
    [75,2,1.1],[88,7,1],[14,15,0.9],[40,18,1.2],[65,14,0.8],
    [85,18,1],[92,5,0.9],[55,22,1.1],[25,24,0.8],[70,28,1],
  ];
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "40%" }}>
      {pts.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r * 0.4} fill="white"
          opacity={0.5 + (i % 4) * 0.12}
          style={{ animation: `starTwinkle ${2 + (i % 3)}s ease-in-out infinite alternate` }} />
      ))}
    </svg>
  );
}

// ─── Hero Card ────────────────────────────────────────────────────────────────

function HeroWeatherCard({
  condition, tempF, humidity, windMph, windDeg, windLabel,
}: {
  condition: string;
  tempF: number | null;
  humidity: number | null;
  windMph: number | null;
  windDeg: number | null;
  windLabel: string;
}) {
  const [sky1, sky2] = getSkyGradient(condition);
  const h = getHour();
  const isNight = h < 6 || h >= 21;
  const tempC = tempF != null ? (((tempF - 32) * 5) / 9).toFixed(1) : null;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-800"
      style={{ minHeight: 320, background: `linear-gradient(180deg, ${sky1} 0%, ${sky2} 100%)` }}>

      {/* Stars at night */}
      {isNight && <Stars />}

      {/* Precipitation / wind effects */}
      <div className="absolute inset-0 pointer-events-none">
        {condition === "rainy" && <RainSvg windAngle={windDeg != null ? (windDeg % 90) * 0.25 : 12} />}
        {condition === "snow"  && <SnowSvg />}
        {condition === "windy" && <WindSvg windDeg={windDeg} />}
      </div>

      {/* Clouds */}
      {(condition === "cloudy" || condition === "rainy" || condition === "windy") && (
        <div className="absolute top-6 left-0 right-0 pointer-events-none" style={{ zIndex: 1 }}>
          <div style={{ animation: "cloudDrift 8s ease-in-out infinite alternate", display: "inline-block" }}>
            <CloudSvg opacity={0.92} dark={condition === "rainy"} />
          </div>
          <div style={{
            position: "absolute", top: 28, right: "10%",
            animation: "cloudDrift 10s ease-in-out infinite alternate-reverse", display: "inline-block",
          }}>
            <CloudSvg opacity={0.7} scale={0.75} dark={condition === "rainy"} />
          </div>
        </div>
      )}

      {/* Celestial body */}
      <div className="absolute top-4 right-6 pointer-events-none" style={{ zIndex: 2 }}>
        {isNight
          ? <MoonSvg />
          : (condition === "sunny" || condition === "windy")
            ? <SunSvg />
            : <div style={{ opacity: 0.55 }}><SunSvg /></div>}
      </div>

      {/* Bottom readout */}
      <div className="absolute bottom-0 left-0 right-0 p-6" style={{ zIndex: 3 }}>
        {/* Giant temp */}
        <div style={{
          fontSize: 96, fontWeight: 900, lineHeight: 1,
          color: "rgba(240,246,255,0.97)",
          textShadow: "0 2px 24px rgba(0,0,0,0.6)",
          fontVariant: "tabular-nums",
        }}>
          {tempF != null ? `${tempF}°` : "—°"}
        </div>

        <div style={{ fontSize: 20, fontWeight: 700, color: "#94aabb", marginTop: 4, marginBottom: 14 }}>
          {conditionLabel[condition] ?? "—"}
        </div>

        {/* Pill row */}
        <div className="flex flex-wrap gap-2">
          {humidity != null && (
            <span style={pillStyle}>💧 {humidity.toFixed(0)}%</span>
          )}
          {windMph != null && (
            <span style={pillStyle}>💨 {windMph.toFixed(1)} mph {windLabel}</span>
          )}
          {tempC != null && (
            <span style={pillStyle}>🌡️ {tempC}°C</span>
          )}
        </div>
      </div>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "rgba(8,16,30,0.65)",
  backdropFilter: "blur(6px)",
  border: "1px solid rgba(56,189,248,0.2)",
  borderRadius: 999,
  padding: "5px 14px",
  fontSize: 13,
  fontWeight: 600,
  color: "#e0f0ff",
};

// ─── Radar links ──────────────────────────────────────────────────────────────

const radarLinks = [
  { label: "NOAA Radar Loop",    desc: "National Weather Service",     url: "https://radar.weather.gov/",                    icon: "🛰️", color: "#38bdf8" },
  { label: "Weather Underground", desc: "Hyper-local PWS data",        url: "https://www.wunderground.com/",                 icon: "🌡️", color: "#fbbf24" },
  { label: "Windy.com",          desc: "Global wind & storm map",       url: "https://www.windy.com/",                        icon: "💨", color: "#2dd4bf" },
  { label: "Rain Viewer",        desc: "Worldwide rain radar",          url: "https://www.rainviewer.com/map.html",           icon: "🌧️", color: "#c084fc" },
];

function RadarCard() {
  return (
    <div className="card">
      <div className="font-bold text-base text-gray-100 mb-4">🌐 Weather Resources</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {radarLinks.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl p-3 no-underline transition-all duration-150 hover:brightness-125"
            style={{ background: "#0d1828", borderLeft: `3px solid ${l.color}` }}>
            <span style={{ fontSize: 26 }}>{l.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate" style={{ color: l.color }}>{l.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{l.desc}</div>
            </div>
            <span className="text-gray-500 text-lg">›</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── CSS keyframe injection ───────────────────────────────────────────────────

const CSS_ANIMATIONS = `
@keyframes spinSun      { to { transform: rotate(360deg); } }
@keyframes cloudDrift   { from { transform: translateX(0); } to { transform: translateX(22px); } }
@keyframes rainFall     { from { transform: translateY(-20px); opacity:1; } to { transform: translateY(20px); opacity:0.6; } }
@keyframes snowDrift    { from { transform: translateX(-12px); } to { transform: translateX(12px); } }
@keyframes windPulse    { from { opacity:0.4; transform:translateX(0); } to { opacity:1; transform:translateX(16px); } }
@keyframes starTwinkle  { from { opacity:0.3; } to { opacity:0.9; } }
`;

// ─── Main page ────────────────────────────────────────────────────────────────

export function Weather() {
  const { data: latest, dataUpdatedAt } = useQuery<Record<string, any>>({
    queryKey: ["sensors-latest"],
    queryFn: getSensorsLatest,
    refetchInterval: 10000,
  });

  const env = latest?.environment?.data ?? latest?.environment;
  const fp  = latest?.flow_pressure?.data ?? latest?.flow_pressure;
  const online = latest?.online ?? false;

  const tempC: number | null  = env?.temperature ?? env?.temperature_c ?? null;
  const tempF  = tempC != null ? tempCtoF(tempC) : null;
  const humidity: number | null = env?.humidity ?? env?.humidity_percent ?? null;
  const windMs: number | null   = env?.wind_speed ?? env?.wind_speed_ms ?? null;
  const windMph = windMs != null ? parseFloat((windMs * 2.237).toFixed(1)) : null;
  const windDeg: number | null  = env?.wind_direction_deg ?? null;
  const windLabel: string = env?.wind_direction_compass ?? (windDeg != null ? `${windDeg.toFixed(0)}°` : "—");
  const pressurePsi: number | null = fp?.pressure_psi ?? null;

  const condition = getCondition(tempF, windMph, humidity);

  const beaufort = (() => {
    if (windMph == null) return undefined;
    const scale: [number, string][] = [
      [55, "Storm"], [47, "Strong Gale"], [39, "Gale"], [32, "Near Gale"],
      [25, "Strong"], [19, "Fresh"], [13, "Moderate"], [8, "Gentle"],
      [4, "Light Breeze"], [1, "Light Air"], [0, "Calm"],
    ];
    return scale.find(([s]) => windMph >= s)?.[1] ?? "Calm";
  })();

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="space-y-6">
      {/* Inject CSS animations once */}
      <style>{CSS_ANIMATIONS}</style>

      {/* Shared SVG defs */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <SharedDefs />
      </svg>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Weather Station</h1>
        <div className="flex items-center gap-3">
          {updatedAt && <span className="text-xs text-gray-500">Updated {updatedAt}</span>}
          <span className={`badge ${online ? "badge-green" : "badge-red"}`}>
            {online ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      {/* Hero */}
      <HeroWeatherCard
        condition={condition}
        tempF={tempF}
        humidity={humidity}
        windMph={windMph}
        windDeg={windDeg}
        windLabel={windLabel}
      />

      {/* Instruments grid */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 py-4 place-items-center">
          <Thermometer tempF={tempF} />
          <Compass deg={windDeg} label={windLabel} />
          <CircularGauge
            value={windMph} min={0} max={60}
            title="Wind Speed" unit="mph"
            zones={[
              { end: 10, color: "#2dd4bf" },
              { end: 25, color: "#fbbf24" },
              { end: 40, color: "#fb923c" },
              { end: 60, color: "#f87171" },
            ]}
            labelSteps={[0, 15, 30, 45, 60]}
            extraLabel={beaufort}
          />
          <CircularGauge
            value={pressurePsi} min={0} max={150}
            title="Water Pressure" unit="PSI"
            zones={[
              { end: 70, color: "#22c55e" },
              { end: 100, color: "#fbbf24" },
              { end: 150, color: "#f87171" },
            ]}
            labelSteps={[0, 25, 50, 75, 100, 125, 150]}
          />
          <CircularGauge
            value={humidity} min={0} max={100}
            title="Humidity" unit="%RH"
            zones={[
              { end: 30, color: "#fb923c" },
              { end: 80, color: "#2dd4bf" },
              { end: 100, color: "#38bdf8" },
            ]}
            labelSteps={[0, 25, 50, 75, 100]}
            extraLabel="Relative Humidity"
          />
        </div>
      </div>

      {/* Radar links */}
      <RadarCard />
    </div>
  );
}
