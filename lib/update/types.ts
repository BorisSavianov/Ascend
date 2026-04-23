export type UpdateStrategy = 'semver' | 'versionCode';

export type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
};

export type ParsedVersion = {
  raw: string;
  strategy: UpdateStrategy;
  semver?: ParsedSemver;
  versionCode?: number;
};

export type GithubReleaseAsset = {
  id: number;
  name: string;
  browser_download_url: string;
  content_type?: string | null;
  size?: number | null;
};

export type GithubRelease = {
  id: number;
  tag_name: string;
  name?: string | null;
  body?: string | null;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  published_at?: string | null;
  assets: GithubReleaseAsset[];
};

export type ReleaseMetadata = {
  force?: boolean;
  minimumVersionCode?: number;
  assetName?: string;
  checksumAssetName?: string;
};

export type UpdateCandidate = {
  releaseId: number;
  releaseUrl: string;
  htmlUrl: string;
  tagName: string;
  version: ParsedVersion;
  currentVersion: ParsedVersion;
  asset: GithubReleaseAsset;
  checksumAsset: GithubReleaseAsset;
  checksumAssetName: string;
  force: boolean;
  notes: string;
  publishedAt: string | null;
};

export type UpdateProgress = {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
};

export type CachedUpdateState = {
  etag?: string;
  checkedAt?: number;
  snoozedUntil?: number;
  candidate?: UpdateCandidate;
  cachedFileUri?: string;
  cachedChecksum?: string;
  resumeData?: string;
};

export type UpdateConfig = {
  owner: string;
  repo: string;
  checkIntervalMs: number;
  snoozeMs: number;
  requestTimeoutMs: number;
};

export type UpdateUiStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'verifying' | 'installing' | 'error';

export type UpdateUiState = {
  visible: boolean;
  status: UpdateUiStatus;
  candidate: UpdateCandidate | null;
  progress: UpdateProgress | null;
  error: string | null;
};
