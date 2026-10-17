import { test, expect } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { releaseRequest, resolveSourceTag } from '../scripts/release-request'
import { verifyArchives } from '../scripts/publish-release'

test('release requests only accept known tools, version tags and complete immutable commit IDs', () => {
  const request = releaseRequest({
    tool: 'df-assembly-tool',
    tag: 'v1.2.0-rc.10',
    sha: 'a'.repeat(40),
  })
  expect(request.releaseTag).toBe('df-assembly-tool/v1.2.0-rc.10')
  expect(request.sourceRepository).toBe('Loudomian/df-assembly-tool')
  for (const input of [
    { tool: 'unknown', tag: 'v1.0.0' },
    { tool: 'df-assembly-tool', tag: 'main' },
    { tool: 'df-assembly-tool', tag: 'v1.0.0\nBAD=x' },
    { tool: 'df-assembly-tool', tag: 'v01.0.0' },
    { tool: 'df-assembly-tool', tag: 'v1.0.0', sha: 'HEAD' },
  ])
    expect(() => releaseRequest(input)).toThrow()
})
test('release archives must match both checksum and filename and contain no extra files', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lo-release-'))
  try {
    const name = 'tool.zip',
      bytes = new Uint8Array([80, 75, 3, 4])
    const digest = createHash('sha256').update(bytes).digest('hex')
    await Bun.write(join(folder, name), bytes)
    await Bun.write(join(folder, name + '.sha256'), `${digest}  ${name}\n`)
    expect((await verifyArchives(folder, [name]))[0]!.hash).toBe(digest)
    await Bun.write(join(folder, name + '.sha256'), `${digest}  other.zip\n`)
    await assert.rejects(verifyArchives(folder, [name]), /校验/)
    await Bun.write(join(folder, name + '.sha256'), `${digest}  ${name}\n`)
    await Bun.write(join(folder, 'private-config.json'), '{}')
    await assert.rejects(verifyArchives(folder, [name]), /额外/)
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
})
test('annotated source tags are resolved to a commit and a mismatched notification is rejected', async () => {
  const paths: string[] = []
  const fetcher = (async (url: string | URL | Request) => {
    paths.push(String(url))
    return Response.json({
      object:
        paths.length % 2
          ? { type: 'tag', sha: 'b'.repeat(40) }
          : { type: 'commit', sha: 'a'.repeat(40) },
    })
  }) as typeof fetch
  const request = releaseRequest({
    tool: 'df-assembly-tool',
    tag: 'v1.0.0',
    sha: 'a'.repeat(40),
  })
  expect(
    (await resolveSourceTag(request, 'test-token', fetcher)).sourceSha,
  ).toBe('a'.repeat(40))
  expect(paths[0]).toContain('/git/ref/tags/v1.0.0')
  expect(paths[1]).toContain('/git/tags/' + 'b'.repeat(40))
  await assert.rejects(
    resolveSourceTag(
      { ...request, sourceSha: 'c'.repeat(40) },
      'test-token',
      fetcher,
    ),
    /不一致/,
  )
})

test('multi-platform deliveries validate every registered archive', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lo-multi-release-'))
  const names = ['tool-windows-x64.zip', 'tool-linux-arm64.zip']
  try {
    for (const name of names) {
      const bytes = new TextEncoder().encode(name)
      const hash = createHash('sha256').update(bytes).digest('hex')
      await Bun.write(join(folder, name), bytes)
      await Bun.write(join(folder, name + '.sha256'), `${hash}  ${name}\n`)
    }
    expect(
      (await verifyArchives(folder, names)).map((file) => file.name),
    ).toEqual(names)
    await Bun.write(join(folder, names[1]!), 'modified archive')
    await assert.rejects(verifyArchives(folder, names), /校验/)
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
})
