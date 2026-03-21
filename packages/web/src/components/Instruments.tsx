// Shared realistic instrument components used by both Sensors and Weather pages.

import React from "react";

// ─── helpers ──────────────────────────────────────────────────────────────────

export function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function arc(cx: number, cy: number, r: number, a1: number, a2: number) {
  const s = polar(cx, cy, r, a1);
  const e = polar(cx, cy, r, a2);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function annularWedge(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number) {
  const s1 = polar(cx, cy, r1, a1), e1 = polar(cx, cy, r1, a2);
  const s2 = polar(cx, cy, r2, a2), e2 = polar(cx, cy, r2, a1);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return (
    `M ${s1.x} ${s1.y} A ${r1} ${r1} 0 ${large} 1 ${e1.x} ${e1.y}` +
    ` L ${s2.x} ${s2.y} A ${r2} ${r2} 0 ${large} 0 ${e2.x} ${e2.y} Z`
  );
}

// ─── Shared SVG <defs> — inject once per page ─────────────────────────────────

export function SharedDefs() {
  return (
    <defs>
      <radialGradient id="gBezel" cx="45%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#2a4060" />
        <stop offset="45%" stopColor="#18283c" />
        <stop offset="75%" stopColor="#0d1828" />
        <stop offset="90%" stopColor="#223558" />
        <stop offset="100%" stopColor="#0a1020" />
      </radialGradient>
      <radialGradient id="gFace" cx="50%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#182a44" />
        <stop offset="55%" stopColor="#0e1c30" />
        <stop offset="100%" stopColor="#060c18" />
      </radialGradient>
      <radialGradient id="gHub" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stopColor="#8ab0d0" />
        <stop offset="30%" stopColor="#4a6888" />
        <stop offset="70%" stopColor="#1e2e42" />
        <stop offset="100%" stopColor="#0d1828" />
      </radialGradient>
      <linearGradient id="gNeedleRed" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ff8080" />
        <stop offset="30%" stopColor="#e53e3e" />
        <stop offset="100%" stopColor="#9b1c1c" />
      </linearGradient>
      <linearGradient id="gNeedleSilver" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#d0e4f4" />
        <stop offset="40%" stopColor="#f0f8ff" />
        <stop offset="100%" stopColor="#8ab0cc" />
      </linearGradient>
      <linearGradient id="gNeedleSteel" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#c0d4e8" />
        <stop offset="50%" stopColor="#e8f4ff" />
        <stop offset="100%" stopColor="#7090a8" />
      </linearGradient>
      <radialGradient id="gGlass" cx="50%" cy="20%" r="55%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.07" />
        <stop offset="60%" stopColor="#ffffff" stopOpacity="0.01" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
      </radialGradient>
      <linearGradient id="gTubeGlass" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#1a3858" stopOpacity="0.9" />
        <stop offset="20%" stopColor="#2a5070" stopOpacity="0.4" />
        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.05" />
        <stop offset="75%" stopColor="#1a3050" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#102040" stopOpacity="0.8" />
      </linearGradient>
      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="glowSoft" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.6" />
      </filter>
    </defs>
  );
}

// ─── Bezel wrapper ─────────────────────────────────────────────────────────────

export function Bezel({ cx, cy, R, children }: { cx: number; cy: number; R: number; children: React.ReactNode }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={R + 13} fill="#040810" />
      <circle cx={cx} cy={cy} r={R + 10} fill="url(#gBezel)" />
      <circle cx={cx} cy={cy} r={R + 5} fill="none" stroke="#3a5878" strokeWidth={1} strokeOpacity={0.4} />
      <circle cx={cx} cy={cy} r={R + 3} fill="none" stroke="#0a1828" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={R} fill="url(#gFace)" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1e3050" strokeWidth={1.5} />
      {children}
      <circle cx={cx} cy={cy} r={R} fill="url(#gGlass)" />
      <path
        d={arc(cx, cy - 2, R * 0.72, 220, 320)}
        fill="none" stroke="white" strokeWidth={R * 0.18} strokeOpacity={0.04} strokeLinecap="round"
      />
    </>
  );
}

// ─── Needle ───────────────────────────────────────────────────────────────────

