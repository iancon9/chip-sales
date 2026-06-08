<template>
  <div>
    <div class="page-header"><h2>设置</h2><p class="text-muted">LLM配置、汇率、提成规则及数据管理</p></div>

    <div class="card-minimal">
      <h4 class="mb-8">LLM 配置</h4>
      <el-form label-width="120px" size="small">
        <el-form-item label="API Key"><el-input v-model="llmConfig.apiKey" type="password" show-password placeholder="sk-..." /></el-form-item>
        <el-form-item label="Endpoint"><el-input v-model="llmConfig.endpoint" placeholder="https://api.openai.com/v1/chat/completions" /></el-form-item>
        <el-form-item label="模型"><el-input v-model="llmConfig.model" placeholder="gpt-3.5-turbo" /></el-form-item>
        <el-form-item><el-button type="primary" @click="saveLLM">保存 LLM 配置</el-button></el-form-item>
      </el-form>
    </div>

    <div class="card-minimal">
      <h4 class="mb-8">汇率配置</h4>
      <el-form label-width="100px" size="small">
        <el-form-item label="USD → RMB">
          <el-input-number v-model="localRate" :min="1" :max="100" :step="0.0001" :precision="4" style="width:200px" />
          <el-button type="primary" @click="saveRate" style="margin-left:12px">保存汇率</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="card-minimal">
      <h4 class="mb-8">MPN 后缀忽略</h4>
      <p class="text-sm text-muted mb-8">导入采购报价时，将忽略 MPN 末尾的这些固定后缀（逗号分隔，如 TR、T/R、PBF、T&R）</p>
      <el-form label-width="100px" size="small">
        <el-form-item label="忽略后缀">
          <el-input v-model="mpnSuffixInput" placeholder="TR, T/R, PBF, T&R" style="width:400px" @blur="saveMpnSuffix" />
          <el-button type="primary" size="small" style="margin-left:8px" @click="saveMpnSuffix">保存</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="card-minimal">
      <h4 class="mb-8">提成规则配置</h4>
      <p class="text-sm text-muted mb-8">根据利润所在区间确定提成比例和绩点。提成金额 = 利润 × 提成比例，绩效金额 = 利润 × 绩点（不含封顶）。</p>
      <el-table :data="commission.tiers" size="small" style="width:100%">
        <el-table-column label="利润从(¥)" min-width="150"><template #default="{ row, $index }"><el-input-number v-model="commission.tiers[$index].minProfit" :min="0" size="small" /></template></el-table-column>
        <el-table-column label="利润至(¥)" min-width="150"><template #default="{ row, $index }"><el-input-number v-model="commission.tiers[$index].maxProfit" :min="0" size="small" /></template></el-table-column>
        <el-table-column label="提成比例" min-width="150"><template #default="{ row, $index }"><el-input-number v-model="commission.tiers[$index].commissionRate" :min="0" :max="1" :step="0.001" :precision="3" size="small" /></template></el-table-column>
        <el-table-column label="绩点" min-width="150"><template #default="{ row, $index }"><el-input-number v-model="commission.tiers[$index].performanceRate" :min="0" :max="1" :step="0.001" :precision="3" size="small" /></template></el-table-column>
        <el-table-column label="操作" width="80"><template #default="{ $index }"><el-button size="small" type="danger" @click="commission.tiers.splice($index,1)"><el-icon><Delete /></el-icon></el-button></template></el-table-column>
      </el-table>
      <el-button size="small" class="mt-8" @click="commission.tiers.push({ minProfit:0, maxProfit:0, commissionRate:0.05, performanceRate:0.02, commissionMin:0, commissionMax:0, performanceMin:0, performanceMax:0 })">+ 添加等级</el-button>
    </div>


    <div class="card-minimal">
      <h4 class="mb-8">数据管理</h4>
      <el-row :gutter="16" class="data-mgmt-row">
        <el-col :span="8"><el-button @click="exportData" class="data-mgmt-btn"><el-icon><Download /></el-icon>导出全部数据 (JSON)</el-button></el-col>
        <el-col :span="8"><el-upload :auto-upload="false" :on-change="handleImport" accept=".json" :show-file-list="false" class="data-mgmt-upload"><el-button class="data-mgmt-btn"><el-icon><Upload /></el-icon>导入数据恢复</el-button></el-upload></el-col>
        <el-col :span="8"><el-button type="danger" @click="handleClearAll" class="data-mgmt-btn data-mgmt-btn--danger"><el-icon><Delete /></el-icon>清除全部数据</el-button></el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, inject, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCommissionConfig, saveCommissionConfig } from '../utils/commission'
