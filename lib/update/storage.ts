import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CachedUpdateState } from './types';

const KEY = 'ascend:update:state';

export async function readUpdateState(): Promise<CachedUpdateState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CachedUpdateState;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function writeUpdateState(patch: Partial<CachedUpdateState>): Promise<void> {
  const current = await readUpdateState();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function clearUpdateState(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

