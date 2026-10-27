import semver from 'semver'
import snapshot from '../../catalog/releases.json'

export interface ReleaseAsset {
  name: string
  size: number
  url: string
}
export interface Release {
  id: number
  version: string
  tag: string
  name: string
  prerelease: boolean
  publishedAt: string
  url: string
  body: string
  assets: ReleaseAsset[]
}
export interface Snapshot {
  generatedAt: string | null
  tools: Record<string, Release[]>
}
export const hubRepository = 'Loudomian/lo-tool-release'
export const catalog = snapshot as Snapshot

export function releaseIdentity(tag: string) {
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/v(.+)$/.exec(tag)
  if (!match) return null
  const parsed = semver.parse(match[2])
  const canonical =
    parsed &&
    parsed.version + (parsed.build.length ? '+' + parsed.build.join('.') : '')
  if (!parsed || canonical !== match[2]) return null
  return { tool: match[1]!, version: match[2]! }
}
export function sortedReleases(values: Release[]) {
  return values
    .filter((release) => !!semver.valid(release.version))
    .toSorted((a, b) => semver.rcompare(a.version, b.version))
}
export function latestRelease(releases: Release[]) {
  return releases.find((release) => !release.prerelease) || releases[0]
}

/** Only published releases in this public hub become entries; no tool registry. */
export function discoverReleases(
  input: unknown[],
  generatedAt = new Date().toISOString(),
): Snapshot {
  const groups = new Map<string, Release[]>()
  const seen = new Set<number>()
  const releasePath = `https://github.com/${hubRepository}/releases/`
  for (const value of input) {
    if (!value || typeof value !== 'object') continue
    const row = value as Record<string, unknown>
    const identity =
      typeof row.tag_name === 'string' && releaseIdentity(row.tag_name)
    if (
      !identity ||
      row.draft ||
      !Number.isSafeInteger(row.id) ||
      seen.has(row.id as number) ||
      typeof row.published_at !== 'string' ||
      !Number.isFinite(Date.parse(row.published_at)) ||
      !Array.isArray(row.assets) ||
      typeof row.html_url !== 'string'
    )
      continue
    const tag = row.tag_name as string
    // A path must refer to this exact release, including its namespaced tag.
    const matchesPath = (url: string, prefix: string, asset = false) => {
      try {
        const parsed = new URL(url)
        const path = decodeURIComponent(parsed.pathname)
        const expected = new URL(releasePath + prefix + tag).pathname
        return (
          parsed.origin === 'https://github.com' &&
          !parsed.username &&
          !parsed.password &&
          !parsed.search &&
          !parsed.hash &&
          (asset
            ? path.startsWith(expected + '/') &&
              path.length > expected.length + 1
            : path === expected)
        )
      } catch {
        return false
      }
    }
    if (!matchesPath(row.html_url, 'tag/')) continue
    const assets = row.assets.flatMap((value: unknown): ReleaseAsset[] => {
      if (!value || typeof value !== 'object') return []
      const asset = value as Record<string, unknown>
      return typeof asset.name === 'string' &&
        Number.isSafeInteger(asset.size) &&
        (asset.size as number) >= 0 &&
        typeof asset.browser_download_url === 'string' &&
        matchesPath(asset.browser_download_url, 'download/', true)
        ? [
            {
              name: asset.name,
              size: asset.size as number,
              url: asset.browser_download_url,
            },
          ]
        : []
    })
    const release: Release = {
      id: row.id as number,
      version: identity.version,
      tag,
      name: typeof row.name === 'string' ? row.name : tag,
      prerelease:
        !!row.prerelease || semver.prerelease(identity.version) !== null,
      publishedAt: row.published_at,
      url: row.html_url,
      body: typeof row.body === 'string' ? row.body : '',
      assets,
    }
    const releases = groups.get(identity.tool) || []
    releases.push(release)
    groups.set(identity.tool, releases)
    seen.add(release.id)
  }
  return {
    generatedAt,
    tools: Object.fromEntries(
      [...groups].map(([id, releases]) => [id, sortedReleases(releases)]),
    ),
  }
}

export function displayTools(data: Snapshot) {
  return Object.entries(data.tools)
    .flatMap(([id, values]) => {
      const releases = sortedReleases(values)
      const release = latestRelease(releases)
      if (!release) return []
      // The publishing workflow titles releases "Tool name v1.2.3".
      // Tags alone still work, falling back to their stable tool identifier.
      const title = release.name.trim()
      const suffix = new RegExp(
        `(?:\\s+|\\s*[-–—]\\s*)v?${release.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      )
      const name =
        title === release.tag ||
        title === release.version ||
        title === `v${release.version}`
          ? id
          : title.replace(suffix, '').trim() || id
      return [{ id, name, release, releases }]
    })
    .toSorted((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}
export const formatSize = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : bytes >= 1024 ** 2
      ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
      : `${Math.ceil(bytes / 1024)} KB`
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
export function platformLabel(name: string) {
  if (/sha256|checksums/i.test(name)) return 'SHA256 校验'
  if (/release\.json/i.test(name)) return '发布清单'
  const platform =
    /(?:^|[-_.\s])win(?:dows|32|64)?(?=[-_.\s]|$)|\.(exe|msi)$/i.test(name)
      ? 'Windows'
      : /linux|\.(appimage|deb|rpm)$/i.test(name)
        ? 'Linux'
        : /macos|darwin|mac[-_.]|\.dmg$/i.test(name)
          ? 'macOS'
          : /blender/i.test(name)
            ? 'Blender 插件'
            : /addon|plugin/i.test(name)
              ? '插件'
              : '下载文件'
  return (
    platform +
    (/arm64|aarch64/i.test(name)
      ? ' · ARM64'
      : /amd64|x64|x86_64/i.test(name)
        ? ' · x64'
        : '')
  )
}
export const isSupportAsset = (asset: ReleaseAsset) =>
  /(?:\.sha\d+|\.sig|sha\d+sums?(?:\.txt)?|checksums?(?:\.[a-z0-9]+)?|release\.json)$/i.test(
    asset.name,
  )
