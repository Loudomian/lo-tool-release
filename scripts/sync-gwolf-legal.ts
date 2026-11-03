import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(process.argv[2] || '../df-assembly-tool/legal')
const names = ['policy.json', 'TERMS.md', 'COPYRIGHT.md', 'CREDITS.txt']
const files = names.map((name) =>
  readFileSync(join(source, name), 'utf8').replaceAll('\r\n', '\n'),
)
const policy = JSON.parse(files[0]!)
if (
  policy.tool !== 'g-wolf-toolkit' ||
  !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(policy.version)
)
  throw new Error('Invalid G-Wolf usage policy')
const hash = createHash('sha256')
for (const text of files) hash.update(text).update('\0')
const digest = hash.digest('hex')
const folder = join(root, 'catalog/legal/g-wolf-toolkit', policy.version)
for (const [index, name] of names.entries()) {
  const destination = join(folder, name)
  if (
    existsSync(destination) &&
    readFileSync(destination, 'utf8').replaceAll('\r\n', '\n') !== files[index]
  ) {
    throw new Error(
      'An existing policy snapshot differs. Bump the source policy version before syncing.',
    )
  }
}
mkdirSync(folder, { recursive: true })
for (const [index, name] of names.entries())
  writeFileSync(join(folder, name), files[index]!)
writeFileSync(
  join(root, 'catalog/legal/g-wolf-toolkit/current.json'),
  JSON.stringify({ ...policy, digest }, null, 2) + '\n',
)
console.log(
  `Synced ${policy.tool} usage policy ${policy.version}; SHA256 ${digest}`,
)
