import { Link, Outlet } from 'react-router-dom'
import { useState } from 'react'
import type { DataSource } from '../types/site'
import { PortfolioProvider } from '../data/PortfolioProvider'
import { ScrollToLocation } from '../components/ScrollToLocation'

export function PublicLayout({ source }: { source: DataSource }) {
  const preview = source === 'draft'
  const [menuOpen, setMenuOpen] = useState(false)
  const base = preview ? '/preview' : '/'
  return (
    <PortfolioProvider key={source} source={source}>
      <ScrollToLocation />
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      {preview && <div className="preview-banner"><span>本机草稿预览 · 保存的修改尚未公开发布</span><Link to="/admin/profile">返回编辑 ↗</Link></div>}
      <header className="public-header shell">
        <Link className="brand" to={preview ? '/preview' : '/'}><span className="brand-symbol">P<span>·</span></span><span>个人作品集<small>PERSONAL PORTFOLIO</small></span></Link>
        <button className="public-menu-toggle button secondary small" aria-controls="public-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>导航 {menuOpen ? '−' : '+'}</button>
        <nav id="public-navigation" className={`public-nav${menuOpen ? ' open' : ''}`} aria-label="前台导航" onClick={() => setMenuOpen(false)}><Link to={`${base}#about`}>关于</Link><Link to={`${base}#skills`}>技能</Link><Link to={`${base}#projects`}>项目</Link><Link to={`${base}#contact`}>联系</Link><Link className="nav-admin" to="/admin">内容管理 <span aria-hidden="true">↗</span></Link></nav>
      </header>
      <main id="main-content" className="shell public-main"><Outlet /></main>
      <footer className="shell public-footer"><span>个人作品集 / 持续记录与成长</span><Link to={preview ? '/' : '/preview'}>{preview ? '查看公开版本' : '本机草稿预览'} ↗</Link></footer>
    </PortfolioProvider>
  )
}
