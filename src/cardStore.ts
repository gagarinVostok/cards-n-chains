import type { ImportedCard } from './cardImport'

/**
 * Card dumps the user added from their own computer, kept in this browser only (IndexedDB).
 * Nothing is uploaded: the files never leave the device.
 */
const DB_NAME = 'cards-n-chains'
const STORE = 'cards'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'))
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'file' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const request = action(transaction.objectStore(STORE))
    transaction.oncomplete = () => { db.close(); resolve(request ? request.result : undefined) }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  }))
}

/** Stored cards; an empty list when the browser cannot store data (e.g. some private windows). */
export async function listStoredCards(): Promise<ImportedCard[]> {
  try {
    const rows = (await run<ImportedCard[]>('readonly', (store) => store.getAll())) ?? []
    return rows.map((row) => ({ file: row.file, bytes: new Uint8Array(row.bytes) }))
  } catch {
    return []
  }
}

export function storeCards(cards: ImportedCard[]) {
  return run('readwrite', (store) => { for (const card of cards) store.put({ file: card.file, bytes: card.bytes }) })
}

export function deleteStoredCard(file: string) {
  return run('readwrite', (store) => store.delete(file))
}
