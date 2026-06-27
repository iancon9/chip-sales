const DB_NAME = 'chip_sales_db'
const DB_VERSION = 1
const STORE_NAME = 'kv'
const MIGRATED_KEY = '__migrated__'

let db = null
let initPromise = null
let fallbackToLocalStorage = false

const cache = new Map()

// ---------------------------------------------------------------------------
// IndexedDB core
// ---------------------------------------------------------------------------

async function openDB() {
  if (initPromise) return initPromise

  initPromise = new Promise((resolve) => {
    if (!window.indexedDB) {
      fallbackToLocalStorage = true
      return resolve(null)
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const d = event.target.result
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = (event) => {
      db = event.target.result
      resolve(db)
    }

    request.onerror = (event) => {
      console.warn('[db] IndexedDB open failed, falling back to localStorage:', event.target.error)
      fallbackToLocalStorage = true
      db = null
      resolve(null)
    }

    request.onblocked = () => {
      console.warn('[db] IndexedDB blocked')
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

function idbGetAll() {
  if (!db) return Promise.resolve({})
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.openCursor()
      const result = {}
      req.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          result[cursor.key] = cursor.value
          cursor.continue()
        } else {
          resolve(result)
        }
      }
      req.onerror = () => reject(req.error)
    } catch (e) {
      reject(e)
    }
  })
}

function idbClear() {
  if (!db) return Promise.resolve()
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

function idbCount() {
  if (!db) return Promise.resolve(0)
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.count()
      req.onsuccess = () => resolve(req.result)
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

  if (keys.length === 0) {
    await idbSet(MIGRATED_KEY, true)
    return 0
  }

  console.log(`[db] Migrating ${keys.length} keys from localStorage to IndexedDB...`)

  for (const key of keys) {
    const raw = localStorage.getItem(key)
    let value = raw
    try { value = JSON.parse(raw) } catch { /* keep as string */ }
    cache.set(key, value)
    await idbSet(key, value)
  }

  await idbSet(MIGRATED_KEY, true)
  console.log('[db] Migration complete:', keys.length, 'keys')
  return keys.length
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initStorage() {
  await openDB()

  if (fallbackToLocalStorage) {
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

  let allData
  try {
    allData = await idbGetAll()
  } catch (e) {
    console.error('[db] Failed to read from IndexedDB, falling back:', e)
    fallbackToLocalStorage = true
    return initStorage()
  }

  for (const [key, value] of Object.entries(allData)) {
    cache.set(key, value)
  }

  if (!cache.has(MIGRATED_KEY)) {
    await migrateFromLocalStorage()
  } else {
    cache.delete(MIGRATED_KEY)
  }
}

export function storageGet(key, defaultValue = null) {
  if (cache.has(key)) return cache.get(key)
  return defaultValue
}

export function storageSet(key, value) {
  cache.set(key, value)

  if (fallbackToLocalStorage) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      console.error('[db] localStorage write failed:', e)
    }
    return
  }

  idbSet(key, value).catch(err => {
    console.error('[db] IndexedDB write failed for', key, ':', err)
    fallbackToLocalStorage = true
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch { /* last resort */ }
  })
}

export function storageDelete(key) {
  cache.delete(key)
  if (fallbackToLocalStorage) {
    localStorage.removeItem(key)
  } else {
    idbDelete(key).catch(err => console.error('[db] Delete failed:', err))
  }
}

export async function storageExport() {
  if (!fallbackToLocalStorage && db) {
    try {
      const allData = await idbGetAll()
      for (const [key, value] of Object.entries(allData)) {
        cache.set(key, value)
      }
    } catch { /* use cache */ }
  }
  const result = {}
  for (const [key, value] of cache) {
    if (key === MIGRATED_KEY) continue
    result[key] = value
  }
  return result
}

export async function storageImport(data) {
  const entries = Object.entries(data)
  for (const [key, value] of entries) {
    cache.set(key, value)
    if (fallbackToLocalStorage) {
      try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
      } catch { /* skip */ }
    } else {
      await idbSet(key, value)
    }
  }
  await idbSet(MIGRATED_KEY, true)
  return entries.length
}

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
    await idbClear()
    await idbSet(MIGRATED_KEY, true)
  }
}

export function isFallback() {
  return fallbackToLocalStorage
}
