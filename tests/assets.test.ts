import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import JSZip from 'jszip'
import { createPortfolioApi } from '../src/api/portfolio.ts'
import type { AssetStore } from '../src/storage/assets.ts'
import { publishedSiteSchema } from '../src/schemas/site.ts'
import type { AssetRef, SiteData, StoredAsset } from '../src/types/site.ts'
import { collectAssets } from '../src/utils/assetRefs.ts'
import { MiB, safeFileName, validateMedia } from '../src/utils/media.ts'
import { inspectZip } from '../src/utils/zipSafety.ts'
import { pdfBytes, pngBytes } from './helpers/fixtures.ts'

const initial = publishedSiteSchema.parse(JSON.parse(readFileSync(new URL('./fixtures/site.json', import.meta.url), 'utf8')))
const pdf = () => new Blob([pdfBytes()], { type: 'application/pdf' })
const png = () => new Blob([pngBytes(20, 20)], { type: 'image/png' })
const project = { title: '文件验收项目（测试）', period: '测试', summary: '仅用于文件链路验证', role: '测试', techStack: ['测试'], highlights: [], visible: true, repoUrl: '', demoUrl: '' }

function setup(published: SiteData = initial) {
  let raw = JSON.stringify(initial)
  let id = 0
  const files = new Map<string, StoredAsset>()
  const controls = { failText: false, failFiles: false, invalidImage: false, decodeFails: false }
  const assetStore: AssetStore = {
    async get(key) { return files.get(key) },
    async keys() { return [...files.keys()] },
    async putMany(assets) { if (controls.failFiles) throw new Error('IDB denied'); assets.forEach((asset) => files.set(asset.id, asset)) },
    async deleteMany(keys) { keys.forEach((key) => files.delete(key)) },
  }
  const staticFiles = new Map<string, Blob>()
  const api = createPortfolioApi({
    storage: { read: () => raw, write: (value) => { if (controls.failText) throw new Error('quota'); raw = value }, remove: () => { raw = '' } },
    assets: assetStore,
    fetcher: async (input) => {
      if (input === '/data/site.json') return new Response(JSON.stringify(published), { headers: { 'content-type': 'application/json' } })
      const file = staticFiles.get(String(input))
      return file ? new Response(file) : new Response('missing', { status: 404 })
    },
    newId: () => `asset-${++id}`,
    now: () => '2026-10-16T08:00:00.000Z',
    imageProcessor: async (file) => { if (controls.invalidImage) throw new Error('decode failed'); return file },
    imageVerifier: async () => { if (controls.decodeFails) throw new Error('image invalid') },
  })
  return { api, files, controls, staticFiles, raw: () => raw, setRaw: (value: string) => { raw = value } }
}

async function loadZip(blob: Blob) { return JSZip.loadAsync(await blob.arrayBuffer()) }
async function zipBlob(zip: JSZip) { return new Blob([Uint8Array.from(await zip.generateAsync({ type: 'uint8array' }))], { type: 'application/zip' }) }
function ref(data: SiteData, kind: 'avatar' | 'resume'): AssetRef { return data.profile[kind]! }

test('头像和 PDF 写入二进制存储，文字不包含 Base64 或 blob URL，重新读取有效', async () => {
  const state = setup()
  await state.api.saveProfileAsset('avatar', png(), 'avatar.png')
  const data = await state.api.saveProfileAsset('resume', pdf(), 'resume.pdf')
  assert.equal(state.files.size, 2)
  assert.equal(state.raw().includes('blob:'), false)
  assert.equal(state.raw().includes('base64'), false)
  assert.deepEqual(new Uint8Array(await (await state.api.readAsset(ref(data, 'resume'), 'resume')).blob.arrayBuffer()), pdfBytes())
  assert.equal((await state.api.getPublished()).profile.avatar, undefined)
})