export function Needle({
  cx, cy, R, angleDeg,
  tipColor = "url(#gNeedleSteel)",
  tailColor = "#1a2a3c",
}: {
  cx: number; cy: number; R: number; angleDeg: number;
  tipColor?: string; tailColor?: string;
}) {
  const tipPt  = polar(cx, cy, R * 0.76, angleDeg);
  const tailPt = polar(cx, cy, R * 0.22, angleDeg + 180);
  const w1  = polar(cx, cy, R * 0.046, angleDeg - 90);
  const w2  = polar(cx, cy, R * 0.046, angleDeg + 90);
  const tw1 = polar(cx, cy, R * 0.03,  angleDeg - 90);
  const tw2 = polar(cx, cy, R * 0.03,  angleDeg + 90);
  const tipPoints  = `${tipPt.x},${tipPt.y} ${w1.x},${w1.y} ${tw1.x},${tw1.y} ${tailPt.x},${tailPt.y} ${tw2.x},${tw2.y} ${w2.x},${w2.y}`;
  const tailPoints = `${tw1.x},${tw1.y} ${tailPt.x},${tailPt.y} ${tw2.x},${tw2.y}`;
  return (
    <g filter="url(#shadow)">
      <polygon points={tipPoints} fill={tipColor} />
      <polygon points={tailPoints} fill={tailColor} opacity={0.9} />
      <circle cx={cx} cy={cy} r={R * 0.075} fill="url(#gHub)" />
      <circle cx={cx} cy={cy} r={R * 0.075} fill="none" stroke="#5a8aaa" strokeWidth={1.5} />
      <circle cx={cx - R * 0.025} cy={cy - R * 0.03} r={R * 0.025} fill="white" opacity={0.4} />
      <circle cx={cx} cy={cy} r={R * 0.028} fill="#c8e0f4" />
    </g>
  );
}

// ─── Thermometer ──────────────────────────────────────────────────────────────

