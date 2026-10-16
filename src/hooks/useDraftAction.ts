import { useState } from 'react'
import { describeError } from '../api/portfolio'
import type { DraftAction } from '../api/portfolio'
import { usePortfolio } from '../data/context'

export function useDraftAction() {
  const { mutate } = usePortfolio()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function run(action: DraftAction, success: string): Promise<boolean> {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await mutate(action)
      setMessage(success)
      return true
    } catch (reason) {
      setError(describeError(reason))
      return false
    } finally { setBusy(false) }
  }

  function clear() { setMessage(''); setError('') }
  return { busy, message, error, run, clear }
}
