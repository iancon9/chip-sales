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
      console.log('[db] IndexedDB not available')
      fallbackToLocalStorage = true
      return resolve(null)
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      console.log('[db] onupgradeneeded')
      const d = event.target.result
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = (event) => {
      db = event.target.result
      console.log('[db] opened OK, stores:', Array.from(db.objectStoreNames))
      resolve(db)
    }

    request.onerror = (event) => {
      console.warn('[db] open failed:', event.target.error)
      fallbackToLocalStorage = true
      db = null
      resolve(null)
    }

    request.onblocked = () => {
      console.warn('[db] blocked')
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
          console.log('[db] idbGetAll returned', Object.keys(result).length, 'keys:', Object.keys(result))
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

async function probeIDB() {
  try {
    await idbSet('__probe__', 1)
    const val = await idbGet('__probe__')
    await idbDelete('__probe__')
    return val === 1
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

async function migrateFromLocalStorage() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('chip_sales_')) {
      keys.push(key)
    }
  }

  console.log('[db] localStorage has', keys.length, 'chip_sales_ keys:', keys)

  if (keys.length === 0) {
    await idbSet(MIGRATED_KEY, true)
    return 0
  }

  let migrated = 0
  for (const key of keys) {
    const raw = localStorage.getItem(key)
    let value = raw
    try { value = JSON.parse(raw) } catch {}
    cache.set(key, value)
    try {
      await idbSet(key, value)
      migrated++
    } catch (e) {
      console.error('[db] migrate failed for', key, ':', e)
    }
  }

  try {
    await idbSet(MIGRATED_KEY, true)
  } catch (e) {
    console.error('[db] failed to set sentinel:', e)
  }

  console.log('[db] migration done:', migrated, '/', keys.length, 'keys')
  return migrated
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initStorage() {
  await openDB()

  if (fallbackToLocalStorage) {
    console.log('[db] using localStorage fallback')
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

  const writable = await probeIDB()
  if (!writable) {
    console.error('[db] IndexedDB not writable, switching to localStorage')
    fallbackToLocalStorage = true
    return initStorage()
  }

  let allData
  try {
    allData = await idbGetAll()
  } catch (e) {
    console.error('[db] idbGetAll failed:', e)
    fallbackToLocalStorage = true
    return initStorage()
  }

  for (const [key, value] of Object.entries(allData)) {
    cache.set(key, value)
  }

  console.log('[db] cache has', cache.size, 'keys, has sentinel:', cache.has(MIGRATED_KEY))

  if (!cache.has(MIGRATED_KEY)) {
    console.log('[db] no sentinel - running migration')
    await migrateFromLocalStorage()
  } else {
    console.log('[db] sentinel found - skipping migration')
    cache.delete(MIGRATED_KEY)
  }

  console.log('[db] init done. cache keys:', Array.from(cache.keys()))
}

export function storageGet(key, defaultValue = null) {
  if (cache.has(key)) return cache.get(key)
  return defaultValue
}

function deepClone(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

export function storageSet(key, value) {
  const plainValue = deepClone(value)
  cache.set(key, plainValue)

  if (fallbackToLocalStorage) {
    try {
      localStorage.setItem(key, JSON.stringify(plainValue))
      console.log('[db] set via localStorage:', key)
    } catch (e) {
      console.error('[db] localStorage write failed for', key, ':', e.message)
    }
    return
  }

  idbSet(key, plainValue).then(() => {
    console.log('[db] set OK:', key)
  }).catch(err => {
    console.error('[db] IndexedDB write failed for', key, ':', err)
    fallbackToLocalStorage = true
    try {
      localStorage.setItem(key, JSON.stringify(plainValue))
    } catch (e2) {
      console.error('[db] localStorage fallback also failed:', e2.message)
    }
  })
}

export function storageDelete(key) {
  cache.delete(key)
  if (fallbackToLocalStorage) {
    localStorage.removeItem(key)
  } else {
    idbDelete(key).catch(err => console.error('[db] delete failed:', err))
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
