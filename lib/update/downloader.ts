import * as FileSystem from 'expo-file-system';
import type { DownloadResumable, FileSystemDownloadResult } from 'expo-file-system';
import type { UpdateCandidate, UpdateProgress } from './types';
import { normalizeChecksum, SHA256, bytesFromBase64 } from './sha256';
import { readUpdateState, writeUpdateState } from './storage';

export type DownloadOutcome = {
  fileUri: string;
  checksum: string;
};

export class UpdateDownloadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'UpdateDownloadError';
  }
}

type ProgressHandler = (progress: UpdateProgress) => void;

function getDownloadUri(candidate: UpdateCandidate): string {
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
  if (!baseDir) {
    throw new UpdateDownloadError('No writable directory available for update downloads');
  }
  return `${baseDir}ascend-update-${candidate.releaseId}.apk`;
}

async function ensureDownloadDir(): Promise<void> {
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
  if (!baseDir) {
    throw new UpdateDownloadError('No writable directory available for update downloads');
  }
  const dir = `${baseDir}updates`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function readFileChecksum(fileUri: string): Promise<string> {
  const CHUNK_SIZE = 1024 * 1024; // 1MB
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) throw new Error('File not found for checksum');
  
  const hasher = new SHA256();
  let position = 0;
  const totalSize = info.size;

  while (position < totalSize) {
    const length = Math.min(CHUNK_SIZE, totalSize - position);
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length,
    });
    hasher.update(bytesFromBase64(base64));
    position += length;
  }

  return hasher.finalize();
}

function parseExpectedChecksum(text: string): string | null {
  return normalizeChecksum(text);
}

async function fetchChecksumFromRelease(candidate: UpdateCandidate): Promise<string> {
  const response = await fetch(candidate.checksumAsset.browser_download_url);
  if (!response.ok) {
    throw new UpdateDownloadError(`Checksum asset missing or unavailable for ${candidate.tagName}`);
  }
  const text = await response.text();
  const checksum = parseExpectedChecksum(text);
  if (!checksum) {
    throw new UpdateDownloadError(`Checksum asset for ${candidate.tagName} is invalid`);
  }
  return checksum;
}

async function loadResumeData(candidate: UpdateCandidate): Promise<string | null> {
  const state = await readUpdateState();
  if (state.candidate?.releaseId !== candidate.releaseId) return null;
  return state.resumeData ?? null;
}

async function persistResumeData(candidate: UpdateCandidate, resumeData: string | null): Promise<void> {
  const state = await readUpdateState();
  await writeUpdateState({
    ...state,
    candidate,
    resumeData: resumeData ?? undefined,
  });
}

export class UpdateDownloader {
  private activeDownload: DownloadResumable | null = null;

  async pauseActiveDownload(): Promise<void> {
    if (!this.activeDownload) return;
    try {
      const pauseResult = await this.activeDownload.pauseAsync();
      const state = await readUpdateState();
      if (pauseResult?.resumeData && state.candidate) {
        await persistResumeData(state.candidate, pauseResult.resumeData);
      }
    } catch {
      // Pausing is best effort; the download can be resumed from scratch.
    }
  }

  async download(
    candidate: UpdateCandidate,
    onProgress?: ProgressHandler,
  ): Promise<DownloadOutcome> {
    await ensureDownloadDir();

    const fileUri = getDownloadUri(candidate);
    const existing = await FileSystem.getInfoAsync(fileUri);
    if (existing.exists) {
      const checksum = await readFileChecksum(fileUri);
      const expected = await fetchChecksumFromRelease(candidate);
      if (checksum === expected) {
        await writeUpdateState({
          candidate,
          cachedFileUri: fileUri,
          cachedChecksum: checksum,
        });
        return { fileUri, checksum };
      }
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }

    const expectedChecksum = await fetchChecksumFromRelease(candidate);
    const resumeData = await loadResumeData(candidate);
    const attemptDelayMs = [0, 1000, 2000, 4000];
    let lastError: unknown;

    for (let attempt = 0; attempt < attemptDelayMs.length; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, attemptDelayMs[attempt] ?? 0));
      }

      try {
        const download = FileSystem.createDownloadResumable(
          candidate.asset.browser_download_url,
          fileUri,
          {},
          (event) => {
            const total = event.totalBytesExpectedToWrite ?? 0;
            const written = event.totalBytesWritten ?? 0;
            onProgress?.({
              downloadedBytes: written,
              totalBytes: total,
              percent: total > 0 ? Math.min(100, Math.round((written / total) * 100)) : 0,
            });
          },
          attempt === 0 ? resumeData ?? undefined : undefined,
        );

        this.activeDownload = download;
        const result = (await download.downloadAsync()) as FileSystemDownloadResult | null;
        this.activeDownload = null;

        if (!result?.uri) {
          throw new UpdateDownloadError(`Download returned no file for ${candidate.tagName}`);
        }

        const checksum = await readFileChecksum(result.uri);
        if (checksum !== expectedChecksum) {
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
          throw new UpdateDownloadError(`Checksum mismatch for ${candidate.tagName}`);
        }

        await writeUpdateState({
          candidate,
          cachedFileUri: result.uri,
          cachedChecksum: checksum,
          resumeData: undefined,
        });

        return { fileUri: result.uri, checksum };
      } catch (error) {
        lastError = error;
        try {
          if (this.activeDownload) {
            const paused = await this.activeDownload.pauseAsync();
            await persistResumeData(candidate, paused.resumeData ?? null);
          }
        } catch {
          // Ignore pause failures and retry from scratch.
        } finally {
          this.activeDownload = null;
        }
      }
    }

    throw new UpdateDownloadError(`Failed to download ${candidate.tagName}`, lastError);
  }
}
