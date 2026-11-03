import { acceptedUsage, usageReceipt, usageStorageKey } from '../lib/legal'

export function initUsageNotice() {
  const dialog = document.querySelector<HTMLDialogElement>('#usage-notice')!
  const checkbox = document.querySelector<HTMLInputElement>('#usage-consent')!
  const confirm = document.querySelector<HTMLButtonElement>('#usage-download')!
  let pending: HTMLAnchorElement | undefined
  function restored() {
    try {
      return acceptedUsage(localStorage.getItem(usageStorageKey))
    } catch {
      return false
    }
  }
  function click(event: MouseEvent) {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('a[data-usage-notice]')
        : null
    if (!target || event.defaultPrevented || restored()) return
    event.preventDefault()
    pending = target
    checkbox.checked = false
    confirm.disabled = true
    if (!dialog.open) dialog.showModal()
  }
  function change() {
    confirm.disabled = !checkbox.checked
  }
  function close() {
    const trigger = pending
    pending = undefined
    trigger?.focus()
  }
  function download() {
    if (!checkbox.checked || !pending) return
    const destination = pending.href
    try {
      localStorage.setItem(usageStorageKey, JSON.stringify(usageReceipt()))
    } catch {
      /* Current confirmation still permits this download. */
    }
    dialog.close('accepted')
    window.location.assign(destination)
  }
  document.addEventListener('click', click)
  checkbox.addEventListener('change', change)
  confirm.addEventListener('click', download)
  dialog.addEventListener('close', close)
  return () => {
    document.removeEventListener('click', click)
    checkbox.removeEventListener('change', change)
    confirm.removeEventListener('click', download)
    dialog.removeEventListener('close', close)
    if (dialog.open) dialog.close()
  }
}
