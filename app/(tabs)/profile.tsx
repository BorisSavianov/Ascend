import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format, subDays } from 'date-fns';
import WeightSparkline from '../../components/WeightSparkline';
import FastingTimer from '../../components/FastingTimer';
import FastingHistoryRow from '../../components/FastingHistoryRow';
import { useBodyMetrics } from '../../hooks/useBodyMetrics';
import { useLogBodyMetrics } from '../../hooks/useLogBodyMetrics';
import { useActiveFast } from '../../hooks/useActiveFast';
import { useFastingHistory } from '../../hooks/useFastingHistory';
import { useStartFast } from '../../hooks/useStartFast';
import { useEndFast } from '../../hooks/useEndFast';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store/useAppStore';
import { auth } from '../../lib/supabase';
import {
  scheduleAllReminders,
  saveNotificationConfig,
  saveCustomReminders,
} from '../../lib/notifications';
import type { CustomReminder, NotificationConfig } from '../../constants/notifications';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { triggerExport } from '../../lib/gemini';
import Screen from '../../components/ui/Screen';
import AppHeader from '../../components/ui/AppHeader';
import Surface from '../../components/ui/Surface';
import TextField from '../../components/ui/TextField';
import Button from '../../components/ui/Button';
import ConfirmationSheet from '../../components/ui/ConfirmationSheet';
import { colors, spacing, typography } from '../../lib/theme';

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={typography.h3}>{title}</Text>
      {subtitle ? (
        <Text style={[typography.caption, { marginTop: spacing.xs }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export default function ProfileScreen() {
  return (
    <ErrorBoundary fallbackLabel="Failed to load profile">
      <ProfileScreenContent />
    </ErrorBoundary>
  );
}

function ProfileScreenContent() {
  const queryClient = useQueryClient();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  async function handleSignOut() {
    await auth.signOut();
    queryClient.clear();
  }

  return (
    <Screen scroll contentContainerStyle={{ paddingBottom: 132 }}>
      <AppHeader
        title="Profile"
        subtitle="Goals, fasting, reminders, and exports are grouped here with clearer hierarchy and calmer controls."
      />

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xl }}>
        <BodyMetricsSection />
        <FastingSection />
        <TargetsSection />
        <NotificationsSection />
        <ExportSection />
        <Surface>
          <SectionHeading
            title="Account"
            subtitle="Destructive actions are kept isolated from the rest of the settings."
          />
          <Button
            label="Sign out"
            onPress={() => setConfirmSignOut(true)}
            variant="destructive"
          />
        </Surface>
      </View>

      <ConfirmationSheet
        visible={confirmSignOut}
        title="Sign out of Ascend?"
        description="You’ll need a new magic link to re-enter this account."
        confirmLabel="Sign out"
        tone="danger"
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={() => {
          setConfirmSignOut(false);
          void handleSignOut();
        }}
      />
    </Screen>
  );
}

function BodyMetricsSection() {
  const [weightText, setWeightText] = useState('');
  const [fatText, setFatText] = useState('');
  const [validationError, setValidationError] = useState('');

  const { data: metrics } = useBodyMetrics();
  const logMutation = useLogBodyMetrics();

  const cutoff = format(subDays(new Date(), 13), 'yyyy-MM-dd');
  const sparklineData = metrics
    .filter((m) => m.weight_kg != null && m.recorded_at >= cutoff)
    .map((m) => ({ date: m.recorded_at, weight_kg: m.weight_kg! }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const firstWeight = sparklineData[0]?.weight_kg;
  const lastWeight = sparklineData[sparklineData.length - 1]?.weight_kg;

  function handleLog() {
    const weight = weightText.trim() ? parseFloat(weightText) : null;
    const fat = fatText.trim() ? parseFloat(fatText) : null;

    if (weight == null && fat == null) {
      setValidationError('Enter at least one value.');
      return;
    }

    setValidationError('');
    logMutation.mutate(
      { weight_kg: weight, body_fat_pct: fat },
      {
        onSuccess: () => {
          setWeightText('');
          setFatText('');
        },
        onError: (err) => {
          setValidationError(err.message);
        },
      },
    );
  }

  return (
    <Surface elevated>
      <SectionHeading
        title="Body metrics"
        subtitle="Log weight and body fat, then keep an eye on the short-term trend."
      />
      <View style={{ gap: spacing.md }}>
        <TextField
          label="Weight"
          value={weightText}
          onChangeText={setWeightText}
          placeholder="0.0"
          unit="kg"
          keyboardType="decimal-pad"
        />
        <TextField
          label="Body fat"
          value={fatText}
          onChangeText={setFatText}
          placeholder="0.0"
          unit="%"
          keyboardType="decimal-pad"
          error={validationError || null}
        />
        <Button
          label="Log metrics"
          onPress={handleLog}
          loading={logMutation.isPending}
        />
      </View>

      {sparklineData.length >= 2 ? (
        <View style={{ marginTop: spacing.xl }}>
          <WeightSparkline data={sparklineData} />
          {firstWeight != null && lastWeight != null ? (
            <Text style={[typography.caption, { textAlign: 'center', marginTop: spacing.sm }]}>
              {firstWeight.toFixed(1)} kg to {lastWeight.toFixed(1)} kg
            </Text>
          ) : null}
        </View>
      ) : null}
    </Surface>
  );
}

function FastingSection() {
  const { data: activeFast } = useActiveFast();
  const { data: history = [] } = useFastingHistory();
  const startFast = useStartFast();
  const endFast = useEndFast();
  const fastingTargetHours = useAppStore((s) => s.fastingTargetHours);
  const setFastingTargetHours = useAppStore((s) => s.setFastingTargetHours);
  const [targetText, setTargetText] = useState(String(fastingTargetHours));

  function handleTargetChange(text: string) {
    setTargetText(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 72) {
      setFastingTargetHours(parsed);
    }
  }

  return (
    <>
      <Surface elevated overlay>
        <SectionHeading
          title="Fasting"
          subtitle="A stronger focal point for your current fast, target, and progression."
        />
        <TextField
          label="Target"
          value={targetText}
          onChangeText={handleTargetChange}
          keyboardType="number-pad"
          unit="hours"
        />
        <View style={{ marginTop: spacing.lg }}>
          <FastingTimer
            activeFast={activeFast ?? null}
            targetHours={fastingTargetHours}
            onStart={() => startFast.mutate()}
            onEnd={() => {
              if (activeFast) endFast.mutate(activeFast.id);
            }}
            isStarting={startFast.isPending}
            isEnding={endFast.isPending}
          />
        </View>
      </Surface>

      {history.length > 0 ? (
        <Surface style={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <SectionHeading
              title="Recent fasting history"
              subtitle="Completed and interrupted fasts over your recent log."
            />
          </View>
          {history.map((fast) => (
            <FastingHistoryRow key={fast.id} fast={fast} />
          ))}
        </Surface>
      ) : null}
    </>
  );
}

function TargetsSection() {
  const calorieTarget = useAppStore((s) => s.calorieTarget);
  const macroTargets = useAppStore((s) => s.macroTargets);
  const setCalorieTarget = useAppStore((s) => s.setCalorieTarget);
  const setMacroTargets = useAppStore((s) => s.setMacroTargets);

  const [kcalText, setKcalText] = useState(String(calorieTarget));
  const [proteinText, setProteinText] = useState(String(macroTargets.protein));
  const [fatText, setFatText] = useState(String(macroTargets.fat));
  const [carbsText, setCarbsText] = useState(String(macroTargets.carbs));
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const kcal = parseInt(kcalText, 10);
    const protein = parseInt(proteinText, 10);
    const fat = parseInt(fatText, 10);
    const carbs = parseInt(carbsText, 10);

    if (isNaN(kcal) || isNaN(protein) || isNaN(fat) || isNaN(carbs)) return;

    setCalorieTarget(kcal);
    setMacroTargets({ protein, fat, carbs });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Surface>
      <SectionHeading
        title="Targets"
        subtitle="Keep your calorie and macro goals in one compact settings block."
      />
      <View style={{ gap: spacing.md }}>
        <TextField label="Calories" value={kcalText} onChangeText={setKcalText} unit="kcal" keyboardType="number-pad" />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <TextField label="Protein" value={proteinText} onChangeText={setProteinText} unit="g" keyboardType="number-pad" style={{ flex: 1 }} />
          <TextField label="Fat" value={fatText} onChangeText={setFatText} unit="g" keyboardType="number-pad" style={{ flex: 1 }} />
          <TextField label="Carbs" value={carbsText} onChangeText={setCarbsText} unit="g" keyboardType="number-pad" style={{ flex: 1 }} />
        </View>
        <Button label={saved ? 'Saved' : 'Save targets'} onPress={handleSave} />
      </View>
    </Surface>
  );
}

const NOTIF_LABELS: Record<keyof NotificationConfig, string> = {
  meal_1_reminder: 'First meal',
  meal_2_reminder: 'Second meal',
  fast_start: 'Start fast',
  morning_weight: 'Morning weight',
  encouragement_reminder: 'Encouragement',
};

function NotificationsSection() {
  const storedConfig = useAppStore((s) => s.notificationConfig);
  const storedCustomReminders = useAppStore((s) => s.customReminders);
  const setNotificationConfig = useAppStore((s) => s.setNotificationConfig);
  const setCustomReminders = useAppStore((s) => s.setCustomReminders);

  const [config, setConfig] = useState<NotificationConfig>(storedConfig);
  const [pickerKey, setPickerKey] = useState<keyof NotificationConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [customReminders, setCustomRemindersLocal] = useState<CustomReminder[]>(storedCustomReminders);
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [customHour, setCustomHour] = useState('17');
  const [customMinute, setCustomMinute] = useState('00');
  const [customEnabled, setCustomEnabled] = useState(true);

  function updateEntry(
    key: keyof NotificationConfig,
    patch: Partial<NotificationConfig[keyof NotificationConfig]>,
  ) {
    setConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  function timeDate(hour: number, minute: number): Date {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  async function handleSave() {
    setSaving(true);
    try {
      setNotificationConfig(config);
      setCustomReminders(customReminders);
      await saveNotificationConfig(config);
      await saveCustomReminders(customReminders);
      await scheduleAllReminders(config, customReminders);
      setToast('Reminders saved.');
      setTimeout(() => setToast(''), 2500);
    } catch (_err) {
      Alert.alert('Error', 'Failed to schedule reminders.');
    } finally {
      setSaving(false);
    }
  }

  function addCustomReminder() {
    const hour = parseInt(customHour, 10);
    const minute = parseInt(customMinute, 10);
    if (isNaN(hour) || isNaN(minute)) return;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return;

    const title = customTitle.trim();
    const body = customBody.trim();
    if (!title || !body) return;

    const nextReminder: CustomReminder = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      body,
      hour,
      minute,
      enabled: customEnabled,
      goal: customGoal.trim(),
    };

    setCustomRemindersLocal((prev) => [...prev, nextReminder]);
    setCustomTitle('');
    setCustomBody('');
    setCustomGoal('');
  }

  function updateCustomReminder(id: string, patch: Partial<CustomReminder>) {
    setCustomRemindersLocal((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeCustomReminder(id: string) {
    setCustomRemindersLocal((prev) => prev.filter((item) => item.id !== id));
  }

  const entries = Object.entries(config) as [
    keyof NotificationConfig,
    NotificationConfig[keyof NotificationConfig],
  ][];

  return (
    <>
      <Surface>
        <SectionHeading
          title="Notifications"
          subtitle="Keep the defaults, but make times and enablement easier to scan."
        />
        <View style={{ gap: spacing.md }}>
          {entries.map(([key, value]) => (
            <View
              key={key}
              style={{
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border.subtle,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Switch
                  value={value.enabled}
                  onValueChange={(v) => updateEntry(key, { enabled: v })}
                  trackColor={{ false: colors.border.strong, true: colors.accent.primary }}
                  thumbColor={value.enabled ? colors.text.primary : colors.text.tertiary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={typography.bodySm}>{NOTIF_LABELS[key]}</Text>
                  <Text style={[typography.caption, { marginTop: spacing.xs }]}>
                    Daily reminder
                  </Text>
                </View>
                <Pressable onPress={() => setPickerKey(pickerKey === key ? null : key)}>
                  <Text style={[typography.label, { color: colors.accent.primary }]}>
                    {String(value.hour).padStart(2, '0')}:{String(value.minute).padStart(2, '0')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}

          {pickerKey != null ? (
            <DateTimePicker
              value={timeDate(config[pickerKey].hour, config[pickerKey].minute)}
              mode="time"
              is24Hour
              display="spinner"
              onChange={(_event: DateTimePickerEvent, date?: Date) => {
                if (date && pickerKey) {
                  updateEntry(pickerKey, { hour: date.getHours(), minute: date.getMinutes() });
                }
                setPickerKey(null);
              }}
            />
          ) : null}

          {toast ? (
            <Text style={[typography.caption, { color: colors.semantic.success }]}>
              {toast}
            </Text>
          ) : null}

          <Button label="Save reminders" onPress={() => { void handleSave(); }} loading={saving} />
        </View>
      </Surface>

      <Surface>
        <SectionHeading
          title="Custom reminders"
          subtitle="Create your own daily prompts while staying inside the app’s reminder limit."
        />

        <View style={{ gap: spacing.md }}>
          <TextField label="Title" value={customTitle} onChangeText={setCustomTitle} placeholder="Hydrate" />
          <TextField label="Message" value={customBody} onChangeText={setCustomBody} placeholder="Drink a glass of water." />
          <TextField label="Goal" value={customGoal} onChangeText={setCustomGoal} placeholder="Hydration" />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <TextField label="Hour" value={customHour} onChangeText={setCustomHour} keyboardType="number-pad" style={{ flex: 1 }} />
            <TextField label="Minute" value={customMinute} onChangeText={setCustomMinute} keyboardType="number-pad" style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={typography.bodySm}>Enabled</Text>
            <Switch
              value={customEnabled}
              onValueChange={setCustomEnabled}
              trackColor={{ false: colors.border.strong, true: colors.accent.primary }}
              thumbColor={customEnabled ? colors.text.primary : colors.text.tertiary}
            />
          </View>
          <Button label="Add custom reminder" onPress={addCustomReminder} variant="secondary" />
        </View>

        {customReminders.length > 0 ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {customReminders.map((item) => (
              <View
                key={item.id}
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.border.subtle,
                  paddingTop: spacing.lg,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Switch
                    value={item.enabled}
                    onValueChange={(v) => updateCustomReminder(item.id, { enabled: v })}
                    trackColor={{ false: colors.border.strong, true: colors.accent.primary }}
                    thumbColor={item.enabled ? colors.text.primary : colors.text.tertiary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.bodySm}>{item.title}</Text>
                    <Text style={[typography.caption, { marginTop: spacing.xs }]}>
                      {item.goal ? `${item.goal} · ` : ''}
                      {String(item.hour).padStart(2, '0')}:{String(item.minute).padStart(2, '0')}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeCustomReminder(item.id)}>
                    <Ionicons name="trash-outline" size={18} color={colors.semantic.danger} />
                  </Pressable>
                </View>
                <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
                  {item.body}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Surface>
    </>
  );
}

function ExportSection() {
  const [exportingMd, setExportingMd] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  async function handleExport(formatType: 'markdown' | 'csv') {
    const setExporting = formatType === 'markdown' ? setExportingMd : setExportingCsv;
    const filename = formatType === 'markdown' ? 'nutrition-export.md' : 'nutrition-export.csv';
    const mimeType = formatType === 'markdown' ? 'text/markdown' : 'text/csv';

    setExporting(true);
    try {
      const blob = await triggerExport(formatType, 30);
      const text = await blob.text();

      const dir = FileSystem.cacheDirectory;
      if (!dir) throw new Error('Cache directory unavailable');
      const fileUri = dir + filename;
      await FileSystem.writeAsStringAsync(fileUri, text, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(fileUri, { mimeType, UTI: mimeType });
    } catch (err) {
      Alert.alert('Export Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Surface>
      <SectionHeading
        title="Export"
        subtitle="Share a snapshot of the last 30 days in Markdown or CSV format."
      />
      <View style={{ gap: spacing.md }}>
        <PressableExport
          label="Export Markdown"
          loading={exportingMd}
          disabled={exportingCsv}
          onPress={() => { void handleExport('markdown'); }}
        />
        <PressableExport
          label="Export CSV"
          loading={exportingCsv}
          disabled={exportingMd}
          onPress={() => { void handleExport('csv'); }}
        />
      </View>
    </Surface>
  );
}

function PressableExport({
  label,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        minHeight: 52,
        borderWidth: 1,
        borderColor: loading ? colors.accent.primary : colors.border.default,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg.surfaceRaised,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.accent.primary} />
      ) : (
        <Text style={typography.bodySm}>{label}</Text>
      )}
    </Pressable>
  );
}
