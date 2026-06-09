<template>
  <div v-if="!quote" class="text-muted">加载中...</div>
  <div v-else>
    <div class="page-header flex-between">
      <div>
        <h2>{{ quote.id }}</h2>
        <p class="text-muted">{{ quote.customer.companyName }} · {{ quote.customer.email }} · <el-tag size="small">{{ quote.status==='draft'?'草稿':'已发送' }}</el-tag></p>
      </div>
      <div>
        <el-button @click="handleCloseDeal" type="success" :disabled="quote.status!=='draft'">确认成交</el-button>
        <el-button @click="exportPDF">导出 PDF</el-button>
        <el-button @click="copyEmailTemplate" type="primary">复制邮件模板</el-button>
        <el-button @click="$router.push('/quote')">返回列表</el-button>
      </div>
    </div>

    <!-- Profit Summary Cards (no commission - that's on Dashboard from monthly closed deals) -->
    <el-row :gutter="16" style="margin-bottom:20px">
      <el-col :span="5"><div class="profit-card"><div class="label">总报价</div><div class="value">${{ quote.totalAmount?.toLocaleString() }}</div></div></el-col>
      <el-col :span="5"><div class="profit-card"><div class="label">总成本</div><div class="value">${{ quote.totalCost?.toLocaleString() }}</div></div></el-col>
      <el-col :span="5"><div class="profit-card"><div class="label">总利润</div><div class="value" style="color:#2d7d2d">${{ quote.totalProfit?.toLocaleString() }}</div></div></el-col>
      <el-col :span="5"><div class="profit-card"><div class="label">利润点</div><div class="value">{{ quote.avgProfitMargin }}%</div></div></el-col>
      <el-col :span="4"><div class="profit-card" :style="quote.status==='won'?'background:#ebf8eb;border-color:#b3e0b3':''"><div class="label">状态</div><div class="value">{{ quote.status==='draft'?'草稿':quote.status==='won'?'已成交':'已发送' }}</div></div></el-col>
    </el-row>

    <!-- Quote Items Table -->
    <div class="card-minimal">
      <div class="flex-between mb-16"><h4>报价明细</h4></div>
      <el-table :data="quote.items" size="small" style="width:100%">
        <el-table-column label="品牌" width="100"><template #default="{ row }">{{ row.brand }}</template></el-table-column>
        <el-table-column label="型号" min-width="150"><template #default="{ row }"><strong>{{ row.mpn }}</strong></template></el-table-column>
        <el-table-column label="数量" width="80" align="right"><template #default="{ row }">{{ Number(row.quantity).toLocaleString() }}</template></el-table-column>
        <el-table-column label="批次" width="100"><template #default="{ row }">{{ row.batch || '-' }}</template></el-table-column>
        <el-table-column label="成本" width="90"><template #default="{ row }">${{ row.costPrice }}</template></el-table-column>
        <el-table-column label="建议价" width="90"><template #default="{ row }">${{ row.suggestedPrice }}</template></el-table-column>
        <el-table-column label="最终报价" width="120">
          <template #default="{ row, $index }">
            <el-input v-model="quote.items[$index].quotedPrice" size="small" type="number" step="0.01" @change="handlePriceChange($index)" />
          </template>
        </el-table-column>
        <el-table-column label="利润" width="90" align="right"><template #default="{ row }">${{ row.profit?.toLocaleString() }}</template></el-table-column>
        <el-table-column label="利润点" width="80" align="center"><template #default="{ row }">{{ row.profitMargin }}%</template></el-table-column>
        <el-table-column label="交期" width="110"><template #default="{ row, $index }"><el-input v-model="quote.items[$index].leadTime" size="small" placeholder="如 7days" /></template></el-table-column>
        <el-table-column label="备注" width="120"><template #default="{ row, $index }"><el-input v-model="quote.items[$index].remark" size="small" /></template></el-table-column>
      </el-table>
    </div>

    <!-- Email Template Preview -->
    <div class="card-minimal">
      <div class="flex-between mb-16"><h4>邮件模板</h4><div><el-button size="small" type="primary" @click="copyEmailTemplate" style="margin-right:6px">复制到剪贴板</el-button><el-button size="small" @click="refreshEmailPreview" style="margin-right:6px">刷新预览</el-button><el-button size="small" @click="saveEmailTemplate">保存模板</el-button></div></div>
      <el-input v-model="editSubject" size="small" placeholder="邮件主题" class="mb-8" />
      <el-input v-model="editBody" type="textarea" :rows="8" placeholder="邮件正文（HTML格式）" class="mb-8" />
      <div class="email-preview" v-html="editBody" style="border:1px solid var(--color-border);border-radius:4px;padding:16px;background:#fff;font-size:13px;line-height:1.8;max-height:400px;overflow-y:auto"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuoteStore } from '../stores/quote'
import { useClosedDealsStore } from '../stores/closedDeals'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const quoteStore = useQuoteStore()
const dealStore = useClosedDealsStore()

const quote = computed(() => quoteStore.getQuote(route.params.id))
const emailSubject = ref('')
const editSubject = ref('')
const editBody = ref('')


function handlePriceChange(itemIndex) {
  if (!quote.value) return
  const oldValue = quote.value.items[itemIndex].suggestedPrice
  const newValue = quote.value.items[itemIndex].quotedPrice
  quoteStore.updateQuoteItem(quote.value.id, itemIndex,
    { quotedPrice: newValue },
    { field: 'quotedPrice', oldValue, newValue, timestamp: new Date().toISOString() }
  )
}

