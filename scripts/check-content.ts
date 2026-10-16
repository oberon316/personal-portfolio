import { readFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { publishedSiteSchema } from '../src/schemas/site.ts'
import { collectAssets } from '../src/utils/assetRefs.ts'
import { validateMedia } from '../src/utils/media.ts'

const publicDirectory = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../public/', import.meta.url))
const data = publishedSiteSchema.parse(JSON.parse(await readFile(resolve(publicDirectory, 'data/site.json'), 'utf8')))
const mimes: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf' }
for (const { ref, role } of collectAssets(data)) {
  if (ref.kind !== 'public') throw new Error('静态数据不可引用本机文件。')
  const target = resolve(publicDirectory, `.${ref.url}`)
  if (relative(publicDirectory, target).startsWith('..')) throw new Error('静态资源路径越界。')
  const bytes = await readFile(target)
  await validateMedia(new Blob([Uint8Array.from(bytes)], { type: mimes[extname(target).toLowerCase()] || '' }), ref.name, role)
}
console.log(`静态内容校验通过：${data.skills.length} 项技能，${data.projects.length} 个项目，${collectAssets(data).length} 个文件引用。`)
