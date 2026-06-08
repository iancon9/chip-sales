import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'chip_sales_closed_deals'

function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] } }
function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }

export const useClosedDealsStore = defineStore('closedDeals', () => {
  const deals = ref(load())

  function generateId() { return 'WON-' + Date.now().toString(36).toUpperCase() }

  function closeQuote(quote) {
    const deal = {
      id: generateId(),
      quoteId: quote.id,
      inquiryId: quote.inquiryId,
      customer: { ...quote.customer },
      items: quote.items.map(item => ({
        brand: item.brand, mpn: item.mpn,
        // Actual quantities (editable)
        actualQuantity: item.quantity,
        actualCost: item.costPrice,
        actualPrice: item.quotedPrice,
        // Original values for reference
        plannedQuantity: item.quantity,
        plannedCost: item.costPrice,
        plannedPrice: item.quotedPrice,
        profit: item.profit || 0,
        profitMargin: item.profitMargin || 0,
        leadTime: item.leadTime || '',
        remark: item.remark || ''
      })),
      totalAmount: quote.totalAmount,
      totalCost: quote.totalCost,
      totalProfit: quote.totalProfit,
      avgProfitMargin: quote.avgProfitMargin,
      exchangeRate: quote.exchangeRate || 7.25,
      closedAt: new Date().toISOString(),
      month: new Date().toISOString().substring(0, 7), // YYYY-MM
      status: 'closed'
    }
    deals.value.unshift(deal)
    save(deals.value)
    return deal
  }

  function updateDealItem(dealId, itemIndex, updates) {
    const deal = deals.value.find(d => d.id === dealId)
    if (!deal || !deal.items[itemIndex]) return
    Object.assign(deal.items[itemIndex], updates)

    // Recalculate profit per item
    const item = deal.items[itemIndex]
    const aq = Number(item.actualQuantity) || 0
    const ac = Number(item.actualCost) || 0
    const ap = Number(item.actualPrice) || 0
    item.profit = (ap - ac) * aq
    item.profitMargin = ap > 0 ? ((ap - ac) / ap) * 100 : 0

    // Recalculate total
    let totalAmount = 0, totalCost = 0, totalProfit = 0
    deal.items.forEach(it => {
      const q = Number(it.actualQuantity) || 0
      totalAmount += (Number(it.actualPrice) || 0) * q
      totalCost += (Number(it.actualCost) || 0) * q
      totalProfit += it.profit || 0
    })
    deal.totalAmount = Math.round(totalAmount * 100) / 100
    deal.totalCost = Math.round(totalCost * 100) / 100
    deal.totalProfit = Math.round(totalProfit * 100) / 100
    deal.avgProfitMargin = totalAmount > 0 ? Math.round((totalProfit / totalAmount) * 10000) / 100 : 0
    save(deals.value)
  }

  function deleteDeal(id) {
    deals.value = deals.value.filter(d => d.id !== id)
    save(deals.value)
  }

  function getDealsByMonth(month) {
    return deals.value.filter(d => d.month === month)
  }

  function getDeal(id) { return deals.value.find(d => d.id === id) }

  // Monthly summary for commission calculation
  function getMonthlySummary(month) {
    const monthDeals = month ? getDealsByMonth(month) : deals.value
    const totalUSD = monthDeals.reduce((s, d) => s + d.totalAmount, 0)
    const totalCost = monthDeals.reduce((s, d) => s + d.totalCost, 0)
    const totalProfit = monthDeals.reduce((s, d) => s + d.totalProfit, 0)
    const rate = monthDeals[0]?.exchangeRate || 7.25
    const totalProfitRMB = totalProfit * rate
    return { month, totalUSD, totalCost, totalProfit, totalProfitRMB, avgMargin: totalUSD > 0 ? Math.round((totalProfit / totalUSD) * 10000) / 100 : 0, dealCount: monthDeals.length, exchangeRate: rate }
  }

  function currentMonth() { return new Date().toISOString().substring(0, 7) }

  return { deals, closeQuote, updateDealItem, deleteDeal, getDeal, getDealsByMonth, getMonthlySummary, currentMonth }
})