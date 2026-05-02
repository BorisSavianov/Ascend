import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import Button from './ui/Button';
import Surface from './ui/Surface';
import { colors, radius, spacing, typography, fontFamily } from '../lib/theme';
import type { AppUpdateController } from '../hooks/useAppUpdate';
import { formatVersionLabel } from '../lib/update/version';

type Props = Pick<AppUpdateController, 'visible' | 'status' | 'candidate' | 'progress' | 'error' | 'installNow' | 'snooze' | 'retry' | 'openInstallSettings'>;

export default function UpdatePrompt({
  visible,
  status,
  candidate,
  progress,
  error,
  installNow,
  snooze,
  retry,
  openInstallSettings,
}: Props) {
  if (!visible || !candidate) return null;

  const versionLabel = formatVersionLabel(candidate.version);
  const body = candidate.notes || 'A newer official release is available.';
  const isDownloading = status === 'downloading' || status === 'verifying';
  const isBusy = isDownloading || status === 'installing';
  const isForced = candidate.force;
  const progressPercent = progress?.percent ?? 0;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={isForced ? undefined : snooze}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        {!isForced ? <Pressable style={{ flex: 1 }} onPress={snooze} /> : <View style={{ flex: 1 }} />}
        <Surface
          elevated
          overlay
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.lg,
            padding: spacing.xl,
            borderRadius: radius.xl,
          }}
        >
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.label}>{isForced ? 'Required update' : 'Update available'}</Text>
            <Text style={typography.h2}>Ascend {versionLabel}</Text>
            <Text style={typography.bodySm}>
              {candidate.releaseUrl}
            </Text>
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Markdown
              style={{
                body: { ...typography.bodySm, color: colors.text.primary, margin: 0 },
                paragraph: { marginTop: 0, marginBottom: 8 },
                heading1: { color: colors.text.primary, fontFamily: fontFamily.displayBold, fontSize: 20, marginVertical: 4 },
                heading2: { color: colors.text.primary, fontFamily: fontFamily.displaySemi, fontSize: 16, marginVertical: 4 },
                bullet_list: { marginVertical: 6 },
                ordered_list: { marginVertical: 6 },
                strong: { color: colors.text.primary, fontWeight: '700' },
                em: { color: colors.text.secondary, fontStyle: 'italic' },
                code_inline: { color: colors.accent.primary },
              }}
            >
              {body}
            </Markdown>
          </View>

          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <View style={{
              height: 10,
              borderRadius: radius.pill,
              backgroundColor: colors.bg.surfaceRaised,
              borderWidth: 1,
              borderColor: colors.border.default,
              overflow: 'hidden',
            }}>
              <View style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: colors.accent.primary,
              }} />
            </View>
            <Text style={typography.caption}>
              {isDownloading ? `Downloading ${progressPercent}%` : candidate.force ? 'This update is required before continuing.' : 'You can install now or remind yourself later.'}
            </Text>
            {error ? (
              <Text style={{ ...typography.caption, color: colors.semantic.danger }}>
                {error}
              </Text>
            ) : null}
          </View>

          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <Button
              label={status === 'installing' ? 'Waiting for installer' : isBusy ? 'Preparing installer' : 'Install update'}
              onPress={installNow}
              loading={isBusy}
            />
            {!isForced ? (
              <Button label="Later" onPress={snooze} variant="secondary" />
            ) : (
              <Button label="Open install settings" onPress={openInstallSettings} variant="secondary" />
            )}
            {status === 'error' ? (
              <Button label="Retry" onPress={retry} variant="ghost" />
            ) : null}
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

