import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export async function getApkInstallUri(fileUri: string): Promise<string> {
  if (Platform.OS === 'android' || fileUri.startsWith('file://')) {
    try {
      return await FileSystem.getContentUriAsync(fileUri);
    } catch {
      return fileUri;
    }
  }

  return fileUri;
}

export async function launchApkInstaller(fileUri: string): Promise<void> {
  const uri = await getApkInstallUri(fileUri);
  await Linking.openURL(uri);
}

export async function openInstallSettings(): Promise<void> {
  await Linking.openSettings();
}
