import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DataBoundary } from '../../components/DataBoundary'
import { DeleteConfirmation } from '../../components/DeleteConfirmation'
import { MutationFeedback } from '../../components/MutationFeedback'
import { TextField } from '../../components/TextField'
import { usePortfolio } from '../../data/context'
import { useDraftAction } from '../../hooks/useDraftAction'
import { skillInputSchema } from '../../schemas/site'
import type { Skill, SkillInput } from '../../types/site'
import { sortedItems } from '../../utils/collections'
import { fieldErrors } from '../../utils/forms'

function SkillForm({ initial, busy, onSave, onCancel }: { initial?: Skill; busy: boolean; onSave: (input: SkillInput) => Promise<boolean>; onCancel: () => void }) {
  const [values, setValues] = useState<SkillInput>(() => initial ? skillInputSchema.parse({ name: initial.name, category: initial.category, proficiency: initial.proficiency }) : { name: '', category: '', proficiency: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = skillInputSchema.safeParse(values)
    if (!result.success) { setErrors(fieldErrors(result.error)); return }
    setErrors({})
    await onSave(result.data)
  }
  function change(key: keyof SkillInput, value: string) { setValues({ ...values, [key]: value }); setErrors({ ...errors, [key]: '' }) }
  return <form className="panel editor-panel" noValidate onSubmit={submit} aria-label={initial ? '编辑技能表单' : '新增技能表单'}>
    <div className="panel-heading"><div><h2>{initial ? '编辑技能' : '新增技能'}</h2><p>带 * 的为必填项。保存后才会出现在草稿预览中。</p></div></div>
    <fieldset disabled={busy} className="form-fields form-grid">
      <TextField label="技能名称" required value={values.name} onChange={(value) => change('name', value)} maxLength={100} error={errors.name} placeholder="填写你实际掌握的技能" />
      <TextField label="技能分类" required value={values.category} onChange={(value) => change('category', value)} maxLength={100} error={errors.category} placeholder="如：前端开发、设计工具" />
      <TextField label="熟练程度说明" fullWidth value={values.proficiency} onChange={(value) => change('proficiency', value)} maxLength={200} error={errors.proficiency} placeholder="选填，描述你能独立完成的工作" />
    </fieldset>
    {Object.values(errors).some(Boolean) && <p className="form-error" role="alert">请检查标红字段后再保存。</p>}
    <div className="form-footer"><p className="muted">仅保存到当前浏览器。</p><div className="actions"><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>取消编辑</button><button className="button" disabled={busy}>{busy ? '正在保存…' : '保存技能'}</button></div></div>
  </form>
}

function SkillsManager() {
  const { data } = usePortfolio()
  const feedback = useDraftAction()
  const [editor, setEditor] = useState<Skill | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Skill | null>(null)
  if (!data) return null
  const items = sortedItems(data.skills)
  const locked = feedback.busy || editor !== null || pendingDelete !== null

  async function save(input: SkillInput) {
    const original = editor && editor !== 'new' ? editor : undefined
    const ok = await feedback.run((api) => api.saveSkill(input, original?.id, original), original ? '技能已更新并保存到本机。' : '技能已新增并保存到本机。')
    if (ok) setEditor(null)
    return ok
  }

  return <>
    <MutationFeedback {...feedback} />
    {editor && <SkillForm key={editor === 'new' ? 'new' : editor.id} initial={editor === 'new' ? undefined : editor} busy={feedback.busy} onSave={save} onCancel={() => { setEditor(null); feedback.clear() }} />}
    {pendingDelete && <DeleteConfirmation name={pendingDelete.name} busy={feedback.busy} onCancel={() => { setPendingDelete(null); feedback.clear() }} onConfirm={async () => { if (await feedback.run((api) => api.deleteSkill(pendingDelete.id, pendingDelete), '技能已删除并保存到本机。')) setPendingDelete(null) }} />}
    <section className="panel">
      <div className="panel-heading"><div><h2>技能清单</h2><p>共 {items.length} 项 · 上移、下移会立即保存顺序。</p></div><button className="button small" disabled={locked || items.length >= 200} onClick={() => { setEditor('new'); feedback.clear() }}>新增技能 +</button></div>
      {items.length ? <div className="managed-list">{items.map((skill, index) => <article className="managed-item" key={skill.id} aria-label={`技能：${skill.name}`}>
        <div className="item-summary"><span className="item-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{skill.name}</h3><span className="pill wrapping-pill">{skill.category}</span><p>{skill.proficiency || '尚未填写熟练程度说明'}</p></div></div>
        <div className="item-actions"><button className="button secondary small" disabled={locked || index === 0} aria-label={`上移技能 ${skill.name}`} onClick={() => feedback.run((api) => api.moveSkill(skill.id, 'up'), '技能顺序已保存到本机。')}>↑ 上移</button><button className="button secondary small" disabled={locked || index === items.length - 1} aria-label={`下移技能 ${skill.name}`} onClick={() => feedback.run((api) => api.moveSkill(skill.id, 'down'), '技能顺序已保存到本机。')}>↓ 下移</button><button className="button secondary small" disabled={locked} aria-label={`编辑技能 ${skill.name}`} onClick={() => { setEditor(skill); feedback.clear() }}>编辑</button><button className="button danger small" disabled={locked} aria-label={`删除技能 ${skill.name}`} onClick={() => { setPendingDelete(skill); feedback.clear() }}>删除</button></div>
      </article>)}</div> : <div className="empty-state"><span aria-hidden="true">◇</span><h3>还没有添加技能</h3><p>点击“新增技能”，记录你真实掌握的知识和工具。</p></div>}
    </section>
  </>
}

export function SkillsPage() {
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">SKILLS</span><h1>技能管理</h1><p>分类整理你的能力，用实际经验说明熟练程度。</p></div><Link className="button secondary" to="/preview#skills">预览技能 ↗</Link></div><DataBoundary><SkillsManager /></DataBoundary></>
}
