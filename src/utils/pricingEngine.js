/**
 * Pricing Engine - Calculate suggested price based on cost + coefficients
 */

const DEFAULT_PRICING = {
  baseMargin: 0.15,
  ratingCoefficient: { A: 1.0, B: 1.05, C: 1.10, D: 1.20 },
  brandTiers: [
    { tier: 'tier1', name: '一线', coeff: 1.00 },
    { tier: 'tier2', name: '二线', coeff: 1.03 },
    { tier: 'general', name: '通用', coeff: 1.05 },
    { tier: 'scarce', name: '稀缺', coeff: 1.08 },
    { tier: 'custom', name: '定制', coeff: 1.12 }
  ],
  brandTierMap: {
    'BROADCOM': 'tier1', 'ALTERA': 'tier1', 'INTEL': 'tier1', 'XILINX': 'tier1',
    'INFINEON': 'tier2', 'MICROCHIP': 'tier2', 'STMICRO': 'tier2', 'ON': 'tier2', 'ST': 'tier2',
    'DIODES': 'general', 'KIOXIA': 'general', 'WINBOND': 'general', 'OMRON': 'general',
    'NXP': 'tier2', 'TE': 'tier2', '3L ELECTRONIC': 'general'
  },
  quantityTiers: [
    { min: 1, max: 99, coeff: 1.0 },
    { min: 100, max: 999, coeff: 0.97 },
    { min: 1000, max: 4999, coeff: 0.93 },
    { min: 5000, max: 999999999, coeff: 0.90 }
  ],
  batchPremiums: { newBatch: 1.0, oldBatch: 1.08, usedNew: 1.15 }
}

export function getPricingConfig() {
  try {
    return JSON.parse(localStorage.getItem('chip_sales_pricing') || JSON.stringify(DEFAULT_PRICING))
  } catch { return DEFAULT_PRICING }
}

/**
 * Get brand coefficient
 */
export function getBrandCoefficient(brand) {
  const config = getPricingConfig()
  const upper = (brand || '').toUpperCase().trim()
  const tier = config.brandTierMap[upper]
  const tierConfig = config.brandTiers.find(t => t.tier === tier)
  return tierConfig ? tierConfig.coeff : 1.05 // default to general
}

/**
 * Get quantity discount coefficient
 */
export function getQuantityCoefficient(quantity) {
  const config = getPricingConfig()
  const qty = Number(quantity) || 0
  const tier = config.quantityTiers.find(t => qty >= t.min && qty <= t.max)
  return tier ? tier.coeff : 1.0
}

/**
 * Get batch premium coefficient
 */
export function getBatchCoefficient(batch) {
  const config = getPricingConfig()
  if (!batch) return 1.0
  const lower = batch.toString().toLowerCase()
  if (lower.includes('old') || /\d{2}\+/.test(lower)) return config.batchPremiums.oldBatch
  if (lower.includes('used') || lower.includes('refurb')) return config.batchPremiums.usedNew
  return config.batchPremiums.newBatch
}

/**
 * Calculate suggested price for a single item
 * Formula: costPrice × (1 + baseMargin) × ratingCoef × brandCoef × qtyCoef × batchCoef
 */
export function calculateSuggestedPrice(item, costPrice, customerRating) {
  const config = getPricingConfig()
  const rating = customerRating || 'B'
  const ratingCoef = config.ratingCoefficient[rating] || 1.05
  const brandCoef = getBrandCoefficient(item.brand)
  const qtyCoef = getQuantityCoefficient(item.quantity)
  const batchCoef = getBatchCoefficient(item.batch)

  const base = Number(costPrice) * (1 + config.baseMargin)
  const price = base * ratingCoef * brandCoef * qtyCoef * batchCoef

  return {
    suggestedPrice: Math.round(price * 100) / 100,
    breakdown: {
      basePrice: Number(costPrice),
      baseWithProfit: Math.round(base * 100) / 100,
      ratingCoef: { rating, coeff: ratingCoef },
      brandCoef: { brand: item.brand, coeff: brandCoef },
      qtyCoef: { quantity: item.quantity, coeff: qtyCoef },
      batchCoef: { batch: item.batch, coeff: batchCoef }
    }
  }
}

/**
 * Calculate lead time
 */
export function calculateLeadTime(deliveryDate, supplierType = 'new') {
  const config = getPricingConfig().leadTimeConfig || { baseDays: 3, useWorkingDays: true }
  const now = new Date()
  const delivery = new Date(deliveryDate)
  const diffDays = Math.ceil((delivery - now) / (1000 * 60 * 60 * 24))
  let leadTime = diffDays + config.baseDays

  // Adjust for supplier type
  if (supplierType === 'new' && config.specialRules) {
    const newRule = config.specialRules.find(r => r.condition === 'newSupplier')
    if (newRule) leadTime += newRule.addDays
  }
  if (supplierType === 'established' && config.specialRules) {
    const estRule = config.specialRules.find(r => r.condition === 'establishedSupplier')
    if (estRule) leadTime += estRule.addDays
  }

  return Math.max(1, leadTime)
}