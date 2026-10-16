import { z } from 'zod'

const shortText = z.string().trim().min(1, '不能为空').max(100, '最多 100 个字符')
const optionalWebUrl = z.string().trim().max(2000, '链接最多 2000 个字符').pipe(z.union([
  z.literal(''),
  z.url({ message: '请输入完整网址' }).refine((value) => {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  }, '仅允许 http 或 https 链接'),
])).optional()

export const assetRefSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('public'),
    url: z.string().regex(/^\/uploads\/[A-Za-z0-9][A-Za-z0-9._/-]*$/, '资源必须位于 /uploads/ 目录')
      .refine((value) => !value.split('/').some((part) => part === '.' || part === '..'), '资源路径无效'),
    name: shortText,
  }),
  z.strictObject({ kind: z.literal('local'), id: shortText, name: shortText }),
])

export const profileSchema = z.strictObject({
  name: shortText,
  title: shortText,
  tagline: z.string().trim().max(200, '最多 200 个字符'),
  bio: z.string().trim().max(3000, '最多 3000 个字符'),
  education: z.string().trim().max(1000, '最多 1000 个字符'),
  email: z.string().trim().pipe(z.union([z.literal(''), z.email({ message: '请输入有效邮箱' })])),
  githubUrl: optionalWebUrl,
  avatar: assetRefSchema.optional(),
  resume: assetRefSchema.optional(),
})

export const skillSchema = z.strictObject({
  id: shortText,
  name: shortText,
  category: shortText,
  proficiency: z.string().trim().max(200),
  order: z.number().int().min(0).max(100000),
})

export const projectSchema = z.strictObject({
  id: shortText,
  title: shortText,
  period: z.string().trim().max(100),
  summary: z.string().trim().max(1000),
  role: z.string().trim().max(1000),
  highlights: z.array(z.string().trim().min(1).max(1000)).max(30),
  techStack: z.array(shortText).max(30),
  cover: assetRefSchema.optional(),
  repoUrl: optionalWebUrl,
  demoUrl: optionalWebUrl,
  visible: z.boolean(),
  order: z.number().int().min(0).max(100000),
})

// 编辑表单的必填规则独立于读取 schema，已有的未完善草稿仍可读取和补充。
export const profileTextSchema = profileSchema.omit({ avatar: true, resume: true })
export const skillInputSchema = skillSchema.omit({ id: true, order: true })
export const projectInputSchema = projectSchema.omit({ id: true, order: true, cover: true }).extend({
  period: z.string().trim().min(1, '请填写项目时间').max(100, '最多 100 个字符'),
  summary: z.string().trim().min(1, '请填写项目简介').max(1000, '最多 1000 个字符'),
  role: z.string().trim().min(1, '请填写个人职责').max(1000, '最多 1000 个字符'),
  techStack: z.array(shortText).min(1, '请至少填写一项技术栈').max(30, '最多 30 项技术栈'),
})

export const siteDataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  contentVersion: shortText,
  updatedAt: z.iso.datetime({ offset: true }),
  profile: profileSchema,
  skills: z.array(skillSchema).max(200),
  projects: z.array(projectSchema).max(100),
}).superRefine((data, ctx) => {
  for (const field of ['skills', 'projects'] as const) {
    const ids = new Set<string>()
    data[field].forEach((item, index) => {
      if (ids.has(item.id)) ctx.addIssue({ code: 'custom', message: 'ID 不能重复', path: [field, index, 'id'] })
      ids.add(item.id)
    })
  }
})

export const publishedSiteSchema = siteDataSchema.superRefine((data, ctx) => {
  const assets = [data.profile.avatar, data.profile.resume, ...data.projects.map((project) => project.cover)]
  if (assets.some((asset) => asset?.kind === 'local')) {
    ctx.addIssue({ code: 'custom', message: '发布版不能引用本机文件，请先导出静态资源' })
  }
})
