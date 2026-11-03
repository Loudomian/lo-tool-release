import policy from '../../catalog/legal/g-wolf-toolkit/current.json'

export const usagePolicy = policy
export const usageStorageKey = 'lo-tools:usage:g-wolf-toolkit'
export function usageNoticeApplies(tool: string, primary: boolean) {
  return primary && (tool === policy.tool || tool === 'df-assembly-tool')
}
export function acceptedUsage(value: string | null) {
  if (!value) return false
  try {
    const receipt = JSON.parse(value)
    return (
      receipt.tool === policy.tool &&
      receipt.version === policy.version &&
      receipt.digest === policy.digest &&
      Number.isFinite(Date.parse(receipt.acceptedAt))
    )
  } catch {
    return false
  }
}
export function usageReceipt() {
  return {
    tool: policy.tool,
    version: policy.version,
    digest: policy.digest,
    acceptedAt: new Date().toISOString(),
  }
}
