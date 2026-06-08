<template>
  <div>
    <div class="page-header flex-between">
      <div><h2>询价单</h2><p class="text-muted">管理所有客户询价</p></div>
      <div>
        <el-button @click="triggerImport" style="margin-right:8px">导入采购报价</el-button>
        <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" style="display:none" @change="handleImportFile" />
        <el-button type="primary" @click="$router.push('/inquiry/new')"><el-icon><Plus /></el-icon> 新建询价单</el-button>
      </div>
    </div>

    <div class="card-minimal mb-16">
      <el-row :gutter="12">
        <el-col :span="6"><el-input v-model="filterKeyword" placeholder="搜索公司/邮箱/型号" size="small" clearable /></el-col>
        <el-col :span="3"><el-select v-model="filterMonth" placeholder="月份" size="small" clearable style="width:100%"><el-option v-for="m in monthOptions" :key="m" :label="m" :value="m" /></el-select></el-col>
        <el-col :span="3"><el-select v-model="filterStatus" placeholder="状态" size="small" clearable style="width:100%"><el-option v-for="(label, key) in store.statusLabels" :key="key" :label="label" :value="key" /></el-select></el-col>
      </el-row>
    </div>

    <div class="card-minimal">
      <el-table :data="filteredInquiries" size="small" style="width:100%" @row-click="goDetail" highlight-current-row>
        <el-table-column prop="id" label="编号" width="130" />
        <el-table-column label="客户" width="130"><template #default="{ row }">{{ row.customer.companyName }}</template></el-table-column>
        <el-table-column label="联系人" width="100"><template #default="{ row }">{{ row.customer.contactName }}</template></el-table-column>
        <el-table-column label="邮箱" min-width="180"><template #default="{ row }">{{ row.customer.email }}</template></el-table-column>
        <el-table-column label="芯片数" width="70" align="center"><template #default="{ row }">{{ row.items.length }}</template></el-table-column>
        <el-table-column label="状态" width="80"><template #default="{ row }"><el-tag :class="`status-${row.status}`" size="small">{{ store.statusLabels[row.status] }}</el-tag></template></el-table-column>
        <el-table-column label="创建时间" width="100"><template #default="{ row }">{{ row.createdAt.substring(0,10) }}</template></el-table-column>
        <el-table-column label="操作" width="160" fixed="right"><template #default="{ row }"><el-button size="small" @click.stop="goDetail(row)">详情</el-button><el-popconfirm title="确定删除？" @confirm="handleDelete(row.id)"><template #reference><el-button size="small" type="danger" @click.stop>删除</el-button></template></el-popconfirm></template></el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useInquiryStore } from '../stores/inquiry'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'

const router = useRouter(); const store = useInquiryStore()
const filterKeyword = ref(''); const filterStatus = ref(''); const filterMonth = ref(''); const fileInput = ref(null)

const monthOptions = computed(() => { const ms = new Set(store.inquiries.map(i => i.createdAt.substring(0,7))); const d = new Date(); for (let i=0; i<12; i++) { ms.add(d.toISOString().substring(0,7)); d.setMonth(d.getMonth()-1) }; return [...ms].sort().reverse() })

const filteredInquiries = computed(() => {
  let list = store.inquiries
  if (filterMonth.value) list = list.filter(i => i.createdAt.startsWith(filterMonth.value))
  if (filterStatus.value) list = list.filter(i => i.status === filterStatus.value)
  if (filterKeyword.value) { const kw = filterKeyword.value.toLowerCase(); list = list.filter(i => i.customer.companyName.toLowerCase().includes(kw) || i.customer.email.toLowerCase().includes(kw) || i.items.some(item => (item.mpn||'').toLowerCase().includes(kw) || (item.brand||'').toLowerCase().includes(kw))) }
  return list
})

function goDetail(row) { router.push(`/inquiry/${row.id}`) }
function handleDelete(id) { store.deleteInquiry(id); ElMessage.success('已删除') }
function triggerImport() { fileInput.value?.click() }

function looksLikeCostPrice(colName) {
  const u = colName.toUpperCase()
  if (/目标|TARGET/.test(colName)) return false
  return /COST|成本|成本价|单价|PRICE|进货/i.test(colName)
}

