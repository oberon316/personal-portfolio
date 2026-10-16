import { Link } from 'react-router-dom'
import { DataBoundary } from '../../components/DataBoundary'
import { usePortfolio } from '../../data/context'
import { formatDate } from '../../utils/format'

export function DashboardPage() {
  const { data } = usePortfolio()
  return <>
    <div className="page-heading"><span className="eyebrow">OVERVIEW</span><h1>让你的故事，逐渐完整。</h1><p>从个人介绍开始，整理技能与作品，构建属于你的展示空间。</p></div>
    <DataBoundary>{data && <>
      <div className="stats-grid">
        <div className="stat-card"><span>技能条目</span><strong>{data.skills.length.toString().padStart(2, '0')}</strong><Link to="/admin/skills">查看技能 →</Link></div>
        <div className="stat-card"><span>项目经历</span><strong>{data.projects.length.toString().padStart(2, '0')}</strong><Link to="/admin/projects">查看项目 →</Link></div>
        <div className="stat-card"><span>草稿状态</span><strong className="text-stat">本机保存</strong><small>最近修改：{formatDate(data.updatedAt)}</small></div>
      </div>
      <div className="dashboard-grid">
        <section className="panel welcome-panel"><span className="eyebrow">START WITH YOU</span><h2>先从一句自我介绍开始。</h2><p>填写个人信息，在预览中查看你的作品集。每一次小小的完善，都让你的故事更清晰。</p><Link to="/admin/profile" className="button">编辑个人信息 ↗</Link><span className="welcome-mark" aria-hidden="true">✳</span></section>
        <section className="panel"><h2>整理你的展示内容</h2><div className="checklist"><Link to="/admin/profile"><span>01</span><div>个人信息<small>介绍、教育与联系方式</small></div><span>↗</span></Link><Link to="/admin/skills"><span>02</span><div>技能与工具<small>分类整理你的能力</small></div><span>↗</span></Link><Link to="/admin/projects"><span>03</span><div>项目经历<small>留下真实的实践记录</small></div><span>↗</span></Link></div></section>
      </div>
      <div className="info-note"><span aria-hidden="true">ⓘ</span><p>这里编辑的是当前浏览器的草稿。保存后可前往预览；公开首页始终显示已发布的静态内容。</p><Link to="/preview">打开预览 →</Link></div>
    </>}</DataBoundary>
  </>
}
