import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'chip_sales_inquiries'

function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] } }
function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }

export const useInquiryStore = defineStore('inquiry', () => {
  const inquiries = ref(load())

  const statusLabels = { pending: '待处理', quoted: '已报价', closed: '已关闭' }

function generateId() { return 'INQ-' + Date.now().toString(36).toUpperCase() }

  function createInquiry(data) {
    const inquiry = {
      id: generateId(),
      customer: { ...data.customer },
      status: 'pending',
      items: data.items.map((item, i) => ({
        brand: item.brand || '',
        mpn: item.mpn || '',
        quantity: item.quantity || '',
        batch: item.batch || '',
        package: item.package || '',
        targetPrice: item.targetPrice || '',
        spq: item.spq || '',
        remark: item.remark || '',
        // Cost fields (filled in inquiry detail or via import)
        costPrice: item.costPrice || '',
        costQuantity: item.costQuantity || '',
        costSupplier: item.costSupplier || '',
        costDeliveryDate: item.costDeliveryDate || '',
        costBatch: item.costBatch || '',
        costSupplierType: item.costSupplierType || 'new',
        // Multiple cost entries from import (same MPN different prices/batches/qtys)
        costEntries: [],
        selectedCostIndex: 0,
        // Quote selection
        selected: false
      })),
      notes: data.notes || '',
      rawEmail: data.rawEmail || '',
      sourceEmlFile: data.sourceEmlFile || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    inquiries.value.unshift(inquiry)
    save(inquiries.value)
    return inquiry
  }

  function updateInquiry(id, updates) {
    const idx = inquiries.value.findIndex(i => i.id === id)
    if (idx !== -1) {
      inquiries.value[idx] = { ...inquiries.value[idx], ...updates, updatedAt: new Date().toISOString() }
      save(inquiries.value)
    }
  }

  function updateItemCost(inquiryId, itemIndex, costData) {
    const inquiry = inquiries.value.find(i => i.id === inquiryId)
    if (inquiry && inquiry.items[itemIndex]) {
      Object.assign(inquiry.items[itemIndex], costData)
      inquiry.updatedAt = new Date().toISOString()
      save(inquiries.value)
    }
  }

  function clearItemCostEntries(inquiryId) {
    const inquiry = inquiries.value.find(i => i.id === inquiryId)
    if (!inquiry) return
    inquiry.items.forEach(item => {
      item.costEntries = []
      item.costPrice = ''
      item.costQuantity = ''
      item.costCurrency = ''
      item.costBatch = ''
      item.costSupplier = ''
      item.costDeliveryDate = ''
    })
    inquiry.updatedAt = new Date().toISOString()
    save(inquiries.value)
  }

  function addItemCostEntry(inquiryId, itemIndex, entry) {
    const inquiry = inquiries.value.find(i => i.id === inquiryId)
    if (inquiry && inquiry.items[itemIndex]) {
      if (!inquiry.items[itemIndex].costEntries) {
        inquiry.items[itemIndex].costEntries = []
      }
      inquiry.items[itemIndex].costEntries.push(entry)
      inquiry.updatedAt = new Date().toISOString()
      save(inquiries.value)
    }
  }

  function toggleItemSelect(inquiryId, itemIndex) {
    const inquiry = inquiries.value.find(i => i.id === inquiryId)
    if (inquiry && inquiry.items[itemIndex]) {
      inquiry.items[itemIndex].selected = !inquiry.items[itemIndex].selected
      save(inquiries.value)
    }
  }

  function selectAllItems(inquiryId, val) {
    const inquiry = inquiries.value.find(i => i.id === inquiryId)
    if (inquiry) {
      inquiry.items.forEach(item => { item.selected = val })
      save(inquiries.value)
    }
  }

  function deleteInquiry(id) {
    inquiries.value = inquiries.value.filter(i => i.id !== id)
    save(inquiries.value)
  }

  function getInquiry(id) { return inquiries.value.find(i => i.id === id) }

  const pendingCount = computed(() => inquiries.value.filter(i => i.status === 'pending').length)

  return { inquiries, statusLabels, createInquiry, updateInquiry, updateItemCost, clearItemCostEntries, addItemCostEntry, toggleItemSelect, selectAllItems, deleteInquiry, getInquiry, pendingCount }
})