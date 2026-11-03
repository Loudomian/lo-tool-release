import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  usagePolicy,
  usageNoticeApplies,
  usageReceipt,
  acceptedUsage,
} from '../src/lib/legal'
import { legalSnapshots, readLegalSnapshot } from '../src/lib/legal-documents'
import { discoverReleases } from '../src/lib/catalog'
import { renderTools } from '../src/lib/release-view'

test('accepted notice requires the same tool, version and document text', () => {
  const receipt = usageReceipt()
  expect(acceptedUsage(JSON.stringify(receipt))).toBe(true)
  for (const change of [
    { version: 'old' },
    { digest: 'old' },
    { tool: 'another-tool' },
    { acceptedAt: 'bad-date' },
  ]) {
    expect(acceptedUsage(JSON.stringify({ ...receipt, ...change }))).toBe(false)
  }
  expect(acceptedUsage(null)).toBe(false)
  expect(acceptedUsage('{broken')).toBe(false)
  expect(usageNoticeApplies('g-wolf-toolkit', true)).toBe(true)
  expect(usageNoticeApplies('df-assembly-tool', true)).toBe(true)
  expect(usageNoticeApplies('g-wolf-toolkit', false)).toBe(false)
  expect(usageNoticeApplies('another-tool', true)).toBe(false)
})

test('published legal snapshot matches the exact digest used for confirmation', () => {
  const hash = createHash('sha256')
  for (const name of [
    'policy.json',
    'TERMS.md',
    'COPYRIGHT.md',
    'CREDITS.txt',
  ]) {
    hash
      .update(
        readFileSync(
          `catalog/legal/g-wolf-toolkit/${usagePolicy.version}/${name}`,
          'utf8',
        ).replaceAll('\r\n', '\n'),
      )
      .update('\0')
  }
  expect(hash.digest('hex')).toBe(usagePolicy.digest)
  expect(legalSnapshots()).toContain(usagePolicy.version)
  expect(readLegalSnapshot(usagePolicy.version)['COPYRIGHT.md']).toContain(
    'lo@duck.com',
  )
  expect(() => readLegalSnapshot('../../outside')).toThrow()
})

test('download confirmation covers only tool packages, including dynamically refreshed cards', () => {
  const tag = 'g-wolf-toolkit/v1.0.0'
  const base = 'https://github.com/Loudomian/lo-tool-release/releases/'
  const data = discoverReleases([
    {
      id: 10,
      tag_name: tag,
      name: 'G-Wolf Toolkit v1.0.0',
      html_url: base + 'tag/' + encodeURIComponent(tag),
      published_at: '2026-11-03T00:00:00Z',
      body: '',
      assets: ['tool.zip', 'tool.zip.sha256'].map((name) => ({
        name,
        size: 500,
        browser_download_url:
          base + 'download/' + encodeURIComponent(tag) + '/' + name,
      })),
    },
  ])
  const markup = renderTools(data)
  expect(markup.match(/data-usage-notice/g)).toHaveLength(1)
  expect(markup).toContain('tool.zip.sha256')
})
