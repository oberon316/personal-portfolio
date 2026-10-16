import { useState } from 'react'
import type { FormEvent } from 'react'
import { projectInputSchema } from '../schemas/site'
import type { Project, ProjectInput } from '../types/site'
import { fieldErrors, parseLines, parseTags } from '../utils/forms'
import { TextField } from './TextField'

export function ProjectForm({ initial, busy, onSave, onCancel }: { initial?: Project; busy: boolean; onSave: (input: ProjectInput) => Promise<boolean>; onCancel: () => void }) {
  const [values, setValues] = useState(() => ({ title: initial?.title ?? '', period: initial?.period ?? '', summary: initial?.summary ?? '', role: initial?.role ?? '', highlights: initial?.highlights.join('\n') ?? '', techStack: initial?.techStack.join(', ') ?? '', repoUrl: initial?.repoUrl ?? '', demoUrl: initial?.demoUrl ?? '', visible: initial?.visible ?? true }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  function change(key: keyof typeof values, value: string | boolean) { setValues({ ...values, [key]: value }); setErrors({ ...errors, [key]: '' }) }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = projectInputSchema.safeParse({ ...values, repoUrl: values.repoUrl.trim(), demoUrl: values.demoUrl.trim(), highlights: parseLines(values.highlights), techStack: parseTags(values.techStack) })
    if (!result.success) { setErrors(fieldErrors(result.error)); return }
    setErrors({})
    await onSave(result.data)
  }

  return <form className="panel editor-panel" noValidate onSubmit={submit} aria-label={initial ? '编辑项目表单' : '新增项目表单'}>
    <div className="panel-heading"><div><h2>{initial ? '编辑项目' : '新增项目'}</h2><p>带 * 的为必填项。请填写真实经历，不需要编造项目成果。</p></div></div>
    <fieldset disabled={busy} className="form-fields form-grid">
      <TextField label="项目名称" required value={values.title} onChange={(value) => change('title', value)} maxLength={100} error={errors.title} />
      <TextField label="项目时间" required value={values.period} onChange={(value) => change('period', value)} maxLength={100} error={errors.period} placeholder="填写实际起止时间" />
      <TextField label="项目简介" required multiline fullWidth value={values.summary} onChange={(value) => change('summary', value)} maxLength={1000} error={errors.summary} placeholder="介绍项目背景、目标和主要功能" />
      <TextField label="个人职责" required multiline fullWidth value={values.role} onChange={(value) => change('role', value)} maxLength={1000} error={errors.role} placeholder="描述你实际承担的工作" />
      <TextField label="技术栈" required multiline rows={2} fullWidth value={values.techStack} onChange={(value) => change('techStack', value)} maxLength={4000} error={errors.techStack} hint="用英文或中文逗号分隔，最多 30 项；也可以每行一项。" />
      <TextField label="成果与亮点" multiline fullWidth value={values.highlights} onChange={(value) => change('highlights', value)} maxLength={30029} error={errors.highlights} hint="选填，每行一项，最多 30 项。没有验证过的数字或成果请勿填写。" />
      <TextField label="代码仓库链接" type="url" value={values.repoUrl} onChange={(value) => change('repoUrl', value)} maxLength={2000} error={errors.repoUrl} hint="选填，仅支持 http 或 https。" />
      <TextField label="在线演示链接" type="url" value={values.demoUrl} onChange={(value) => change('demoUrl', value)} maxLength={2000} error={errors.demoUrl} hint="选填，没有线上演示可留空。" />
      <label className="checkbox-field full-width"><input type="checkbox" checked={values.visible} onChange={(event) => change('visible', event.target.checked)} /><span>在首页展示此项目<small>隐藏后仍保留在后台，可从后台预览详情。</small></span></label>
    </fieldset>
    {Object.values(errors).some(Boolean) && <p className="form-error" role="alert">请检查标红字段后再保存。</p>}
    <div className="form-footer"><p className="muted">仅保存到当前浏览器。</p><div className="actions"><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>取消编辑</button><button className="button" disabled={busy}>{busy ? '正在保存…' : '保存项目'}</button></div></div>
  </form>
}
