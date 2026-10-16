import { ZodError } from 'zod'
import { assetRefSchema, profileTextSchema, projectInputSchema, publishedSiteSchema, siteDataSchema, skillInputSchema } from '../schemas/site.ts'
import { browserDraftStorage, DRAFT_KEY } from '../storage/draft.ts'
import type { DraftStorage } from '../storage/draft.ts'
import type { AssetRef, MoveDirection, ProfileText, Project, SiteData, Skill, StoredAsset } from '../types/site.ts'
import { moveItem, normalizeOrder, sortedItems } from '../utils/collections.ts'
import { browserAssetStore } from '../storage/assets.ts'
import type { AssetStore } from '../storage/assets.ts'
import { mediaLimits, mimeExtensions, prepareImage, safeFileName, validateMedia, verifyImage } from '../utils/media.ts'
import type { AssetRole } from '../utils/media.ts'
import { assetKey, collectAssets, mapAssets } from '../utils/assetRefs.ts'

export class PortfolioDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PortfolioDataError'
  }
}

export function describeError(error: unknown): string {
  if (error instanceof ZodError) {
    const first = error.issues[0]
    return `数据格式不正确：${first?.path.join('.') || '根节点'} ${first?.message || ''}`
  }
  return error instanceof Error ? error.message : '操作失败，请重试。'
}

interface Dependencies {
  storage: DraftStorage
  fetcher: typeof fetch
  now?: () => string
  onChange?: () => void
  newId?: () => string
  assets?: AssetStore
  imageProcessor?: typeof prepareImage
  imageVerifier?: typeof verifyImage
}

