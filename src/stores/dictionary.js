import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'chip_sales_dictionary'

const DEFAULT_MODELS = [
  { brand: 'BROADCOM', mpn: 'BCM56780A0KFSBG', scarce: true },
  { brand: 'BROADCOM', mpn: 'BCM56880B0KFSBG', scarce: true },
  { brand: 'BROADCOM', mpn: 'BCM56990B0KFLGG', scarce: true },
  { brand: 'BROADCOM', mpn: 'BCM56870A0KFSBG', scarce: true },
  { brand: 'ALTERA', mpn: 'EPM7160STI100-10N', scarce: true },
  { brand: 'ALTERA', mpn: '5CEBA4F23C7N', scarce: false },
  { brand: 'ALTERA', mpn: '5CEBA4F23I7N', scarce: false },
  { brand: 'ALTERA', mpn: '5M1270ZF324C5N', scarce: true },
  { brand: 'INFINEON', mpn: 'IAUC90N10S5N062', scarce: false },
  { brand: 'INTEL', mpn: '52559-1633', scarce: false },
  { brand: 'DIODES', mpn: 'BAT64SQ-7', scarce: false },
  { brand: 'SHINDENGEN', mpn: 'D3UBA80-7062', scarce: false },
]

function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_MODELS } catch { return DEFAULT_MODELS } }
function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }

export const useDictionaryStore = defineStore('dictionary', () => {
  const models = ref(load())

  function isScarce(brand, mpn) {
    const upperBrand = (brand || '').toUpperCase().trim()
    const upperMpn = (mpn || '').toUpperCase().trim()
    return models.value.some(m =>
      m.brand.toUpperCase() === upperBrand && m.mpn.toUpperCase() === upperMpn && m.scarce
    )
  }

  function toggleScarce(brand, mpn) {
    const upperBrand = (brand || '').toUpperCase().trim()
    const upperMpn = (mpn || '').toUpperCase().trim()
    const idx = models.value.findIndex(m => m.brand.toUpperCase() === upperBrand && m.mpn.toUpperCase() === upperMpn)
    if (idx !== -1) {
      models.value[idx].scarce = !models.value[idx].scarce
    } else {
      models.value.push({ brand: upperBrand, mpn: upperMpn, scarce: true })
    }
    save(models.value)
  }

  function addModel(brand, mpn, scarce = false) {
    models.value.push({ brand, mpn, scarce })
    save(models.value)
  }

  function removeModel(brand, mpn) {
    const upperBrand = (brand || '').toUpperCase().trim()
    const upperMpn = (mpn || '').toUpperCase().trim()
    models.value = models.value.filter(m => !(m.brand.toUpperCase() === upperBrand && m.mpn.toUpperCase() === upperMpn))
    save(models.value)
  }

  function searchMpn(keyword) {
    const kw = (keyword || '').toUpperCase()
    return models.value.filter(m => m.mpn.toUpperCase().includes(kw) || m.brand.toUpperCase().includes(kw))
  }

  return { models, isScarce, toggleScarce, addModel, removeModel, searchMpn }
})