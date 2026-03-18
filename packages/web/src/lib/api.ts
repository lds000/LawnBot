import axios from "axios";

const BASE = "/api";

export const api = axios.create({ baseURL: BASE });

export const getStatus = () => api.get("/status").then((r) => r.data);
export const getSchedule = () => api.get("/schedule").then((r) => r.data);
export const updateSchedule = (schedule: object) =>
  api.put("/schedule", { schedule }).then((r) => r.data);
export const getHistory = (limit = 50) =>
  api.get(`/history?limit=${limit}`).then((r) => r.data);
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