test('错误类型、MIME、扩展名、空文件、超限文件和解码失败不覆盖旧文件', async () => {
  const state = setup()
  await state.api.saveProfileAsset('resume', pdf(), 'old.pdf')
  const before = state.raw()
  for (const [file, name] of [[new Blob(['bad'], { type: 'application/pdf' }), 'bad.pdf'], [pdf(), 'bad.png'], [new Blob([pdfBytes()], { type: 'text/plain' }), 'bad.pdf'], [new Blob([]), 'empty.pdf'], [new Blob([new Uint8Array(10 * MiB + 1)]), 'big.pdf']] as [Blob, string][]) {
    await assert.rejects(state.api.saveProfileAsset('resume', file, name))
    assert.equal(state.raw(), before)
  }
  state.controls.invalidImage = true
  await assert.rejects(state.api.saveProfileAsset('avatar', png(), 'avatar.png'), /decode failed/)
  assert.equal(state.raw(), before)
  assert.equal(state.files.size, 1)
})

test('文件存储拒绝与文字容量不足都保留旧引用，文字失败回收新文件', async () => {
  const state = setup()
  await state.api.saveProfileAsset('resume', pdf(), 'old.pdf')
  const before = state.raw()
  state.controls.failFiles = true
  await assert.rejects(state.api.saveProfileAsset('resume', pdf(), 'new.pdf'), /无法保存文件/)
  state.controls.failFiles = false
  state.controls.failText = true
  await assert.rejects(state.api.saveProfileAsset('resume', pdf(), 'new.pdf'), /无法保存本机草稿/)
  assert.equal(state.raw(), before)
  assert.equal(state.files.size, 1)
})

test('移除只解除引用，清理不删除当前头像或简历', async () => {
  const state = setup()
  await state.api.saveProfileAsset('avatar', png(), 'avatar.png')
  await state.api.saveProfileAsset('resume', pdf(), 'old.pdf')
  await state.api.saveProfileAsset('resume', pdf(), 'new.pdf')
  assert.equal(state.files.size, 3)
  assert.equal(await state.api.removeUnusedAssets(), 1)
  await state.api.removeProfileAsset('resume')
  assert.equal(state.files.size, 2)
  assert.equal(await state.api.removeUnusedAssets(), 1)
  assert.equal(state.files.size, 1)
  assert.equal((await state.api.getDraft()).profile.avatar?.kind, 'local')
})

test('替换与移除拒绝过期文件引用；项目封面持久化并可移除', async () => {
  const state = setup()
  const first = await state.api.saveProfileAsset('avatar', png(), 'first.png')
  await state.api.saveProfileAsset('avatar', png(), 'second.png')
  await assert.rejects(state.api.removeProfileAsset('avatar', ref(first, 'avatar')), /其他页面更新/)
  const data = await state.api.saveProject(project)
  const id = data.projects[0].id
  const covered = await state.api.saveProjectCover(id, png(), 'cover.png')
  assert.equal(covered.projects[0].cover?.kind, 'local')
  assert.equal((await state.api.removeProjectCover(id)).projects[0].cover, undefined)
  await assert.rejects(state.api.saveProjectCover('missing', png(), 'cover.png'), /项目已不存在/)
})

test('完整备份恢复文字、头像、PDF、封面，导入使用新 ID，文件字节一致', async () => {
  const source = setup()
  await source.api.saveProfileAsset('avatar', png(), 'avatar.png')
  await source.api.saveProfileAsset('resume', pdf(), 'resume.pdf')
  const data = await source.api.saveProject(project)
  await source.api.saveProjectCover(data.projects[0].id, png(), 'cover.png')
  const backup = await source.api.exportBackup()
  const destination = setup()
  const restored = await destination.api.importBackup(backup)
  assert.equal(destination.files.size, 3)
  assert.equal(restored.projects[0].title, project.title)
  assert.deepEqual(new Uint8Array(await (await destination.api.readAsset(ref(restored, 'resume'), 'resume')).blob.arrayBuffer()), pdfBytes())
  const backupZip = await loadZip(backup)
  const backupManifest = JSON.parse(await backupZip.file('backup.json')!.async('string'))
  assert.notDeepEqual(ref(restored, 'resume'), backupManifest.data.profile.resume)
})