export function Thermometer({ tempF, compact = false, hideTitle = false }: { tempF: number | null; compact?: boolean; hideTitle?: boolean }) {
  const MIN_F = -20, MAX_F = 130;
  const H = compact ? 200 : 300;
  const W = compact ? 90 : 130;
  const cx = compact ? 28 : 42;
  const tubeW = compact ? 14 : 20;
  const BULB_R = compact ? 17 : 24;
  const tubeTop = 18, tubeBottom = H - BULB_R * 2 - 8;
  const tubeH = tubeBottom - tubeTop;
  const bulbCy = tubeBottom + BULB_R + 4;
  const clamped = Math.min(MAX_F, Math.max(MIN_F, tempF ?? MIN_F));
  const fillFrac = (clamped - MIN_F) / (MAX_F - MIN_F);
  const fillH = fillFrac * tubeH;
  const fillY = tubeBottom - fillH;
  const col = clamped < 32 ? "#38bdf8" : clamped < 50 ? "#2dd4bf"
    : clamped < 75 ? "#22c55e" : clamped < 95 ? "#fbbf24" : "#f87171";
  const ticks: { f: number; major: boolean }[] = [];
  for (let f = MIN_F; f <= MAX_F; f += 5) ticks.push({ f, major: f % 20 === 0 });
  const tempToY = (f: number) => tubeBottom - ((f - MIN_F) / (MAX_F - MIN_F)) * tubeH;
  const clipId = "thermoClip";
  return (
    <div className="flex flex-col items-center select-none">
      <div className="text-[10px] font-bold tracking-[3px] uppercase text-gray-500 mb-3">{hideTitle ? "" : "Temperature"}</div>
      <svg width={W + 60} height={H + 30} viewBox={`0 0 ${W + 60} ${H + 30}`}>
        <defs>
          <linearGradient id="gTubeBg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0d1a2e" />
            <stop offset="40%" stopColor="#162038" />
            <stop offset="100%" stopColor="#0d1a2e" />
          </linearGradient>
          <linearGradient id={`gLiquid_${col.replace('#','')}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={col} stopOpacity="0.65" />
            <stop offset="35%" stopColor={col} />
            <stop offset="65%" stopColor={col} stopOpacity="0.9" />
            <stop offset="100%" stopColor={col} stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="gBulbFill" cx="38%" cy="35%" r="60%">
            <stop offset="0%" stopColor={col} />
            <stop offset="65%" stopColor={col} stopOpacity="0.8" />
            <stop offset="100%" stopColor={col} stopOpacity="0.45" />
          </radialGradient>
          <clipPath id={clipId}>
            <rect x={cx - tubeW / 2 + 3} y={tubeTop}
              width={tubeW - 6} height={tubeBottom - tubeTop + BULB_R + 4}
              rx={(tubeW - 6) / 2} />
          </clipPath>
          <filter id="tubeGlow" x="-50%" y="-10%" width="200%" height="120%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect x={cx - tubeW / 2} y={tubeTop} width={tubeW} height={tubeBottom - tubeTop}
          rx={tubeW / 2} fill="url(#gTubeBg)" stroke="#2a4060" strokeWidth={2} />
        {tempF != null && (
          <rect x={cx - tubeW / 2 + 3} y={fillY} width={tubeW - 6} height={fillH + BULB_R + 4}
            rx={(tubeW - 6) / 2} fill={col} opacity={0.18} filter="url(#tubeGlow)"
            clipPath={`url(#${clipId})`} />
        )}
        {tempF != null && (
          <rect x={cx - tubeW / 2 + 3} y={fillY} width={tubeW - 6} height={fillH + BULB_R + 4}
            rx={(tubeW - 6) / 2} fill={`url(#gLiquid_${col.replace('#','')})`}
            clipPath={`url(#${clipId})`} />
        )}
        <rect x={cx - tubeW / 2} y={tubeTop} width={tubeW} height={tubeBottom - tubeTop}
          rx={tubeW / 2} fill="url(#gTubeGlass)" />
        <rect x={cx - tubeW / 2 + 3} y={tubeTop + 6} width={4} height={tubeBottom - tubeTop - 12}
          rx={2} fill="white" opacity={0.1} />
        {ticks.map(({ f, major }) => {
          const y = tempToY(f);
          const x1 = cx + tubeW / 2 + 3;
          const x2 = x1 + (major ? 18 : 9);
          return (
            <g key={f}>
              <line x1={x1} y1={y} x2={x2} y2={y}
                stroke={major ? "#8ab0cc" : "#2a4060"}
                strokeWidth={major ? 1.5 : 1} strokeLinecap="round" />
              {major && (
                <text x={x2 + 5} y={y + 4} fontSize={11} fill="#7090a8" fontWeight="600">{f}°</text>
              )}
            </g>
          );
        })}
        {tempF != null && (
          <line x1={cx - tubeW / 2 - 3} y1={fillY} x2={cx + tubeW / 2 + 3} y2={fillY}
            stroke={col} strokeWidth={1.5} strokeOpacity={0.7} />
        )}
        <circle cx={cx} cy={bulbCy} r={BULB_R} fill="#0a1628" stroke="#2a4060" strokeWidth={2} />
        <circle cx={cx} cy={bulbCy} r={BULB_R - 2} fill={col} opacity={0.15} filter="url(#glowSoft)" />
        <circle cx={cx} cy={bulbCy} r={BULB_R - 4} fill="url(#gBulbFill)" />
        <circle cx={cx - 7} cy={bulbCy - 7} r={6} fill="white" opacity={0.14} />
        <circle cx={cx - 5} cy={bulbCy - 5} r={2.5} fill="white" opacity={0.28} />
      </svg>
      <div className="text-3xl font-black tabular-nums mt-0" style={{ color: col }}>
        {tempF != null ? `${tempF}°F` : "—"}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {tempF != null ? `${(((tempF - 32) * 5) / 9).toFixed(1)}°C` : "Celsius"}
      </div>
    </div>
  );
}

// ─── Compass ──────────────────────────────────────────────────────────────────

