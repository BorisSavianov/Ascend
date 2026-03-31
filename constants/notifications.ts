export type NotificationId =
  | 'meal_1_reminder'
  | 'meal_2_reminder'
  | 'fast_start'
  | 'morning_weight'
  | 'encouragement_reminder';

export type NotificationConfig = {
  meal_1_reminder: { hour: number; minute: number; enabled: boolean };
  meal_2_reminder: { hour: number; minute: number; enabled: boolean };
  fast_start:      { hour: number; minute: number; enabled: boolean };
  morning_weight:  { hour: number; minute: number; enabled: boolean };
  encouragement_reminder: { hour: number; minute: number; enabled: boolean };
};

export type CustomReminder = {
  id: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  enabled: boolean;
  goal: string;
};

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  meal_1_reminder: { hour: 12, minute: 30, enabled: true },
  meal_2_reminder: { hour: 18, minute: 30, enabled: true },
  fast_start:      { hour: 20, minute: 30, enabled: true },
  morning_weight:  { hour: 8,  minute: 0,  enabled: true },
  encouragement_reminder: { hour: 15, minute: 0, enabled: true },
};

export const DEFAULT_CUSTOM_REMINDERS: CustomReminder[] = [];

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
  encouragement_reminder: {
    title: 'Keep going.',
    body:  'You are on track.',
  },
};

export const ENCOURAGEMENT_MESSAGES = [
  `Don't be a bitch, do the work.`,
  `Don't break your fast now. Stay hard`,
  'FOCUS. DISCIPLINE. RESULTS.',
  'Remember what you promised yourself.',
  'You will ascend. Do not stop now.',
] as const;
