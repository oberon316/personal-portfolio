import type { MoveDirection } from '../types/site.ts'

export function sortedItems<T extends { order: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order)
}

export function normalizeOrder<T extends { order: number }>(items: readonly T[]): T[] {
  return items.map((item, order) => ({ ...item, order }))
}

export function moveItem<T extends { id: string; order: number }>(items: readonly T[], id: string, direction: MoveDirection): T[] {
  const sorted = sortedItems(items)
  const from = sorted.findIndex((item) => item.id === id)
  if (from === -1) throw new Error('条目已不存在，请刷新列表后重试。')
  const to = from + (direction === 'up' ? -1 : 1)
  if (to >= 0 && to < sorted.length) [sorted[from], sorted[to]] = [sorted[to], sorted[from]]
  return normalizeOrder(sorted)
}
