import { discoverReleases, displayTools } from '../lib/catalog'
import { readReleases } from '../lib/github'
import { renderTools } from '../lib/release-view'

export function initReleaseList() {
  const list = document.querySelector<HTMLElement>('#release-list')!
  const empty = document.querySelector<HTMLElement>('#catalog-empty')!
  const searchEmpty = document.querySelector<HTMLElement>('#search-empty')!
  const search = document.querySelector<HTMLInputElement>('#tool-search')!
  const status = document.querySelector<HTMLElement>('#release-status')!
  const retry = document.querySelector<HTMLButtonElement>('#release-retry')!
  let disposed = false
  let loading = false
  let current = list.innerHTML
  function filter() {
    const query = search.value.trim().toLocaleLowerCase()
    const cards = [...list.querySelectorAll<HTMLElement>('[data-tool-card]')]
    let visible = 0
    for (const card of cards) {
      card.hidden = !(card.dataset.search || '').includes(query)
      if (!card.hidden) visible++
    }
    searchEmpty.hidden = cards.length === 0 || visible > 0
  }
  async function refresh() {
    if (loading) return
    loading = true
    retry.hidden = true
    list.setAttribute('aria-busy', 'true')
    if (!list.childElementCount) {
      empty.hidden = true
      status.textContent = '正在读取发布版本…'
    }
    try {
      const data = discoverReleases(await readReleases())
      if (disposed) return
      const next = renderTools(data)
      if (next !== current) {
        list.innerHTML = next
        current = next
      }
      const count = displayTools(data).length
      empty.hidden = count > 0
      search.closest<HTMLElement>('label')!.hidden = count < 4
      status.textContent = ''
      filter()
    } catch {
      if (disposed) return
      empty.hidden = true
      status.textContent = list.childElementCount
        ? '暂时无法更新，当前显示已保存的版本。'
        : '暂时无法读取版本，请重试或前往 GitHub Releases。'
      retry.hidden = false
    } finally {
      loading = false
      if (!disposed) list.setAttribute('aria-busy', 'false')
    }
  }
  const onRetry = () => {
    void refresh()
  }
  search.addEventListener('input', filter)
  retry.addEventListener('click', onRetry)
  void refresh()
  return () => {
    disposed = true
    search.removeEventListener('input', filter)
    retry.removeEventListener('click', onRetry)
  }
}
