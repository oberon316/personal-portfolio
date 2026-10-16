import type { z } from 'zod'
import type { assetRefSchema, profileSchema, profileTextSchema, projectInputSchema, projectSchema, siteDataSchema, skillInputSchema, skillSchema } from '../schemas/site.ts'

export type AssetRef = z.infer<typeof assetRefSchema>
export type Profile = z.infer<typeof profileSchema>
export type Project = z.infer<typeof projectSchema>
export type Skill = z.infer<typeof skillSchema>
export type SiteData = z.infer<typeof siteDataSchema>
export type DataSource = 'published' | 'draft'
export type ProfileText = z.infer<typeof profileTextSchema>
export type SkillInput = z.infer<typeof skillInputSchema>
export type ProjectInput = z.infer<typeof projectInputSchema>
export type MoveDirection = 'up' | 'down'

export interface StoredAsset {
  id: string
  blob: Blob
  name: string
  mime: string
  size: number
  updatedAt: string
}