export function createPortfolioApi({ storage, fetcher, now = () => new Date().toISOString(), onChange, newId = () => crypto.randomUUID(), assets = browserAssetStore, imageProcessor = prepareImage, imageVerifier = verifyImage }: Dependencies) {
  let mutationQueue: Promise<unknown> = Promise.resolve()
  async function getPublished(): Promise<SiteData> {
    try {
      const response = await fetcher('/data/site.json', { cache: 'no-cache' })
      if (!response.ok) throw new Error(`静态数据请求失败（HTTP ${response.status}）`)
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('发布数据不是 JSON，请检查 public/data/site.json 是否存在。')
      }
      return publishedSiteSchema.parse(await response.json())
    } catch (error) {
      throw new PortfolioDataError(`无法读取发布版。${describeError(error)}`, { cause: error })
    }
  }

  function persist(data: SiteData): void {
    try {
      storage.write(JSON.stringify(data))
    } catch (error) {
      throw new PortfolioDataError('无法保存本机草稿，请检查浏览器存储权限或剩余空间。原草稿未被主动清除。', { cause: error })
    }
    onChange?.()
  }

  async function getDraft(): Promise<SiteData> {
    let raw: string | null
    try { raw = storage.read() }
    catch (error) { throw new PortfolioDataError('无法访问本机草稿，请检查浏览器存储权限。', { cause: error }) }
    if (raw !== null) {
      try { return siteDataSchema.parse(JSON.parse(raw)) }
      catch (error) {
        throw new PortfolioDataError('本机草稿已损坏或版本不兼容。原数据已保留；可在管理设置中确认重置为发布版。', { cause: error })
      }
    }
    const published = await getPublished()
    // 避免首次请求期间，另一标签页已写入的草稿被初始化覆盖。
    try {
      const latest = storage.read()
      if (latest !== null) return siteDataSchema.parse(JSON.parse(latest))
    } catch (error) {
      throw new PortfolioDataError('初始化时无法读取本机草稿，未覆盖已有数据。', { cause: error })
    }
    const draft = structuredClone(published)
    persist(draft)
    return draft
  }

  async function saveDraft(input: unknown): Promise<SiteData> {
    const parsed = siteDataSchema.parse(input)
    const saved = { ...parsed, updatedAt: now() }
    persist(saved)
    return saved
  }

  function resetDraft(): Promise<SiteData> {
    // 读取成功后原位替换，不先删除旧草稿。
    return enqueue(async () => {
      const data = structuredClone(await getPublished())
      persist(data)
      return data
    })
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation)
    mutationQueue = result.catch(() => undefined)
    return result
  }

  function mutateDraft(change: (data: SiteData) => SiteData): Promise<SiteData> {
    return enqueue(async () => saveDraft(change(await getDraft())))
  }

  function checkUnchanged(current: Skill | Project, expected?: Skill | Project) {
    // 排序不构成内容冲突；其他页面修改过条目时，要求重新载入再编辑。
    if (expected && JSON.stringify({ ...current, order: 0 }) !== JSON.stringify({ ...expected, order: 0 })) {
      throw new PortfolioDataError('此条目已在其他页面修改。请取消编辑并重新打开，避免覆盖新内容。')
    }
  }

  function updateProfile(input: unknown, expected?: ProfileText): Promise<SiteData> {
    const profile = profileTextSchema.parse(input)
    return mutateDraft((data) => {
      if (expected && JSON.stringify(profileTextSchema.strip().parse(data.profile)) !== JSON.stringify(profileTextSchema.parse(expected))) {
        throw new PortfolioDataError('个人资料已在其他页面更新。请重新载入最新资料后编辑。')
      }
      return { ...data, profile: { ...data.profile, ...profile } }
    })
  }

  function saveSkill(input: unknown, id?: string, expected?: Skill): Promise<SiteData> {
    const values = skillInputSchema.parse(input)
    return mutateDraft((data) => {
      const items = sortedItems(data.skills)
      if (id) {
        const current = items.find((item) => item.id === id)
        if (!current) throw new PortfolioDataError('此技能已被删除，请取消编辑并刷新列表。')
        checkUnchanged(current, expected)
        return { ...data, skills: normalizeOrder(items.map((item) => item.id === id ? { ...item, ...values } : item)) }
      }
      return { ...data, skills: normalizeOrder([...items, { ...values, id: newId(), order: items.length }]) }
    })
  }

  function saveProject(input: unknown, id?: string, expected?: Project): Promise<SiteData> {
    const values = projectInputSchema.parse(input)
    return mutateDraft((data) => {
      const items = sortedItems(data.projects)
      if (id) {
        const current = items.find((item) => item.id === id)
        if (!current) throw new PortfolioDataError('此项目已被删除，请取消编辑并刷新列表。')
        checkUnchanged(current, expected)
        return { ...data, projects: normalizeOrder(items.map((item) => item.id === id ? { ...item, ...values } : item)) }
      }
      return { ...data, projects: normalizeOrder([...items, { ...values, id: newId(), order: items.length }]) }
    })
  }

  function deleteSkill(id: string, expected?: Skill): Promise<SiteData> {
    return mutateDraft((data) => {
      const current = data.skills.find((item) => item.id === id)
      if (!current) throw new PortfolioDataError('此技能已不存在，请刷新列表。')
      checkUnchanged(current, expected)
      return { ...data, skills: normalizeOrder(sortedItems(data.skills).filter((item) => item.id !== id)) }
    })
  }

  function deleteProject(id: string, expected?: Project): Promise<SiteData> {
    return mutateDraft((data) => {
      const current = data.projects.find((item) => item.id === id)
      if (!current) throw new PortfolioDataError('此项目已不存在，请刷新列表。')
      checkUnchanged(current, expected)
      return { ...data, projects: normalizeOrder(sortedItems(data.projects).filter((item) => item.id !== id)) }
    })
  }

  function moveSkill(id: string, direction: MoveDirection): Promise<SiteData> {
    return mutateDraft((data) => ({ ...data, skills: moveItem(data.skills, id, direction) }))
  }

  function moveProject(id: string, direction: MoveDirection): Promise<SiteData> {
    return mutateDraft((data) => ({ ...data, projects: moveItem(data.projects, id, direction) }))
  }

  async function readAsset(input: AssetRef, role: AssetRole): Promise<StoredAsset> {
    const ref = assetRefSchema.parse(input)
    let file: StoredAsset
    if (ref.kind === 'local') {
      let stored: StoredAsset | undefined
      try { stored = await assets.get(ref.id) }
      catch (error) { throw new PortfolioDataError('无法读取本机文件，请检查浏览器存储权限。', { cause: error }) }
      if (!stored) throw new PortfolioDataError(`文件缺失：${ref.name}。请重新上传或导入完整备份。`)
      file = { ...stored, name: ref.name }
    } else {
      const response = await fetcher(ref.url, { cache: 'no-cache' })
      if (!response.ok) throw new PortfolioDataError(`无法读取静态文件：${ref.name}（HTTP ${response.status}）`)
      const length = Number(response.headers.get('content-length'))
      if (length > mediaLimits[role]) throw new PortfolioDataError(`静态文件超出大小限制：${ref.name}`)
      const blob = await response.blob()
      file = { id: assetKey(ref), blob, name: ref.name, mime: blob.type, size: blob.size, updatedAt: now() }
    }
    const mime = await validateMedia(file.blob, file.name, role)
    return { ...file, mime, size: file.blob.size }
  }

  async function writeFiles(files: StoredAsset[]) {
    if (!files.length) return
    try { await assets.putMany(files) }
    catch (error) { throw new PortfolioDataError('无法保存文件，请检查浏览器存储权限或剩余空间；原草稿未改变。', { cause: error }) }
  }

  async function commitWithFiles(data: SiteData, files: StoredAsset[]): Promise<SiteData> {
    await writeFiles(files)
    try { return await saveDraft(data) }
    catch (error) {
      // 只回收本次暂存的新 ID；旧草稿及其文件保持可读。
      try { await assets.deleteMany(files.map((file) => file.id)) } catch { /* 留下未引用文件，比删除旧文件安全。 */ }
      throw error
    }
  }

  function checkAssetUnchanged(current: AssetRef | undefined, expected?: AssetRef | null) {
    if (expected !== undefined && JSON.stringify(current ?? null) !== JSON.stringify(expected)) throw new PortfolioDataError('此文件已在其他页面更新，请刷新后重试。')
  }

  async function prepareStoredFile(file: Blob, name: string, role: AssetRole): Promise<StoredAsset> {
    const safeName = safeFileName(name)
    const inputMime = await validateMedia(file, safeName, role)
    const normalized = new Blob([file], { type: inputMime })
    const blob = role === 'resume' ? normalized : await imageProcessor(normalized, role)
    const extension = mimeExtensions[blob.type]
    if (!extension) throw new PortfolioDataError('浏览器生成了不支持的图片格式。')
    const outputName = role === 'resume' ? safeName : `${safeName.replace(/\.[^.]+$/, '').slice(0, 90)}.${extension}`
    const mime = await validateMedia(blob, outputName, role)
    return { id: newId(), blob, name: outputName, mime, size: blob.size, updatedAt: now() }
  }

  function saveProfileAsset(role: 'avatar' | 'resume', file: Blob, name: string, expected?: AssetRef | null): Promise<SiteData> {
    return enqueue(async () => {
      const data = await getDraft()
      checkAssetUnchanged(data.profile[role], expected)
      const stored = await prepareStoredFile(file, name, role)
      return commitWithFiles({ ...data, profile: { ...data.profile, [role]: { kind: 'local', id: stored.id, name: stored.name } } }, [stored])
    })
  }

  function removeProfileAsset(role: 'avatar' | 'resume', expected?: AssetRef | null): Promise<SiteData> {
    return mutateDraft((data) => {
      checkAssetUnchanged(data.profile[role], expected)
      const profile = { ...data.profile }
      delete profile[role]
      return { ...data, profile }
    })
  }

  function saveProjectCover(id: string, file: Blob, name: string, expected?: AssetRef | null): Promise<SiteData> {
    return enqueue(async () => {
      const data = await getDraft()
      const project = data.projects.find((item) => item.id === id)
      if (!project) throw new PortfolioDataError('项目已不存在，无法保存封面。')
      checkAssetUnchanged(project.cover, expected)
      const stored = await prepareStoredFile(file, name, 'cover')
      return commitWithFiles({ ...data, projects: data.projects.map((item) => item.id === id ? { ...item, cover: { kind: 'local', id: stored.id, name: stored.name } as AssetRef } : item) }, [stored])
    })
  }

  function removeProjectCover(id: string, expected?: AssetRef | null): Promise<SiteData> {
    return mutateDraft((data) => {
      const project = data.projects.find((item) => item.id === id)
      if (!project) throw new PortfolioDataError('项目已不存在。')
      checkAssetUnchanged(project.cover, expected)
      return { ...data, projects: data.projects.map((item) => {
        if (item.id !== id) return item
        const copy = { ...item }
        delete copy.cover
        return copy
      }) }
    })
  }

  function exportBackup(): Promise<Blob> {
    return enqueue(async () => (await import('../utils/archive.ts')).buildArchive(await getDraft(), 'backup', { newId, now, resolve: readAsset }))
  }

  function exportPublishBundle(): Promise<Blob> {
    return enqueue(async () => (await import('../utils/archive.ts')).buildArchive(await getDraft(), 'publish', { newId, now, resolve: readAsset }))
  }

  function importBackup(file: Blob): Promise<SiteData> {
    return enqueue(async () => {
      const imported = await (await import('../utils/archive.ts')).parseBackup(file, imageVerifier)
      const idMap = new Map(imported.assets.map((asset) => [asset.id, newId()]))
      const files = imported.assets.map((asset) => ({ ...asset, id: idMap.get(asset.id)!, updatedAt: now() }))
      const data = mapAssets(imported.data, (ref) => {
        if (ref.kind !== 'local' || !idMap.has(ref.id)) throw new PortfolioDataError('备份文件引用无法恢复。')
        return { ...ref, id: idMap.get(ref.id)! }
      })
      // 无需先读取旧草稿，因此可用完整备份恢复损坏的 localStorage 数据。
      return commitWithFiles(data, files)
    })
  }

  function removeUnusedAssets(): Promise<number> {
    return enqueue(async () => {
      const used = new Set(collectAssets(await getDraft()).flatMap(({ ref }) => ref.kind === 'local' ? [ref.id] : []))
      const unused = (await assets.keys()).filter((id) => !used.has(id))
      await assets.deleteMany(unused)
      return unused.length
    })
  }

  return { getPublished, getDraft, saveDraft, resetDraft, updateProfile, saveSkill, saveProject, deleteSkill, deleteProject, moveSkill, moveProject, readAsset, saveProfileAsset, removeProfileAsset, saveProjectCover, removeProjectCover, exportBackup, importBackup, exportPublishBundle, removeUnusedAssets }
}

export type PortfolioApi = ReturnType<typeof createPortfolioApi>
export type DraftAction = (api: PortfolioApi) => Promise<SiteData>

const CHANGE_EVENT = 'portfolio:draft-change'
export const portfolioApi = createPortfolioApi({
  storage: browserDraftStorage,
  fetcher: (...args) => fetch(...args),
  onChange: () => window.dispatchEvent(new Event(CHANGE_EVENT)),
})

export function subscribeToDraftChanges(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === DRAFT_KEY || event.key === null) listener()
  }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', onStorage)
  window.addEventListener('focus', listener)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('focus', listener)
  }
}
