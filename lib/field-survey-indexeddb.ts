/**
 * Fila offline de entrevistas — uma fila por navegador/dispositivo.
 * Cada entrevista tem localClientId único (UUID) → vários pesquisadores não colidem.
 */

const DB_NAME = 'cockpit-field-survey-pi2026'
const DB_VERSION = 1
const STORE = 'pending_interviews'

export interface PendingFieldInterview {
  localClientId: string
  answers: Record<string, unknown>
  questionnaireVersion: string
  createdAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = (): void => {
      reject(req.error ?? new Error('IndexedDB open failed'))
    }
    req.onupgradeneeded = (): void => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'localClientId' })
      }
    }
    req.onsuccess = (): void => {
      resolve(req.result)
    }
  })
}

export async function savePendingInterview(row: PendingFieldInterview): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = (): void => resolve()
    tx.onerror = (): void => reject(tx.error ?? new Error('tx error'))
    tx.objectStore(STORE).put(row)
  })
  db.close()
}

export async function getAllPendingInterviews(): Promise<PendingFieldInterview[]> {
  const db = await openDb()
  const rows = await new Promise<PendingFieldInterview[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const q = tx.objectStore(STORE).getAll()
    q.onerror = (): void => reject(q.error ?? new Error('getAll error'))
    q.onsuccess = (): void => resolve((q.result as PendingFieldInterview[]) ?? [])
  })
  db.close()
  return rows
}

export async function removePendingInterview(localClientId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = (): void => resolve()
    tx.onerror = (): void => reject(tx.error ?? new Error('tx error'))
    tx.objectStore(STORE).delete(localClientId)
  })
  db.close()
}
