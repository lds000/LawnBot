import { API_BASE } from "./config";

let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (_authToken) h["Authorization"] = `Bearer ${_authToken}`;
  return h;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(),
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
export const clearHistory = () => request("/history", { method: "DELETE" });
export const getSensors = () => request<Record<string, unknown>>("/sensors/latest");
export const getSensorHistory = (topic: "environment" | "flow" | "plant", limit = 60) =>
  request<Record<string, unknown>[]>(`/sensors/history/${topic}?limit=${limit}`);
export const getSystemMetrics = () => request<Record<string, unknown>>("/system/metrics");

export const manualRun = (zone_name: string, duration_minutes: number) =>
  request(`/zones/${encodeURIComponent(zone_name)}/run`, {
    method: "POST",
    body: JSON.stringify({ set_name: zone_name, duration_minutes }),
  });

export const stopAll = () => request("/stop-all", { method: "POST" });

export const triggerMist = () => request("/mist/trigger", { method: "POST" });
export const stopMist = () => request("/mist/stop", { method: "POST" });

export const getLocation = () => request<{ latitude: number; longitude: number; timezone: string }>("/config/location");
export const updateLocation = (location: { latitude: number; longitude: number; timezone: string }) =>
  request("/config/location", { method: "PUT", body: JSON.stringify({ location }) });

// Open-Meteo forecast — uses lat/lon from API config
export async function getWeatherForecast() {
  let lat = 43.615;
  let lon = -116.202;
  let tz = "America%2FDenver";
  try {
    const loc = await getLocation();
    lat = loc.latitude;
    lon = loc.longitude;
    tz = encodeURIComponent(loc.timezone);
  } catch {
    // fall back to defaults
  }
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation" +
    "&hourly=temperature_2m,weather_code,precipitation_probability" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset" +
    `&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch` +
    `&timezone=${tz}&forecast_days=3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("forecast fetch failed");
  return res.json();
}
