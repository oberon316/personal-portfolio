import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DataBoundary } from '../../components/DataBoundary'
import { MutationFeedback } from '../../components/MutationFeedback'
import { TextField } from '../../components/TextField'
import { AssetManager } from '../../components/AssetManager'
import { usePortfolio } from '../../data/context'
import { useDraftAction } from '../../hooks/useDraftAction'
import { profileTextSchema } from '../../schemas/site'
import type { ProfileText } from '../../types/site'
import { fieldErrors } from '../../utils/forms'

const fields = [
  { key: 'name', label: '姓名或昵称', max: 100, required: true, placeholder: '填写你的姓名或公开昵称' },
  { key: 'title', label: '目标职位 / 身份', max: 100, required: true, placeholder: '填写你的真实身份或目标方向' },
  { key: 'tagline', label: '一句话介绍', max: 200, placeholder: '用一句话介绍你正在做什么' },
  { key: 'bio', label: '个人简介', max: 3000, multiline: true, placeholder: '分享真实的经历、兴趣与探索方向' },
  { key: 'education', label: '教育经历', max: 1000, multiline: true, placeholder: '填写真实的学校、专业与学习经历' },
  { key: 'email', label: '公开邮箱', max: 254, type: 'email', placeholder: '选填，用于公开联系方式' },
  { key: 'githubUrl', label: 'GitHub 地址', max: 2000, type: 'url', placeholder: '选填，https://github.com/你的用户名' },
] as const

function ProfileForm() {
  const { data } = usePortfolio()
  const feedback = useDraftAction()
  const [values, setValues] = useState<ProfileText>(() => profileTextSchema.strip().parse(data!.profile))
  const [baseline, setBaseline] = useState(values)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const latest = data ? profileTextSchema.strip().parse(data.profile) : baseline
  const changedElsewhere = JSON.stringify(latest) !== JSON.stringify(baseline)
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = profileTextSchema.safeParse(values)
    if (!result.success) { setErrors(fieldErrors(result.error)); feedback.clear(); return }
    setErrors({})
    if (await feedback.run((api) => api.updateProfile(result.data, baseline), '已保存到本机，可前往预览查看修改。')) {
      setBaseline(result.data)
      setValues(result.data)
    }
  }

  return <>
    <MutationFeedback {...feedback} />
    {changedElsewhere && <div className="info-note conflict-note"><p>其他页面已更新个人资料。你正在输入的内容仍保留，请先重新载入最新资料再继续编辑。</p><button className="button secondary small" onClick={() => { setValues(latest); setBaseline(latest); setErrors({}); feedback.clear() }}>载入最新资料</button></div>}
    <form className="panel profile-form" noValidate onSubmit={onSubmit}>
      <div className="panel-heading"><div><h2>基本资料与联系方式</h2><p>只填写你准备公开的信息，带 * 的为必填项。</p></div><span className="pill">{dirty ? '有未保存修改' : '本机草稿'}</span></div>
      <fieldset disabled={feedback.busy} className="form-grid form-fields">
        {fields.map((field) => <TextField key={field.key} label={field.label} value={values[field.key] || ''} onChange={(value) => { setValues({ ...values, [field.key]: value }); setErrors({ ...errors, [field.key]: '' }); feedback.clear() }} error={errors[field.key]} required={'required' in field} multiline={'multiline' in field} rows={field.key === 'bio' ? 5 : 3} fullWidth={'multiline' in field || field.key === 'tagline'} maxLength={field.max} type={'type' in field ? field.type : 'text'} placeholder={field.placeholder} />)}
      </fieldset>
      <div className="form-footer"><p className="muted">{Object.values(errors).some(Boolean) ? '请检查标红字段后再保存。' : '保存仅影响本机草稿，不会修改公开首页。'}</p><button className="button" disabled={feedback.busy || changedElsewhere}>{feedback.busy ? '正在保存…' : '保存到本机'}</button></div>
    </form>
  </>
}

export function ProfilePage() {
  const { data } = usePortfolio()
  return <>
    <div className="page-heading heading-with-action"><div><span className="eyebrow">PROFILE</span><h1>个人信息</h1><p>让访客认识你，从真实而清晰的介绍开始。</p></div><Link className="button secondary" to="/preview">预览修改 ↗</Link></div>
    <DataBoundary>{data && <><ProfileForm /><section className="panel"><div className="panel-heading"><div><h2>头像与简历</h2><p>选择文件后自动保存到本机。公开版本通过发布包更新。</p></div></div><div className="asset-manager-grid"><AssetManager role="avatar" asset={data.profile.avatar} /><AssetManager role="resume" asset={data.profile.resume} /></div></section></>}</DataBoundary>
  </>
}
