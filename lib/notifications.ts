import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';
import {
  DEFAULT_CUSTOM_REMINDERS,
  DEFAULT_NOTIFICATION_CONFIG,
  ENCOURAGEMENT_MESSAGES,
  NOTIFICATION_MESSAGES,
  type CustomReminder,
  type NotificationConfig,
  type NotificationId,
} from '../constants/notifications';
import { supabase } from './supabase';

const NOTIFICATION_CONFIG_KEY = '@notification_config';
const CUSTOM_REMINDERS_KEY = '@custom_reminders';
const DAILY_PLAN_KEY = '@notification_daily_plan';
const MAX_NOTIFICATIONS_PER_DAY = 3;
const JITTER_MINUTES = 90;
const FAST_NEAR_END_NOTIFICATION_ID = 'fast:near_end';
const DAILY_SYSTEM_PREFIX = 'daily:system:';
const DAILY_CUSTOM_PREFIX = 'daily:custom:';

type DailyPlanEntry = {
  identifier: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
};

type StoredDailyPlan = {
  dayKey: string;
  entries: DailyPlanEntry[];
};

type ReminderSource =
  | { kind: 'system'; id: NotificationId; title: string; body: string; hour: number; minute: number; enabled: boolean }
  | { kind: 'custom'; id: string; title: string; body: string; hour: number; minute: number; enabled: boolean };

type ActiveFastReminderRow = {
  id: string;
  started_at: string;
  target_hours: number;
};

function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6D2B79F5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clampMinuteOfDay(value: number): number {
  return Math.max(0, Math.min(23 * 60 + 59, value));
}

function minutesToTime(totalMinutes: number): { hour: number; minute: number } {
  const safe = clampMinuteOfDay(totalMinutes);
  return { hour: Math.floor(safe / 60), minute: safe % 60 };
}

function jitterAround(hour: number, minute: number, rand: () => number): { hour: number; minute: number } {
  const base = hour * 60 + minute;
  const offset = Math.floor((rand() * (JITTER_MINUTES * 2 + 1)) - JITTER_MINUTES);
  return minutesToTime(base + offset);
}

function encouragementBody(rand: () => number): string {
  return ENCOURAGEMENT_MESSAGES[Math.floor(rand() * ENCOURAGEMENT_MESSAGES.length)];
}

function dailyIdentifier(source: ReminderSource): string {
  return source.kind === 'system'
    ? `${DAILY_SYSTEM_PREFIX}${source.id}`
    : `${DAILY_CUSTOM_PREFIX}${source.id}`;
}

function isDailyIdentifier(identifier: string, customReminders: CustomReminder[]): boolean {
  if (identifier.startsWith(DAILY_SYSTEM_PREFIX) || identifier.startsWith(DAILY_CUSTOM_PREFIX)) {
    return true;
  }

  if ((Object.keys(DEFAULT_NOTIFICATION_CONFIG) as NotificationId[]).includes(identifier as NotificationId)) {
    return true;
  }

  return customReminders.some((reminder) => reminder.id === identifier);
}

function getFastReminderLeadMs(targetHours: number): number {
  if (targetHours <= 2) return 30 * 60 * 1000;

  const leadHours = Math.max(1, Math.round(targetHours / 6));
  const leadMs = leadHours * 60 * 60 * 1000;
  const maxLeadMs = Math.max((targetHours * 60 - 30) * 60 * 1000, 15 * 60 * 1000);
  return Math.min(leadMs, maxLeadMs);
}

function buildFastReminderContent(targetHours: number): { title: string; body: string } {
  const leadMs = getFastReminderLeadMs(targetHours);
  const leadHours = Math.round(leadMs / 3_600_000);
  const remainingLabel =
    leadMs < 3_600_000
      ? 'less than 1 hour'
      : `${leadHours} hour${leadHours === 1 ? '' : 's'}`;

  return {
    title: `Let's go, no excuses!`,
    body: `You are in the last ${remainingLabel} of your ${targetHours}h fast.`,
  };
}

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
    const raw = await AsyncStorage.getItem(NOTIFICATION_CONFIG_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_CONFIG;
    return JSON.parse(raw) as NotificationConfig;
  } catch {
    return DEFAULT_NOTIFICATION_CONFIG;
  }
}

export async function saveNotificationConfig(config: NotificationConfig): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_CONFIG_KEY, JSON.stringify(config));
}

export async function getStoredCustomReminders(): Promise<CustomReminder[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_REMINDERS_KEY);
    if (!raw) return DEFAULT_CUSTOM_REMINDERS;
    return JSON.parse(raw) as CustomReminder[];
  } catch {
    return DEFAULT_CUSTOM_REMINDERS;
  }
}

export async function saveCustomReminders(reminders: CustomReminder[]): Promise<void> {
  await AsyncStorage.setItem(CUSTOM_REMINDERS_KEY, JSON.stringify(reminders));
}

// ── Scheduling ────────────────────────────────────────────────────────────────

