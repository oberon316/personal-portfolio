import { useId, useState } from 'react'
import type { ChangeEvent } from 'react'
import { describeError, portfolioApi } from '../api/portfolio'
import { useDraftAction } from '../hooks/useDraftAction'
import type { AssetRef } from '../types/site'
import type { AssetRole } from '../utils/media'
import { downloadBlob, formatFileSize } from '../utils/download'
import { AssetImage } from './AssetImage'
import { MutationFeedback } from './MutationFeedback'

export function AssetManager({ role, asset, projectId }: { role: AssetRole; asset?: AssetRef; projectId?: string }) {
  const inputId = useId()
  const feedback = useDraftAction()
  const [confirming, setConfirming] = useState(false)
  const [fileInfo, setFileInfo] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const label = role === 'avatar' ? '头像' : role === 'resume' ? 'PDF 简历' : '项目封面'
  const busy = feedback.busy || downloading

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setConfirming(false)
    setDownloadError('')
    const ok = await feedback.run((api) => role === 'cover'
      ? api.saveProjectCover(projectId!, file, file.name, asset ?? null)
      : api.saveProfileAsset(role, file, file.name, asset ?? null), `${label}已保存到本机，刷新后仍可使用。`)
    if (ok) setFileInfo(`所选文件 ${formatFileSize(file.size)}；图片已按展示尺寸压缩。`)
  }

  async function remove() {
    const ok = await feedback.run((api) => role === 'cover' ? api.removeProjectCover(projectId!, asset ?? null) : api.removeProfileAsset(role, asset ?? null), `${label}已从本机草稿移除。`)
    if (ok) { setConfirming(false); setFileInfo('') }
  }

  async function download() {
    if (!asset) return
    setDownloading(true)
    setDownloadError('')
    try { const file = await portfolioApi.readAsset(asset, role); downloadBlob(file.blob, file.name) }
    catch (error) { setDownloadError(describeError(error)) }
    finally { setDownloading(false) }
  }

  return <section className={`asset-manager asset-manager-${role}`} aria-label={`${label}管理`}>
    <div className="asset-manager-heading"><h3>{label}</h3><span className="pill">{asset ? '已设置' : '尚未提供'}</span></div>
    {role !== 'resume' && <AssetImage asset={asset} role={role} alt={`${label}预览`} className="managed-image" />}
    {role === 'resume' && <div className="pdf-file-card"><span aria-hidden="true">PDF</span><p>{asset?.name || '尚未上传简历'}</p></div>}
    {role !== 'resume' && asset && <p className="asset-file-name">{asset.name}</p>}
    <p className="asset-hint">{role === 'resume' ? '仅接受 PDF，最多 10 MiB。文件保存在当前浏览器。' : `JPEG、PNG、WebP，最多 ${role === 'avatar' ? '2' : '5'} MiB；最长边压缩至 ${role === 'avatar' ? '512' : '1600'}px。`}</p>
    <label className="file-input-label" htmlFor={inputId}>{asset ? `替换${label}` : `上传${label}`}</label>
    <input id={inputId} className="file-input" type="file" accept={role === 'resume' ? '.pdf,application/pdf' : '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'} onChange={upload} disabled={busy || confirming} />
    <div className="actions asset-actions">{asset && <><button className="button secondary small" onClick={download} disabled={busy}>{downloading ? '正在读取…' : role === 'resume' ? '下载 PDF 简历' : '下载图片'}</button><button className="button danger small" onClick={() => { setConfirming(true); feedback.clear() }} disabled={busy || confirming}>移除{label}</button></>}</div>
    {confirming && <div className="asset-confirmation" role="alert"><p>确认从草稿移除{label}？公开版本不会改变。</p><div className="actions"><button className="button danger small" onClick={remove} disabled={busy}>确认移除</button><button className="button secondary small" onClick={() => setConfirming(false)} disabled={busy}>取消移除</button></div></div>}
    {fileInfo && <p className="muted">{role === 'resume' ? fileInfo.split('；')[0] : fileInfo}</p>}
    <MutationFeedback {...feedback} />{downloadError && <p className="form-error" role="alert">{downloadError}</p>}
  </section>
}
