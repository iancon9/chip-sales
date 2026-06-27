/**
 * IndexedDB-backed storage with in-memory cache.
 *
 * Replaces localStorage to bypass the 5-10MB per-origin limit.
 * On first load, auto-migrates existing localStorage chip_sales_* keys.
 *
 * Design:
 *   - Reads are synchronous (memory cache), so Pinia setup() works unchanged.
 *   - Writes go to memory cache immediately, then persisted to IndexedDB async.
 *   - Falls back to localStorage if IndexedDB is unavailable.
 */

const DB_NAME = 'chip_sales_db'
const DB_VERSION = 1
const STORE_NAME = 'kv'

/** @type {IDBDatabase|null} */
let db = null
let initPromise = null
let fallbackToLocalStorage = false

/** In-memory cache: key → parsed value */
const cache = new Map()

// ---------------------------------------------------------------------------
// IndexedDB core
// ---------------------------------------------------------------------------

async function openDB() {
  if (initPromise) return initPromise

  initPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      fallbackToLocalStorage = true
      return resolve(null)
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const d = /** @type {IDBDatabase} */ (event.target.result)
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = (event) => {
      db = /** @type {IDBDatabase} */ (event.target.result)
      resolve(db)
    }

    request.onerror = (event) => {
      console.warn('[db] IndexedDB open failed, falling back to localStorage:', event.target.error)
      fallbackToLocalStorage = true
      db = null
      resolve(null)
    }

    request.onblocked = () => {
      console.warn('[db] IndexedDB blocked - another tab may have an open connection')
      fallbackToLocalStorage = true
      resolve(null)
    }
  })

  return initPromise
}

function idbGet(key) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(undefined)
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    } catch (e) {
      reject(e)
    }
  })
}

function idbSet(key, value) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve()
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.put(value, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    } catch (e) {
      reject(e)
    }
  })
}

function idbDelete(key) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve()
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    } catch (e) {
      reject(e)
    }
  })
}

async function idbGetAll() {
  if (!db) return {}
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const keysReq = store.getAllKeys()
      const valsReq = store.getAll()
      let done = 0
      const result = {}
      const check = () => {
        done++
        if (done === 2) {
          keysReq.result.forEach((k, i) => { result[k] = valsReq.result[i] })
          resolve(result)
        }
      }
      keysReq.onsuccess = check
      keysReq.onerror = () => reject(keysReq.error)
      valsReq.onsuccess = check
      valsReq.onerror = () => reject(valsReq.error)
    } catch (e) {
      reject(e)
    }
  })
}

async function idbClear() {
  if (!db) return
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    } catch (e) {
      reject(e)
    }
  })
}

// ---------------------------------------------------------------------------
// Migration from localStorage
// ---------------------------------------------------------------------------

async function migrateFromLocalStorage() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('chip_sales_')) {
      keys.push(key)
    }
  }

  if (keys.length === 0) return 0

  console.log(`[db] Migrating ${keys.length} keys from localStorage to IndexedDB...`)

  let migrated = 0
  for (const key of keys) {
    const raw = localStorage.getItem(key)
    let value = raw
    try { value = JSON.parse(raw) } catch { /* keep as string */ }
    cache.set(key, value)
    await idbSet(key, value).catch(() => {})
    migrated++
  }

  console.log(`[db] Migration complete: ${migrated} keys`)
  return migrated
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize storage. Must be called once before any read/write.
 * Loads all data from IndexedDB into memory cache.
 * If IndexedDB is empty, migrates from localStorage.
 */
export async function initStorage() {
  await openDB()

  if (fallbackToLocalStorage) {
    // Load localStorage into cache so reads work
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('chip_sales_')) {
        try {
          cache.set(key, JSON.parse(localStorage.getItem(key)))
        } catch {
          cache.set(key, localStorage.getItem(key))
        }
      }
    }
    return
  }

  // Load from IndexedDB
  const allData = await idbGetAll().catch(() => ({}))
  for (const [key, value] of Object.entries(allData)) {
    cache.set(key, value)
  }

  // If DB is empty, migrate from localStorage
  if (cache.size === 0) {
    await migrateFromLocalStorage()
  }
}

/**
 * Synchronous read. Returns defaultValue if key not found.
 */
export function storageGet(key, defaultValue = null) {
  if (cache.has(key)) return cache.get(key)
  return defaultValue
}

/**
 * Write to memory cache immediately, persist to IndexedDB async.
 */
export function storageSet(key, value) {
  cache.set(key, value)

  if (fallbackToLocalStorage) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      console.error('[db] localStorage write failed (quota exceeded?):', e)
    }
  } else {
    idbSet(key, value).catch(err => {
      console.error('[db] IndexedDB write failed for', key, ':', err)
    })
  }
}

/**
 * Delete a key from both cache and persistent storage.
 */
export function storageDelete(key) {
  cache.delete(key)
  if (fallbackToLocalStorage) {
    localStorage.removeItem(key)
  } else {
    idbDelete(key).catch(err => console.error('[db] Delete failed:', err))
  }
}

/**
 * Export all data as a plain object (JSON-serializable).
 */
export async function storageExport() {
  // Refresh from IndexedDB to ensure we have latest
  if (!fallbackToLocalStorage && db) {
    const allData = await idbGetAll().catch(() => ({}))
    for (const [key, value] of Object.entries(allData)) {
      cache.set(key, value)
    }
  }
  const result = {}
  for (const [key, value] of cache) {
    result[key] = value
  }
  return result
}

/**
 * Import data (from JSON backup). Overwrites existing keys.
 */
export async function storageImport(data) {
  const entries = Object.entries(data)
  for (const [key, value] of entries) {
    cache.set(key, value)
    if (fallbackToLocalStorage) {
      try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
      } catch { /* skip on quota error */ }
    } else {
      await idbSet(key, value).catch(() => {})
    }
  }
  return entries.length
}

/**
 * Clear all chip_sales data from cache and persistent storage.
 */
export async function storageClear() {
  cache.clear()
  if (fallbackToLocalStorage) {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('chip_sales_')) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } else {
    await idbClear().catch(() => {})
  }
}

/**
 * Check if falling back to localStorage.
 */
export function isFallback() {
  return fallbackToLocalStorage
}
