import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { PortfolioProvider } from '../data/PortfolioProvider'

const navigation = [
  { to: '/admin', label: '内容概览', icon: '▦', end: true },
  { to: '/admin/profile', label: '个人信息', icon: '◎' },
  { to: '/admin/skills', label: '技能管理', icon: '◇' },
  { to: '/admin/projects', label: '项目管理', icon: '▤' },
  { to: '/admin/settings', label: '管理设置', icon: '⚙' },
]

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <PortfolioProvider source="draft">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <div className="admin-shell">
        <aside className="sidebar">
          <Link className="brand" to="/admin"><span className="brand-symbol">P<span>·</span></span><span>作品集管理<small>YOUR CREATIVE SPACE</small></span></Link>
          <button className="menu-toggle button secondary" aria-expanded={menuOpen} aria-controls="admin-nav" onClick={() => setMenuOpen(!menuOpen)}>管理菜单 {menuOpen ? '−' : '+'}</button>
          <nav id="admin-nav" className={menuOpen ? 'sidebar-nav open' : 'sidebar-nav'} aria-label="后台导航">
            {navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)}><span aria-hidden="true">{item.icon}</span>{item.label}</NavLink>)}
          </nav>
          <div className="sidebar-note"><span className="status-dot" />本机工作空间<p>先整理内容，再分享你的故事。</p></div>
          <Link className="back-site" to="/">← 返回公开网站</Link>
        </aside>
        <div className="admin-body">
          <header className="admin-topbar"><span>工作空间 <span className="muted">/ 内容管理</span></span><Link to="/preview" className="button secondary small">预览草稿 ↗</Link></header>
          <main id="main-content" className="admin-main"><Outlet /></main>
          <footer className="admin-footer">修改仅保存在当前浏览器 · 公开内容需通过静态发布更新</footer>
        </div>
      </div>
    </PortfolioProvider>
  )
}