test('备份包含静态文件，导入后不依赖原域名', async () => {
  const source = setup()
  const data = structuredClone(initial)
  data.profile.avatar = { kind: 'public', url: '/uploads/old.png', name: 'old.png' }
  data.profile.resume = { kind: 'public', url: '/uploads/old.pdf', name: 'old.pdf' }
  source.staticFiles.set('/uploads/old.png', png())
  source.staticFiles.set('/uploads/old.pdf', pdf())
  source.setRaw(JSON.stringify(data))
  const destination = setup()
  const restored = await destination.api.importBackup(await source.api.exportBackup())
  assert.equal(ref(restored, 'avatar').kind, 'local')
  assert.equal(ref(restored, 'resume').kind, 'local')
  assert.equal((await destination.api.readAsset(ref(restored, 'resume'), 'resume')).blob.size, pdf().size)
})

test('发布包只含静态引用且资源均存在，发布过程不修改本机草稿', async () => {
  const state = setup()
  await state.api.saveProfileAsset('avatar', png(), 'avatar.png')
  await state.api.saveProfileAsset('resume', pdf(), 'resume.pdf')
  const before = state.raw()
  const zip = await loadZip(await state.api.exportPublishBundle())
  const data = publishedSiteSchema.parse(JSON.parse(await zip.file('data/site.json')!.async('string')))
  for (const { ref: asset } of collectAssets(data)) {
    assert.equal(asset.kind, 'public')
    assert.ok(asset.kind === 'public' && zip.file(asset.url.slice(1)))
  }
  assert.equal(state.raw(), before)
  assert.ok(data.contentVersion.startsWith('release-'))
})

test('缺失本机或静态文件时阻止导出，拒绝伪造资源成功', async () => {
  const state = setup()
  const data = structuredClone(initial)
  data.profile.avatar = { kind: 'local', id: 'missing', name: 'avatar.png' }
  state.setRaw(JSON.stringify(data))
  await assert.rejects(state.api.exportBackup(), /文件缺失/)
  data.profile.avatar = { kind: 'public', url: '/uploads/missing.png', name: 'missing.png' }
  state.setRaw(JSON.stringify(data))
  await assert.rejects(state.api.exportPublishBundle(), /HTTP 404/)
})

test('无效 ZIP、截断 ZIP、发布包和未知版本不会改动原草稿', async () => {
  const state = setup()
  const original = state.raw()
  await assert.rejects(state.api.importBackup(new Blob(['not a zip'])))
  const valid = await state.api.exportBackup()
  await assert.rejects(state.api.importBackup(valid.slice(0, valid.size - 5)))
  await assert.rejects(state.api.importBackup(await state.api.exportPublishBundle()), /发布包/)
  const zip = await loadZip(valid)
  const manifest = JSON.parse(await zip.file('backup.json')!.async('string'))
  zip.file('backup.json', JSON.stringify({ ...manifest, version: 99 }))
  await assert.rejects(state.api.importBackup(await zipBlob(zip)))
  assert.equal(state.raw(), original)
})

test('ZIP 路径穿越、未声明文件和资源缺失在写入前被拒绝', async () => {
  const source = setup()
  await source.api.saveProfileAsset('avatar', png(), 'avatar.png')
  const valid = await source.api.exportBackup()
  const destination = setup()
  for (const mode of ['traversal', 'extra', 'missing']) {
    const zip = await loadZip(valid)
    if (mode === 'traversal') zip.file('../evil.txt', 'evil')
    if (mode === 'extra') zip.file('extra.txt', 'unknown')
    if (mode === 'missing') {
      const manifest = JSON.parse(await zip.file('backup.json')!.async('string'))
      zip.remove(manifest.assets[0].path)
    }
    await assert.rejects(destination.api.importBackup(await zipBlob(zip)))
    assert.equal(destination.files.size, 0)
    assert.equal(destination.raw(), JSON.stringify(initial))
  }
})

