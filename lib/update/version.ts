import type { ParsedSemver, ParsedVersion, UpdateStrategy } from './types';

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)$/;
const VERSION_CODE_RE = /^v?(\d+)$/;

export function parseVersionTag(tagName: string): ParsedVersion | null {
  const semverMatch = tagName.trim().match(SEMVER_RE);
  if (semverMatch) {
    const parsed: ParsedSemver = {
      major: Number(semverMatch[1]),
      minor: Number(semverMatch[2]),
      patch: Number(semverMatch[3]),
    };
    return {
      raw: tagName,
      strategy: 'semver',
      semver: parsed,
    };
  }

  const versionCodeMatch = tagName.trim().match(VERSION_CODE_RE);
  if (versionCodeMatch) {
    return {
      raw: tagName,
      strategy: 'versionCode',
      versionCode: Number(versionCodeMatch[1]),
    };
  }

  return null;
}

export function compareParsedVersions(left: ParsedVersion, right: ParsedVersion): number {
  if (left.strategy !== right.strategy) {
    return 0;
  }

  if (left.strategy === 'semver') {
    const a = left.semver;
    const b = right.semver;
    if (!a || !b) return 0;
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  }

  return (left.versionCode ?? 0) - (right.versionCode ?? 0);
}

export function isRemoteNewer(remote: ParsedVersion, local: ParsedVersion): boolean {
  return compareParsedVersions(remote, local) > 0;
}

export function normalizeVersionSource(
  version: string | number | null | undefined,
  strategy: UpdateStrategy,
): ParsedVersion | null {
  if (version == null) return null;

  if (strategy === 'semver') {
    const raw = String(version).trim();
    const parsed = parseVersionTag(raw);
    if (parsed?.strategy === 'semver') return parsed;
    return null;
  }

  const numeric = typeof version === 'number' ? version : Number(String(version).trim());
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return {
    raw: String(version),
    strategy: 'versionCode',
    versionCode: numeric,
  };
}

export function formatVersionLabel(version: ParsedVersion): string {
  if (version.strategy === 'semver' && version.semver) {
    return `${version.semver.major}.${version.semver.minor}.${version.semver.patch}`;
  }
  return String(version.versionCode ?? version.raw);
}

