import { API_BASE } from "./config";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const getStatus = () => request<Record<string, unknown>>("/status");
export const getSchedule = () => request<Record<string, unknown>>("/schedule");
export const updateSchedule = (schedule: unknown) =>
  request("/schedule", { method: "PUT", body: JSON.stringify({ schedule }) });
export const getHistory = (limit = 50) => request<unknown[]>(`/history?limit=${limit}`);
export const getSensors = () => request<Record<string, unknown>>("/sensors/latest");
export const getSystemMetrics = () => request<Record<string, unknown>>("/system/metrics");

export const manualRun = (zone_name: string, duration_minutes: number) =>
  request(`/zones/${encodeURIComponent(zone_name)}/run`, {
    method: "POST",
    body: JSON.stringify({ set_name: zone_name, duration_minutes }),
  });

export const stopAll = () => request("/stop-all", { method: "POST" });
