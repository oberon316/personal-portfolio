export const DRAFT_KEY = 'portfolio:draft:v1'

export interface DraftStorage {
  read(): string | null
  write(value: string): void
  remove(): void
}

export const browserDraftStorage: DraftStorage = {
  read: () => window.localStorage.getItem(DRAFT_KEY),
  write: (value) => window.localStorage.setItem(DRAFT_KEY, value),
  remove: () => window.localStorage.removeItem(DRAFT_KEY),
}
