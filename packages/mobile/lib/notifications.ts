import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === "granted";
  } catch {
    return false;
  }
}

export async function notifyRunComplete(zoneName: string, durationSeconds: number): Promise<void> {
  const m = Math.floor(durationSeconds / 60);
  const s = durationSeconds % 60;
  const dur = s > 0 ? `${m}m ${s}s` : `${m}m`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Watering Complete",
      body: `${zoneName} finished after ${dur}`,
      sound: true,
    },
    trigger: null,
  });
}

export async function notifyRunStopped(zoneName: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Watering Stopped",
      body: `${zoneName} was stopped`,
      sound: true,
    },
    trigger: null,
  });
}

export async function notifySensorOffline(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Sensor Pi Offline",
      body: "No sensor data received. Check your sensor connection.",
      sound: false,
    },
    trigger: null,
  });
}

export async function notifyRainSkip(zoneName: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Watering Skipped",
      body: `${zoneName} skipped due to rain forecast`,
      sound: false,
    },
    trigger: null,
  });
}
