import React, { useState } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        color: '#6b7280',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginTop: 24,
        marginBottom: 10,
        marginHorizontal: 16,
      }}
    >
      {title}
    </Text>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        marginHorizontal: 16,
        backgroundColor: '#111827',
        borderRadius: 16,
        padding: 16,
      }}
    >
      {children}
    </View>
  );
}

// ── Input row ─────────────────────────────────────────────────────────────────

function InputRow({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  unit?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
      <Text style={{ color: '#c4c9d4', fontSize: 14, width: 110 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ''}
        placeholderTextColor="#4b5563"
        keyboardType="decimal-pad"
        style={{
          flex: 1,
          backgroundColor: '#1f2937',
          color: '#ffffff',
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          fontSize: 14,
        }}
      />
      {unit ? (
        <Text style={{ color: '#6b7280', fontSize: 13, marginLeft: 8, width: 24 }}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

// ── Primary button ────────────────────────────────────────────────────────────

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: disabled ? '#374151' : pressed ? '#16a34a' : '#22c55e',
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 12,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Text
        style={{
          color: disabled ? '#6b7280' : '#000000',
          fontWeight: '700',
          fontSize: 13,
          letterSpacing: 0.8,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  return (
    <ErrorBoundary fallbackLabel="Failed to load profile">
      <ProfileScreenContent />
    </ErrorBoundary>
  );
}

function ProfileScreenContent() {
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await auth.signOut();
    queryClient.clear();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030712' }}>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <Text
          style={{
            color: '#ffffff',
            fontSize: 22,
            fontWeight: '700',
            marginTop: 16,
            marginHorizontal: 16,
          }}
        >
          Profile
        </Text>

        <BodyMetricsSection />
        <FastingSection />
        <TargetsSection />
        <NotificationsSection />
        <ExportSection />

        {/* Sign out */}
        <View style={{ marginHorizontal: 16, marginTop: 24 }}>
          <Pressable
            onPress={() => { void handleSignOut(); }}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: '#ef4444',
              borderRadius: 10,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 14 }}>Sign Out</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Section 1: Body Metrics ───────────────────────────────────────────────────

function BodyMetricsSection() {
  const [weightText, setWeightText] = useState('');
  const [fatText, setFatText] = useState('');
  const [validationError, setValidationError] = useState('');

  const { data: metrics } = useBodyMetrics();
  const logMutation = useLogBodyMetrics();

  // Last 14 days for sparkline
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
    <>
      <SectionHeader title="Body Metrics" />
      <Card>
        <InputRow label="Weight" value={weightText} onChangeText={setWeightText} placeholder="0.0" unit="kg" />
        <InputRow label="Body fat" value={fatText} onChangeText={setFatText} placeholder="0.0" unit="%" />

        {validationError ? (
          <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationError}</Text>
        ) : null}

        <PrimaryButton
          label={logMutation.isPending ? 'SAVING…' : 'LOG METRICS'}
          onPress={handleLog}
          disabled={logMutation.isPending}
        />

        {sparklineData.length >= 2 ? (
          <>
            <View style={{ marginTop: 16 }}>
              <WeightSparkline data={sparklineData} />
            </View>
            {firstWeight != null && lastWeight != null ? (
              <Text style={{ color: '#c4c9d4', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
                {firstWeight.toFixed(1)} kg → {lastWeight.toFixed(1)} kg
              </Text>
            ) : null}
          </>
        ) : null}
      </Card>
    </>
  );
}

// ── Section 2: Fasting ────────────────────────────────────────────────────────

function FastingSection() {
  const { data: activeFast } = useActiveFast();
  const { data: history } = useFastingHistory();
  const startFast = useStartFast();
  const endFast = useEndFast();
  const fastingTargetHours = useAppStore((s) => s.fastingTargetHours);
  const setFastingTargetHours = useAppStore((s) => s.setFastingTargetHours);
  const [targetText, setTargetText] = useState(String(fastingTargetHours));

  function handleStart() {
    startFast.mutate();
  }

  function handleEnd() {
    if (!activeFast) return;
    endFast.mutate(activeFast.id);
  }

  function handleTargetChange(text: string) {
    setTargetText(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 72) {
      setFastingTargetHours(parsed);
    }
  }

  return (
    <>
      <SectionHeader title="Fasting" />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: '#c4c9d4', fontSize: 14, flex: 1 }}>Fasting target</Text>
          <TextInput
            value={targetText}
            onChangeText={handleTargetChange}
            keyboardType="number-pad"
            style={{
              backgroundColor: '#1f2937',
              color: '#ffffff',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
              fontSize: 14,
              width: 60,
              textAlign: 'center',
            }}
          />
          <Text style={{ color: '#6b7280', fontSize: 13, marginLeft: 8 }}>h</Text>
        </View>
        <FastingTimer
          activeFast={activeFast ?? null}
          targetHours={fastingTargetHours}
          onStart={handleStart}
          onEnd={handleEnd}
          isStarting={startFast.isPending}
          isEnding={endFast.isPending}
        />
      </Card>

      {history.length > 0 ? (
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          {history.map((fast) => (
            <FastingHistoryRow key={fast.id} fast={fast} />
          ))}
        </View>
      ) : null}
    </>
  );
}

// ── Section 3: Targets ────────────────────────────────────────────────────────

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
    <>
      <SectionHeader title="Targets" />
      <Card>
        <InputRow label="Calories" value={kcalText} onChangeText={setKcalText} unit="kcal" />
        <InputRow label="Protein" value={proteinText} onChangeText={setProteinText} unit="g" />
        <InputRow label="Fat" value={fatText} onChangeText={setFatText} unit="g" />
        <InputRow label="Carbs" value={carbsText} onChangeText={setCarbsText} unit="g" />

        <PrimaryButton
          label={saved ? 'SAVED ✓' : 'SAVE TARGETS'}
          onPress={handleSave}
        />
      </Card>
    </>
  );
}

// ── Section 4: Notifications ──────────────────────────────────────────────────

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
    } catch (err) {
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
      <SectionHeader title="Notifications" />
      <Card>
        {entries.map(([key, value]) => (
          <View
            key={key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#1f2937',
            }}
          >
            <Switch
              value={value.enabled}
              onValueChange={(v) => updateEntry(key, { enabled: v })}
              trackColor={{ false: '#374151', true: '#16a34a' }}
              thumbColor={value.enabled ? '#22c55e' : '#6b7280'}
            />
            <Text style={{ color: '#d1d5db', fontSize: 14, flex: 1, marginLeft: 12 }}>
              {NOTIF_LABELS[key]}
            </Text>
            <Pressable
              onPress={() => setPickerKey(pickerKey === key ? null : key)}
              style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            >
              <Text style={{ color: '#22c55e', fontSize: 14, fontVariant: ['tabular-nums'] }}>
                {String(value.hour).padStart(2, '0')}:{String(value.minute).padStart(2, '0')}
              </Text>
            </Pressable>
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
          <Text style={{ color: '#22c55e', fontSize: 13, textAlign: 'center', marginTop: 10 }}>
            {toast}
          </Text>
        ) : null}

        <PrimaryButton
          label={saving ? 'SAVING…' : 'SAVE REMINDERS'}
          onPress={() => { void handleSave(); }}
          disabled={saving}
        />
      </Card>

      <SectionHeader title="Custom reminders" />
      <Card>
        <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>
          Create daily reminders for your own goals. These are counted inside the 3-notification daily limit.
        </Text>

        <InputRow label="Title" value={customTitle} onChangeText={setCustomTitle} placeholder="Hydrate" />
        <InputRow label="Message" value={customBody} onChangeText={setCustomBody} placeholder="Drink a glass of water." />
        <InputRow label="Goal" value={customGoal} onChangeText={setCustomGoal} placeholder="Hydration" />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ color: '#c4c9d4', fontSize: 14, width: 110 }}>Time</Text>
          <TextInput
            value={customHour}
            onChangeText={setCustomHour}
            keyboardType="number-pad"
            style={{
              backgroundColor: '#1f2937',
              color: '#ffffff',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 14,
              width: 60,
              textAlign: 'center',
            }}
          />
          <Text style={{ color: '#6b7280', fontSize: 13, marginHorizontal: 8 }}>:</Text>
          <TextInput
            value={customMinute}
            onChangeText={setCustomMinute}
            keyboardType="number-pad"
            style={{
              backgroundColor: '#1f2937',
              color: '#ffffff',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 14,
              width: 60,
              textAlign: 'center',
            }}
          />
          <Switch
            value={customEnabled}
            onValueChange={setCustomEnabled}
            trackColor={{ false: '#374151', true: '#16a34a' }}
            thumbColor={customEnabled ? '#22c55e' : '#6b7280'}
          />
        </View>

        <PrimaryButton label="ADD CUSTOM REMINDER" onPress={addCustomReminder} />

        {customReminders.length > 0 ? (
          <View style={{ marginTop: 16 }}>
            {customReminders.map((item) => (
              <View
                key={item.id}
                style={{
                  borderTopWidth: 1,
                  borderTopColor: '#1f2937',
                  paddingTop: 12,
                  marginTop: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Switch
                    value={item.enabled}
                    onValueChange={(v) => updateCustomReminder(item.id, { enabled: v })}
                    trackColor={{ false: '#374151', true: '#16a34a' }}
                    thumbColor={item.enabled ? '#22c55e' : '#6b7280'}
                  />
                  <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', marginLeft: 10, flex: 1 }}>
                    {item.title}
                  </Text>
                  <Pressable onPress={() => removeCustomReminder(item.id)} style={{ padding: 4 }}>
                    <Text style={{ color: '#ef4444', fontSize: 12 }}>Delete</Text>
                  </Pressable>
                </View>
                <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>
                  {item.goal ? `${item.goal} · ` : ''}
                  {String(item.hour).padStart(2, '0')}:{String(item.minute).padStart(2, '0')}
                </Text>
                <Text style={{ color: '#d1d5db', fontSize: 13 }}>{item.body}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </>
  );
}

// ── Section 5: Export ─────────────────────────────────────────────────────────

function ExportSection() {
  const [exportingMd, setExportingMd] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  async function handleExport(format: 'markdown' | 'csv') {
    const setExporting = format === 'markdown' ? setExportingMd : setExportingCsv;
    const filename = format === 'markdown' ? 'nutrition-export.md' : 'nutrition-export.csv';
    const mimeType = format === 'markdown' ? 'text/markdown' : 'text/csv';

    setExporting(true);
    try {
      const blob = await triggerExport(format, 30);
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
    <>
      <SectionHeader title="Export" />
      <Card>
        <Pressable
          onPress={() => { void handleExport('markdown'); }}
          disabled={exportingMd || exportingCsv}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: exportingMd ? '#22c55e' : '#374151',
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: 'center',
            marginBottom: 8,
            opacity: exportingCsv ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          {exportingMd ? (
            <ActivityIndicator size="small" color="#22c55e" />
          ) : (
            <Text style={{ color: '#d1d5db', fontSize: 13 }}>Export Markdown</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => { void handleExport('csv'); }}
          disabled={exportingMd || exportingCsv}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: exportingCsv ? '#22c55e' : '#374151',
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: 'center',
            opacity: exportingMd ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          {exportingCsv ? (
            <ActivityIndicator size="small" color="#22c55e" />
          ) : (
            <Text style={{ color: '#d1d5db', fontSize: 13 }}>Export CSV</Text>
          )}
        </Pressable>
      </Card>
    </>
  );
}
