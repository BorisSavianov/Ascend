export type NotificationId =
  | 'meal_1_reminder'
  | 'meal_2_reminder'
  | 'fast_start'
  | 'morning_weight';

export type NotificationConfig = {
  meal_1_reminder: { hour: number; minute: number; enabled: boolean };
  meal_2_reminder: { hour: number; minute: number; enabled: boolean };
  fast_start:      { hour: number; minute: number; enabled: boolean };
  morning_weight:  { hour: number; minute: number; enabled: boolean };
};

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  meal_1_reminder: { hour: 12, minute: 30, enabled: true },
  meal_2_reminder: { hour: 18, minute: 30, enabled: true },
  fast_start:      { hour: 20, minute: 30, enabled: true },
  morning_weight:  { hour: 8,  minute: 0,  enabled: true },
};

export const NOTIFICATION_MESSAGES: Record<NotificationId, { title: string; body: string }> = {
  meal_1_reminder: {
    title: 'Time to eat.',
    body:  'Break your fast. Log your first meal.',
  },
  meal_2_reminder: {
    title: 'Second meal window.',
    body:  "Don't skip logging.",
  },
  fast_start: {
    title: 'Eating window closed.',
    body:  'Start your fast.',
  },
  morning_weight: {
    title: 'Log your weight.',
    body:  'Before eating. Takes 10 seconds.',
  },
};
