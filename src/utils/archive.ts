import JSZip from 'jszip'
import { z } from 'zod'
import { projectInputSchema, publishedSiteSchema, siteDataSchema } from '../schemas/site.ts'
import type { AssetRef, SiteData, StoredAsset } from '../types/site.ts'
import { assetKey, collectAssets, mapAssets } from './assetRefs.ts'
import { mimeExtensions, validateMedia } from './media.ts'
import type { AssetRole } from './media.ts'
import { inspectZip, MAX_EXPANDED_SIZE, MAX_MANIFEST_SIZE, MAX_ZIP_SIZE } from './zipSafety.ts'

const manifestSchema = z.strictObject({
  format: z.literal('portfolio-backup'),
  version: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  data: siteDataSchema,
  assets: z.array(z.strictObject({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    path: z.string().regex(/^assets\/[A-Za-z0-9_-]{1,100}\.(png|jpg|webp|pdf)$/),
    name: z.string().min(1).max(100).refine((name) => !name.includes('/') && !name.includes('\\') && !Array.from(name).some((char) => char.charCodeAt(0) < 32), '文件名无效'),
    mime: z.enum(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
    size: z.number().int().positive(),
  })).max(102),
})

interface ArchiveOptions {
  newId: () => string
  now: () => string
  resolve: (ref: AssetRef, role: AssetRole) => Promise<StoredAsset>
}

export async function buildArchive(input: SiteData, mode: 'backup' | 'publish', options: ArchiveOptions): Promise<Blob> {
  const data = siteDataSchema.parse(input)
  if (mode === 'publish') for (const project of data.projects) {
    const result = projectInputSchema.strip().safeParse(project)
    if (!result.success) throw new Error(`项目“${project.title}”的资料不完整：${result.error.issues[0]?.message}`)
  }
  const zip = new JSZip()
  const replacements = new Map<string, AssetRef>()
  const files: z.infer<typeof manifestSchema>['assets'] = []
  const resolved = new Map<string, StoredAsset>()
  let total = 0
  for (const { ref, role } of collectAssets(data)) {
    const key = assetKey(ref)
    const file = resolved.get(key) ?? await options.resolve(ref, role)
    await validateMedia(file.blob, file.name, role)
    if (resolved.has(key)) continue
    resolved.set(key, file)
    total += file.blob.size
    if (total > MAX_EXPANDED_SIZE - MAX_MANIFEST_SIZE) throw new Error('文件总量超过 49 MiB，请精简后再导出。')
    const id = options.newId()
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error('资源 ID 无效。')
    const extension = mimeExtensions[file.mime]
    if (!extension) throw new Error('不支持的文件类型，无法导出。')
    const path = `${mode === 'backup' ? 'assets' : 'uploads'}/${id}.${extension}`
    zip.file(path, await file.blob.arrayBuffer())
    replacements.set(key, mode === 'backup' ? { kind: 'local', id, name: file.name } : { kind: 'public', url: `/${path}`, name: file.name })
    files.push({ id, path, name: file.name, mime: file.mime as z.infer<typeof manifestSchema>['assets'][number]['mime'], size: file.blob.size })
  }
  const converted = mapAssets(data, (ref) => {
    const replacement = replacements.get(assetKey(ref))
    if (!replacement) throw new Error('资源引用未转换，已中止导出。')
    return replacement
  })
  if (mode === 'backup') {
    const manifest = manifestSchema.parse({ format: 'portfolio-backup', version: 1, exportedAt: options.now(), data: converted, assets: files })
    const json = JSON.stringify(manifest, null, 2)
    if (new TextEncoder().encode(json).length > MAX_MANIFEST_SIZE) throw new Error('文字数据超过 1 MiB，无法导出备份。')
    zip.file('backup.json', json)
  } else {
    converted.contentVersion = `release-${options.newId()}`
    converted.updatedAt = options.now()
    zip.file('data/site.json', JSON.stringify(publishedSiteSchema.parse(converted), null, 2))
    zip.file('PUBLISH_README.txt', '将 data 和 uploads 文件夹合并到项目 public 目录，然后构建并提交 GitHub。不要创建 public/public。此压缩包是静态内容，不是完整网站源码。\n')
  }
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return new Blob([Uint8Array.from(bytes)], { type: 'application/zip' })
}

export async function parseBackup(file: Blob, checkImage: (blob: Blob) => Promise<void>): Promise<{ data: SiteData; assets: StoredAsset[] }> {
  if (!file.size || file.size > MAX_ZIP_SIZE) throw new Error('备份文件为空或超过 55 MiB 上限。')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const entries = inspectZip(bytes)
  if (!entries.has('backup.json')) throw new Error('请选择本站导出的完整备份 ZIP，静态发布包不能用作备份导入。')
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true, createFolders: false })
  const raw = await zip.file('backup.json')?.async('string')
  if (!raw) throw new Error('备份清单为空。')
  const manifest = manifestSchema.parse(JSON.parse(raw))
  const ids = new Set(manifest.assets.map((asset) => asset.id))
  const paths = new Set(manifest.assets.map((asset) => asset.path))
  if (ids.size !== manifest.assets.length || paths.size !== manifest.assets.length) throw new Error('备份包含重复资源。')
  for (const path of entries.keys()) {
    if (path !== 'backup.json' && path !== 'assets/' && !paths.has(path)) throw new Error('备份包含未声明的文件。')
  }
  const refs = collectAssets(manifest.data)
  if (refs.some(({ ref }) => ref.kind !== 'local')) throw new Error('备份未包含所有静态资源，无法离线恢复。')
  const used = new Set(refs.map(({ ref }) => ref.kind === 'local' ? ref.id : ''))
  if (used.size !== ids.size || [...used].some((id) => !ids.has(id))) throw new Error('备份资源引用不完整。')
  const assets: StoredAsset[] = []
  for (const entry of manifest.assets) {
    if (entries.get(entry.path) !== entry.size || entry.path !== `assets/${entry.id}.${mimeExtensions[entry.mime]}`) throw new Error('备份文件大小或路径与清单不一致。')
    const data = await zip.file(entry.path)?.async('uint8array')
    if (!data || data.length !== entry.size) throw new Error(`备份文件缺失或损坏：${entry.name}`)
    const blob = new Blob([Uint8Array.from(data)], { type: entry.mime })
    for (const { ref, role } of refs) {
      if (ref.kind === 'local' && ref.id === entry.id) {
        if (ref.name !== entry.name) throw new Error('备份文件名与资源引用不一致。')
        await validateMedia(blob, entry.name, role)
      }
    }
    if (entry.mime.startsWith('image/')) await checkImage(blob)
    assets.push({ id: entry.id, name: entry.name, mime: entry.mime, size: blob.size, updatedAt: manifest.exportedAt, blob })
  }
  return { data: manifest.data, assets }
}
