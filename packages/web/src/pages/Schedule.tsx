import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSchedule, updateSchedule } from "@/lib/api";
import { useState } from "react";
import { Plus, Trash2, Save, Clock } from "lucide-react";

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
                <div key={zi} className="flex items-center gap-3 text-sm">
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
                  sets.push({ name: "Garden", duration_minutes: 10, mode: "normal", enabled: true });
                  setField(["start_times", si, "sets"], sets);
                }}
              >
                <Plus className="w-3 h-3" /> Add Zone
              </button>
            </div>
          </div>
        ))}
      </div>

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
    </div>
  );
}