import { getLLMConfig, saveLLMConfig as saveLLMToStorage } from '../utils/llm'

const darkMode = inject('darkMode')
const isDark = ref(false)
const currentLang = ref('zh-CN')

onMounted(() => {
  isDark.value = darkMode?.isDark?.() || false
  currentLang.value = localStorage.getItem('chip_sales_language') || 'zh-CN'
})

const SETTINGS_KEY = 'chip_sales_settings'
const defaultSettings = { exchangeRate: 7.25, emailSignature: { zh: '此致\nBest regards,\n{公司名} {姓名}', en: 'Best regards,\n{Name}\n{Company}', ko: '감사합니다.\n{Name} 드림' } }

const settings = reactive(JSON.parse(localStorage.getItem(SETTINGS_KEY) || JSON.stringify(defaultSettings)))
const commission = reactive(getCommissionConfig())
const llmConfig = reactive(getLLMConfig())
const localRate = ref(settings.exchangeRate || 7.25)

// MPN suffix ignore config
const MPN_SUFFIX_KEY = 'chip_sales_mpn_suffixes'
const defaultMpnSuffixes = 'TR, T/R, PBF, T&R'
const mpnSuffixInput = ref(localStorage.getItem(MPN_SUFFIX_KEY) || defaultMpnSuffixes)
function saveMpnSuffix() {
  localStorage.setItem(MPN_SUFFIX_KEY, mpnSuffixInput.value)
  ElMessage.success('MPN 后缀已保存')
}

function saveRate() { settings.exchangeRate = localRate.value; ElMessage.success('汇率已保存') }

watch(settings, () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)), { deep: true })
watch(commission, () => saveCommissionConfig(commission), { deep: true })

function saveLLM() { saveLLMToStorage({ ...llmConfig }); ElMessage.success('LLM 配置已保存') }
function toggleDark() { if (darkMode) darkMode.toggle() }
function changeLang(lang) { localStorage.setItem('chip_sales_language', lang); location.reload() }

function exportData() {
  const data = {}
  for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key.startsWith('chip_sales_')) { try { data[key] = JSON.parse(localStorage.getItem(key)) } catch { data[key] = localStorage.getItem(key) } } }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `chip_sales_backup_${new Date().toISOString().substring(0,10)}.json`; a.click(); URL.revokeObjectURL(url)
  ElMessage.success('数据导出成功')
}

async function handleImport(file) {
  try { const text = await file.raw.text(); const data = JSON.parse(text); let count = 0; for (const [key, value] of Object.entries(data)) { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); count++ }; ElMessage.success(`已导入 ${count} 个数据表，请刷新页面`); setTimeout(() => location.reload(), 1500) } catch (e) { ElMessage.error('导入失败: ' + e.message) }
}

async function handleClearAll() {
  try { await ElMessageBox.confirm('这将清除所有本地数据。确定继续？', '危险操作', { type: 'warning', confirmButtonText: '确认清除' }); const keys = []; for (let i=0; i<localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('chip_sales_')) keys.push(k) }; keys.forEach(k => localStorage.removeItem(k)); ElMessage.success(`已清除 ${keys.length} 个数据表，即将刷新`); setTimeout(() => location.reload(), 1000) } catch {}
}
</script>