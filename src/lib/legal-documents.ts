import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const root = resolve('catalog/legal/g-wolf-toolkit')
export function legalSnapshots() {
  return readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && /^\d{4}-\d{2}-\d{2}\.\d+$/.test(entry.name),
    )
    .map((entry) => entry.name)
}
export function readLegalSnapshot(version: string) {
  if (!legalSnapshots().includes(version))
    throw new Error('Unknown usage agreement version')
  return Object.fromEntries(
    ['TERMS.md', 'COPYRIGHT.md', 'CREDITS.txt'].map((name) => [
      name,
      readFileSync(join(root, version, name), 'utf8'),
    ]),
  )
}
export function legalBlocks(text: string) {
  return text
    .replaceAll('\r\n', '\n')
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      if (/^#{1,3} /.test(block))
        return {
          kind: 'heading',
          text: block.replace(/^#{1,3} /, ''),
          lines: [],
        }
      if (block.startsWith('- '))
        return {
          kind: 'list',
          text: '',
          lines: block.split('\n').map((line) => line.replace(/^- /, '')),
        }
      return { kind: 'paragraph', text: block, lines: [] }
    })
}
