import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createPortfolioApi } from '../src/api/portfolio.ts'
import { projectInputSchema, publishedSiteSchema, siteDataSchema } from '../src/schemas/site.ts'
import type { DraftStorage } from '../src/storage/draft.ts'

// Keep mutation tests independent of the portfolio owner's current release.
const published = publishedSiteSchema.parse(JSON.parse(readFileSync(new URL('./fixtures/site.json', import.meta.url), 'utf8')))

function setup(initial: string | null = null) {
  let raw = initial
  let writes = 0
  const storage: DraftStorage = {
    read: () => raw,
    write: (value) => { raw = value; writes += 1 },
    remove: () => { raw = null },
  }
  const fetcher: typeof fetch = async () => new Response(JSON.stringify(published), { headers: { 'content-type': 'application/json; charset=utf-8' } })
  const api = createPortfolioApi({ storage, fetcher, now: () => '2026-10-16T12:00:00.000Z' })
  return { api, storage, fetcher, raw: () => raw, writes: () => writes }
}

test('当前仓库发布数据通过 schema 与项目必填检查', () => {
  const actual = publishedSiteSchema.parse(JSON.parse(readFileSync(new URL('../public/data/site.json', import.meta.url), 'utf8')))
  for (const project of actual.projects) projectInputSchema.strip().parse(project)
})

test('首次读取草稿从发布版初始化，后续读取不覆盖', async () => {
  const state = setup()
  assert.deepEqual(await state.api.getDraft(), published)
  assert.equal(state.writes(), 1)
  await state.api.getDraft()
  assert.equal(state.writes(), 1)
})

test('保存草稿后重新创建适配器仍能读取，公开版本保持不变', async () => {
  const state = setup()
  const draft = await state.api.getDraft()
  draft.profile.name = '测试草稿姓名'
  const saved = await state.api.saveDraft(draft)
  assert.equal(saved.updatedAt, '2026-10-16T12:00:00.000Z')
  const reopened = createPortfolioApi({ storage: state.storage, fetcher: state.fetcher })
  assert.equal((await reopened.getDraft()).profile.name, '测试草稿姓名')
  assert.equal((await reopened.getPublished()).profile.name, '你的姓名')
})

test('损坏或不兼容草稿不会被默认值覆盖', async () => {
  for (const invalid of ['{broken', JSON.stringify({ schemaVersion: 99 })]) {
    const state = setup(invalid)
    await assert.rejects(state.api.getDraft(), /已损坏或版本不兼容/)
    assert.equal(state.raw(), invalid)
    assert.equal(state.writes(), 0)
  }
})

test('非法表单不会写入存储，链接拒绝 javascript 协议', async () => {
  const state = setup()
  await assert.rejects(state.api.saveDraft({ ...published, profile: { ...published.profile, githubUrl: 'javascript:alert(1)' } }))
  await assert.rejects(state.api.saveDraft({ ...published, profile: { ...published.profile, email: 'bad-email' } }))
  assert.equal(state.writes(), 0)
})

test('重复条目 ID 与非法资源路径被拒绝', () => {
  const skill = { id: 'same', name: '测试条目', category: '测试分类', proficiency: '', order: 0 }
  assert.equal(siteDataSchema.safeParse({ ...published, skills: [skill, skill] }).success, false)
  for (const url of ['/uploads/../private.pdf', '//other.test/file', 'blob:test', 'C:\\resume.pdf']) {
    assert.equal(siteDataSchema.safeParse({ ...published, profile: { ...published.profile, resume: { kind: 'public', url, name: 'file.pdf' } } }).success, false)
  }
})

test('本机资源引用可用于草稿，但不可进入静态发布版', () => {
  const draft = { ...published, profile: { ...published.profile, avatar: { kind: 'local', id: 'test-asset', name: 'avatar.webp' } } }
  assert.equal(siteDataSchema.safeParse(draft).success, true)
  assert.equal(publishedSiteSchema.safeParse(draft).success, false)
})

test('存储容量不足会报错并保留原内容', async () => {
  const old = JSON.stringify(published)
  const storage: DraftStorage = { read: () => old, write: () => { throw new DOMException('full', 'QuotaExceededError') }, remove: () => assert.fail('不应删除') }
  const api = createPortfolioApi({ storage, fetcher: setup().fetcher })
  await assert.rejects(api.saveDraft(published), /无法保存本机草稿/)
  assert.equal(storage.read(), old)
})

test('读取权限被拒绝时不静默使用发布版覆盖草稿', async () => {
  const api = createPortfolioApi({ storage: { read: () => { throw new Error('denied') }, write: () => assert.fail('不应写入'), remove: () => assert.fail('不应删除') }, fetcher: setup().fetcher })
  await assert.rejects(api.getDraft(), /无法访问本机草稿/)
})

test('HTML 回退、HTTP 错误、非法发布数据均得到明确错误', async () => {
  for (const response of [new Response('<html></html>', { headers: { 'content-type': 'text/html' } }), new Response('missing', { status: 404 }), new Response('{"schemaVersion":99}', { headers: { 'content-type': 'application/json' } })]) {
    const state = setup()
    const api = createPortfolioApi({ storage: state.storage, fetcher: async () => response })
    await assert.rejects(api.getPublished(), /无法读取发布版/)
    assert.equal(state.writes(), 0)
  }
})

test('重置先读取发布版，网络失败时保留原草稿', async () => {
  const state = setup('original-draft')
  const api = createPortfolioApi({ storage: state.storage, fetcher: async () => { throw new Error('offline') } })
  await assert.rejects(api.resetDraft(), /offline/)
  assert.equal(state.raw(), 'original-draft')
  assert.deepEqual(await state.api.resetDraft(), published)
})

test('初始化等待网络时出现的新草稿优先，不被旧发布内容覆盖', async () => {
  const state = setup()
  const concurrent = { ...published, profile: { ...published.profile, name: '另一标签页的草稿' } }
  const api = createPortfolioApi({ storage: state.storage, fetcher: async () => {
    state.storage.write(JSON.stringify(concurrent))
    return new Response(JSON.stringify(published), { headers: { 'content-type': 'application/json' } })
  } })
  assert.equal((await api.getDraft()).profile.name, '另一标签页的草稿')
  assert.equal(state.writes(), 1)
})
