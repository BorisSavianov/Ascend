import type {
  GithubRelease,
  GithubReleaseAsset,
  ParsedVersion,
  ReleaseMetadata,
  UpdateCandidate,
} from './types';
import { isRemoteNewer, parseVersionTag } from './version';

type FetchLatestReleaseOptions = {
  etag?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  owner: string;
  repo: string;
};

type FetchResult =
  | { status: 'not-modified'; etag?: string; release: null }
  | { status: 'ok'; etag?: string; release: GithubRelease }
  | { status: 'rate-limited'; etag?: string; release: null; retryAfterMs?: number };

const METADATA_RE = /<!--\s*ascend-update\s+(\{[\s\S]*?\})\s*-->/i;

export function stripUpdateMetadata(body: string | null | undefined): string {
  if (!body) return '';
  return body.replace(METADATA_RE, '').trim();
}

export function parseReleaseMetadata(body: string | null | undefined): ReleaseMetadata {
  if (!body) return {};
  const match = body.match(METADATA_RE);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[1]) as ReleaseMetadata;
    return {
      force: Boolean(parsed.force),
      minimumVersionCode: parsed.minimumVersionCode,
      assetName: parsed.assetName,
      checksumAssetName: parsed.checksumAssetName,
    };
  } catch {
    return {};
  }
}

export function selectApkAsset(
  assets: GithubReleaseAsset[],
  preferredAssetName?: string,
): GithubReleaseAsset | null {
  const apkAssets = assets.filter((asset) => asset.name.toLowerCase().endsWith('.apk'));
  if (apkAssets.length === 0) return null;

  if (preferredAssetName) {
    const preferred = apkAssets.find((asset) => asset.name === preferredAssetName);
    if (preferred) return preferred;
  }

  const scored = [...apkAssets].sort((left, right) => scoreAsset(right.name) - scoreAsset(left.name));
  return scored[0] ?? null;
}

export function selectChecksumAsset(
  assets: GithubReleaseAsset[],
  checksumAssetName: string,
): GithubReleaseAsset | null {
  return assets.find((asset) => asset.name === checksumAssetName) ?? null;
}

export function resolveChecksumAssetName(
  apkAsset: GithubReleaseAsset,
  metadata: ReleaseMetadata,
): string {
  if (metadata.checksumAssetName) return metadata.checksumAssetName;
  return `${apkAsset.name}.sha256`;
}

function scoreAsset(name: string): number {
  const lowered = name.toLowerCase();
  if (lowered.includes('universal')) return 100;
  if (lowered.includes('release')) return 80;
  if (lowered.includes('arm64')) return 60;
  if (lowered.includes('armeabi')) return 50;
  if (lowered.includes('x86_64')) return 40;
  if (lowered.includes('x86')) return 30;
  return 10;
}

export function buildUpdateCandidate(
  release: GithubRelease,
  localVersion: ParsedVersion,
): UpdateCandidate | null {
  if (release.draft || release.prerelease) return null;

  const remoteVersion = parseVersionTag(release.tag_name);
  if (!remoteVersion) return null;

  if (!isRemoteNewer(remoteVersion, localVersion)) return null;

  const metadata = parseReleaseMetadata(release.body);
  const apkAsset = selectApkAsset(release.assets, metadata.assetName);
  if (!apkAsset) return null;

  const checksumAssetName = resolveChecksumAssetName(apkAsset, metadata);
  const checksumAsset = selectChecksumAsset(release.assets, checksumAssetName);
  if (!checksumAsset) return null;

  if (remoteVersion.strategy === 'versionCode' && metadata.minimumVersionCode != null) {
    const versionCode = remoteVersion.versionCode ?? 0;
    if (versionCode < metadata.minimumVersionCode) return null;
  }

  return {
    releaseId: release.id,
    releaseUrl: release.html_url,
    htmlUrl: release.html_url,
    tagName: release.tag_name,
    version: remoteVersion,
    currentVersion: localVersion,
    asset: apkAsset,
    checksumAsset,
    checksumAssetName,
    force: Boolean(metadata.force),
    notes: stripUpdateMetadata(release.body),
    publishedAt: release.published_at ?? null,
  };
}

export async function fetchLatestRelease({
  owner,
  repo,
  etag,
  signal,
  timeoutMs,
}: FetchLatestReleaseOptions): Promise<FetchResult> {
  const timeoutController = timeoutMs ? new AbortController() : null;
  const controller = new AbortController();
  const abort = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      abort();
    } else {
      signal.addEventListener('abort', abort, { once: true });
    }
  }

  const timeoutId = timeoutController
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(etag ? { 'If-None-Match': etag } : {}),
      },
      signal: controller.signal,
    });

    if (response.status === 304) {
      return { status: 'not-modified', etag: response.headers.get('ETag') ?? etag, release: null };
    }

    if (response.status === 403 || response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;
      return { status: 'rate-limited', etag: response.headers.get('ETag') ?? etag, release: null, retryAfterMs };
    }

    if (!response.ok) {
      throw new Error(`GitHub release lookup failed with HTTP ${response.status}`);
    }

    const release = (await response.json()) as GithubRelease;
    return {
      status: 'ok',
      etag: response.headers.get('ETag') ?? undefined,
      release,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', abort);
    }
  }
}

export function canUseCachedCandidate(candidate: UpdateCandidate | undefined | null): candidate is UpdateCandidate {
  return Boolean(candidate);
}

export function buildCandidateFromCachedRelease(
  cachedRelease: GithubRelease,
  localVersion: ParsedVersion,
): UpdateCandidate | null {
  return buildUpdateCandidate(cachedRelease, localVersion);
}

export function parseChecksumValue(text: string): string | null {
  const match = text.match(/[A-Fa-f0-9]{64}/);
  return match ? match[0].toLowerCase() : null;
}
