import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import en from 'element-plus/dist/locale/en.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import zhCN from './locales/zh-CN'
import enUS from './locales/en'
import { initStorage } from './utils/db'
import './style.css'

async function bootstrap() {
  await initStorage()

  // Language & dark mode: read from localStorage (synced before app mount)
  const savedLang = localStorage.getItem('chip_sales_language') || 'zh-CN'
  const i18n = createI18n({
    legacy: false,
    locale: savedLang,
    fallbackLocale: 'zh-CN',
    messages: { 'zh-CN': zhCN, 'en': enUS }
  })

  const savedDark = localStorage.getItem('chip_sales_darkMode')
  if (savedDark === 'true') {
    document.documentElement.classList.add('dark')
  }

  const elLocaleMap = { 'zh-CN': zhCn, 'en': en }

  const app = createApp(App)

  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }

  app.use(createPinia())
  app.use(router)
  app.use(i18n)
  app.use(ElementPlus, { locale: elLocaleMap[savedLang] || zhCn })

  app.provide('i18n', i18n)
  app.provide('darkMode', {
    toggle: () => {
      const isDark = document.documentElement.classList.toggle('dark')
      localStorage.setItem('chip_sales_darkMode', isDark)
      if (isDark) {
        document.documentElement.style.setProperty('--color-bg', '#1a1a1a')
        document.documentElement.style.setProperty('--color-surface', '#262626')
        document.documentElement.style.setProperty('--color-border', '#333')
        document.documentElement.style.setProperty('--color-text', '#e0e0e0')
        document.documentElement.style.setProperty('--color-text-secondary', '#999')
      } else {
        document.documentElement.style.setProperty('--color-bg', '#fafafa')
        document.documentElement.style.setProperty('--color-surface', '#ffffff')
        document.documentElement.style.setProperty('--color-border', '#e8e8e8')
        document.documentElement.style.setProperty('--color-text', '#1a1a1a')
        document.documentElement.style.setProperty('--color-text-secondary', '#888888')
      }
    },
    isDark: () => document.documentElement.classList.contains('dark')
  })

  app.mount('#app')
}

bootstrap()