const emailHtml = computed(() => {
  if (!quote.value) return ''
  const items = quote.value.items

  const tableRows = items.map(item => {
    const remarks = item.remark ? ` (${item.remark})` : ''
    return `<tr>
      <td style="border:1px solid #ddd;padding:4px 6px">${item.brand || ''}</td>
      <td style="border:1px solid #ddd;padding:4px 6px">${item.mpn || ''}</td>
      <td style="border:1px solid #ddd;padding:4px 6px">${Number(item.quantity).toLocaleString()}</td>
      <td style="border:1px solid #ddd;padding:4px 6px">${item.batch || '-'}</td>
      <td style="border:1px solid #ddd;padding:4px 6px">$${item.quotedPrice}</td>
      <td style="border:1px solid #ddd;padding:4px 6px">${item.leadTime || 'TBD'}</td>
      <td style="border:1px solid #ddd;padding:4px 6px">${item.remark || ''}</td>
    </tr>`
  }).join('')

  return `
    <p>Hi ${getLastName(quote.value.customer.contactName) || 'there'},</p>
    <p>Good day. Please find our quotation below:</p>
    <table style="border-collapse:collapse;table-layout:fixed;width:680px;margin:12px 0;font-size:12px">
      <colgroup>
        <col style="width:80px">
        <col style="width:140px">
        <col style="width:60px">
        <col style="width:60px">
        <col style="width:80px">
        <col style="width:80px">
        <col style="width:100px">
      </colgroup>
      <tr style="background:#f5f5f5">
        <th style="border:1px solid #ddd;padding:6px;text-align:left">MFG/Brand</th>
        <th style="border:1px solid #ddd;padding:6px;text-align:left">P/N</th>
        <th style="border:1px solid #ddd;padding:6px;text-align:left">QTY</th>
        <th style="border:1px solid #ddd;padding:6px;text-align:left">D/C</th>
        <th style="border:1px solid #ddd;padding:6px;text-align:left">PRICE/USD</th>
        <th style="border:1px solid #ddd;padding:6px;text-align:left">L/T</th>
        <th style="border:1px solid #ddd;padding:6px;text-align:left">Remark</th>
      </tr>
      ${tableRows}
    </table>
    <p>For suppliers' stock, need to double confirm before placing an order.</p>
    <p>Any further questions, please feel free to contact us.</p>
    <p>Best regards,</p>
  `
})

function getLastName(name) {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1] || name
}

watch(quote, (q) => {
  if (q) {
    // 优先读取全局模板，其次用该报价单的模板，最后用自动生成的
    const GLOBAL_EMAIL_KEY = 'chip_sales_global_email_template'
    const global = JSON.parse(localStorage.getItem(GLOBAL_EMAIL_KEY) || '{}')

    const subj = q.emailSubject || global.subject || `Quotation - ${q.customer.companyName}`
    emailSubject.value = subj; editSubject.value = subj
    editBody.value = q.emailBody || global.body || emailHtml.value
  }
}, { immediate: true })

function refreshEmailPreview() {
  if (!quote.value) return
  editBody.value = emailHtml.value
  ElMessage.success('已刷新为当前报价数据')
}

function saveEmailTemplate() {
  if (!quote.value) return
  // 保存模板到全局，后续所有报价单开箱即用
  const GLOBAL_EMAIL_KEY = 'chip_sales_global_email_template'
  const existing = JSON.parse(localStorage.getItem(GLOBAL_EMAIL_KEY) || '{}')
  existing.subject = editSubject.value
  existing.body = editBody.value
  localStorage.setItem(GLOBAL_EMAIL_KEY, JSON.stringify(existing))

  quoteStore.updateQuote(quote.value.id, { emailSubject: editSubject.value, emailBody: editBody.value })
  ElMessage.success('模板已保存（应用于所有报价单）')
}

function copyEmailTemplate() {
  const html = editBody.value || emailHtml.value
  const plainText = html.replace(/<[^>]+>/g, '').replace(/\s{2,}/g, '\n').trim()
  try {
    if (navigator.clipboard && typeof navigator.clipboard.write === 'function') {
      navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' })
        })
      ]).then(() => ElMessage.success('邮件模板已复制（HTML格式，可直接粘贴到Outlook）'))
        .catch(() => ElMessage.error('复制失败，请手动复制'))
    } else {
      // Fallback for non-secure contexts
      const textarea = document.createElement('textarea')
      textarea.value = plainText
      textarea.style.position = 'fixed'; textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      ElMessage.success('已复制纯文本模板')
    }
  } catch {
    ElMessage.error('复制失败，请手动复制下方内容')
  }
}

async function handleCloseDeal() {
  if (!quote.value) return
  try {
    await ElMessageBox.confirm('确认此报价单已成交？成交后将在仪表盘中作为本月订单统计提成。', '确认成交', { confirmButtonText: '确认成交', type: 'success' })
    quoteStore.updateQuote(quote.value.id, { status: 'won' })
    dealStore.closeQuote(quote.value)
    ElMessage.success('已确认成交，可在仪表盘查看和编辑最终成交信息')
  } catch {}
}

function exportPDF() {
  ElMessage.info('PDF导出功能将在后续实现（使用jsPDF）')
  // TODO: jsPDF implementation
}
</script>