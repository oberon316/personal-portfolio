import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { describeError, portfolioApi, subscribeToDraftChanges } from '../api/portfolio'
import type { DraftAction } from '../api/portfolio'
import type { DataSource, SiteData } from '../types/site'
import { PortfolioContext } from './context'

export function PortfolioProvider({ source, children }: { source: DataSource; children: ReactNode }) {
  const [state, setState] = useState<{ data: SiteData | null; loading: boolean; error: string | null }>({
    data: null, loading: true, error: null,
  })
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    let active = true
    const request = source === 'published' ? portfolioApi.getPublished() : portfolioApi.getDraft()
    request.then(
      (data) => { if (active) setState({ data, loading: false, error: null }) },
      (error: unknown) => { if (active) setState({ data: null, loading: false, error: describeError(error) }) },
    )
    return () => { active = false }
  }, [source, revision])

  useEffect(() => source === 'draft' ? subscribeToDraftChanges(reload) : undefined, [source, reload])

  async function mutate(action: DraftAction) {
    if (source !== 'draft') throw new Error('发布版只读，请在管理页编辑本机草稿。')
    const saved = await action(portfolioApi)
    setState({ data: saved, loading: false, error: null })
  }

  async function reset() {
    if (source !== 'draft') throw new Error('发布版只读。')
    const data = await portfolioApi.resetDraft()
    setState({ data, loading: false, error: null })
  }

  return <PortfolioContext.Provider value={{ source, ...state, reload, mutate, reset }}>{children}</PortfolioContext.Provider>
}
