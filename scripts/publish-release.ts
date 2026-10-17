import { createHash } from 'node:crypto'
import { basename, resolve } from 'node:path'
import { readdir } from 'node:fs/promises'
import semver from 'semver'
import { hubRepository } from '../src/lib/catalog'
import { tools } from './build-tools'
import { releaseRequest } from './release-request'

export async function verifyArchives(folder: string, expectedNames: string[]) {
  const entries = await readdir(folder)
  if (
    !expectedNames.length ||
    new Set(expectedNames).size !== expectedNames.length ||
    expectedNames.some(
      (name) => basename(name) !== name || !name.endsWith('.zip'),
    )
  )
    throw new Error('交付文件登记无效')
  const allowed = new Set(
    expectedNames.flatMap((name) => [name, name + '.sha256']),
  )
  if (entries.some((entry) => !allowed.has(entry)))
    throw new Error('构建产物中有未登记的额外文件')
  const result = []
  for (const name of expectedNames) {
    const archive = Bun.file(resolve(folder, name))
    const expected = (
      await Bun.file(resolve(folder, name + '.sha256')).text()
    ).trim()
    const hash = createHash('sha256')
      .update(await archive.bytes())
      .digest('hex')
    if (expected !== `${hash}  ${name}`)
      throw new Error('ZIP 校验失败或校验文件名不匹配')
    result.push({ name, hash, size: archive.size })
  }
  return result
}
if (import.meta.main) {
  const request = releaseRequest({
    tool: process.env.RELEASE_TOOL,
    tag: process.env.SOURCE_TAG,
    sha: process.env.SOURCE_SHA,
  })
  if (!request.sourceSha) throw new Error('缺少构建来源 SHA')
  const tool = tools.find((tool) => tool.id === request.tool)!
  const folder = resolve(process.env.ARTIFACT_DIR || 'artifacts')
  const names = tool.build.artifacts.map((artifact) =>
    artifact.filename.replaceAll('{version}', request.version),
  )
  const artifacts = await verifyArchives(folder, names)
  const url = `https://github.com/${hubRepository}/releases/download/${encodeURIComponent(request.releaseTag)}/`
  const manifest = {
    tool: tool.id,
    version: request.version,
    source: {
      repository: request.sourceRepository,
      tag: request.sourceTag,
      commit: request.sourceSha,
    },
    assets: Object.fromEntries(
      artifacts.map((artifact) => [
        artifact.name,
        {
          url: url + encodeURIComponent(artifact.name),
          size: artifact.size,
          sha256: artifact.hash,
        },
      ]),
    ),
  }
  await Bun.write(
    resolve(folder, 'release.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  )
  const notes = `${tool.description}\n\n- 平台：${tool.build.artifacts.map((artifact) => artifact.platform).join('、')}\n- 源码标签：\`${request.sourceTag}\`\n- 源码提交：\`${request.sourceSha}\`\n\n完整解压 ZIP 后使用；SHA256 校验文件和构建来源清单随版本提供。\n`
  const notesPath = resolve(
    process.env.RUNNER_TEMP || folder,
    'lo-release-notes.md',
  )
  await Bun.write(notesPath, notes)
  const gh = async (args: string[], allowFailure = false) => {
    const child = Bun.spawn(['gh', ...args, '--repo', hubRepository], {
      env: process.env,
      stdout: 'pipe',
      stderr: 'inherit',
    })
    const output = await new Response(child.stdout).text()
    const code = await child.exited
    if (code && !allowFailure) throw new Error(`GitHub 发布失败 (${code})`)
    return { code, output: output.trim() }
  }
  const current = await gh(
    [
      'release',
      'view',
      request.releaseTag,
      '--json',
      'isDraft',
      '--jq',
      '.isDraft',
    ],
    true,
  )
  if (!current.code && current.output === 'false') {
    console.log('该版本已发布，保留已有附件，不覆盖。')
    process.exit(0)
  }
  if (current.code) {
    const args = [
      'release',
      'create',
      request.releaseTag,
      '--draft',
      '--title',
      `${tool.name} v${request.version}`,
      '--notes-file',
      notesPath,
      '--target',
      process.env.GITHUB_SHA || 'main',
    ]
    if (semver.prerelease(request.version)) args.push('--prerelease')
    await gh(args)
  }
  await gh([
    'release',
    'upload',
    request.releaseTag,
    ...[
      ...artifacts.flatMap((artifact) => [
        artifact.name,
        artifact.name + '.sha256',
      ]),
      'release.json',
    ].map((name) => resolve(folder, name)),
    '--clobber',
  ])
  await gh([
    'release',
    'edit',
    request.releaseTag,
    '--draft=false',
    '--notes-file',
    notesPath,
  ])
  console.log(`已发布 ${request.releaseTag}`)
}
