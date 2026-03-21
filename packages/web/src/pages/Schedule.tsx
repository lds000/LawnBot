import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSchedule, updateSchedule } from "@/lib/api";
import { useState, useRef, useCallback } from "react";
import { Plus, Trash2, Save, Clock, Droplets } from "lucide-react";


// Hex colors for zone bar SVG (needs hex, not Tailwind classes)
const ZONE_HEX: Record<string, string> = {
  "Hanging Pots": "#10b981",
  "Garden":       "#3b82f6",
  "Misters":      "#fbbf24",
};
const HEX_PALETTE = ["#10b981","#3b82f6","#fbbf24","#a855f7","#ec4899","#06b6d4"];
function zoneHex(name: string, idx: number) {
  return ZONE_HEX[name] ?? HEX_PALETTE[idx % HEX_PALETTE.length];
}

// Renders a single zone's bar — pulse/soak shows alternating filled/dark segments
function ZoneBar({ zone, widthPct, zoneIdx, barH = 10 }: {
  zone: { name: string; dur: number; pulse: boolean; pulseMin: number; soakMin: number };
  widthPct: number;
  zoneIdx: number;
  barH?: number;
}) {
  const color = zoneHex(zone.name, zoneIdx);
  const W = 100; // SVG viewBox units — we'll scale via preserveAspectRatio

  if (!zone.pulse || zone.pulseMin <= 0) {
    // Normal mode — solid bar
    return (
      <svg viewBox={`0 0 ${W} ${barH}`} preserveAspectRatio="none"
        style={{ width: `${widthPct}%`, height: barH, display: "block" }}>
        <rect x={0} y={0} width={W} height={barH} fill={color} />
      </svg>
    );
  }

  // Pulse/soak — build cycle segments
  const cycles = Math.max(1, Math.floor(zone.dur / zone.pulseMin));
  const totalTime = cycles * zone.pulseMin + Math.max(0, cycles - 1) * zone.soakMin;
  const segments: { x: number; w: number; type: "water" | "soak" }[] = [];
  let cursor = 0;
  for (let c = 0; c < cycles; c++) {
    const pulseW = (zone.pulseMin / totalTime) * W;
    segments.push({ x: cursor, w: pulseW, type: "water" });
    cursor += pulseW;
    if (c < cycles - 1) {
      const soakW = (zone.soakMin / totalTime) * W;
      segments.push({ x: cursor, w: soakW, type: "soak" });
      cursor += soakW;
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${barH}`} preserveAspectRatio="none"
      style={{ width: `${widthPct}%`, height: barH, display: "block" }}
      title={`${zone.name}: ${zone.dur} min · ${cycles}× ${zone.pulseMin}m on / ${zone.soakMin}m soak`}>
      {segments.map((seg, i) =>
        seg.type === "water" ? (
          <rect key={i} x={seg.x} y={0} width={seg.w} height={barH} fill={color} />
        ) : (
          // Soak gap — dark with subtle hatching
          <g key={i}>
            <rect x={seg.x} y={0} width={seg.w} height={barH} fill="#0f172a" />
            <rect x={seg.x} y={barH * 0.35} width={seg.w} height={barH * 0.3} fill={color} opacity={0.18} />
          </g>
        )
      )}
      {/* Tick marks at cycle boundaries */}
      {segments.filter(s => s.type === "water").map((seg, i) => (
        i > 0 ? <line key={i} x1={seg.x} y1={0} x2={seg.x} y2={barH} stroke="#1e293b" strokeWidth={0.8} /> : null
      ))}
    </svg>
  );
}

function parseTimeMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function fmtTime(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}


type ZoneInfo = { name: string; dur: number; pulse: boolean; pulseMin: number; soakMin: number };
type RunInfo  = { time: string; zones: ZoneInfo[] };

function zoneTotalMin(z: ZoneInfo) {
  if (!z.pulse) return z.dur;
  const cycles = Math.max(1, Math.floor(z.dur / z.pulseMin));
  return z.dur + Math.max(0, cycles - 1) * z.soakMin;
}

function TwoWeekPreview({ scheduleDays, startTimes }: { scheduleDays: boolean[]; startTimes: any[] }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // zoom/pan state for the canvas
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<SVGSVGElement>(null);

  const resetView = useCallback(() => { setScale(1); setPan({ x: 0, y: 0 }); }, []);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setScale(prev => {
      const next = Math.min(12, Math.max(0.5, prev * delta));
      // zoom toward the cursor: adjust pan so the point under the cursor stays fixed
      setPan(p => ({
        x: mx - (mx - p.x) * (next / prev),
        y: my - (my - p.y) * (next / prev),
      }));
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = "grabbing";
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const stopPan = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    isPanning.current = false;
    e.currentTarget.style.cursor = "grab";
  }, []);
  const allZoneNames = Array.from(
    new Set(
      (startTimes ?? [])
        .filter((st) => st.enabled)
        .flatMap((st) => (st.sets ?? []).map((s: any) => s.name ?? "Zone"))
    )
  );

  // Build ordered list of runs for a watering day
  const wateringRuns: RunInfo[] =
    (startTimes ?? [])
      .filter((st) => st.enabled)
      .map((st) => ({
        time: st.time ?? "00:00",
        zones: (st.sets ?? []).map((s: any) => ({
          name: s.name ?? "Zone",
          dur: s.duration_minutes ?? 0,
          pulse: (s.mode ?? "normal") === "pulse_soak",
          pulseMin: s.pulse_minutes ?? 5,
          soakMin: s.soak_minutes ?? 10,
        })),
      }));

  const totalWaterMin = wateringRuns.reduce(
    (a, run) => a + run.zones.reduce((b, z) => b + z.dur, 0),
    0
  );

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold flex items-center gap-2">
        <Droplets className="w-4 h-4 text-brand-400" /> 14-Day Schedule Overview
      </h2>

      {/* Legend */}
      {allZoneNames.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {allZoneNames.map((name, idx) => (
            <div key={name} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: zoneHex(name, idx) }} />
              {name}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-2">
            <span className="inline-block w-3 h-3 rounded-full bg-gray-800 border border-gray-700" />
            Rest day
          </div>
          {wateringRuns.some(r => r.zones.some(z => z.pulse)) && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-1">
              <svg viewBox="0 0 28 8" width={28} height={8}>
                <rect x={0}  y={0} width={10} height={8} fill="#10b981" />
                <rect x={10} y={0} width={8}  height={8} fill="#0f172a" />
                <rect x={10} y={2.5} width={8} height={3} fill="#10b981" opacity={0.2} />
                <rect x={18} y={0} width={10} height={8} fill="#10b981" />
              </svg>
              Pulse / Soak
            </div>
          )}
        </div>
      )}

      {/* Two-week grid: 14 columns */}
      <div className="grid grid-cols-7 gap-2">
        {(scheduleDays ?? []).map((isWatering: boolean, i: number) => (
          <button
            key={i}
            onClick={() => setSelectedDay(selectedDay === i ? null : i)}
            className={[
              "rounded-lg overflow-hidden border text-left transition-all duration-150 w-full",
              isWatering ? "border-brand-700/60 hover:border-brand-400" : "border-gray-800 hover:border-gray-600",
              selectedDay === i ? "ring-2 ring-brand-500 ring-offset-1 ring-offset-gray-900" : "",
            ].join(" ")}
          >
            <div className={`text-center text-xs font-semibold py-1 ${
              isWatering ? "bg-brand-900/60 text-brand-300" : "bg-gray-800/60 text-gray-600"
            }`}>
              Day {i + 1}
            </div>
            {isWatering ? (
              <div className="p-1.5 space-y-1.5">
                {wateringRuns.length === 0 ? (
                  <p className="text-[10px] text-gray-600 text-center py-1">No times</p>
                ) : (
                  wateringRuns.map((run, ri) => {
                    const total = run.zones.reduce((a, z) => a + z.dur, 0);
                    return (
                      <div key={ri}>
                        <div className="text-[10px] text-gray-500 mb-0.5 text-center">
                          {fmtTime(parseTimeMinutes(run.time))}
                        </div>
                        <div className="flex rounded overflow-hidden w-full" style={{ height: 10 }}>
                          {run.zones.map((z, zi) => (
                            <ZoneBar key={zi} zone={z}
                              widthPct={total > 0 ? (z.dur / total) * 100 : 100 / run.zones.length}
                              zoneIdx={zi} barH={10} />
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
                {totalWaterMin > 0 && (
                  <div className="text-[10px] text-center text-brand-400 font-medium pt-0.5">{totalWaterMin}m</div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-4 text-gray-700 text-xs">—</div>
            )}
          </button>
        ))}
      </div>

      {/* ── Day detail modal ── */}
      {selectedDay !== null && (() => {
        const isWateringDay = !!(scheduleDays ?? [])[selectedDay];

        // Build all run data up front for the canvas
        type ZSeg = { type: "water" | "soak"; durMin: number };
        type RunData = {
          runStartMin: number; runEndMin: number; totalRunMin: number;
          zones: {
            name: string; color: string; zTotal: number; zStartMin: number; zEndMin: number;
            segs: ZSeg[]; pulse: boolean; cycles: number; pulseMin: number; soakMin: number; dur: number; soakTotal: number;
          }[];
          timeline: { zone: string; zi: number; type: "water" | "soak"; durMin: number }[];
        };
        const runDataList: RunData[] = wateringRuns.map(run => {
          const runStartMin = parseTimeMinutes(run.time);
          const timeline: RunData["timeline"] = [];
          run.zones.forEach((z, zi) => {
            if (!z.pulse) { timeline.push({ zone: z.name, zi, type: "water", durMin: z.dur }); }
            else {
              const c = Math.max(1, Math.floor(z.dur / z.pulseMin));
              for (let i = 0; i < c; i++) {
                timeline.push({ zone: z.name, zi, type: "water", durMin: z.pulseMin });
                if (i < c - 1) timeline.push({ zone: z.name, zi, type: "soak", durMin: z.soakMin });
              }
            }
          });
          const totalRunMin = timeline.reduce((a, s) => a + s.durMin, 0);
          const zones = run.zones.map((z, zi) => {
            const color = zoneHex(z.name, zi);
            const cycles = z.pulse ? Math.max(1, Math.floor(z.dur / z.pulseMin)) : 1;
            const soakTotal = z.pulse ? Math.max(0, cycles - 1) * z.soakMin : 0;
            const zTotal = z.dur + soakTotal;
            const zOffsetMin = run.zones.slice(0, zi).reduce((a, zz) => a + zoneTotalMin(zz), 0);
            const segs: ZSeg[] = [];
            if (!z.pulse) { segs.push({ type: "water", durMin: z.dur }); }
            else {
              for (let c = 0; c < cycles; c++) {
                segs.push({ type: "water", durMin: z.pulseMin });
                if (c < cycles - 1) segs.push({ type: "soak", durMin: z.soakMin });
              }
            }
            return { name: z.name, color, zTotal, zStartMin: runStartMin + zOffsetMin, zEndMin: runStartMin + zOffsetMin + zTotal, segs, pulse: z.pulse, cycles, pulseMin: z.pulseMin, soakMin: z.soakMin, dur: z.dur, soakTotal };
          });
          return { runStartMin, runEndMin: runStartMin + totalRunMin, totalRunMin, zones, timeline };
        });

        // Canvas layout constants (in SVG coords at scale=1)
        const MARGIN_LEFT = 140; // left gutter for zone name labels
        const BAR_H = 40;
        const BAR_GAP = 14;
        const COMBO_H = 20;
        const RUN_GAP = 32;
        const HEADER_H = 28;
        const BAR_W = 700; // full bar width at scale=1

        // Compute total canvas height
        let canvasH = 16;
        runDataList.forEach(rd => {
          canvasH += HEADER_H + 8;
          rd.zones.forEach(() => { canvasH += BAR_H + BAR_GAP; });
          if (rd.zones.length > 1) canvasH += 8 + COMBO_H + 16;
          canvasH += RUN_GAP;
        });
        const canvasW = MARGIN_LEFT + BAR_W + 20;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => { setSelectedDay(null); resetView(); }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden border border-gray-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`flex items-center gap-3 px-5 py-3 border-b flex-shrink-0 ${
                isWateringDay ? "bg-brand-950/90 border-brand-800/50" : "bg-gray-800/90 border-gray-700"
              }`}>
                <span className="text-base font-bold text-gray-100">Day {selectedDay + 1}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  isWateringDay ? "bg-brand-800 text-brand-300" : "bg-gray-700 text-gray-400"
                }`}>
                  {isWateringDay ? "Watering Day" : "Rest Day"}
                </span>
                {isWateringDay && (
                  <span className="ml-auto text-[11px] text-gray-500 flex items-center gap-2">
                    <span>🖱 scroll to zoom · drag to pan</span>
                    {(scale !== 1 || pan.x !== 0 || pan.y !== 0) && (
                      <button onClick={resetView}
                        className="text-gray-400 hover:text-gray-200 border border-gray-700 rounded px-2 py-0.5 text-[10px]">
                        reset view
                      </button>
                    )}
                  </span>
                )}
                <button
                  onClick={() => { setSelectedDay(null); resetView(); }}
                  className="text-gray-500 hover:text-gray-200 hover:bg-gray-700 rounded-lg w-8 h-8 flex items-center justify-center text-lg transition-colors ml-2"
                >✕</button>
              </div>

              {/* Canvas body */}
              {isWateringDay ? (
                <svg
                  ref={canvasRef}
                  className="w-full flex-1 bg-gray-950 select-none"
                  style={{ cursor: "grab", minHeight: 200 }}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={stopPan}
                  onMouseLeave={stopPan}
                >
                  <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
                    {/* Background */}
                    <rect x={0} y={0} width={canvasW} height={canvasH} fill="#030712" rx={4} />

                    {(() => {
                      const els: React.ReactNode[] = [];
                      let cy = 16;

                      runDataList.forEach((rd, ri) => {
                        // Run time header
                        els.push(
                          <g key={`rh-${ri}`}>
                            <text x={12} y={cy + 18} fontSize={13} fill="#38bdf8" fontWeight="700">
                              {fmtTime(rd.runStartMin)}
                            </text>
                            <text x={75} y={cy + 18} fontSize={11} fill="#4b5563">
                              → {fmtTime(rd.runEndMin)} · {rd.totalRunMin} min
                            </text>
                          </g>
                        );
                        cy += HEADER_H + 8;

                        // Zone bars
                        rd.zones.forEach((z, zi) => {
                          const barX = MARGIN_LEFT;

                          // Zone name label (left gutter)
                          els.push(
                            <g key={`zl-${ri}-${zi}`}>
                              <circle cx={12} cy={cy + BAR_H / 2} r={5} fill={z.color} />
                              <text x={22} y={cy + BAR_H / 2 + 4} fontSize={11} fill="#d1d5db" fontWeight="600">
                                {z.name}
                              </text>
                              {z.pulse && (
                                <text x={22} y={cy + BAR_H / 2 + 16} fontSize={9} fill="#22d3ee">
                                  ⚡ {z.cycles}× {z.pulseMin}m/{z.soakMin}m
                                </text>
                              )}
                            </g>
                          );

                          // SVG bar segments
                          let bx = barX;
                          z.segs.forEach((seg, si) => {
                            const sw = z.zTotal > 0 ? (seg.durMin / z.zTotal) * BAR_W : 0;
                            const mx2 = bx + sw / 2;
                            if (seg.type === "water") {
                              els.push(
                                <g key={`seg-${ri}-${zi}-${si}`}>
                                  <rect x={bx} y={cy} width={sw} height={BAR_H} fill={z.color} rx={si === 0 ? 4 : 0} />
                                  <rect x={bx} y={cy} width={sw} height={10} fill="white" opacity={0.07} />
                                  <text x={mx2} y={cy + 17} textAnchor="middle" fontSize={11} fill="white" fontWeight="800" opacity={0.9}>
                                    {seg.durMin} min
                                  </text>
                                  {sw > 55 && (
                                    <text x={mx2} y={cy + 30} textAnchor="middle" fontSize={9} fill="white" opacity={0.45}>
                                      water on
                                    </text>
                                  )}
                                  {si > 0 && <line x1={bx} y1={cy + 3} x2={bx} y2={cy + BAR_H - 3} stroke="#1e293b" strokeWidth={1} />}
                                </g>
                              );
                            } else {
                              els.push(
                                <g key={`seg-${ri}-${zi}-${si}`}>
                                  <rect x={bx} y={cy} width={sw} height={BAR_H} fill="#0b1622" />
                                  <rect x={bx} y={cy + BAR_H * 0.35} width={sw} height={BAR_H * 0.3} fill={z.color} opacity={0.18} />
                                  <line x1={bx}      y1={cy + 3} x2={bx}      y2={cy + BAR_H - 3} stroke="#2a4a6a" strokeWidth={1} strokeDasharray="2 2" />
                                  <line x1={bx + sw} y1={cy + 3} x2={bx + sw} y2={cy + BAR_H - 3} stroke="#2a4a6a" strokeWidth={1} strokeDasharray="2 2" />
                                  <text x={mx2} y={cy + 17} textAnchor="middle" fontSize={11} fill="#4a8aaa" fontWeight="700">
                                    {seg.durMin} min
                                  </text>
                                  {sw > 55 && (
                                    <text x={mx2} y={cy + 30} textAnchor="middle" fontSize={9} fill="#3a6080" fontWeight="600">
                                      soaking
                                    </text>
                                  )}
                                </g>
                              );
                            }
                            bx += sw;
                          });

                          // Bar outline
                          els.push(
                            <rect key={`bo-${ri}-${zi}`} x={barX} y={cy} width={BAR_W} height={BAR_H}
                              fill="none" stroke="#1e293b" strokeWidth={1} rx={4} />
                          );

                          // Time labels under bar
                          els.push(
                            <g key={`tl-${ri}-${zi}`}>
                              <text x={barX} y={cy + BAR_H + 11} fontSize={9} fill="#4b5563">{fmtTime(z.zStartMin)}</text>
                              <text x={barX + BAR_W} y={cy + BAR_H + 11} textAnchor="end" fontSize={9} fill="#4b5563">{fmtTime(z.zEndMin)}</text>
                            </g>
                          );

                          cy += BAR_H + BAR_GAP;
                        });

                        // Combined timeline
                        if (rd.zones.length > 1) {
                          cy += 8;
                          els.push(
                            <text key={`ctl-${ri}`} x={MARGIN_LEFT} y={cy - 2} fontSize={9} fill="#374151" fontWeight="600">
                              COMBINED
                            </text>
                          );
                          let tx = MARGIN_LEFT;
                          rd.timeline.forEach((seg, si) => {
                            const tw = rd.totalRunMin > 0 ? (seg.durMin / rd.totalRunMin) * BAR_W : 0;
                            const col = zoneHex(seg.zone, seg.zi);
                            if (seg.type === "water") {
                              els.push(
                                <g key={`ct-${ri}-${si}`}>
                                  <rect x={tx} y={cy} width={tw} height={COMBO_H} fill={col} />
                                  {tw > 30 && <text x={tx + tw / 2} y={cy + 13} textAnchor="middle" fontSize={8} fill="white" opacity={0.8}>{seg.durMin}m</text>}
                                </g>
                              );
                            } else {
                              els.push(
                                <g key={`ct-${ri}-${si}`}>
                                  <rect x={tx} y={cy} width={tw} height={COMBO_H} fill="#0b1622" />
                                  <rect x={tx} y={cy + 7} width={tw} height={6} fill={col} opacity={0.2} />
                                  {tw > 30 && <text x={tx + tw / 2} y={cy + 13} textAnchor="middle" fontSize={8} fill="#3a6080">{seg.durMin}m</text>}
                                </g>
                              );
                            }
                            tx += tw;
                          });
                          els.push(
                            <g key={`ctlabels-${ri}`}>
                              <text x={MARGIN_LEFT} y={cy + COMBO_H + 11} fontSize={9} fill="#4b5563">{fmtTime(rd.runStartMin)}</text>
                              <text x={MARGIN_LEFT + BAR_W} y={cy + COMBO_H + 11} textAnchor="end" fontSize={9} fill="#4b5563">{fmtTime(rd.runEndMin)}</text>
                            </g>
                          );
                          cy += COMBO_H + 16;
                        }

                        cy += RUN_GAP;
                        if (ri < runDataList.length - 1) {
                          els.push(
                            <line key={`sep-${ri}`} x1={8} y1={cy - RUN_GAP / 2} x2={canvasW - 8} y2={cy - RUN_GAP / 2}
                              stroke="#1f2937" strokeWidth={1} />
                          );
                        }
                      });

                      return els;
                    })()}
                  </g>
                </svg>
              ) : (
                <div className="p-8 text-center bg-gray-950">
                  <div className="text-3xl mb-2">💤</div>
                  <div className="text-sm text-gray-500">Rest day — no watering scheduled</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Summary row */}
      {wateringRuns.length > 0 && (
        <div className="border-t border-gray-800 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-400">
          <div>
            <div className="text-gray-600 mb-0.5">Watering days</div>
            <div className="font-semibold text-white">{(scheduleDays ?? []).filter(Boolean).length} / 14</div>
          </div>
          <div>
            <div className="text-gray-600 mb-0.5">Runs per day</div>
            <div className="font-semibold text-white">{wateringRuns.length}</div>
          </div>
          <div>
            <div className="text-gray-600 mb-0.5">Min per run</div>
            <div className="font-semibold text-white">{totalWaterMin} min</div>
          </div>
          <div>
            <div className="text-gray-600 mb-0.5">Zones</div>
            <div className="font-semibold text-white">{allZoneNames.length}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Schedule() {
  const qc = useQueryClient();
  const { data: schedule, isLoading } = useQuery({ queryKey: ["schedule"], queryFn: getSchedule });
  const [local, setLocal] = useState<any>(null);
  const current = local ?? schedule;

  const saveMutation = useMutation({
    mutationFn: (s: any) => updateSchedule(s),
    onSuccess: () => { setLocal(null); qc.invalidateQueries({ queryKey: ["schedule"] }); },
  });

  if (isLoading) return <div className="text-gray-400">Loading schedule…</div>;
  if (!current) return <div className="text-gray-400">No schedule found.</div>;

  const setField = (path: (string | number)[], value: unknown) => {
    const copy = JSON.parse(JSON.stringify(current));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let obj: any = copy;
    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    obj[path[path.length - 1]] = value;
    setLocal(copy);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Schedule</h1>
        {local && (
          <button
            className="btn-primary"
            onClick={() => saveMutation.mutate(local)}
            disabled={saveMutation.isPending}
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        )}
      </div>

      {/* 14-day rotation grid */}
      <div className="card">
        <h2 className="font-semibold mb-3">14-Day Rotation</h2>
        <div className="grid grid-cols-7 gap-2">
          {(current.schedule_days ?? []).map((on: boolean, i: number) => (
            <button
              key={i}
              onClick={() => {
                const days = [...(current.schedule_days ?? [])];
                days[i] = !on;
                setField(["schedule_days"], days);
              }}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                on ? "bg-brand-700 text-white" : "bg-gray-800 text-gray-500"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Green = watering day. Tap to toggle.
        </p>
      </div>

      {/* Start times */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Start Times</h2>
          <button
            className="btn-ghost text-sm"
            onClick={() => {
              const st = [...(current.start_times ?? [])];
              st.push({ time: "09:00", enabled: true, sets: [] });
              setField(["start_times"], st);
            }}
          >
            <Plus className="w-4 h-4" /> Add Time
          </button>
        </div>

        {(current.start_times ?? []).map((st: any, si: number) => (
          <div key={si} className="border border-gray-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-400" />
              <input
                type="time"
                value={st.time}
                onChange={(e) => setField(["start_times", si, "time"], e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={st.enabled}
                  onChange={(e) => setField(["start_times", si, "enabled"], e.target.checked)}
                  className="accent-brand-500"
                />
                Enabled
              </label>
              <button
                className="ml-auto text-gray-500 hover:text-red-400"
                onClick={() => {
                  const times = (current.start_times ?? []).filter((_: any, i: number) => i !== si);
                  setField(["start_times"], times);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Sets for this start time */}
            <div className="space-y-2 pl-7">
              {(st.sets ?? []).map((s: any, zi: number) => (
                <div key={zi} className="flex flex-wrap items-center gap-3 text-sm">
                  <input
                    value={s.name}
                    onChange={(e) => setField(["start_times", si, "sets", zi, "name"], e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-32"
                    placeholder="Zone name"
                  />
                  <input
                    type="number"
                    min={1} max={60}
                    value={s.duration_minutes}
                    onChange={(e) => setField(["start_times", si, "sets", zi, "duration_minutes"], +e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-16"
                  />
                  <span className="text-gray-500">min</span>
                  <select
                    value={s.mode ?? "normal"}
                    onChange={(e) => setField(["start_times", si, "sets", zi, "mode"], e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                  >
                    <option value="normal">Normal</option>
                    <option value="pulse_soak">Pulse/Soak</option>
                  </select>

                  {/* Pulse/soak time inputs — only shown when mode is pulse_soak */}
                  {(s.mode ?? "normal") === "pulse_soak" && (
                    <div className="flex items-center gap-2 bg-gray-800/60 border border-cyan-900/60 rounded-lg px-3 py-1.5">
                      <span className="text-cyan-500 text-xs font-bold">⚡</span>
                      <label className="text-xs text-gray-400">Pulse</label>
                      <input
                        type="number"
                        min={1} max={60}
                        step={0.5}
                        value={s.pulse_minutes ?? 5}
                        onChange={(e) => setField(["start_times", si, "sets", zi, "pulse_minutes"], +e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded px-2 py-0.5 w-14 text-sm text-cyan-300"
                      />
                      <span className="text-gray-500 text-xs">min</span>
                      <span className="text-gray-600 mx-1">|</span>
                      <label className="text-xs text-gray-400">Soak</label>
                      <input
                        type="number"
                        min={1} max={120}
                        step={1}
                        value={s.soak_minutes ?? 10}
                        onChange={(e) => setField(["start_times", si, "sets", zi, "soak_minutes"], +e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded px-2 py-0.5 w-14 text-sm text-cyan-300"
                      />
                      <span className="text-gray-500 text-xs">min</span>
                    </div>
                  )}

                  {/* Flow rate — for water usage estimation */}
                  <div className="flex items-center gap-1.5 bg-gray-800/40 border border-blue-900/40 rounded px-2 py-1">
                    <span className="text-blue-400 text-xs">💧</span>
                    <input
                      type="number"
                      min={0} max={100}
                      step={0.1}
                      value={s.flow_rate_lpm ?? ""}
                      onChange={(e) => setField(["start_times", si, "sets", zi, "flow_rate_lpm"], e.target.value === "" ? null : +e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 w-14 text-xs text-blue-300"
                      placeholder="—"
                    />
                    <span className="text-gray-500 text-xs">L/min</span>
                  </div>

                  {/* Soil moisture skip threshold */}
                  <div className="flex items-center gap-1.5 bg-gray-800/40 border border-amber-900/40 rounded px-2 py-1">
                    <span className="text-amber-400 text-xs">🌱</span>
                    <input
                      type="number"
                      min={0} max={100}
                      step={1}
                      value={s.soil_moisture_skip_threshold ?? ""}
                      onChange={(e) => setField(["start_times", si, "sets", zi, "soil_moisture_skip_threshold"], e.target.value === "" ? null : +e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 w-14 text-xs text-amber-300"
                      placeholder="—"
                    />
                    <span className="text-gray-500 text-xs">% skip</span>
                  </div>

                  <button
                    className="text-gray-500 hover:text-red-400"
                    onClick={() => {
                      const sets = (st.sets ?? []).filter((_: any, i: number) => i !== zi);
                      setField(["start_times", si, "sets"], sets);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                className="text-xs text-brand-500 hover:text-brand-400 flex items-center gap-1"
                onClick={() => {
                  const sets = [...(st.sets ?? [])];
                  sets.push({ name: "Garden", duration_minutes: 10, mode: "normal", pulse_minutes: 5, soak_minutes: 10, enabled: true });
                  setField(["start_times", si, "sets"], sets);
                }}
              >
                <Plus className="w-3 h-3" /> Add Zone
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 14-Day Schedule Overview */}
      <TwoWeekPreview scheduleDays={current.schedule_days ?? []} startTimes={current.start_times ?? []} />

      {/* Mist settings */}
      <div className="card space-y-3">
        <h2 className="font-semibold">Mist Settings</h2>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={current.mist_settings?.enabled ?? false}
            onChange={(e) => setField(["mist_settings", "enabled"], e.target.checked)}
            className="accent-brand-500"
          />
          Enable auto-misting
        </label>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <label className="text-gray-400 block mb-1">Trigger Temp (°F)</label>
            <input
              type="number"
              value={current.mist_settings?.trigger_temp_f ?? 95}
              onChange={(e) => setField(["mist_settings", "trigger_temp_f"], +e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="text-gray-400 block mb-1">Duration (sec)</label>
            <input
              type="number"
              value={current.mist_settings?.duration_seconds ?? 60}
              onChange={(e) => setField(["mist_settings", "duration_seconds"], +e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-full"
            />
          </div>
        </div>
      </div>

      {/* Rain skip settings */}
      <div className="card space-y-3">
        <h2 className="font-semibold">Rain Skip</h2>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={current.rain_skip?.enabled ?? false}
            onChange={(e) => setField(["rain_skip", "enabled"], e.target.checked)}
            className="accent-sky-500"
          />
          Skip watering when rain is forecast
        </label>
        <div className="text-sm">
          <label className="text-gray-400 block mb-1">Skip if precipitation probability ≥</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={10} max={100} step={5}
              value={current.rain_skip?.threshold_percent ?? 50}
              onChange={(e) => setField(["rain_skip", "threshold_percent"], +e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-24"
            />
            <span className="text-gray-500">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
