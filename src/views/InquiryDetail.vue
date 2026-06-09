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
          <el-button size="small" style="margin-right:6px" :type="showMatchedOnly ? 'primary' : ''" @click="showMatchedOnly = !showMatchedOnly">{{ showMatchedOnly ? '显示全部' : '仅看已匹配' }} ({{ inquiry.items.filter(it => it.costEntries && it.costEntries.length > 0).length }})</el-button>
          <el-button size="small" @click="store.selectAllItems(inquiry.id, true)">全选</el-button>
          <el-button size="small" @click="store.selectAllItems(inquiry.id, false)">取消全选</el-button>
        </div>
      </div>

      <el-table :data="displayItems" size="small" style="width:100%" :row-key="(item) => item._rowId">
        <el-table-column type="expand">
          <template #default="{ row: itemRow }">
            <div v-if="itemRow.costEntries && itemRow.costEntries.length > 0" style="padding:8px 16px">
              <div class="text-sm text-muted mb-8">来自采购报价表的匹配结果（{{ itemRow.costEntries.length }} 条）：</div>
              <el-table :data="itemRow.costEntries" size="small" border style="width:100%">
                <el-table-column label="型号 MPN" min-width="150"><template #default="{ row: entry }">{{ entry.mpn || itemRow.mpn }}</template></el-table-column>
                <el-table-column label="采购数量" width="100" align="right"><template #default="{ row: entry }">{{ formatNum(entry.costQuantity) }}</template></el-table-column>
                <el-table-column label="采购单价" width="100" align="right"><template #default="{ row: entry }">{{ entry.costPrice ? '$' + entry.costPrice : '-' }}</template></el-table-column>
                <el-table-column label="币种" width="80"><template #default="{ row: entry }">{{ entry.costCurrency || 'USD' }}</template></el-table-column>
                <el-table-column label="采购批次" width="100"><template #default="{ row: entry }">{{ entry.costBatch || '-' }}</template></el-table-column>
                <el-table-column label="采购员" width="100"><template #default="{ row: entry }">{{ entry.costSupplier || '-' }}</template></el-table-column>
                <el-table-column label="交期" width="100"><template #default="{ row: entry }">{{ entry.costDeliveryDate || '-' }}</template></el-table-column>
                <el-table-column label="操作" width="80">
                  <template #default="{ $index: entryIdx }">
                    <el-button size="small" type="primary" @click="applyCostEntry(itemRow, entryIdx)">应用</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div v-else style="padding:8px 16px;color:var(--color-text-secondary);font-size:12px">暂无采购报价匹配结果，可导入采购报价表自动匹配</div>
          </template>
        </el-table-column>
        <el-table-column label="选择" width="55" align="center">
          <template #default="{ row }">
            <el-checkbox :model-value="row.selected" @change="store.toggleItemSelect(inquiry.id, findItemIndex(row))" />
          </template>
        </el-table-column>
        <el-table-column label="品牌" min-width="110"><template #default="{ row }">{{ row.brand }}</template></el-table-column>
        <el-table-column label="型号 MPN" min-width="150"><template #default="{ row }"><strong>{{ row.mpn }}</strong></template></el-table-column>
        <el-table-column label="客户数量" width="90" align="right"><template #default="{ row }">{{ formatNum(row.quantity) }}</template></el-table-column>
        <el-table-column label="目标价" width="90"><template #default="{ row }">{{ row.targetPrice ? '$' + row.targetPrice : '-' }}</template></el-table-column>
        <el-table-column label="采购单价" width="100"><template #default="{ row }"><el-input v-model="row.costPrice" size="small" type="number" step="0.01" placeholder="单价" /></template></el-table-column>
        <el-table-column label="采购数量" width="90"><template #default="{ row }"><el-input v-model="row.costQuantity" size="small" placeholder="数量" /></template></el-table-column>
        <el-table-column label="币种" width="70"><template #default="{ row }"><el-select v-model="row.costCurrency" size="small" style="width:100%"><el-option label="USD" value="USD" /><el-option label="RMB" value="RMB" /></el-select></template></el-table-column>
        <el-table-column label="交期" width="100"><template #default="{ row }"><el-input v-model="row.costDeliveryDate" size="small" placeholder="如 7days" /></template></el-table-column>
        <el-table-column label="批次" width="100"><template #default="{ row }"><el-input v-model="row.costBatch" size="small" placeholder="如 24+" /></template></el-table-column>
        <el-table-column label="备注" width="120"><template #default="{ row }"><el-input v-model="row.remark" size="small" placeholder="备注" /></template></el-table-column>
        <el-table-column label="操作" width="80"><template #default="{ row }"><el-button size="small" type="primary" @click="saveCostForRow(row)">保存</el-button></template></el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
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

// Assign unique _rowId to each item for row-key
watch(inquiry, (inq) => {
  if (inq && inq.items) {
    inq.items.forEach((item, idx) => {
      if (!item._rowId) item._rowId = 'item-' + idx + '-' + Date.now()
    })
  }
}, { immediate: true })

const showMatchedOnly = ref(false)

const displayItems = computed(() => {
  if (!inquiry.value) return []
  if (showMatchedOnly.value) {
    return inquiry.value.items.filter(it => it.costEntries && it.costEntries.length > 0)
  }
  return inquiry.value.items
})

function findItemIndex(row) {
  if (!inquiry.value) return -1
  return inquiry.value.items.indexOf(row)
}

function formatNum(n) { return n ? Number(n).toLocaleString() : '-' }

function applyCostEntry(itemRow, entryIdx) {
  if (!inquiry.value) return
  const entry = itemRow.costEntries[entryIdx]
  if (!entry) return
  const idx = inquiry.value.items.indexOf(itemRow)
  if (idx === -1) return
  store.updateItemCost(inquiry.value.id, idx, {
    costPrice: entry.costPrice || itemRow.costPrice,
    costQuantity: entry.costQuantity || itemRow.costQuantity,
    costCurrency: entry.costCurrency || itemRow.costCurrency || 'USD',
    costBatch: entry.costBatch || itemRow.costBatch,
    costSupplier: entry.costSupplier || itemRow.costSupplier,
    costDeliveryDate: entry.costDeliveryDate || itemRow.costDeliveryDate,
    remark: entry.costRemark || itemRow.remark
  })
  ElMessage.success('已应用该条采购报价到当前行')
}

function saveCostForRow(row) {
  const index = findItemIndex(row)
  if (index === -1) return
  saveCost(index)
}

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
    remark: item.remark,
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