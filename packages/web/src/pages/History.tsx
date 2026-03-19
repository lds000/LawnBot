import { useQuery } from "@tanstack/react-query";
import { getHistory } from "@/lib/api";
import { formatDateTime, formatDuration } from "@/lib/utils";
import { CheckCircle2, XCircle, User, Clock, Droplets, Timer, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell,
} from "recharts";

const ZONE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#a78bfa", "#f97316", "#34d399", "#e879f9", "#38bdf8"];

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="card flex items-center gap-4 py-4">
      <div className="rounded-lg p-2" style={{ backgroundColor: `${color}22` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

function buildDailyData(history: any[]) {
  const map = new Map<string, number>();
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toLocaleDateString([], { month: "short", day: "numeric" });
    map.set(key, 0);
  }
  for (const h of history) {
    const d = new Date(h.start_time);
    const key = d.toLocaleDateString([], { month: "short", day: "numeric" });
    if (map.has(key)) {
      map.set(key, (map.get(key) ?? 0) + (h.duration_seconds ?? 0));
    }
  }
  return Array.from(map.entries()).map(([date, seconds]) => ({ date, minutes: +(seconds / 60).toFixed(1) }));
}

function buildZoneData(history: any[]) {
  const map = new Map<string, number>();
  for (const h of history) {
    const name = h.set_name ?? "Unknown";
    map.set(name, (map.get(name) ?? 0) + (h.duration_seconds ?? 0));
  }
  return Array.from(map.entries())
    .map(([zone, seconds]) => ({ zone, minutes: +(seconds / 60).toFixed(1) }))
    .sort((a, b) => b.minutes - a.minutes);
}

const tooltipStyle = {
  contentStyle: { backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 },
  labelStyle: { color: "#9ca3af" },
  itemStyle: { color: "#f9fafb" },
};

export function History() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: () => getHistory(100),
    refetchInterval: 10000,
  });

  const items = history as any[];

  const totalRuns = items.length;
  const totalSeconds = items.reduce((s, h) => s + (h.duration_seconds ?? 0), 0);
  const completed = items.filter((h) => h.completed).length;
  const completionRate = totalRuns > 0 ? Math.round((completed / totalRuns) * 100) : 0;

  const dailyData = buildDailyData(items);
  const zoneData = buildZoneData(items);

  if (isLoading) return <div className="text-gray-400">Loading history…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Watering History</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total Runs" value={String(totalRuns)} icon={BarChart3} color="#22c55e" />
        <StatCard label="Total Water Time" value={formatDuration(totalSeconds)} icon={Droplets} color="#3b82f6" />
        <StatCard label="Completion Rate" value={`${completionRate}%`} icon={Timer} color="#a78bfa" />
      </div>

      {/* Charts */}
      {totalRuns > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daily duration chart */}
          <div className="card">
            <h2 className="text-sm font-medium text-gray-400 mb-4">Daily Water Time (last 14 days)</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6b7280", fontSize: 9 }}
                  tickLine={false}
                  interval={1}
                />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} unit=" min" width={42} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${v} min`, "Duration"]} />
                <Bar dataKey="minutes" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-zone duration chart */}
          <div className="card">
            <h2 className="text-sm font-medium text-gray-400 mb-4">Total Time by Zone</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={zoneData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} unit=" min" />
                <YAxis dataKey="zone" type="category" tick={{ fill: "#d1d5db", fontSize: 11 }} tickLine={false} width={80} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${v} min`, "Duration"]} />
                <Bar dataKey="minutes" radius={[0, 3, 3, 0]}>
                  {zoneData.map((_, i) => (
                    <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* History table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
              <th className="text-left px-4 py-3">Zone</th>
              <th className="text-left px-4 py-3">Started</th>
              <th className="text-left px-4 py-3">Duration</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((h: any) => (
              <tr key={h.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 font-medium">{h.set_name}</td>
                <td className="px-4 py-3 text-gray-400">{formatDateTime(h.start_time)}</td>
                <td className="px-4 py-3 text-gray-400">
                  {h.duration_seconds ? formatDuration(h.duration_seconds) : "—"}
                </td>
                <td className="px-4 py-3">
                  {h.is_manual ? (
                    <span className="badge-blue"><User className="w-3 h-3 mr-1" />Manual</span>
                  ) : (
                    <span className="badge-gray"><Clock className="w-3 h-3 mr-1" />Scheduled</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {h.completed ? (
                    <span className="badge-green"><CheckCircle2 className="w-3 h-3 mr-1" />Done</span>
                  ) : (
                    <span className="badge-yellow"><XCircle className="w-3 h-3 mr-1" />Interrupted</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No watering history yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
