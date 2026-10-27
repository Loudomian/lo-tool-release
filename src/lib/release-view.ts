import {
  displayTools,
  formatDate,
  formatSize,
  isSupportAsset,
  platformLabel,
  type Release,
  type ReleaseAsset,
  type Snapshot,
} from './catalog'

// Release titles, notes and filenames are untrusted text. This single escaped
// renderer is shared by static HTML and live updates; never render raw Markdown.
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  )
const external = 'target="_blank" rel="noopener noreferrer"'
const arrow =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>'

function files(assets: ReleaseAsset[], primary = false) {
  return assets
    .map(
      (
        asset,
      ) => `<a class="download-file${primary ? ' primary-download' : ''}" title="${escape(asset.name)}" href="${escape(asset.url)}" ${external}>
    <span class="file-info"><span>${primary && platformLabel(asset.name) !== '下载文件' ? '下载 ' : ''}${escape(platformLabel(asset.name))}</span><span class="filename">${escape(asset.name)}</span></span>
    <span class="file-size">${formatSize(asset.size)}</span>${arrow}</a>`,
    )
    .join('')
}
function downloads(release: Release) {
  const main = release.assets.filter((asset) => !isSupportAsset(asset))
  const support = release.assets.filter(isSupportAsset)
  return `${main.length ? files(main, true) : '<p class="no-files">此版本未提供下载附件。</p>'}
    ${support.length ? `<details class="support-files"><summary>校验与发布清单</summary>${files(support)}</details>` : ''}`
}
export function renderTools(data: Snapshot) {
  return displayTools(data)
    .map((tool) => {
      const platforms = [
        ...new Set(
          tool.release.assets
            .filter((asset) => !isSupportAsset(asset))
            .map((asset) => platformLabel(asset.name)),
        ),
      ].join('、')
      return `<article class="tool-entry" id="${escape(tool.id)}" data-tool-card data-search="${escape(`${tool.id} ${tool.name}`.toLocaleLowerCase())}">
      <div class="tool-info"><h2>${escape(tool.name)}</h2>
        <dl class="release-meta">
          <div><dt>版本</dt><dd>v${escape(tool.release.version)}${tool.release.prerelease ? '<span class="release-badge">预发布</span>' : ''}</dd></div>
          <div><dt>更新</dt><dd><time datetime="${escape(tool.release.publishedAt)}">${formatDate(tool.release.publishedAt)}</time></dd></div>
          ${platforms ? `<div><dt>平台</dt><dd>${escape(platforms)}</dd></div>` : ''}
        </dl>
      </div>
      <div class="tool-downloads">${downloads(tool.release)}
        <a class="text-link release-notes" href="${escape(tool.release.url)}" ${external}>版本说明 ↗</a>
      </div>
    </article>`
    })
    .join('')
}