function buildReminderSources(
  config: NotificationConfig,
  customReminders: CustomReminder[],
): ReminderSource[] {
  const systemSources: ReminderSource[] = (Object.keys(config) as NotificationId[]).map((id) => ({
    kind: 'system' as const,
    id,
    ...NOTIFICATION_MESSAGES[id],
    ...config[id],
  }));

  const customSources: ReminderSource[] = customReminders.map((reminder) => ({
    kind: 'custom' as const,
    id: reminder.id,
    title: reminder.title.trim() || 'Custom reminder',
    body: reminder.body.trim() || reminder.title.trim() || 'Reminder',
    hour: reminder.hour,
    minute: reminder.minute,
    enabled: reminder.enabled,
  }));

  return [...systemSources, ...customSources].filter((entry) => entry.enabled);
}

function buildDailyPlan(
  config: NotificationConfig,
  customReminders: CustomReminder[],
  dayKey: string,
): StoredDailyPlan {
  const rand = seededRandom(dayKey);
  const enabled = buildReminderSources(config, customReminders);
  const selected = shuffle(enabled, rand).slice(0, MAX_NOTIFICATIONS_PER_DAY);

  return {
    dayKey,
    entries: selected.map((source) => {
      const { hour, minute } = jitterAround(source.hour, source.minute, rand);
      const body =
        source.kind === 'system' && source.id === 'encouragement_reminder'
          ? encouragementBody(rand)
          : source.body;

      return {
        identifier: dailyIdentifier(source),
        title: source.title,
        body,
        hour,
        minute,
      };
    }),
  };
}

async function getStoredDailyPlan(): Promise<StoredDailyPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_PLAN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredDailyPlan;
  } catch {
    return null;
  }
}

async function saveDailyPlan(plan: StoredDailyPlan): Promise<void> {
  await AsyncStorage.setItem(DAILY_PLAN_KEY, JSON.stringify(plan));
}

async function cancelDailyReminders(customReminders: CustomReminder[]): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const cancellations = scheduled
    .filter((entry) => isDailyIdentifier(entry.identifier, customReminders))
    .map((entry) => Notifications.cancelScheduledNotificationAsync(entry.identifier));

  await Promise.all(cancellations);
}

export async function scheduleAllReminders(
  config: NotificationConfig,
  customReminders: CustomReminder[] = DEFAULT_CUSTOM_REMINDERS,
): Promise<void> {
  const dayKey = todayKey();
  const plan = buildDailyPlan(config, customReminders, dayKey);

  await cancelDailyReminders(customReminders);

  for (const entry of plan.entries) {
    await Notifications.scheduleNotificationAsync({
      identifier: entry.identifier,
      content: {
        title: entry.title,
        body: entry.body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: entry.hour,
        minute: entry.minute,
      },
    });
  }

  await saveDailyPlan(plan);
}

export async function ensureDailyRemindersScheduled(
  config: NotificationConfig,
  customReminders: CustomReminder[] = DEFAULT_CUSTOM_REMINDERS,
): Promise<void> {
  const dayKey = todayKey();
  const storedPlan = await getStoredDailyPlan();
  if (storedPlan?.dayKey === dayKey) return;
  await scheduleAllReminders(config, customReminders);
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledReminders(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

export async function cancelFastNearEndReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(FAST_NEAR_END_NOTIFICATION_ID);
  } catch {
    // Ignore missing identifier
  }
}

export async function scheduleFastNearEndReminder(
  startedAt: string | Date,
  targetHours: number,
  enabled: boolean,
): Promise<void> {
  await cancelFastNearEndReminder();
  if (!enabled) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const startedAtDate = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  const triggerAt = new Date(
    startedAtDate.getTime() + targetHours * 3_600_000 - getFastReminderLeadMs(targetHours),
  );

  if (triggerAt.getTime() <= Date.now()) return;

  const { title, body } = buildFastReminderContent(targetHours);

  await Notifications.scheduleNotificationAsync({
    identifier: FAST_NEAR_END_NOTIFICATION_ID,
    content: {
      title,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerAt,
    },
  });
}

async function getActiveFastReminderRow(): Promise<ActiveFastReminderRow | null> {
  const { data, error } = await supabase
    .from('fasting_logs')
    .select('id, started_at, target_hours')
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1);

  if (error) {
    logger.warn('Active fast reminder lookup failed:', error.message);
    return null;
  }

  const list = (data ?? []) as ActiveFastReminderRow[];
  return list.length > 0 ? list[0] : null;
}

export async function ensureFastNearEndReminderScheduled(enabled: boolean): Promise<void> {
  if (!enabled) {
    await cancelFastNearEndReminder();
    return;
  }

  const activeFast = await getActiveFastReminderRow();
  if (!activeFast) {
    await cancelFastNearEndReminder();
    return;
  }

  await scheduleFastNearEndReminder(
    activeFast.started_at,
    activeFast.target_hours,
    true,
  );
}