test('导入文字写入失败回收暂存文件，旧文件与草稿仍有效', async () => {
  const source = setup()
  await source.api.saveProfileAsset('resume', pdf(), 'import.pdf')
  const destination = setup()
  const old = await destination.api.saveProfileAsset('avatar', png(), 'old.png')
  const before = destination.raw()
  destination.controls.failText = true
  await assert.rejects(destination.api.importBackup(await source.api.exportBackup()), /无法保存本机草稿/)
  assert.equal(destination.raw(), before)
  assert.equal(destination.files.size, 1)
  assert.equal((await destination.api.readAsset(ref(old, 'avatar'), 'avatar')).mime, 'image/png')
})

test('有效备份可恢复损坏的文字存储，无效图片导入不会修改原数据', async () => {
  const source = setup()
  await source.api.saveProfileAsset('avatar', png(), 'avatar.png')
  const backup = await source.api.exportBackup()
  const destination = setup()
  destination.setRaw('{broken')
  destination.controls.decodeFails = true
  await assert.rejects(destination.api.importBackup(backup), /image invalid/)
  assert.equal(destination.raw(), '{broken')
  destination.controls.decodeFails = false
  assert.equal((await destination.api.importBackup(backup)).profile.avatar?.kind, 'local')
})

test('ZIP 解压前检查体积，拒绝虚报的大文件', async () => {
  const state = setup()
  const bytes = new Uint8Array(await (await state.api.exportBackup()).arrayBuffer())
  const view = new DataView(bytes.buffer)
  let central = -1
  for (let offset = 0; offset < bytes.length - 46; offset++) if (view.getUint32(offset, true) === 0x02014b50) { central = offset; break }
  assert.ok(central >= 0)
  view.setUint32(central + 24, 100 * MiB, true)
  assert.throws(() => inspectZip(bytes), /大小超限/)
})

test('损坏草稿不允许清理文件；只含文字的备份不要求文件存储可写', async () => {
  const state = setup()
  await state.api.saveProfileAsset('resume', pdf(), 'resume.pdf')
  state.setRaw('{broken')
  await assert.rejects(state.api.removeUnusedAssets(), /已损坏/)
  assert.equal(state.files.size, 1)
  const empty = setup()
  const backup = await empty.api.exportBackup()
  empty.controls.failFiles = true
  assert.deepEqual((await empty.api.importBackup(backup)).profile, initial.profile)
})

test('发布前要求项目必填资料完整，备份允许保存待完善草稿', async () => {
  const state = setup()
  state.setRaw(JSON.stringify({ ...initial, projects: [{ ...project, summary: '', id: 'partial', order: 0 }] }))
  await state.api.exportBackup()
  await assert.rejects(state.api.exportPublishBundle(), /资料不完整/)
})

test('长文件名保留扩展名，SVG 和伪装文件被拒绝', async () => {
  const longName = safeFileName('头像'.repeat(100) + '.png')
  assert.ok(longName.endsWith('.png'))
  assert.ok(longName.length <= 100)
  await assert.rejects(validateMedia(new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'avatar.svg', 'avatar'))
})

test('浏览器未声明 MIME 时按真实文件头规范化 PDF 和图片类型', async () => {
  const state = setup()
  await state.api.saveProfileAsset('avatar', new Blob([pngBytes(20, 20)]), 'avatar.png')
  const data = await state.api.saveProfileAsset('resume', new Blob([pdfBytes()]), 'resume.pdf')
  assert.equal((await state.api.readAsset(ref(data, 'avatar'), 'avatar')).blob.type, 'image/png')
  assert.equal((await state.api.readAsset(ref(data, 'resume'), 'resume')).blob.type, 'application/pdf')
})
