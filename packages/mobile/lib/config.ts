// Central config for the mobile app.
// PI_HOST/PI_PORT can be overridden via AsyncStorage (set in Settings tab).
import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEFAULT_PI_HOST = "raspberrypi.local";
export const DEFAULT_PI_PORT = 8000;

// Initial values — may be overridden at runtime by loadConfig()
export let PI_HOST = DEFAULT_PI_HOST;
export let PI_PORT = DEFAULT_PI_PORT;
export let API_BASE = `http://${PI_HOST}:${PI_PORT}/api`;
export let WS_URL = `ws://${PI_HOST}:${PI_PORT}/ws`;

export async function loadConfig(): Promise<void> {
  try {
    const [host, port] = await Promise.all([
      AsyncStorage.getItem("pi_host"),
      AsyncStorage.getItem("pi_port"),
    ]);
    PI_HOST = host ?? DEFAULT_PI_HOST;
    PI_PORT = port ? parseInt(port, 10) : DEFAULT_PI_PORT;
    API_BASE = `http://${PI_HOST}:${PI_PORT}/api`;
    WS_URL = `ws://${PI_HOST}:${PI_PORT}/ws`;
  } catch {
    // keep defaults
  }
}

export async function saveConfig(host: string, port: number, token: string): Promise<void> {
  await AsyncStorage.multiSet([
    ["pi_host", host],
    ["pi_port", String(port)],
    ["api_token", token],
  ]);
  PI_HOST = host;
  PI_PORT = port;
  API_BASE = `http://${PI_HOST}:${PI_PORT}/api`;
  WS_URL = `ws://${PI_HOST}:${PI_PORT}/ws`;
}

export async function loadToken(): Promise<string> {
  try {
    return (await AsyncStorage.getItem("api_token")) ?? "";
  } catch {
    return "";
  }
}

export async function saveNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem("notifications_enabled", enabled ? "1" : "0");
}

export async function loadNotificationsEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem("notifications_enabled")) !== "0";
  } catch {
    return true;
  }
}
