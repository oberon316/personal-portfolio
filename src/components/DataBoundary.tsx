import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolio } from '../data/context'

export function DataBoundary({ children }: { children: ReactNode }) {
  const { loading, error, reload, source } = usePortfolio()
  if (loading) return <div className="state-panel" role="status"><span className="spinner" />正在读取{source === 'draft' ? '本机草稿' : '发布内容'}…</div>
  if (error) return (
    <div className="state-panel error-panel" role="alert">
      <h2>暂时无法读取内容</h2><p>{error}</p>
      <div className="actions"><button className="button" onClick={reload}>重新读取</button>
        {source === 'draft' && <Link className="button secondary" to="/admin/settings">管理设置</Link>}
      </div>
    </div>
  )
  return children
}
