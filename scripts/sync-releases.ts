import { resolve } from 'node:path'
import { discoverReleases } from '../src/lib/catalog'
import { readReleases } from '../src/lib/github'

if (import.meta.main) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  // Fetch every page before replacing the complete snapshot. API errors must
  // never erase cached releases or appear as a successful empty catalogue.
  const data = discoverReleases(
    await readReleases({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  )
  await Bun.write(
    resolve(import.meta.dir, '../catalog/releases.json'),
    JSON.stringify(data, null, 2) + '\n',
  )
  console.log(`已同步 ${Object.keys(data.tools).length} 个工具的公开 Release`)
}
