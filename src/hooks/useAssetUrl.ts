import { useEffect, useState } from 'react'
import { describeError, portfolioApi } from '../api/portfolio'
import type { AssetRef } from '../types/site'
import type { AssetRole } from '../utils/media'

export function useAssetUrl(asset: AssetRef | undefined, role: AssetRole) {
  const key = JSON.stringify(asset ?? null)
  const [state, setState] = useState({ key: '', url: '', error: '' })
  useEffect(() => {
    let active = true
    let objectUrl = ''
    const ref = JSON.parse(key) as AssetRef | null
    void Promise.resolve().then(async () => {
      if (!ref) return ''
      if (ref.kind === 'public') return ref.url
      const file = await portfolioApi.readAsset(ref, role)
      objectUrl = URL.createObjectURL(file.blob)
      return objectUrl
    }).then((url) => { if (active) setState({ key, url, error: '' }); else if (objectUrl) URL.revokeObjectURL(objectUrl) },
      (error: unknown) => { if (active) setState({ key, url: '', error: describeError(error) }) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
    // key 是资源引用内容，不因父组件产生等价对象而重建 URL。
  }, [key, role])
  return state.key === key ? { ...state, loading: false } : { key, url: '', error: '', loading: Boolean(asset) }
}
