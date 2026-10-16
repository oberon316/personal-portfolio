import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <div className="state-panel not-found"><span className="eyebrow">404 / PAGE NOT FOUND</span><h1>这页还没有故事。</h1><p>页面不存在，请检查地址或返回首页。</p><div className="actions"><Link className="button" to="/">返回首页</Link><Link className="button secondary" to="/admin">管理概览</Link></div></div>
}
