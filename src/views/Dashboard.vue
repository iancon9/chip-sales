<template>
  <div>
    <div class="page-header flex-between">
      <div><h2>仪表盘</h2><p class="text-muted">本月业务概览</p></div>
      <div><el-select v-model="filterMonth" size="small" style="width:160px" @change="refreshData"><el-option v-for="m in monthOptions" :key="m" :label="m" :value="m" /></el-select></div>
    </div>

    <!-- Top Stats -->
    <el-row :gutter="16" style="margin-bottom:20px">
      <el-col :span="4"><div class="profit-card"><div class="label">询价单</div><div class="value">{{ inquiryStore.inquiries.length }}</div></div></el-col>
      <el-col :span="4"><div class="profit-card"><div class="label">待处理</div><div class="value">{{ inquiryStore.pendingCount }}</div></div></el-col>
      <el-col :span="4"><div class="profit-card"><div class="label">客户数</div><div class="value">{{ customerStore.customers.length }}</div></div></el-col>
      <el-col :span="4"><div class="profit-card"><div class="label">当月成交</div><div class="value" style="color:#2d7d2d">{{ summary.dealCount }}</div></div></el-col>
      <el-col :span="4"><div class="profit-card"><div class="label">当月利润</div><div class="value" style="color:#2d7d2d">${{ fmt(summary.totalProfit) }}</div></div></el-col>
      <el-col :span="4"><div class="profit-card"><div class="label">利润率</div><div class="value">{{ summary.avgMargin }}%</div></div></el-col>
    </el-row>

    <!-- Commission from monthly closed deals -->
    <el-row :gutter="16" style="margin-bottom:20px">
      <el-col :span="8">
        <div class="profit-card" style="background:linear-gradient(135deg, #fef9f0 0%, #fff7e6 100%);border-color:#fad4a7">
          <div class="commission-section">
            <div class="commission-label">当月提成 (¥) <span class="commission-month">{{ filterMonth }}</span></div>
            <div class="commission-value" style="color:#c98a3e">{{ commissionDisplay }}</div>
            <div class="commission-desc">{{ commissionTierDesc }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="profit-card" style="background:linear-gradient(135deg, #f0f6ff 0%, #eaf1fb 100%);border-color:#b3d8f5">
          <div class="commission-section">
            <div class="commission-label">当月绩效 (¥)</div>
            <div class="commission-value" style="color:#3d8fd9">{{ performanceDisplayOverride }}</div>
            <div class="commission-controls">
              <span class="commission-hint">绩点</span>
              <el-input-number v-model="manualPoints" :min="0" :max="20" :step="0.1" :precision="1" size="small" style="width:80px" controls-position="right" />
              <span class="commission-hint">%</span>
              <el-button size="small" type="primary" @click="recalcPerformance(manualPoints)">确定</el-button>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="profit-card" style="background:linear-gradient(135deg, #f0fff0 0%, #e6f9e6 100%);border-color:#b3e0b3">
          <div class="commission-section">
            <div class="commission-label">奖金合计 (¥)</div>
            <div class="commission-value" style="color:#2d7d2d">{{ totalBonusDisplay }}</div>
            <div class="commission-desc">{{ filterMonth }} 提成 + 绩效</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- Closed Deals -->
    <div class="card-minimal">
      <div class="flex-between mb-16"><h4>当月成交订单 ({{ monthDeals.length }})</h4></div>
      <el-table :data="monthDeals" size="small" style="width:100%">
        <el-table-column prop="id" label="编号" width="140" />
        <el-table-column label="客户" min-width="160"><template #default="{ row }">{{ row.customer.companyName }}</template></el-table-column>
        <el-table-column label="成交额" width="130" align="right"><template #default="{ row }">${{ fmt(row.totalAmount) }}</template></el-table-column>
        <el-table-column label="利润" width="120" align="right"><template #default="{ row }">${{ fmt(row.totalProfit) }}</template></el-table-column>
        <el-table-column label="利润点" width="90" align="center"><template #default="{ row }">{{ row.avgProfitMargin }}%</template></el-table-column>
        <el-table-column label="成交日期" width="120"><template #default="{ row }">{{ row.closedAt.substring(0,10) }}</template></el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" @click.stop="openDealEdit(row)">编辑详情</el-button>
            <el-popconfirm title="删除？" @confirm="dealStore.deleteDeal(row.id); refreshData()"><template #reference><el-button size="small" type="danger" @click.stop>删除</el-button></template></el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Recent Inquiries -->
    <div class="card-minimal">
      <h4 class="mb-16">最近询价单</h4>
      <el-table :data="recentInquiries" size="small" style="width:100%">
        <el-table-column prop="id" label="编号" width="140" />
        <el-table-column label="客户" min-width="160"><template #default="{ row }">{{ row.customer.companyName }}</template></el-table-column>
        <el-table-column label="芯片数" width="90" align="center"><template #default="{ row }">{{ row.items.length }}</template></el-table-column>
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :class="`status-${row.status}`" size="small">{{ inquiryStore.statusLabels[row.status] }}</el-tag></template></el-table-column>
        <el-table-column label="创建时间" width="120"><template #default="{ row }">{{ row.createdAt.substring(0,10) }}</template></el-table-column>
      </el-table>
    </div>

    <!-- Deal Edit Dialog -->
    <el-dialog v-model="showDealEditor" title="编辑成交信息" width="900px">
      <el-table :data="editingDeal?.items" size="small" v-if="editingDeal">
        <el-table-column label="品牌" width="100"><template #default="{ row }">{{ row.brand }}</template></el-table-column>
        <el-table-column label="型号" min-width="140"><template #default="{ row }">{{ row.mpn }}</template></el-table-column>
        <el-table-column label="实际数量" width="110"><template #default="{ $index }"><el-input-number v-model="editingDeal.items[$index].actualQuantity" size="small" :min="0" controls-position="right" /></template></el-table-column>
        <el-table-column label="实际成本" width="110"><template #default="{ $index }"><el-input-number v-model="editingDeal.items[$index].actualCost" size="small" :min="0" :step="0.01" :precision="2" controls-position="right" /></template></el-table-column>
        <el-table-column label="实际报价" width="110"><template #default="{ $index }"><el-input-number v-model="editingDeal.items[$index].actualPrice" size="small" :min="0" :step="0.01" :precision="2" controls-position="right" /></template></el-table-column>
        <el-table-column label="利润" width="90"><template #default="{ row }">${{ fmt(row.profit) }}</template></el-table-column>
        <el-table-column label="利润点" width="70"><template #default="{ row }">{{ row.profitMargin }}%</template></el-table-column>
      </el-table>
      <template #footer><el-button @click="showDealEditor=false">取消</el-button><el-button type="primary" @click="saveDealEdit">保存并重算</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useInquiryStore } from '../stores/inquiry'
import { useCustomerStore } from '../stores/customer'
import { useClosedDealsStore } from '../stores/closedDeals'
import { calculateCommission } from '../utils/commission'
import { ElMessage } from 'element-plus'

const inquiryStore = useInquiryStore()
const customerStore = useCustomerStore()
const dealStore = useClosedDealsStore()
const showDealEditor = ref(false)
const editingDeal = ref(null)

// Month selector
const filterMonth = ref(new Date().toISOString().substring(0, 7))
const monthOptions = computed(() => {
  const months = new Set(dealStore.deals.map(d => d.month))
  const current = new Date().toISOString().substring(0, 7)
  months.add(current)
  // Add previous 6 months
  const d = new Date()
  for (let i = 1; i <= 6; i++) { d.setMonth(d.getMonth() - 1); months.add(d.toISOString().substring(0, 7)) }
  d.setMonth(d.getMonth() + 6)
  return [...months].sort().reverse()
})

function refreshData() {}

const monthDeals = computed(() => dealStore.getDealsByMonth(filterMonth.value))
const summary = computed(() => dealStore.getMonthlySummary(filterMonth.value))
const recentInquiries = computed(() => inquiryStore.inquiries.slice(0, 5))

const commResult = computed(() => calculateCommission(summary.value.totalProfitRMB))
const manualPoints = ref(commResult.value.points ? commResult.value.points * 100 : 0)
const customPerformance = ref(0)
const commissionDisplay = computed(() => commResult.value.commission > 0 ? '¥' + commResult.value.commission.toLocaleString() : '¥0')
const performanceDisplayOverride = computed(() => {
  if (customPerformance.value === 0 && manualPoints.value === (commResult.value.points * 100)) return '¥' + (commResult.value.performance > 0 ? commResult.value.performance.toLocaleString() : '0')
  return '¥' + customPerformance.value.toLocaleString()
})
const totalBonusDisplay = computed(() => {
  const comm = commResult.value.commission || 0
  const perf = customPerformance.value || commResult.value.performance || 0
  const total = comm + perf
  return total > 0 ? '¥' + total.toLocaleString() : '¥0'
})
function recalcPerformance(val) {
  if (!commResult.value.tier) return
  const rate = val / 100
  const raw = summary.value.totalProfitRMB * rate
  customPerformance.value = Math.round(Math.min(Math.max(raw, commResult.value.tier.performanceMin), commResult.value.tier.performanceMax) * 100) / 100
}
const commissionTierDesc = computed(() => {
  const t = commResult.value.tier
  return t ? `提成${(t.commissionRate*100).toFixed(1)}% (¥${t.commissionMin.toLocaleString()}~${t.commissionMax.toLocaleString()})` : '利润不足¥2万，暂无提成'
})

function fmt(n) { return n ? Number(n).toLocaleString() : '0' }

function openDealEdit(deal) {
  editingDeal.value = JSON.parse(JSON.stringify(deal))
  showDealEditor.value = true
}

function saveDealEdit() {
  if (!editingDeal.value) return
  const d = editingDeal.value
  d.items.forEach((item, i) => {
    dealStore.updateDealItem(d.id, i, { actualQuantity: item.actualQuantity, actualCost: item.actualCost, actualPrice: item.actualPrice })
  })
  ElMessage.success('成交信息已更新')
  showDealEditor.value = false
  refreshData()
}
</script>