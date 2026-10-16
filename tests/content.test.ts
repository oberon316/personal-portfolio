import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createPortfolioApi } from '../src/api/portfolio.ts'
import { profileTextSchema, publishedSiteSchema, siteDataSchema } from '../src/schemas/site.ts'
import type { ProjectInput, SkillInput } from '../src/types/site.ts'

const published = publishedSiteSchema.parse(JSON.parse(readFileSync(new URL('./fixtures/site.json', import.meta.url), 'utf8')))
const skill: SkillInput = { name: '测试技能 A', category: '验收数据', proficiency: '仅用于测试' }
const project: ProjectInput = { title: '验收项目 A', period: '测试期间', summary: '仅用于验证项目流程的测试内容。', role: '执行功能验证。', techStack: ['测试工具'], highlights: ['验证保存与预览'], visible: true, repoUrl: '', demoUrl: '' }

function setup() {
  let raw: string | null = JSON.stringify(published)
  let id = 0
  let denyWrite = false
  const api = createPortfolioApi({
    storage: { read: () => raw, write: (value) => { if (denyWrite) throw new Error('quota'); raw = value }, remove: () => { raw = null } },
    fetcher: async () => new Response(JSON.stringify(published), { headers: { 'content-type': 'application/json' } }),
    newId: () => `test-${++id}`,
  })
  return { api, raw: () => raw, setRaw: (value: string) => { raw = value }, denyWrite: () => { denyWrite = true } }
}

test('技能新增、编辑、上移、下移、删除持久化，ID 稳定且顺序连续', async () => {
  const { api } = setup()
  const first = (await api.saveSkill(skill)).skills[0]
  const second = (await api.saveSkill({ ...skill, name: '测试技能 B' })).skills[1]
  let data = await api.saveSkill({ ...skill, proficiency: '已编辑' }, first.id, first)
  assert.equal(data.skills[0].id, first.id)
  assert.equal(data.skills[0].proficiency, '已编辑')
  data = await api.moveSkill(second.id, 'up')
  assert.deepEqual(data.skills.map((item) => item.id), [second.id, first.id])
  data = await api.moveSkill(second.id, 'up')
  assert.equal(data.skills[0].id, second.id)
  await api.moveSkill(second.id, 'down')
  data = await api.deleteSkill(first.id)
  assert.deepEqual(data.skills.map((item) => [item.id, item.order]), [[second.id, 0]])
  assert.deepEqual((await api.getDraft()).skills, data.skills)
  assert.deepEqual((await api.getPublished()).skills, [])
})

test('项目完整编辑、排序、可见性及删除不会改变发布版', async () => {
  const { api } = setup()
  const first = (await api.saveProject(project)).projects[0]
  const second = (await api.saveProject({ ...project, title: '验收项目 B' })).projects[1]
  await api.saveProject({ ...project, title: '验收项目已编辑', visible: false, highlights: ['修改后的测试亮点'] }, first.id, first)
  let data = await api.moveProject(second.id, 'up')
  assert.deepEqual(data.projects.map((item) => item.id), [second.id, first.id])
  assert.equal(data.projects[1].visible, false)
  assert.deepEqual(data.projects[1].highlights, ['修改后的测试亮点'])
  await api.moveProject(second.id, 'down')
  data = await api.deleteProject(first.id)
  assert.deepEqual(data.projects.map((item) => [item.id, item.order]), [[second.id, 0]])
  assert.deepEqual((await api.getPublished()).projects, [])
})

test('个人资料更新从最新草稿合并，保留其他条目和文件引用', async () => {
  const state = setup()
  const draft = await state.api.getDraft()
  draft.profile.avatar = { kind: 'public', url: '/uploads/test.webp', name: 'test.webp' }
  state.setRaw(JSON.stringify(draft))
  const baseline = profileTextSchema.strip().parse(draft.profile)
  await state.api.saveSkill(skill)
  const data = await state.api.updateProfile({ ...baseline, bio: '这是测试简介', education: '这是测试教育信息', email: 'test@example.com' }, baseline)
  assert.equal(data.skills.length, 1)
  assert.deepEqual(data.profile.avatar, draft.profile.avatar)
  assert.equal(data.profile.email, 'test@example.com')
})

