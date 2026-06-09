import { defineStore } from 'pinia'
import { ref } from 'vue'
import { calculateSuggestedPrice, calculateLeadTime } from '../utils/pricingEngine'
import { calculateQuoteProfit, calculateCommission } from '../utils/commission'

const STORAGE_KEY = 'chip_sales_quotes'
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] } }
function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }

export const useQuoteStore = defineStore('quote', () => {
  const quotes = ref(load())
  function generateId() { return 'QTE-' + Date.now().toString(36).toUpperCase() }

  function createQuote(inquiry, selectedItems, customerRating) {
    const rate = parseFloat(localStorage.getItem('chip_sales_settings') ? JSON.parse(localStorage.getItem('chip_sales_settings')).exchangeRate || 7.25 : 7.25)
      const items = selectedItems.map(item => {
      let costPrice = parseFloat(item.costPrice) || 0
      const currency = item.costCurrency || 'USD'
      const costUSD = currency === 'RMB' ? costPrice / rate : costPrice
      const { suggestedPrice } = calculateSuggestedPrice(item, costUSD, customerRating)
      const lt = item.costDeliveryDate ? String(item.costDeliveryDate) : 'TBD'
      const bestRemark = (item.costEntries && item.costEntries.length > 0 && item.costEntries[0].costRemark)
        ? item.costEntries[0].costRemark : (item.remark || '')
      return {
        brand: item.brand,
        mpn: item.mpn,
        quantity: item.costQuantity || item.quantity,
        batch: item.costBatch || item.batch,
        costPrice: costUSD,
        costCurrency: currency,
        suggestedPrice,
        quotedPrice: suggestedPrice,
        leadTime: lt,
        remark: bestRemark
      }
    })

    const profitResult = calculateQuoteProfit(items, rate)
    const commResult = calculateCommission(profitResult.summary.totalProfitRMB)

    const quote = {
      id: generateId(), inquiryId: inquiry.id, customer: { ...inquiry.customer },
      items: profitResult.items, totalAmount: profitResult.summary.totalRevenue, totalCost: profitResult.summary.totalCost,
      totalProfit: profitResult.summary.totalProfit, avgProfitMargin: profitResult.summary.avgProfitMargin,
      currency: 'USD', exchangeRate: rate, commissionAmount: commResult.commission, performanceAmount: commResult.performance,
      performancePoints: commResult.points, commissionTier: commResult.tier, commissionTotal: commResult.total,
      validDate: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
      emailRecipient: inquiry.customer.email, emailSubject: `Quotation - ${inquiry.customer.companyName}`,
      emailBody: '', status: 'draft', editHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }
    quotes.value.unshift(quote); save(quotes.value); return quote
  }

  function updateQuoteItem(quoteId, itemIndex, updates, editRecord) {
    const quote = quotes.value.find(q => q.id === quoteId); if (!quote) return
    Object.assign(quote.items[itemIndex], updates); if (editRecord) quote.editHistory.push(editRecord)
    const profitResult = calculateQuoteProfit(quote.items, quote.exchangeRate)
    quote.items = profitResult.items
    quote.totalAmount = profitResult.summary.totalRevenue; quote.totalCost = profitResult.summary.totalCost
    quote.totalProfit = profitResult.summary.totalProfit; quote.avgProfitMargin = profitResult.summary.avgProfitMargin
    const commResult = calculateCommission(profitResult.summary.totalProfitRMB)
    quote.commissionAmount = commResult.commission; quote.performanceAmount = commResult.performance
    quote.performancePoints = commResult.points; quote.commissionTotal = commResult.total
    quote.updatedAt = new Date().toISOString(); save(quotes.value)
  }

  function updateQuote(id, u) { const i = quotes.value.findIndex(q => q.id === id); if (i !== -1) { quotes.value[i] = { ...quotes.value[i], ...u, updatedAt: new Date().toISOString() }; save(quotes.value) } }
  function getQuote(id) { return quotes.value.find(q => q.id === id) }
  function deleteQuote(id) { quotes.value = quotes.value.filter(q => q.id !== id); save(quotes.value) }

  return { quotes, createQuote, updateQuoteItem, updateQuote, getQuote, deleteQuote }
})