import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const ACTION_VIEW = 'android.intent.action.VIEW';
const ACTION_MANAGE_UNKNOWN_APP_SOURCES = 'android.settings.MANAGE_UNKNOWN_APP_SOURCES';
const APK_MIME_TYPE = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 1;
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;

export class UpdateInstallError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'UpdateInstallError';
  }
}

function getAndroidPackageName(): string {
  return Constants.expoConfig?.android?.package ?? 'com.personal.ascend';
}

export async function getApkInstallUri(fileUri: string): Promise<string> {
  if (Platform.OS !== 'android') return fileUri;

  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists || typeof info.size !== 'number' || info.size <= 0) {
    throw new UpdateInstallError('Downloaded APK is missing or empty');
  }

  try {
    return await FileSystem.getContentUriAsync(fileUri);
  } catch (error) {
    throw new UpdateInstallError('Unable to create installer-readable APK URI', error);
  }
}

export async function launchApkInstaller(fileUri: string): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openURL(fileUri);
    return;
  }

  const uri = await getApkInstallUri(fileUri);

  try {
    await IntentLauncher.startActivityAsync(ACTION_VIEW, {
      data: uri,
      type: APK_MIME_TYPE,
      flags: FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION,
    });
  } catch (error) {
    throw new UpdateInstallError('Android package installer could not be opened', error);
  }
}

export async function openInstallSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return;
  }

  try {
    await IntentLauncher.startActivityAsync(ACTION_MANAGE_UNKNOWN_APP_SOURCES, {
      data: `package:${getAndroidPackageName()}`,
    });
  } catch {
    await Linking.openSettings();
  }
}
