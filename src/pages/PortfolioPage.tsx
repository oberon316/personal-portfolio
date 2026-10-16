import { DataBoundary } from '../components/DataBoundary'
import { SectionHeading } from '../components/SectionHeading'
import { usePortfolio } from '../data/context'
import { Link } from 'react-router-dom'
import { sortedItems } from '../utils/collections'
import { AssetImage } from '../components/AssetImage'
import { ResumeDownload } from '../components/ResumeDownload'

export function PortfolioPage() {
  const { data, source } = usePortfolio()
  const projectBase = source === 'draft' ? '/preview/projects/' : '/projects/'
  const skillGroups = new Map<string, NonNullable<typeof data>['skills']>()
  if (data) for (const skill of sortedItems(data.skills)) {
    skillGroups.set(skill.category, [...(skillGroups.get(skill.category) ?? []), skill])
  }
  return <DataBoundary>{data && <>
    <section className="hero-grid">
      <div className="hero-copy">
        <span className="eyebrow"><span className="status-dot" />{source === 'draft' ? '本机草稿' : '个人展示空间'}</span>
        <p className="hero-greeting">你好，我是</p>
        <h1>{data.profile.name}<span className="accent">.</span></h1>
        <p className="hero-title">{data.profile.title}</p>
        <p className="hero-description">{data.profile.tagline || '在这里，用自己的故事介绍自己。'}</p>
        <div className="actions">
          <a className="button" href="#projects">查看项目 <span aria-hidden="true">↗</span></a>
          <ResumeDownload asset={data.profile.resume} />
        </div>
      </div>
      <div className="identity-card">
        <span className="card-corner">ABOUT / ME</span>
        <AssetImage asset={data.profile.avatar} role="avatar" alt={`${data.profile.name}的头像`} className="portrait" />
        <div className="identity-caption"><span>{data.profile.name}</span><span className="accent" aria-hidden="true">✳</span></div>
        <p>{data.profile.title}</p>
      </div>
    </section>
    <section id="about" className="portfolio-section about-grid">
      <SectionHeading number="01" title="关于我" description="经历、兴趣，以及正在探索的方向" />
      <div className="about-content"><p className="body-copy">{data.profile.bio || '个人简介尚未填写。请在管理页补充真实的学习、实践经历与兴趣方向。'}</p><div className="education"><span className="eyebrow">教育经历</span><p>{data.profile.education || '教育信息尚未填写'}</p></div></div>
    </section>
    <section id="skills" className="portfolio-section">
      <SectionHeading number="02" title="技能与工具" description="把所学，变成解决问题的能力" />
      {data.skills.length
        ? <div className="skill-groups">{[...skillGroups].map(([category, skills]) => <section className="skill-group" key={category}><h3 className="skill-category">{category}</h3><div className="skill-grid">{skills.map((skill) => <article className="content-card" key={skill.id}><h4>{skill.name}</h4><p>{skill.proficiency || '熟练程度待补充'}</p></article>)}</div></section>)}</div>
        : <div className="empty-state"><span aria-hidden="true">◇</span><h3>技能清单，等待补充</h3><p>在管理页添加你真实掌握的技能与工具。</p></div>}
    </section>
    <section id="projects" className="portfolio-section">
      <SectionHeading number="03" title="项目经历" description="记录从想法到实现的每一步" />
      {data.projects.some((project) => project.visible)
        ? <div className="project-grid">{sortedItems(data.projects).filter((project) => project.visible).map((project) => <article className="content-card" key={project.id}>
          <AssetImage asset={project.cover} role="cover" alt={`${project.title}封面`} className="project-cover" />
          <span className="eyebrow">{project.period || '项目经历'}</span><h3><Link to={`${projectBase}${encodeURIComponent(project.id)}`}>{project.title}</Link></h3><p className="project-excerpt">{project.summary}</p>
          <div className="tags">{project.techStack.map((tag, index) => <span key={index}>{tag}</span>)}</div>
          <div className="actions"><Link className="detail-link" to={`${projectBase}${encodeURIComponent(project.id)}`}>查看项目详情 ↗</Link></div>
        </article>)}</div>
        : <div className="empty-state"><span aria-hidden="true">↗</span><h3>下一个作品，即将从这里出发</h3><p>项目尚未添加，未来在这里展示真实的实践与成果。</p></div>}
    </section>
    <section id="contact" className="contact-section">
      <div><span className="eyebrow">LET’S CONNECT</span><h2>保持联系<span className="accent">↗</span></h2><p>交流想法，也分享新的可能。</p></div>
      <div className="contact-links">{data.profile.email ? <a href={`mailto:${data.profile.email}`}>{data.profile.email} ↗</a> : <span className="muted">联系邮箱尚未填写</span>}{data.profile.githubUrl && <a href={data.profile.githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a>}</div>
    </section>
    {source === 'draft' && <div className="preview-bottom"><Link className="button secondary" to="/admin">返回内容管理 ↗</Link><Link to="/">查看公开版本 →</Link></div>}
  </>}</DataBoundary>
}
