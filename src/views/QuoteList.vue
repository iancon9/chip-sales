<template>
  <div>
    <div class="page-header"><h2>报价单</h2><p class="text-muted">所有生成的报价单</p></div>

    <div class="card-minimal mb-16">
      <el-row :gutter="12"><el-col :span="3"><el-select v-model="filterMonth" placeholder="月份" size="small" clearable style="width:100%"><el-option v-for="m in monthOptions" :key="m" :label="m" :value="m" /></el-select></el-col></el-row>
    </div>

    <div class="card-minimal">
      <el-table :data="filteredQuotes" size="small" style="width:100%" @row-click="goDetail" highlight-current-row>
        <el-table-column prop="id" label="报价编号" width="140" />
        <el-table-column label="客户" min-width="150"><template #default="{ row }">{{ row.customer.companyName }}</template></el-table-column>
        <el-table-column label="总额" width="140"><template #default="{ row }">{{ row.currency || 'USD' }} ${{ row.totalAmount?.toLocaleString() }}</template></el-table-column>
        <el-table-column label="总利润" width="130"><template #default="{ row }"><span :class="row.totalProfit > 0 ? '' : 'text-muted'">${{ row.totalProfit?.toLocaleString() }}</span></template></el-table-column>
        <el-table-column label="利润点" width="90"><template #default="{ row }">{{ row.avgProfitMargin }}%</template></el-table-column>
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag size="small" :type="row.status==='draft'?'info':row.status==='won'?'success':'warning'">{{ row.status==='draft'?'草稿':row.status==='won'?'已成交':'已发送' }}</el-tag></template></el-table-column>
        <el-table-column label="创建时间" width="120"><template #default="{ row }">{{ row.createdAt.substring(0,10) }}</template></el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }"><el-button size="small" @click.stop="goDetail(row)">详情</el-button><el-popconfirm title="确定删除？" @confirm="quoteStore.deleteQuote(row.id)"><template #reference><el-button size="small" type="danger" @click.stop>删除</el-button></template></el-popconfirm></template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuoteStore } from '../stores/quote'

const router = useRouter()
const quoteStore = useQuoteStore()
const filterMonth = ref('')

const monthOptions = computed(() => {
  const months = new Set(quoteStore.quotes.map(q => q.createdAt.substring(0,7)))
  const d = new Date(); for (let i=0; i<12; i++) { months.add(d.toISOString().substring(0,7)); d.setMonth(d.getMonth()-1) }
  return [...months].sort().reverse()
})

const filteredQuotes = computed(() => {
  let list = quoteStore.quotes
  if (filterMonth.value) list = list.filter(q => q.createdAt.startsWith(filterMonth.value))
  return list
})

function goDetail(row) { router.push(`/quote/${row.id}`) }
</script>