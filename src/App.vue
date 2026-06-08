<template>
  <div class="app-layout">
    <aside class="app-sidebar">
      <div class="logo">ChipSales</div>
      <router-link v-for="nav in navs" :key="nav.path" :to="nav.path" class="nav-item" active-class="active">
        <el-icon><component :is="nav.icon" /></el-icon>
        {{ nav.label }}
      </router-link>
    </aside>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
const navs = [
  { path: '/dashboard', label: '仪表盘', icon: 'Odometer' },
  { path: '/inquiry', label: '询价单', icon: 'Document' },
  { path: '/quote', label: '报价单', icon: 'Tickets' },
  { path: '/customers', label: '客户', icon: 'User' },
  { path: '/dictionary', label: '报价参数配置', icon: 'Collection' },
  { path: '/settings', label: '设置', icon: 'Setting' },
]
</script>