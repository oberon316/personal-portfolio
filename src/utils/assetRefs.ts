import type { AssetRef, SiteData } from '../types/site.ts'
import type { AssetRole } from './media.ts'

export function assetKey(ref: AssetRef): string {
  return ref.kind === 'local' ? `local:${ref.id}` : `public:${ref.url}`
}

export function collectAssets(data: SiteData): { ref: AssetRef; role: AssetRole }[] {
  const refs: { ref: AssetRef; role: AssetRole }[] = []
  if (data.profile.avatar) refs.push({ ref: data.profile.avatar, role: 'avatar' })
  if (data.profile.resume) refs.push({ ref: data.profile.resume, role: 'resume' })
  for (const project of data.projects) if (project.cover) refs.push({ ref: project.cover, role: 'cover' })
  return refs
}

export function mapAssets(data: SiteData, map: (ref: AssetRef) => AssetRef): SiteData {
  const copy = structuredClone(data)
  if (copy.profile.avatar) copy.profile.avatar = map(copy.profile.avatar)
  if (copy.profile.resume) copy.profile.resume = map(copy.profile.resume)
  copy.projects = copy.projects.map((project) => project.cover ? { ...project, cover: map(project.cover) } : project)
  return copy
}
