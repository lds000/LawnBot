import axios from "axios";

const BASE = "/api";

export const api = axios.create({ baseURL: BASE });

// Inject auth token if configured
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

export const getStatus = () => api.get("/status").then((r) => r.data);
export const getSchedule = () => api.get("/schedule").then((r) => r.data);
export const updateSchedule = (schedule: object) =>
  api.put("/schedule", { schedule }).then((r) => r.data);
export const getHistory = (limit = 50) =>
  api.get(`/history?limit=${limit}`).then((r) => r.data);
export const clearHistory = () => api.delete("/history").then((r) => r.data);
export const getZones = () => api.get("/zones").then((r) => r.data);
export const getSensorsLatest = () =>
  api.get("/sensors/latest").then((r) => r.data);
export const getSensorHistory = (type: string, limit = 60) =>
  api.get(`/sensors/history/${type}?limit=${limit}`).then((r) => r.data);
export const getSystemMetrics = () =>
  api.get("/system/metrics").then((r) => r.data);

export const manualRun = (zone_name: string, duration_minutes: number) =>
  api.post(`/zones/${encodeURIComponent(zone_name)}/run`, {
    set_name: zone_name,
    duration_minutes,
  }).then((r) => r.data);

export const stopAll = () => api.post("/stop-all").then((r) => r.data);

export const triggerMist = () => api.post("/mist/trigger").then((r) => r.data);
export const stopMist = () => api.post("/mist/stop").then((r) => r.data);

export const getLocation = () =>
  api.get("/config/location").then((r) => r.data);
export const updateLocation = (location: { latitude: number; longitude: number; timezone: string }) =>
  api.put("/config/location", { location }).then((r) => r.data);

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
