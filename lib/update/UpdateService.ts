import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import type { UpdateCandidate, UpdateConfig, UpdateUiState } from './types';
import { fetchLatestRelease, buildUpdateCandidate } from './github';
import { normalizeVersionSource, parseVersionTag } from './version';
import { readUpdateState, writeUpdateState } from './storage';
import { UpdateDownloader } from './downloader';
import { launchApkInstaller, openInstallSettings } from './installer';

export class UpdateService {
  private readonly downloader = new UpdateDownloader();
  private readonly config: UpdateConfig;

  constructor(config: UpdateConfig) {
    this.config = config;
  }

  getLocalVersionStrategy(): 'semver' | 'versionCode' {
    const remoteVersion = String(Constants.expoConfig?.version ?? '1.0.0');
    return parseVersionTag(remoteVersion)?.strategy ?? 'semver';
  }

  getLocalVersion() {
    const strategy = this.getLocalVersionStrategy();
    if (strategy === 'versionCode') {
      return normalizeVersionSource(Constants.expoConfig?.android?.versionCode ?? null, 'versionCode');
    }
    return normalizeVersionSource(Constants.expoConfig?.version ?? '1.0.0', 'semver');
  }

  async shouldCheckNow(): Promise<boolean> {
    const state = await readUpdateState();
    const lastCheck = state.checkedAt ?? 0;
    return Date.now() - lastCheck >= this.config.checkIntervalMs;
  }

  async checkForUpdate(): Promise<UpdateCandidate | null> {
    const localVersion = this.getLocalVersion();
    if (!localVersion) return null;

    if (!this.config.owner || !this.config.repo) {
      return null;
    }

    const state = await readUpdateState();
    const releaseState = state.candidate;

    if (state.snoozedUntil && state.snoozedUntil > Date.now()) {
      return null;
    }

    if (state.checkedAt && Date.now() - state.checkedAt < this.config.checkIntervalMs && releaseState) {
      return releaseState;
    }

    if (!(await NetInfo.fetch()).isConnected) {
      return releaseState ?? null;
    }

    try {
      const result = await fetchLatestRelease({
        owner: this.config.owner,
        repo: this.config.repo,
        etag: state.etag,
        timeoutMs: this.config.requestTimeoutMs,
      });

      if (result.status === 'not-modified') {
        await writeUpdateState({ checkedAt: Date.now(), etag: result.etag ?? state.etag });
        return state.candidate ?? null;
      }

      if (result.status === 'rate-limited') {
        await writeUpdateState({ checkedAt: Date.now(), etag: result.etag ?? state.etag });
        return state.candidate ?? null;
      }

      const candidate = buildUpdateCandidate(result.release, localVersion);
      await writeUpdateState({
        checkedAt: Date.now(),
        etag: result.etag,
        candidate: candidate ?? undefined,
        resumeData: undefined,
      });
      return candidate;
    } catch {
      return state.candidate ?? null;
    }
  }

  async install(candidate: UpdateCandidate, onProgress?: (progress: NonNullable<UpdateUiState['progress']>) => void): Promise<void> {
    const download = await this.downloader.download(candidate, (progress) => {
      onProgress?.(progress);
    });

    if (!download.fileUri) {
      throw new Error('Download failed');
    }

    await launchApkInstaller(download.fileUri);
  }

  async pauseActiveDownload(): Promise<void> {
    await this.downloader.pauseActiveDownload();
  }

  async snooze(candidate: UpdateCandidate): Promise<void> {
    await writeUpdateState({
      candidate,
      checkedAt: Date.now(),
      snoozedUntil: Date.now() + this.config.snoozeMs,
    });
  }

  async openInstallSettings(): Promise<void> {
    await openInstallSettings();
  }

  async getCachedCandidate(): Promise<UpdateCandidate | null> {
    const state = await readUpdateState();
    return state.candidate ?? null;
  }
}

export function createUpdateService(): UpdateService {
  const extra = Constants.expoConfig?.extra as {
    update?: { githubOwner?: string; githubRepo?: string; checkIntervalMs?: number; snoozeMs?: number; requestTimeoutMs?: number };
  } | undefined;

  const owner = extra?.update?.githubOwner ?? process.env.EXPO_PUBLIC_GITHUB_OWNER ?? '';
  const repo = extra?.update?.githubRepo ?? process.env.EXPO_PUBLIC_GITHUB_REPO ?? '';

  return new UpdateService({
    owner,
    repo,
    checkIntervalMs: extra?.update?.checkIntervalMs ?? 6 * 60 * 60 * 1000,
    snoozeMs: extra?.update?.snoozeMs ?? 24 * 60 * 60 * 1000,
    requestTimeoutMs: extra?.update?.requestTimeoutMs ?? 15_000,
  });
}
