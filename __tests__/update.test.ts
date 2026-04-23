import { buildUpdateCandidate, parseReleaseMetadata, selectApkAsset, stripUpdateMetadata } from '../lib/update/github';
import { sha256Bytes } from '../lib/update/sha256';
import { compareParsedVersions, normalizeVersionSource, parseVersionTag } from '../lib/update/version';

describe('version parsing', () => {
  it('parses semantic versions with a leading v', () => {
    const parsed = parseVersionTag('v1.2.3');
    expect(parsed?.strategy).toBe('semver');
    expect(parsed?.semver).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('parses integer version codes', () => {
    const parsed = parseVersionTag('42');
    expect(parsed?.strategy).toBe('versionCode');
    expect(parsed?.versionCode).toBe(42);
  });

  it('compares versions without string ordering bugs', () => {
    const left = normalizeVersionSource('1.10.0', 'semver');
    const right = normalizeVersionSource('1.2.9', 'semver');
    expect(left && right ? compareParsedVersions(left, right) : 0).toBeGreaterThan(0);
  });
});

describe('release parsing', () => {
  const release = {
    id: 7,
    tag_name: 'v1.2.3',
    name: 'v1.2.3',
    body: [
      '<!-- ascend-update {"force":true,"checksumAssetName":"Ascend.apk.sha256"} -->',
      '## Fixes',
      '- Better downloads',
    ].join('\n'),
    draft: false,
    prerelease: false,
    html_url: 'https://github.com/acme/ascend/releases/tag/v1.2.3',
    published_at: '2026-04-23T00:00:00Z',
    assets: [
      {
        id: 11,
        name: 'Ascend-universal.apk',
        browser_download_url: 'https://example.com/Ascend-universal.apk',
        content_type: 'application/vnd.android.package-archive',
        size: 123,
      },
      {
        id: 12,
        name: 'Ascend.apk.sha256',
        browser_download_url: 'https://example.com/Ascend.apk.sha256',
        content_type: 'text/plain',
        size: 64,
      },
    ],
  };

  it('strips metadata from release notes', () => {
    expect(stripUpdateMetadata(release.body)).toBe('## Fixes\n- Better downloads');
    expect(parseReleaseMetadata(release.body)).toEqual({
      force: true,
      checksumAssetName: 'Ascend.apk.sha256',
    });
  });

  it('selects the universal APK when multiple APK assets exist', () => {
    expect(selectApkAsset(release.assets)?.name).toBe('Ascend-universal.apk');
  });

  it('builds an update candidate only for official releases with matching checksum assets', () => {
    const candidate = buildUpdateCandidate(release, normalizeVersionSource('1.0.0', 'semver')!);
    expect(candidate?.tagName).toBe('v1.2.3');
    expect(candidate?.force).toBe(true);
    expect(candidate?.checksumAsset.name).toBe('Ascend.apk.sha256');
  });

  it('ignores prereleases and drafts', () => {
    expect(buildUpdateCandidate({ ...release, prerelease: true }, normalizeVersionSource('1.0.0', 'semver')!)).toBeNull();
    expect(buildUpdateCandidate({ ...release, draft: true }, normalizeVersionSource('1.0.0', 'semver')!)).toBeNull();
  });
});

describe('checksum hashing', () => {
  it('computes sha256 correctly', () => {
    const digest = sha256Bytes(new TextEncoder().encode('abc'));
    expect(digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

