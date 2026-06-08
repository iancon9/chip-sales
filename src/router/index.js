import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
  { path: '/inquiry', name: 'InquiryList', component: () => import('../views/InquiryList.vue') },
  { path: '/inquiry/new', name: 'InquiryNew', component: () => import('../views/InquiryNew.vue') },
  { path: '/inquiry/:id', name: 'InquiryDetail', component: () => import('../views/InquiryDetail.vue') },
  { path: '/quote', name: 'QuoteList', component: () => import('../views/QuoteList.vue') },
  { path: '/quote/:id', name: 'QuoteDetail', component: () => import('../views/QuoteDetail.vue') },
  { path: '/customers', name: 'Customers', component: () => import('../views/Customers.vue') },
  { path: '/dictionary', name: 'Dictionary', component: () => import('../views/Dictionary.vue') },
  { path: '/settings', name: 'Settings', component: () => import('../views/Settings.vue') },
]

const router = createRouter({ history: createWebHashHistory(), routes })
export default router