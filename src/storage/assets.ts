import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { StoredAsset } from '../types/site.ts'

interface AssetDatabase extends DBSchema {
  assets: { key: string; value: StoredAsset }
}

export interface AssetStore {
  get(id: string): Promise<StoredAsset | undefined>
  putMany(assets: StoredAsset[]): Promise<void>
  deleteMany(ids: string[]): Promise<void>
  keys(): Promise<string[]>
}

let connection: Promise<IDBPDatabase<AssetDatabase>> | undefined

function database() {
  connection ??= openDB<AssetDatabase>('portfolio-assets', 1, {
    upgrade(db) { db.createObjectStore('assets', { keyPath: 'id' }) },
    blocking() { void connection?.then((db) => db.close()); connection = undefined },
    terminated() { connection = undefined },
  }).catch((error: unknown) => { connection = undefined; throw error })
  return connection
}

export const browserAssetStore: AssetStore = {
  async get(id) { return (await database()).get('assets', id) },
  async putMany(assets) {
    const transaction = (await database()).transaction('assets', 'readwrite')
    await Promise.all([...assets.map((asset) => transaction.store.put(asset)), transaction.done])
  },
  async deleteMany(ids) {
    if (!ids.length) return
    const transaction = (await database()).transaction('assets', 'readwrite')
    await Promise.all([...ids.map((id) => transaction.store.delete(id)), transaction.done])
  },
  async keys() { return (await database()).getAllKeys('assets') },
}
