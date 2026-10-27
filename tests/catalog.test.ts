import { expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import {
  discoverReleases,
  displayTools,
  hubRepository,
  releaseIdentity,
  platformLabel,
  isSupportAsset,
} from '../src/lib/catalog'
import { readReleases } from '../src/lib/github'
import { renderTools } from '../src/lib/release-view'

const root = `https://github.com/${hubRepository}/releases/`
function row(tag: string, id: number, extra = {}) {
  return {
    id,
    tag_name: tag,
    name: tag,
    html_url: root + 'tag/' + encodeURIComponent(tag),
    published_at: '2026-10-15T00:00:00Z',
    body: '修复与改进。',
    assets: [
      {
        name: 'tool-windows-x64.zip',
        size: 2048,
        browser_download_url:
          root + 'download/' + encodeURIComponent(tag) + '/tool.zip',
      },
    ],
    ...extra,
  }
}
test('new tools appear from tags without a registry and each tool prefers its own stable release', () => {
  const data = discoverReleases([
    row('new-tool/v2.0.0-rc.9', 1),
    row('new-tool/v2.0.0-rc.10', 2),
    row('new-tool/v1.9.0', 3, { name: '新工具 v1.9.0' }),
    row('another-tool/v5.0.0', 4, { name: '另一个工具 v5.0.0' }),
  ])
  expect(Object.keys(data.tools)).toEqual(['new-tool', 'another-tool'])
  expect(data.tools['new-tool']!.map((r) => r.version)).toEqual([
    '2.0.0-rc.10',
    '2.0.0-rc.9',
    '1.9.0',
  ])
  const tools = displayTools(data)
  expect(tools.find((t) => t.id === 'new-tool')?.name).toBe('新工具')
  expect(tools.find((t) => t.id === 'new-tool')?.release.version).toBe('1.9.0')
  expect(tools.find((t) => t.id === 'another-tool')?.release.version).toBe(
    '5.0.0',
  )
})
test('prerelease-only tools are usable and names fall back to their tag identifier', () => {
  const data = discoverReleases([
    row('tool/v1.0.0-rc.9', 1),
    row('tool/v1.0.0-rc.10', 2),
    row('custom/v1.0.0+build.1', 3, { name: 'Custom — v1.0.0+build.1' }),
  ])
  const tool = displayTools(data).find((t) => t.id === 'tool')!
  expect(tool.name).toBe('tool')
  expect(tool.release.version).toBe('1.0.0-rc.10')
  expect(tool.release.prerelease).toBe(true)
  expect(displayTools(data).find((t) => t.id === 'custom')?.name).toBe('Custom')
})
test('download labels apply to unrelated tools, not only Blender or Windows archives', () => {
  expect(platformLabel('editor-plugin.zip')).toBe('插件')
  expect(platformLabel('blender-addon.zip')).toBe('Blender 插件')
  expect(platformLabel('tool-win64.zip')).toBe('Windows')
  expect(platformLabel('tool-darwin-arm64.zip')).toBe('macOS · ARM64')
  expect(platformLabel('tool-linux-x86_64.tar.gz')).toBe('Linux · x64')
  expect(isSupportAsset({ name: 'SHA256SUMS', size: 12, url: '' })).toBe(true)
})
test('drafts, duplicates, non-tool tags and unsafe or mismatched release URLs are excluded', () => {
  const data = discoverReleases([
    null,
    row('tool/v1.0.0', 1, { draft: true }),
    row('tool/v01.0.0', 2),
    row('v1.0.0', 3),
    row('tool/v1.0.0/other', 4),
    row('tool/v1.0.0', 5, { published_at: 'invalid' }),
    row('tool/v1.0.0', 6, {
      html_url: 'https://example.com/releases/tag/tool/v1.0.0',
    }),
    row('tool/v1.0.0', 7, { html_url: root + 'tag/other/v1.0.0' }),
    row('tool/v1.0.0', 8, {
      assets: [
        null,
        { name: 'bad', size: 1, browser_download_url: 'javascript:alert(1)' },
        {
          name: 'wrong-tag.zip',
          size: 1,
          browser_download_url: root + 'download/other/v1.0.0/file.zip',
        },
      ],
    }),
    row('tool/v1.0.0', 8),
  ])
  expect(data.tools.tool).toHaveLength(1)
  expect(data.tools.tool![0]!.assets).toEqual([])
  expect(releaseIdentity('../bad/v1.0.0')).toBeNull()
  expect(releaseIdentity('tool/v1.0.0\n')).toBeNull()
})
test('release text is escaped, supporting files are secondary and cards show only the latest release', () => {
  const data = discoverReleases([
    row('one/v1.0.0', 1, {
      name: '<img src=x onerror=alert(1)> v1.0.0',
      body: '<script>alert(1)</script>',
      assets: [
        {
          name: 'one-windows-x64.zip',
          size: 2048,
          browser_download_url: root + 'download/one/v1.0.0/one.zip',
        },
        {
          name: 'checksums.txt',
          size: 200,
          browser_download_url: root + 'download/one/v1.0.0/checksums.txt',
        },
      ],
    }),
    row('one/v0.9.0', 2),
    row('two/v8.0.0', 3),
  ])
  const html = renderTools(data)
  expect(html).not.toContain('<img')
  expect(html).not.toContain('<script>')
  expect(html).toContain('&lt;img')
  expect(html).toContain('<summary>校验与发布清单</summary>')
  expect(html).not.toContain('其他版本')
  expect(html).not.toContain('v0.9.0')
  expect(html).toContain('releases/tag/one%2Fv1.0.0')
  expect(html).toContain('releases/tag/two%2Fv8.0.0')
  expect(html).toContain('Windows · x64')
  expect(renderTools(discoverReleases([]))).toBe('')
})
test('all release pages are read before discovery, including tools absent from page one', async () => {
  const urls: string[] = []
  const values = await readReleases({
    fetcher: (async (url: string | URL | Request, init?: RequestInit) => {
      urls.push(String(url))
      expect(new Headers(init?.headers).has('Authorization')).toBe(false)
      return Response.json(
        urls.length === 1
          ? Array.from({ length: 100 }, (_, i) => row(`one/v1.0.${i}`, i + 1))
          : [row('new-tool/v1.0.0', 101)],
      )
    }) as typeof fetch,
  })
  expect(urls).toHaveLength(2)
  expect(urls[1]).toContain('page=2')
  expect(discoverReleases(values).tools['new-tool']).toHaveLength(1)
})
test('API outages, rate limiting and malformed responses fail instead of becoming an empty catalogue', async () => {
  for (const status of [403, 404, 429, 500]) {
    await assert.rejects(
      readReleases({ fetcher: async () => new Response('', { status }) }),
      new RegExp(`HTTP ${status}`),
    )
  }
  await assert.rejects(
    readReleases({ fetcher: async () => Response.json({ message: 'error' }) }),
    /无效/,
  )
  let page = 0
  await assert.rejects(
    readReleases({
      fetcher: async () =>
        ++page === 1
          ? Response.json(Array(100).fill(row('one/v1.0.0', 1)))
          : new Response('', { status: 500 }),
    }),
    /HTTP 500/,
  )
})