export function Compass({ deg, label, hideTitle = false }: { deg: number | null; label: string; hideTitle?: boolean }) {
  const SIZE = 260, cx = SIZE / 2, cy = SIZE / 2, R = SIZE / 2 - 12;
  const needleDeg = deg ?? 0;
  const cardinals = [
    { l: "N", d: 0, col: "#f87171", fs: 15 },
    { l: "NE", d: 45, col: "#7a9ab8", fs: 9 },
    { l: "E", d: 90, col: "#90b8d0", fs: 13 },
    { l: "SE", d: 135, col: "#7a9ab8", fs: 9 },
    { l: "S", d: 180, col: "#90b8d0", fs: 13 },
    { l: "SW", d: 225, col: "#7a9ab8", fs: 9 },
    { l: "W", d: 270, col: "#90b8d0", fs: 13 },
    { l: "NW", d: 315, col: "#7a9ab8", fs: 9 },
  ];
  const tipPt  = polar(cx, cy, R * 0.70, needleDeg);
  const tailPt = polar(cx, cy, R * 0.22, needleDeg + 180);
  const w1 = polar(cx, cy, R * 0.05, needleDeg - 90);
  const w2 = polar(cx, cy, R * 0.05, needleDeg + 90);
  return (
    <div className="flex flex-col items-center select-none">
      <div className="text-[10px] font-bold tracking-[3px] uppercase text-gray-500 mb-3">{hideTitle ? "" : "Wind Direction"}</div>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Bezel cx={cx} cy={cy} R={R}>
          {Array.from({ length: 72 }).map((_, i) => {
            const a = i * 5;
            const is45 = a % 45 === 0, is10 = a % 10 === 0;
            const outer = R - 1, inner = is45 ? outer - 22 : is10 ? outer - 13 : outer - 7;
            const p1 = polar(cx, cy, outer, a), p2 = polar(cx, cy, inner, a);
            return (
              <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={is45 ? "#7ab0d0" : is10 ? "#385878" : "#1e3050"}
                strokeWidth={is45 ? 2 : 1} strokeLinecap="round" />
            );
          })}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((d) => {
            if (d % 90 === 0) return null;
            const pos = polar(cx, cy, R - 30, d);
            return (
              <text key={d} x={pos.x} y={pos.y + 3.5} textAnchor="middle"
                fontSize={8} fill="#384e68" fontWeight="600">{d}</text>
            );
          })}
          {cardinals.map(({ l, d, col, fs }) => {
            const lr = R - (l.length === 1 ? 34 : 27);
            const pos = polar(cx, cy, lr, d);
            return (
              <text key={l} x={pos.x} y={pos.y + fs / 3}
                textAnchor="middle" fontSize={fs} fill={col} fontWeight="800">{l}</text>
            );
          })}
          <circle cx={cx} cy={cy} r={R * 0.55} fill="none" stroke="#1a2e48" strokeWidth={1} strokeDasharray="4 8" />
          <circle cx={cx} cy={cy} r={R * 0.34} fill="none" stroke="#1a2e48" strokeWidth={1} strokeDasharray="2 10" />
          {[0, 90].map((d) => {
            const a = polar(cx, cy, R * 0.30, d), b = polar(cx, cy, R * 0.30, d + 180);
            return <line key={d} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1e3050" strokeWidth={0.8} strokeOpacity={0.5} />;
          })}
          {deg != null && (
            <circle
              cx={polar(cx, cy, R * 0.6, needleDeg).x}
              cy={polar(cx, cy, R * 0.6, needleDeg).y}
              r={R * 0.09} fill="#f87171" opacity={0.12} filter="url(#glowSoft)"
            />
          )}
          <g filter="url(#shadow)">
            <polygon points={`${tipPt.x},${tipPt.y} ${w1.x},${w1.y} ${cx},${cy} ${w2.x},${w2.y}`} fill="url(#gNeedleRed)" />
            <polygon points={`${tailPt.x},${tailPt.y} ${w1.x},${w1.y} ${cx},${cy} ${w2.x},${w2.y}`} fill="url(#gNeedleSilver)" opacity={0.92} />
            <circle cx={cx} cy={cy} r={R * 0.076} fill="url(#gHub)" />
            <circle cx={cx} cy={cy} r={R * 0.076} fill="none" stroke="#5a8aaa" strokeWidth={1.5} />
            <circle cx={cx - R * 0.022} cy={cy - R * 0.028} r={R * 0.022} fill="white" opacity={0.45} />
            <circle cx={cx} cy={cy} r={R * 0.026} fill="#c8e0f4" />
          </g>
        </Bezel>
      </svg>
      <div className="text-2xl font-black text-sky-200 mt-2 tracking-wide">{label}</div>
      <div className="text-xs text-gray-500 mt-0.5">{deg != null ? `${deg.toFixed(0)}°` : "—"}</div>
    </div>
  );
}

// ─── CircularGauge ────────────────────────────────────────────────────────────

