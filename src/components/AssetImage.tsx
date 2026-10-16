import { useState } from 'react'
import type { AssetRef } from '../types/site'
import { useAssetUrl } from '../hooks/useAssetUrl'

export function AssetImage({ asset, alt, role, className = '' }: { asset?: AssetRef; alt: string; role: 'avatar' | 'cover'; className?: string }) {
  const { url, key, loading, error } = useAssetUrl(asset, role)
  const [failedKey, setFailedKey] = useState('')
  if (!asset && role === 'cover') return null
  if (!asset && role === 'avatar') return <div className="avatar-placeholder" aria-label="尚未设置头像"><span>ME</span><small>你的故事，从这里开始</small></div>
  if (loading) return <div className={`image-state ${className}`} role="status">正在读取图片…</div>
  if (error || failedKey === key) return <div className={`image-state ${className}`} role="status">图片暂不可用，请在管理页重新上传。</div>
  return url ? <img src={url} alt={alt} className={className} onError={() => setFailedKey(key)} /> : null
}
