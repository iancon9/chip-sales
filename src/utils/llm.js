/**
 * LLM Configuration Manager
 * Stores/loads API key, endpoint, model from localStorage.
 * 
 * Actual LLM email parsing logic is in emlParser.js (parseEmlWithLLM).
 */

import { storageGet, storageSet } from './db'

export function getLLMConfig() {
  return storageGet('chip_sales_llm_config', {
    apiKey: '',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo'
  })
}

export function saveLLMConfig(config) {
  storageSet('chip_sales_llm_config', config)
}