export interface CircularGaugeProps {
  value: number | null;
  min: number;
  max: number;
  title: string;
  unit: string;
  zones: { end: number; color: string }[];
  labelSteps: number[];
  extraLabel?: string;
}

export function CircularGauge({ value, min, max, title, unit, zones, labelSteps, extraLabel, hideTitle = false }: CircularGaugeProps & { hideTitle?: boolean }) {
  const SIZE = 260, cx = SIZE / 2, cy = SIZE / 2, R = SIZE / 2 - 12;
  const START = 135, END = 405, SWEEP = END - START;
  const clamped = Math.min(max, Math.max(min, value ?? min));
  const frac = (clamped - min) / (max - min);
  const needleDeg = START + frac * SWEEP;
  const activeColor = (() => {
    for (let i = 0; i < zones.length; i++) {
      const zStart = i === 0 ? min : zones[i - 1].end;
      if (clamped >= zStart && clamped <= zones[i].end) return zones[i].color;
    }
    return zones[zones.length - 1].color;
  })();
  const numMinor = 60, numMajor = 12;
  return (
    <div className="flex flex-col items-center select-none">
      <div className="text-[10px] font-bold tracking-[3px] uppercase text-gray-500 mb-3">{hideTitle ? "" : title}</div>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Bezel cx={cx} cy={cy} R={R}>
          {zones.map((z, i) => {
            const zStartVal = i === 0 ? min : zones[i - 1].end;
            const a1 = START + ((zStartVal - min) / (max - min)) * SWEEP;
            const a2 = START + ((z.end - min) / (max - min)) * SWEEP;
            return <path key={i} d={annularWedge(cx, cy, R - 20, R - 5, a1, a2)} fill={z.color} opacity={0.18} />;
          })}
          <path d={arc(cx, cy, R - 13, START, END)} fill="none" stroke="#0e1c2e" strokeWidth={14} />
          {value != null && (
            <path d={arc(cx, cy, R - 13, START, needleDeg)}
              fill="none" stroke={activeColor} strokeWidth={14} strokeOpacity={0.15} filter="url(#glowSoft)" />
          )}
          {value != null && (
            <path d={arc(cx, cy, R - 13, START, needleDeg)}
              fill="none" stroke={activeColor} strokeWidth={5} strokeOpacity={0.9} strokeLinecap="round" />
          )}
          {Array.from({ length: numMinor + 1 }).map((_, i) => {
            const td = START + (i / numMinor) * SWEEP;
            const isMajor = i % (numMinor / numMajor) === 0;
            const p1 = polar(cx, cy, R - 1, td);
            const p2 = polar(cx, cy, R - (isMajor ? 20 : 11), td);
            return (
              <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={isMajor ? "#8ab0cc" : "#233348"}
                strokeWidth={isMajor ? 2 : 1} strokeLinecap="round" />
            );
          })}
          {labelSteps.map((v) => {
            const td = START + ((v - min) / (max - min)) * SWEEP;
            const pos = polar(cx, cy, R - 34, td);
            return (
              <text key={v} x={pos.x} y={pos.y + 4} textAnchor="middle"
                fontSize={10} fill="#5a7898" fontWeight="700">{v}</text>
            );
          })}
          <text x={cx} y={cy + R * 0.35} textAnchor="middle"
            fontSize={11} fill="#3a5070" fontWeight="700" letterSpacing="2">
            {unit.toUpperCase()}
          </text>
          <Needle cx={cx} cy={cy} R={R} angleDeg={needleDeg} tipColor="url(#gNeedleSteel)" tailColor="#0e1c2e" />
          <rect x={cx - 38} y={cy + R * 0.42} width={76} height={28} rx={5} fill="#040c16" stroke="#1e3050" strokeWidth={1} />
          <text x={cx} y={cy + R * 0.42 + 19} textAnchor="middle"
            fontSize={15} fontWeight="800" fill={activeColor} style={{ fontVariant: "tabular-nums" }}>
            {value != null ? (value < 10 ? value.toFixed(1) : value.toFixed(0)) : "—"}
          </text>
        </Bezel>
      </svg>
      {extraLabel && <div className="text-xs mt-1 font-semibold" style={{ color: activeColor }}>{extraLabel}</div>}
    </div>
  );
}
