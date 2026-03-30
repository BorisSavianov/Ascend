import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationConfig } from '../constants/notifications';
import {
  DEFAULT_NOTIFICATION_CONFIG,
  NOTIFICATION_MESSAGES,
} from '../constants/notifications';

const STORAGE_KEY = '@notification_config';

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Config storage ────────────────────────────────────────────────────────────

export async function getStoredNotificationConfig(): Promise<NotificationConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_CONFIG;
    return JSON.parse(raw) as NotificationConfig;
  } catch {
    return DEFAULT_NOTIFICATION_CONFIG;
  }
}

export async function saveNotificationConfig(
  config: NotificationConfig,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// ── Scheduling ────────────────────────────────────────────────────────────────

export async function scheduleAllReminders(
  config: NotificationConfig,
): Promise<void> {
  await cancelAllReminders();

  const entries = Object.entries(config) as [
    keyof NotificationConfig,
    NotificationConfig[keyof NotificationConfig],
  ][];

  for (const [id, value] of entries) {
    if (!value.enabled) continue;

    const message = NOTIFICATION_MESSAGES[id];

    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: message.title,
        body: message.body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: value.hour,
        minute: value.minute,
      },
    });
  }
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledReminders(): Promise<
  Notifications.NotificationRequest[]
> {
  return Notifications.getAllScheduledNotificationsAsync();
}