function looksLikeDeliveryDate(colName) {
  const u = colName.toUpperCase()
  return /交期|交货|DELIVERY|LEADTIME|L\/T/i.test(colName)
}

async function handleImportFile(e) {
  const file = e.target.files[0]; if (!file) return
  try {
    const data = await file.arrayBuffer(); const wb = XLSX.read(data); const ws = wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    if (rows.length === 0) { ElMessage.warning('导入文件为空'); return }

    // Log headers for debugging
    const headers = Object.keys(rows[0])
    console.log('导入文件列名:', headers)

    const colMap = {}
    headers.forEach(k => {
      const u = k.toUpperCase()
      // MPN
      if (!colMap.mpn && /MPN|PART|型号|P\/N/.test(u)) colMap.mpn = k
      // Brand
      if (!colMap.brand && /BRAND|品牌|MFG|MAKER|MANUFACTURE/.test(u)) colMap.brand = k
      // Currency
      if (!colMap.currency && /币种|货币|CURRENCY/.test(u)) colMap.currency = k
      // Cost price - use dedicated function
      if (!colMap.costPrice && looksLikeCostPrice(k)) colMap.costPrice = k
      // Supplier / Buyer
      if (!colMap.supplier && /采购员|采购|SUPPLIER|BUYER/i.test(k)) colMap.supplier = k
      // Delivery date
      if (!colMap.deliveryDate && looksLikeDeliveryDate(k)) colMap.deliveryDate = k
      // Batch
      if (!colMap.batch && /批次|DC|DATE\s*CODE/i.test(u)) colMap.batch = k
      // Quantity
      if (!colMap.quantity && /QTY|数量|QUANTITY/i.test(u)) colMap.quantity = k
    })

    console.log('列映射:', colMap)

    let matchedCount = 0
    let skippedCount = 0
    const pendingInquiries = store.inquiries.filter(i => i.status === 'pending')

    for (const row of rows) {
      const rawMpn = row[colMap.mpn]
      if (!rawMpn && rawMpn !== 0) continue
      const mpn = String(rawMpn).trim().toUpperCase()
      if (!mpn) continue

      let matched = false
      for (const inquiry of pendingInquiries) {
        for (let i = 0; i < inquiry.items.length; i++) {
          const item = inquiry.items[i]
          if (!item.mpn) continue
          if (item.mpn.toUpperCase().trim() === mpn) {
            const entry = {}
            if (colMap.costPrice && row[colMap.costPrice] !== undefined && row[colMap.costPrice] !== '') entry.costPrice = String(row[colMap.costPrice])
            if (colMap.currency && row[colMap.currency]) entry.costCurrency = String(row[colMap.currency])
            if (colMap.supplier && row[colMap.supplier]) entry.costSupplier = String(row[colMap.supplier])
            if (colMap.deliveryDate && row[colMap.deliveryDate]) {
              const dv = row[colMap.deliveryDate]
              entry.costDeliveryDate = typeof dv === 'number' ? new Date((dv - 25569) * 86400000).toISOString().substring(0,10) : String(dv)
            }
            if (colMap.batch && row[colMap.batch]) entry.costBatch = String(row[colMap.batch])
            if (colMap.quantity && row[colMap.quantity]) entry.costQuantity = String(row[colMap.quantity])
            entry._index = matchedCount + 1

            // First match populates top-level cost fields, all matches go to costEntries
            if (!item.costEntries || item.costEntries.length === 0) {
              store.updateItemCost(inquiry.id, i, {
                costPrice: entry.costPrice || item.costPrice,
                costQuantity: entry.costQuantity || item.costQuantity,
                costCurrency: entry.costCurrency || item.costCurrency,
                costBatch: entry.costBatch || item.costBatch,
                costSupplier: entry.costSupplier || item.costSupplier,
                costDeliveryDate: entry.costDeliveryDate || item.costDeliveryDate
              })
            }
            store.addItemCostEntry(inquiry.id, i, entry)
            matchedCount++
            matched = true
            break
          }
        }
        if (matched) break
      }
      if (!matched) skippedCount++
    }
    const msg = `导入完成，匹配了 ${matchedCount} 行采购报价`
    ElMessage.success(skippedCount > 0 ? msg + `，${skippedCount} 行未匹配` : msg)
  } catch (err) { ElMessage.error('导入失败: ' + err.message) }
  fileInput.value.value = ''
}
</script>