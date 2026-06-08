/**
 * Commission & Performance Calculator
 * Based on 6-tier profit commission rules (RMB)
 */

const DEFAULT_COMMISSION = {
  commissionWeight: 0.70,
  performanceWeight: 0.30,
  tiers: [
    { minProfit: 20000, maxProfit: 40000, commissionRate: 0.07, performanceRate: 0.03,
      commissionMin: 1400, commissionMax: 2800, performanceMin: 600, performanceMax: 1200 },
    { minProfit: 40001, maxProfit: 60000, commissionRate: 0.084, performanceRate: 0.036,
      commissionMin: 3360, commissionMax: 5040, performanceMin: 1440, performanceMax: 2160 },
    { minProfit: 60001, maxProfit: 80000, commissionRate: 0.098, performanceRate: 0.042,
      commissionMin: 5880, commissionMax: 7840, performanceMin: 2520, performanceMax: 3360 },
    { minProfit: 80001, maxProfit: 150000, commissionRate: 0.112, performanceRate: 0.048,
      commissionMin: 8960, commissionMax: 16800, performanceMin: 3840, performanceMax: 7200 },
    { minProfit: 150001, maxProfit: 230000, commissionRate: 0.126, performanceRate: 0.054,
      commissionMin: 18900, commissionMax: 28980, performanceMin: 8100, performanceMax: 12420 },
    { minProfit: 230001, maxProfit: 999999999, commissionRate: 0.14, performanceRate: 0.06,
      commissionMin: 32200, commissionMax: 140000, performanceMin: 13800, performanceMax: 60000 }
  ]
}

export function getCommissionConfig() {
  try {
    return JSON.parse(localStorage.getItem('chip_sales_commission') || JSON.stringify(DEFAULT_COMMISSION))
  } catch { return DEFAULT_COMMISSION }
}

export function saveCommissionConfig(config) {
  localStorage.setItem('chip_sales_commission', JSON.stringify(config))
}

/**
 * Clamp value between min and max
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Calculate commission and performance for a given profit (in RMB)
 * Returns: { commission, performance, tier, points, total }
 */
export function calculateCommission(profitRMB) {
  const config = getCommissionConfig()
  const tier = config.tiers.find(t => profitRMB >= t.minProfit && profitRMB <= t.maxProfit)
  if (!tier) {
    return { commission: 0, performance: 0, tier: null, points: 0, total: 0 }
  }

  const rawCommission = profitRMB * tier.commissionRate
  const rawPerformance = profitRMB * tier.performanceRate

  const commission = clamp(rawCommission, tier.commissionMin, tier.commissionMax)
  const performance = clamp(rawPerformance, tier.performanceMin, tier.performanceMax)

  return {
    commission: Math.round(commission * 100) / 100,
    performance: Math.round(performance * 100) / 100,
    tier,
    points: tier.performanceRate,
    total: Math.round((commission + performance) * 100) / 100,
    rawCommission,
    rawPerformance
  }
}

/**
 * Calculate profit per item and total
 */
export function calculateQuoteProfit(quoteItems, exchangeRate = 7.25) {
  let totalUSD = 0
  let totalCost = 0
  const items = quoteItems.map(item => {
    const costPrice = parseFloat(item.costPrice) || 0
    const quotedPrice = parseFloat(item.quotedPrice) || parseFloat(item.suggestedPrice) || 0
    const qty = Number(item.quantity) || 0
    const revenue = quotedPrice * qty
    const cost = costPrice * qty
    const profit = revenue - cost
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0

    totalUSD += revenue
    totalCost += cost

    return {
      ...item,
      revenue: Math.round(revenue * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100
    }
  })

  const totalProfit = totalUSD - totalCost
  const avgMargin = totalUSD > 0 ? (totalProfit / totalUSD) * 100 : 0

  return {
    items,
    summary: {
      totalRevenue: Math.round(totalUSD * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      avgProfitMargin: Math.round(avgMargin * 100) / 100,
      totalProfitRMB: Math.round(totalProfit * exchangeRate * 100) / 100
    }
  }
}