test('同一页面同时触发的更新依次合并，避免丢失新增条目', async () => {
  const { api } = setup()
  await Promise.all([api.saveSkill(skill), api.saveSkill({ ...skill, name: '测试技能 B' }), api.saveProject(project)])
  const data = await api.getDraft()
  assert.equal(data.skills.length, 2)
  assert.equal(data.projects.length, 1)
  assert.deepEqual(data.skills.map((item) => item.order), [0, 1])
})

test('过期编辑和删除会被拒绝，删除后的条目不会被旧表单复活', async () => {
  const { api } = setup()
  const first = (await api.saveSkill(skill)).skills[0]
  await api.saveSkill({ ...skill, name: '另一页面的修改' }, first.id, first)
  await assert.rejects(api.saveSkill(skill, first.id, first), /其他页面修改/)
  await assert.rejects(api.deleteSkill(first.id, first), /其他页面修改/)
  await api.deleteSkill(first.id)
  await assert.rejects(api.saveSkill(skill, first.id, first), /已被删除/)
  assert.deepEqual((await api.getDraft()).skills, [])
})

test('项目文本更新保留封面，过期项目不能覆盖或删除新内容', async () => {
  const state = setup()
  let draft = await state.api.saveProject(project)
  draft.projects[0].cover = { kind: 'public', url: '/uploads/cover.webp', name: 'cover.webp' }
  state.setRaw(JSON.stringify(draft))
  const original = (await state.api.getDraft()).projects[0]
  draft = await state.api.saveProject({ ...project, role: '更新的测试职责' }, original.id, original)
  assert.deepEqual(draft.projects[0].cover, original.cover)
  await assert.rejects(state.api.deleteProject(original.id, original), /其他页面修改/)
  await assert.rejects(state.api.saveProject(project, original.id, original), /其他页面修改/)
})

test('其他页面修改资料时拒绝覆盖，并保留最新草稿', async () => {
  const { api } = setup()
  const baseline = profileTextSchema.strip().parse((await api.getDraft()).profile)
  await api.updateProfile({ ...baseline, bio: '另一页面的简介' }, baseline)
  await assert.rejects(api.updateProfile({ ...baseline, bio: '旧表单内容' }, baseline), /其他页面更新/)
  assert.equal((await api.getDraft()).profile.bio, '另一页面的简介')
})

test('新增和编辑均验证必填项、协议与技术栈，不写入无效内容', async () => {
  const state = setup()
  const before = state.raw()
  for (const input of [{ ...skill, name: '  ' }, { ...skill, category: '' }]) {
    await assert.rejects(async () => state.api.saveSkill(input))
  }
  for (const input of [{ ...project, title: '' }, { ...project, period: '' }, { ...project, summary: '' }, { ...project, role: '' }, { ...project, techStack: [] }, { ...project, repoUrl: 'javascript:alert(1)' }]) {
    await assert.rejects(async () => state.api.saveProject(input))
  }
  assert.equal(state.raw(), before)
})

test('损坏草稿阻止条目增删改，不会被操作间接覆盖', async () => {
  const state = setup()
  state.setRaw('{broken')
  await assert.rejects(state.api.saveSkill(skill), /已损坏/)
  await assert.rejects(state.api.saveProject(project), /已损坏/)
  await assert.rejects(state.api.deleteSkill('missing'), /已损坏/)
  assert.equal(state.raw(), '{broken')
})

test('条目写入失败后保留原数据，失败不会阻塞后续队列', async () => {
  const state = setup()
  await assert.rejects(state.api.deleteProject('missing'), /已不存在/)
  await state.api.saveProject(project)
  const before = state.raw()
  state.denyWrite()
  await assert.rejects(state.api.saveSkill(skill), /无法保存/)
  assert.equal(state.raw(), before)
})

test('条目容量上限及重复 ID 校验失败时不写入', async () => {
  const state = setup()
  const full = { ...published, skills: Array.from({ length: 200 }, (_, index) => ({ ...skill, id: `skill-${index}`, order: index })) }
  state.setRaw(JSON.stringify(full))
  assert.equal(siteDataSchema.safeParse(full).success, true)
  const before = state.raw()
  await assert.rejects(state.api.saveSkill(skill))
  assert.equal(state.raw(), before)
})
