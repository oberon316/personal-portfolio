import { Link, useParams } from 'react-router-dom'
import { DataBoundary } from '../components/DataBoundary'
import { usePortfolio } from '../data/context'
import { AssetImage } from '../components/AssetImage'

export function ProjectDetailPage() {
  const { id } = useParams()
  const { data, source } = usePortfolio()
  const project = data?.projects.find((item) => item.id === id && (source === 'draft' || item.visible))
  const base = source === 'draft' ? '/preview' : '/'
  return <DataBoundary>{data && (project ? <article className="project-detail">
    <Link className="detail-back" to={`${base}#projects`}>← 返回项目列表</Link>
    <div className="detail-heading"><span className="eyebrow">PROJECT / 项目经历</span><h1>{project.title}</h1><p className="detail-summary">{project.summary || '项目简介待补充'}</p><div className="detail-meta"><span>{project.period || '项目时间待补充'}</span><div className="tags">{project.techStack.map((tag, index) => <span key={index}>{tag}</span>)}</div></div></div>
    {!project.visible && <div className="info-note"><p>此项目已隐藏，不会出现在首页。当前仅在本机草稿详情中预览。</p></div>}
    <AssetImage asset={project.cover} role="cover" alt={`${project.title}封面`} className="detail-cover" />
    <div className="detail-content"><section><span className="eyebrow">MY CONTRIBUTION</span><h2>个人职责</h2><p className="body-copy">{project.role || '个人职责待补充'}</p></section><section><span className="eyebrow">OUTCOMES & LEARNINGS</span><h2>成果与亮点</h2>{project.highlights.length ? <ul className="highlight-list">{project.highlights.map((highlight, index) => <li key={index}>{highlight}</li>)}</ul> : <p className="muted">尚未填写成果与亮点。</p>}</section></div>
    <div className="detail-links">{project.repoUrl && <a className="button" href={project.repoUrl} target="_blank" rel="noreferrer">查看代码 ↗</a>}{project.demoUrl && <a className="button secondary" href={project.demoUrl} target="_blank" rel="noreferrer">在线演示 ↗</a>}{!project.repoUrl && !project.demoUrl && <p className="muted">尚未提供代码仓库或在线演示链接。</p>}</div>
  </article> : <div className="state-panel"><span className="eyebrow">PROJECT NOT FOUND</span><h1>项目暂不可用</h1><p>该项目不存在，或未在当前版本中公开展示。</p><Link className="button secondary" to={`${base}#projects`}>返回项目列表</Link></div>)}</DataBoundary>
}
