import { hubRepository } from './catalog'

// Shared by CI and the browser. Only CI supplies authorization headers.
export async function readReleases(
  options: {
    fetcher?: (url: string, init?: RequestInit) => Promise<Response>
    headers?: HeadersInit
  } = {},
) {
  const values: unknown[] = []
  const fetcher = options.fetcher || fetch
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/vnd.github+json')
  headers.set('X-GitHub-Api-Version', '2022-11-28')
  for (let page = 1; page <= 100; page++) {
    const response = await fetcher(
      `https://api.github.com/repos/${hubRepository}/releases?per_page=100&page=${page}`,
      { headers, signal: AbortSignal.timeout(15000) },
    )
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows)) throw new Error('无效的 Release 响应')
    values.push(...rows)
    if (rows.length < 100) return values
  }
  throw new Error('Release 数量超过同步上限')
}
