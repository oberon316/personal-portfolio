import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePortfolio } from '../data/context'

export function ScrollToLocation() {
  const { pathname, hash } = useLocation()
  const { data } = usePortfolio()
  const ready = Boolean(data)
  useEffect(() => {
    if (!hash) { window.scrollTo({ top: 0, behavior: 'instant' }); return }
    document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [pathname, hash, ready])
  return null
}
