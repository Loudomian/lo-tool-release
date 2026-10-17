import semver from 'semver'
import { tools, type BuildTool } from './build-tools'

export interface ReleaseRequest {
  tool: string
  version: string
  sourceRepository: string
  sourceTag: string
  sourceSha?: string
  releaseTag: string
}
export function releaseRequest(
  input: { tool?: unknown; tag?: unknown; sha?: unknown },
  registry: BuildTool[] = tools,
): ReleaseRequest {
  const tool = registry.find((tool) => tool.id === input.tool)
  if (!tool || !tool.build.enabled)
    throw new Error('工具尚未登记可执行的发布工作流')
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tool.id) ||
    !/^[\w.-]+\/[\w.-]+$/.test(tool.build.repository)
  )
    throw new Error('工具登记无效')
  const tag = String(input.tag || '')
  if (!tag.startsWith(tool.build.sourceTagPrefix))
    throw new Error('需要源码版本标签')
  const version = tag.slice(tool.build.sourceTagPrefix.length)
  if (version.length > 100 || semver.valid(version) !== version)
    throw new Error('版本标签不是有效的 SemVer')
  const sha = input.sha ? String(input.sha) : undefined
  if (sha && !/^[a-f0-9]{40}$/i.test(sha))
    throw new Error('源码 SHA 必须是完整的 40 位提交标识')
  return {
    tool: tool.id,
    version,
    sourceRepository: tool.build.repository,
    sourceTag: tag,
    sourceSha: sha?.toLowerCase(),
    releaseTag: `${tool.id}/v${version}`,
  }
}
export async function resolveSourceTag(
  request: ReleaseRequest,
  token: string,
  fetcher = fetch,
) {
  const get = async (path: string): Promise<any> => {
    const response = await fetcher(
      `https://api.github.com/repos/${request.sourceRepository}/${path}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(20000),
      },
    )
    if (!response.ok)
      throw new Error(`读取源码标签失败：GitHub HTTP ${response.status}`)
    return response.json()
  }
  let object = (
    await get(`git/ref/tags/${encodeURIComponent(request.sourceTag)}`)
  ).object
  for (let depth = 0; object?.type === 'tag' && depth < 8; depth++)
    object = (await get(`git/tags/${object.sha}`)).object
  if (object?.type !== 'commit' || !/^[a-f0-9]{40}$/.test(object.sha))
    throw new Error('标签没有指向有效的提交')
  if (request.sourceSha && request.sourceSha !== object.sha)
    throw new Error('通知中的源码提交与标签不一致，停止发布')
  return { ...request, sourceSha: object.sha as string }
}
if (import.meta.main) {
  const event = process.env.GITHUB_EVENT_PATH
    ? await Bun.file(process.env.GITHUB_EVENT_PATH).json()
    : {}
  const payload = event.client_payload || event.inputs || {}
  let tool = payload.tool || process.env.RELEASE_TOOL
  let tag = payload.tag
  if (process.env.GITHUB_REF_TYPE === 'tag') {
    const publicTag = process.env.GITHUB_REF_NAME || ''
    const match = tools.find((tool) => publicTag.startsWith(`${tool.id}/v`))
    if (!match) throw new Error('公共标签不属于已登记工具')
    tool = match.id
    tag = match.build.sourceTagPrefix + publicTag.slice(`${match.id}/v`.length)
  }
  const request = releaseRequest({ tool, tag, sha: payload.sha })
  const token = process.env.SOURCE_TOKEN
  if (!token)
    throw new Error(
      '请在公共仓库配置 SOURCE_TOKEN：仅需已登记源码仓库的 Contents 读取权限',
    )
  const resolved = await resolveSourceTag(request, token)
  if (!process.env.GITHUB_OUTPUT)
    throw new Error('此入口由 GitHub Actions 调用')
  const outputs = {
    tool: resolved.tool,
    version: resolved.version,
    source_repository: resolved.sourceRepository,
    source_tag: resolved.sourceTag,
    source_sha: resolved.sourceSha!,
    release_tag: resolved.releaseTag,
  }
  await Bun.write(
    Bun.file(process.env.GITHUB_OUTPUT),
    (await Bun.file(process.env.GITHUB_OUTPUT)
      .text()
      .catch(() => '')) +
      Object.entries(outputs)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(''),
  )
  console.log(`${resolved.tool} ${resolved.sourceTag} → ${resolved.sourceSha}`)
}
