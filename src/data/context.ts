import { createContext, useContext } from 'react'
import type { DataSource, SiteData } from '../types/site'
import type { DraftAction } from '../api/portfolio'

interface PortfolioContextValue {
  source: DataSource
  data: SiteData | null
  loading: boolean
  error: string | null
  reload: () => void
  mutate: (action: DraftAction) => Promise<void>
  reset: () => Promise<void>
}

export const PortfolioContext = createContext<PortfolioContextValue | null>(null)

export function usePortfolio() {
  const context = useContext(PortfolioContext)
  if (!context) throw new Error('当前页面缺少 PortfolioProvider')
  return context
}
