/**
 * LLM Configuration Manager
 * Stores/loads API key, endpoint, model from localStorage.
 * 
 * Actual LLM email parsing logic is in emlParser.js (parseEmlWithLLM).
 */

export function getLLMConfig() {
  try {
    return JSON.parse(localStorage.getItem('chip_sales_llm_config') || '{"apiKey":"","endpoint":"https://api.openai.com/v1/chat/completions","model":"gpt-3.5-turbo"}')
  } catch { return { apiKey: '', endpoint: '', model: 'gpt-3.5-turbo' } }
}

export function saveLLMConfig(config) {
  localStorage.setItem('chip_sales_llm_config', JSON.stringify(config))
}