import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DataBoundary } from '../../components/DataBoundary'
import { DeleteConfirmation } from '../../components/DeleteConfirmation'
import { MutationFeedback } from '../../components/MutationFeedback'
import { usePortfolio } from '../../data/context'
import { useDraftAction } from '../../hooks/useDraftAction'
import type { Project, ProjectInput } from '../../types/site'
import { sortedItems } from '../../utils/collections'
import { ProjectForm } from '../../components/ProjectForm'
import { AssetManager } from '../../components/AssetManager'

function ProjectsManager() {
  const { data } = usePortfolio()
  const feedback = useDraftAction()
  const [editor, setEditor] = useState<Project | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)
  if (!data) return null
  const items = sortedItems(data.projects)
  const locked = feedback.busy || editor !== null || pendingDelete !== null

  async function save(input: ProjectInput) {
    const original = editor && editor !== 'new' ? editor : undefined
    const ok = await feedback.run((api) => api.saveProject(input, original?.id, original), original ? '项目已更新并保存到本机。' : '项目已新增并保存到本机。')
    if (ok) setEditor(null)
    return ok
  }

  return <>
    <MutationFeedback {...feedback} />
    {editor && <ProjectForm key={editor === 'new' ? 'new' : editor.id} initial={editor === 'new' ? undefined : editor} busy={feedback.busy} onSave={save} onCancel={() => { setEditor(null); feedback.clear() }} />}
    {pendingDelete && <DeleteConfirmation name={pendingDelete.title} busy={feedback.busy} onCancel={() => { setPendingDelete(null); feedback.clear() }} onConfirm={async () => { if (await feedback.run((api) => api.deleteProject(pendingDelete.id, pendingDelete), '项目已删除并保存到本机。')) setPendingDelete(null) }} />}
    <section className="panel">
      <div className="panel-heading"><div><h2>项目清单</h2><p>共 {items.length} 项 · 上移、下移会立即保存顺序。</p></div><button className="button small" disabled={locked || items.length >= 100} onClick={() => { setEditor('new'); feedback.clear() }}>新增项目 +</button></div>
      {items.length ? <div className="managed-list">{items.map((project, index) => <article className="managed-item" key={project.id} aria-label={`项目：${project.title}`}>
        <div className="item-summary"><span className="item-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{project.title}</h3><span className="pill">{project.visible ? '首页展示' : '已隐藏'}</span><p>{project.period || '项目时间待补充'} · {project.summary || '项目简介待补充'}</p><div className="tags">{project.techStack.map((tag, i) => <span key={i}>{tag}</span>)}</div></div></div>
        <div className="item-actions"><Link className="item-preview" to={`/preview/projects/${encodeURIComponent(project.id)}`}>预览详情 ↗</Link><button className="button secondary small" disabled={locked || index === 0} aria-label={`上移项目 ${project.title}`} onClick={() => feedback.run((api) => api.moveProject(project.id, 'up'), '项目顺序已保存到本机。')}>↑ 上移</button><button className="button secondary small" disabled={locked || index === items.length - 1} aria-label={`下移项目 ${project.title}`} onClick={() => feedback.run((api) => api.moveProject(project.id, 'down'), '项目顺序已保存到本机。')}>↓ 下移</button><button className="button secondary small" disabled={locked} aria-label={`编辑项目 ${project.title}`} onClick={() => { setEditor(project); feedback.clear() }}>编辑</button><button className="button danger small" disabled={locked} aria-label={`删除项目 ${project.title}`} onClick={() => { setPendingDelete(project); feedback.clear() }}>删除</button></div>
        {!editor && !pendingDelete && <details className="cover-disclosure"><summary>管理项目封面</summary><AssetManager role="cover" asset={project.cover} projectId={project.id} /></details>}
      </article>)}</div> : <div className="empty-state"><span aria-hidden="true">▤</span><h3>还没有添加项目</h3><p>点击“新增项目”，填写真实的实践、个人职责和成果。</p></div>}
    </section>
  </>
}

export function ProjectsPage() {
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">PROJECTS</span><h1>项目管理</h1><p>从项目背景到个人职责，记录真实的实践过程。</p></div><Link className="button secondary" to="/preview#projects">预览项目 ↗</Link></div><DataBoundary><ProjectsManager /></DataBoundary></>
}
