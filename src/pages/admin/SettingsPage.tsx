import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolio } from '../../data/context'
import { describeError, portfolioApi } from '../../api/portfolio'
import { MutationFeedback } from '../../components/MutationFeedback'
import { formatDate } from '../../utils/format'
import { downloadBlob, formatFileSize } from '../../utils/download'

export function SettingsPage() {
  const { data, error, loading, reset, mutate } = usePortfolio()
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [selected, setSelected] = useState<File | null>(null)
  const [confirming, setConfirming] = useState<'reset' | 'import' | 'cleanup' | null>(null)
  const disabled = Boolean(busy) || loading

  async function run(kind: string, operation: () => Promise<string>) {
    setBusy(kind)
    setMessage('')
    setFailure('')
    try { setMessage(await operation()); setConfirming(null) }
    catch (reason) { setFailure(describeError(reason)) }
    finally { setBusy('') }
  }

  function exportFile(kind: 'backup' | 'publish') {
    return run(kind, async () => {
      const file = kind === 'backup' ? await portfolioApi.exportBackup() : await portfolioApi.exportPublishBundle()
      downloadBlob(file, `portfolio-${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`)
      return kind === 'backup' ? '完整备份已生成并开始下载，包含文字和全部引用文件。请妥善保存。' : '静态发布包已生成并开始下载。解压后将 data、uploads 合并到项目 public 目录，再构建并提交 GitHub。'
    })
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    setSelected(event.target.files?.[0] ?? null)
    event.target.value = ''
    setConfirming(null)
    setMessage('')
    setFailure('')
  }

  return <>
    <div className="page-heading heading-with-action"><div><span className="eyebrow">SETTINGS</span><h1>备份与发布</h1><p>带走完整的内容，也为公开发布做好准备。</p></div><Link className="button secondary" to="/preview">检查草稿 ↗</Link></div>
    <MutationFeedback message={message} error={failure} />
    {busy && <div className="operation-status" role="status"><span className="spinner" />{busy === 'import' ? '正在校验并恢复备份…' : busy === 'backup' || busy === 'publish' ? '正在读取文件并生成 ZIP…' : '正在处理…'}请勿关闭此页面。</div>}
    <div className="export-grid">
      <section className="panel export-card"><span className="eyebrow">01 / BACKUP</span><h2>完整备份</h2><p>将文字、头像、简历和项目封面一起打包。可在另一台电脑或清除浏览器数据后导入恢复。</p><button className="button" onClick={() => exportFile('backup')} disabled={disabled || Boolean(error)}>{busy === 'backup' ? '正在生成备份…' : '导出完整备份 ZIP ↓'}</button></section>
      <section className="panel export-card publish-card"><span className="eyebrow">02 / PUBLISH</span><h2>静态发布包</h2><p>将本机文件转换为站点资源地址，生成 data/site.json 与 uploads，供 GitHub 和 Cloudflare Pages 发布。</p><button className="button secondary" onClick={() => exportFile('publish')} disabled={disabled || Boolean(error)}>{busy === 'publish' ? '正在生成发布包…' : '导出静态发布 ZIP ↓'}</button></section>
    </div>
    <section className="panel"><div className="panel-heading"><div><h2>导入完整备份</h2><p>支持本站导出的备份 ZIP，不接受静态发布包。最大 55 MiB，解压总量最多 50 MiB。</p></div></div>
      <label className="file-input-label" htmlFor="backup-file">选择备份 ZIP</label><input id="backup-file" className="file-input" type="file" accept=".zip,application/zip" disabled={disabled} onChange={choose} />
      {selected && <div className="selected-backup"><span>{selected.name}</span><small>{formatFileSize(selected.size)}</small><button className="button secondary small" disabled={disabled} onClick={() => { setConfirming('import'); setFailure('') }}>导入此备份</button></div>}
      {confirming === 'import' && selected && <div className="delete-confirmation" role="alert"><p>确认导入“{selected.name}”？当前本机文字和文件引用将被替换，建议先导出完整备份。公开版本不会改变。</p><div className="actions"><button className="button" disabled={disabled} onClick={() => run('import', async () => { await mutate((api) => api.importBackup(selected)); setSelected(null); return '备份已完整恢复，文字和文件均可在草稿预览中查看。' })}>确认导入</button><button className="button secondary" disabled={disabled} onClick={() => setConfirming(null)}>取消导入</button></div></div>}
    </section>
    <section className="panel publish-guide"><h2>让修改成为公开版本</h2><ol><li>预览草稿，确认信息、头像和简历。</li><li>导出静态发布 ZIP，解压到临时目录。</li><li>将 data、uploads 合并到项目 public 目录。</li><li>运行生产构建，提交并推送 GitHub，等待 Cloudflare Pages 部署。</li><li>使用无痕窗口检查正式首页、图片与简历下载。</li></ol><p>下载发布包不会自动修改仓库或线上站点。</p></section>
    <section className="panel"><h2>当前工作空间</h2>
      {loading ? <p role="status">正在读取草稿…</p> : error ? <p className="form-error" role="alert">{error} 可使用有效备份恢复，或确认重置为发布版。</p> : data && <dl className="settings-list"><div><dt>数据结构版本</dt><dd>v{data.schemaVersion}</dd></div><div><dt>基础内容版本</dt><dd>{data.contentVersion}</dd></div><div><dt>草稿最近修改</dt><dd>{formatDate(data.updatedAt)}</dd></div><div><dt>保存位置</dt><dd>当前域名 · 当前浏览器</dd></div></dl>}
      <div className="info-note"><p>文字保存在 localStorage，文件保存在 IndexedDB。不同域名、设备和浏览器之间不会自动同步；完整备份可以迁移内容。</p></div>
    </section>
    <section className="panel danger-zone"><div><h2>重置本机草稿</h2><p>用发布版覆盖未发布的文字及文件引用，请先备份。</p></div><button className="button danger" disabled={disabled} onClick={() => setConfirming('reset')}>重置草稿</button>
      {confirming === 'reset' && <div className="full-width" role="alert"><p>确认覆盖当前草稿？公开站点不会改变。旧文件在清理前仍保留于本机。</p><div className="actions confirmation-actions"><button className="button danger" disabled={disabled} onClick={() => run('reset', async () => { await reset(); return '本机草稿已重置为当前发布版。' })}>确认重置</button><button className="button secondary" disabled={disabled} onClick={() => setConfirming(null)}>取消重置</button></div></div>}
    </section>
    <section className="panel danger-zone"><div><h2>清理未引用文件</h2><p>回收替换、移除或导入后遗留的旧文件。当前草稿正在使用的文件不会删除。</p></div><button className="button danger" disabled={disabled || Boolean(error)} onClick={() => setConfirming('cleanup')}>清理旧文件</button>
      {confirming === 'cleanup' && <div className="full-width" role="alert"><p>确认永久清理未被当前草稿引用的本机文件？建议先保存完整备份。</p><div className="actions confirmation-actions"><button className="button danger" disabled={disabled} onClick={() => run('cleanup', async () => `已清理 ${await portfolioApi.removeUnusedAssets()} 个未引用文件。`)}>确认清理</button><button className="button secondary" disabled={disabled} onClick={() => setConfirming(null)}>取消清理</button></div></div>}
    </section>
  </>
}
