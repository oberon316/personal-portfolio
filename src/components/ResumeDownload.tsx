import { useState } from 'react'
import { describeError, portfolioApi } from '../api/portfolio'
import type { AssetRef } from '../types/site'
import { downloadBlob } from '../utils/download'

export function ResumeDownload({ asset }: { asset?: AssetRef }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!asset) return <span className="muted">简历尚未提供</span>
  async function download() {
    if (!asset) return
    setBusy(true)
    setError('')
    try { const file = await portfolioApi.readAsset(asset, 'resume'); downloadBlob(file.blob, file.name) }
    catch (reason) { setError(describeError(reason)) }
    finally { setBusy(false) }
  }
  return <div className="resume-download"><button className="button secondary" onClick={download} disabled={busy}>{busy ? '读取简历…' : '下载简历 ↓'}</button>{error && <p className="form-error" role="alert">{error}</p>}</div>
}
