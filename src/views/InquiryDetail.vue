<template>
  <div v-if="!inquiry" class="text-muted">加载中...</div>
  <div v-else>
    <div class="page-header flex-between">
      <div>
        <h2>{{ inquiry.id }}</h2>
        <p class="text-muted">{{ inquiry.customer.companyName }} · {{ inquiry.customer.email }} · <el-tag :class="`status-${inquiry.status}`" size="small">{{ store.statusLabels[inquiry.status] }}</el-tag></p>
      </div>
      <div>
        <el-button @click="exportExcel">导出 Excel</el-button>
        <el-button type="success" @click="generateQuote" :disabled="selectedCount === 0">生成报价单 ({{ selectedCount }})</el-button>
        <el-button @click="$router.push('/inquiry')">返回列表</el-button>
      </div>
    </div>

    <div class="card-minimal">
      <el-descriptions :column="4" size="small" border>
        <el-descriptions-item label="公司">{{ inquiry.customer.companyName }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ inquiry.customer.email }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ inquiry.customer.contactName }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ inquiry.createdAt.substring(0,10) }}</el-descriptions-item>
      </el-descriptions>
    </div>

    <div class="card-minimal">
      <div class="flex-between mb-16">
        <h4>芯片明细 · 成本录入</h4>
        <div>
          <el-button size="small" @click="store.selectAllItems(inquiry.id, true)">全选</el-button>
          <el-button size="small" @click="store.selectAllItems(inquiry.id, false)">取消全选</el-button>
        </div>
      </div>

      <el-table :data="inquiry.items" size="small" style="width:100%">
        <el-table-column label="选择" width="55" align="center">
          <template #default="{ $index }"><el-checkbox :model-value="inquiry.items[$index].selected" @change="store.toggleItemSelect(inquiry.id, $index)" /></template>
        </el-table-column>
        <el-table-column label="品牌" min-width="110"><template #default="{ row }">{{ row.brand }}</template></el-table-column>
        <el-table-column label="型号 MPN" min-width="150"><template #default="{ row }"><strong>{{ row.mpn }}</strong></template></el-table-column>
        <el-table-column label="客户数量" width="90" align="right"><template #default="{ row }">{{ formatNum(row.quantity) }}</template></el-table-column>
        <el-table-column label="采购数量" width="100"><template #default="{ $index }"><el-input v-model="inquiry.items[$index].costQuantity" size="small" placeholder="数量" /></template></el-table-column>
        <el-table-column label="目标价" width="100"><template #default="{ row }">{{ row.targetPrice ? '$' + row.targetPrice : '-' }}</template></el-table-column>
        <el-table-column label="采购单价" width="110"><template #default="{ $index }"><el-input v-model="inquiry.items[$index].costPrice" size="small" type="number" step="0.01" placeholder="单价" /></template></el-table-column>
        <el-table-column label="币种" width="75"><template #default="{ $index }"><el-select v-model="inquiry.items[$index].costCurrency" size="small" style="width:100%"><el-option label="USD" value="USD" /><el-option label="RMB" value="RMB" /></el-select></template></el-table-column>
        <el-table-column label="采购批次" width="110"><template #default="{ $index }"><el-input v-model="inquiry.items[$index].costBatch" size="small" placeholder="如 24+" /></template></el-table-column>
        <el-table-column label="采购员" width="120"><template #default="{ $index }"><el-input v-model="inquiry.items[$index].costSupplier" size="small" placeholder="联系人" /></template></el-table-column>
        <el-table-column label="交期" width="110"><template #default="{ $index }"><el-input v-model="inquiry.items[$index].costDeliveryDate" size="small" placeholder="如 7days" /></template></el-table-column>
        <el-table-column label="操作" width="80"><template #default="{ $index }"><el-button size="small" type="primary" @click="saveCost($index)">保存</el-button></template></el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInquiryStore } from '../stores/inquiry'
import { useCustomerStore } from '../stores/customer'
import { useQuoteStore } from '../stores/quote'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'

const route = useRoute()
const router = useRouter()
const store = useInquiryStore()
const customerStore = useCustomerStore()
const quoteStore = useQuoteStore()

const inquiry = computed(() => store.getInquiry(route.params.id))
const selectedCount = computed(() => inquiry.value ? inquiry.value.items.filter(it => it.selected).length : 0)

function formatNum(n) { return n ? Number(n).toLocaleString() : '-' }

function saveCost(index) {
  if (!inquiry.value) return
  const item = inquiry.value.items[index]
  store.updateItemCost(inquiry.value.id, index, {
    costPrice: item.costPrice,
    costQuantity: item.costQuantity,
    costCurrency: item.costCurrency || 'USD',
    costBatch: item.costBatch,
    costSupplier: item.costSupplier,
    costDeliveryDate: item.costDeliveryDate,
    batch: item.batch,
    costSupplierType: 'new'
  })
  ElMessage.success('成本已保存')
}

function exportExcel() {
  if (!inquiry.value) return
  const data = inquiry.value.items.map(item => ({ Brand: item.brand, MPN: item.mpn, QTY: item.quantity, 'Target Price': item.targetPrice, 'D/C': item.batch, Package: item.package, Cost: item.costPrice, Currency: item.costCurrency, Supplier: item.costSupplier }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Inquiry')
  XLSX.writeFile(wb, `${inquiry.id}_${new Date().toISOString().substring(0,10)}.xlsx`)
  ElMessage.success('导出成功')
}

function generateQuote() {
  if (!inquiry.value) return
  const selected = inquiry.value.items.filter(it => it.selected)
  if (selected.length === 0) { ElMessage.warning('请至少选择一行芯片'); return }
  if (!selected.every(it => it.costPrice)) { ElMessage.warning('选中行有未填写进货单价的，请先填写'); return }
  const customer = customerStore.getByEmail(inquiry.value.customer.email)
  const rating = customerStore.getRatingByEmail(inquiry.value.customer.email)
  const quote = quoteStore.createQuote(inquiry.value, selected, rating)
  store.updateInquiry(inquiry.value.id, { status: 'quoted' })
  ElMessage.success('报价单生成成功')
  router.push(`/quote/${quote.id}`)
}
</script>