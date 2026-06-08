<template>
  <div>
    <div class="page-header flex-between">
      <div><h2>新建询价单</h2><p class="text-muted">上传 .eml 邮件自动解析，支持规则解析/AI 解析</p></div>
      <el-button @click="$router.push('/inquiry')">返回列表</el-button>
    </div>

    <el-tabs v-model="inputMethod" class="mb-16">
      <el-tab-pane label="上传 EML 文件" name="eml" />
      <el-tab-pane label="粘贴邮件原文" name="paste" />
      <el-tab-pane label="手动录入" name="manual" />
    </el-tabs>

    <!-- EML Upload -->
    <div v-if="inputMethod === 'eml'" class="card-minimal">
      <el-upload drag :auto-upload="false" :on-change="handleEmlFile" accept=".eml" :show-file-list="false">
        <div class="eml-upload">
          <el-icon :size="36" color="#888"><Upload /></el-icon>
          <p style="margin-top:12px;color:#888">点击或拖拽 .eml 邮件文件到此区域</p>
          <p class="text-sm text-muted">支持网易企业邮箱 / 标准 SMTP 邮件格式</p>
        </div>
      </el-upload>
      <div v-if="emlFileName" class="mt-16">
        <div class="text-sm text-muted mb-8">已选择: {{ emlFileName }}</div>
        <el-row :gutter="8">
          <el-col :span="12"><el-button type="primary" @click="parseFile('rule')" :loading="parsing && parseMode==='rule'" style="width:100%">规则解析（秒级）</el-button></el-col>
          <el-col :span="12"><el-button type="success" @click="parseFile('ai')" :loading="parsing && parseMode==='ai'" style="width:100%">AI 解析（需配置 LLM）</el-button></el-col>
        </el-row>
      </div>
    </div>

    <!-- Paste text -->
    <div v-if="inputMethod === 'paste'" class="card-minimal">
      <el-input v-model="pasteText" type="textarea" :rows="10" placeholder="粘贴客户邮件原文（HTML/纯文本均可）..." />
      <el-row :gutter="8" class="mt-16">
        <el-col :span="12"><el-button type="primary" @click="parsePasted('rule')" :loading="parsing && parseMode==='rule'" style="width:100%">规则解析</el-button></el-col>
        <el-col :span="12"><el-button type="success" @click="parsePasted('ai')" :loading="parsing && parseMode==='ai'" style="width:100%">AI 解析</el-button></el-col>
      </el-row>
    </div>

    <!-- Status -->
    <div v-if="parsingStatus" class="card-minimal" style="background:#f0f7ff;text-align:center;padding:16px">
      <el-icon class="is-loading" :size="20" style="margin-right:8px"><Loading /></el-icon>
      <span style="font-size:14px;color:#3d8fd9">{{ parsingStatus }}</span>
    </div>

    <!-- Parsed Result Table -->
    <div v-if="parsedItems.length > 0" class="card-minimal">
      <h4 class="mb-8">解析结果（请确认并编辑）</h4>
      <el-form :model="form.customer" label-width="70px" size="small" class="mb-16">
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="公司"><el-input v-model="form.customer.companyName" placeholder="客户公司名" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="邮箱"><el-input v-model="form.customer.email" placeholder="发件人邮箱" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="联系人"><el-input v-model="form.customer.contactName" placeholder="联系人姓名" /></el-form-item></el-col>
        </el-row>
      </el-form>

      <el-table :data="parsedItems" size="small" style="width:100%">
        <el-table-column label="品牌" width="110"><template #default="{ $index }"><el-input v-model="parsedItems[$index].brand" size="small" /></template></el-table-column>
        <el-table-column label="型号 MPN" min-width="150"><template #default="{ $index }"><el-input v-model="parsedItems[$index].mpn" size="small" /></template></el-table-column>
        <el-table-column label="数量" width="100"><template #default="{ $index }"><el-input v-model="parsedItems[$index].quantity" size="small" /></template></el-table-column>
        <el-table-column label="目标价" width="100"><template #default="{ $index }"><el-input v-model="parsedItems[$index].targetPrice" size="small" /></template></el-table-column>
        <el-table-column label="批次" width="100"><template #default="{ $index }"><el-input v-model="parsedItems[$index].batch" size="small" /></template></el-table-column>
        <el-table-column label="封装" width="80"><template #default="{ $index }"><el-input v-model="parsedItems[$index].package" size="small" /></template></el-table-column>
        <el-table-column label="SPQ" width="70"><template #default="{ $index }"><el-input v-model="parsedItems[$index].spq" size="small" /></template></el-table-column>
        <el-table-column label="操作" width="60"><template #default="{ $index }"><el-button size="small" type="danger" @click="parsedItems.splice($index,1)"><el-icon><Delete /></el-icon></el-button></template></el-table-column>
      </el-table>

      <div class="flex-between mt-16">
        <el-button @click="parsedItems.push({ ...defaultItem })">+ 添加行</el-button>
        <el-button type="primary" @click="submitInquiry">提交询价单</el-button>
      </div>
    </div>

    <!-- Manual -->
    <div v-if="inputMethod === 'manual'" class="card-minimal">
      <el-form label-width="80px" size="small" class="mb-16">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="选择客户">
              <el-select v-model="selectedCustomerId" filterable clearable placeholder="搜索/选择客户" style="width:100%" @change="onCustomerSelect">
                <el-option v-for="c in customerOptions" :key="c.id" :label="c.label" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6"><el-form-item label="公司">{{ form.customer.companyName }}</el-form-item></el-col>
          <el-col :span="6"><el-form-item label="联系人">{{ form.customer.contactName }} · {{ form.customer.email }}</el-form-item></el-col>
        </el-row>
      </el-form>
      <el-table :data="form.items" size="small" style="width:100%">
        <el-table-column label="品牌" width="110"><template #default="{ $index }"><el-input v-model="form.items[$index].brand" size="small" /></template></el-table-column>
        <el-table-column label="型号" min-width="150"><template #default="{ $index }"><el-input v-model="form.items[$index].mpn" size="small" /></template></el-table-column>
        <el-table-column label="数量" width="100"><template #default="{ $index }"><el-input v-model="form.items[$index].quantity" size="small" /></template></el-table-column>
        <el-table-column label="目标价" width="100"><template #default="{ $index }"><el-input v-model="form.items[$index].targetPrice" size="small" /></template></el-table-column>
        <el-table-column label="批次" width="100"><template #default="{ $index }"><el-input v-model="form.items[$index].batch" size="small" /></template></el-table-column>
        <el-table-column label="封装" width="80"><template #default="{ $index }"><el-input v-model="form.items[$index].package" size="small" /></template></el-table-column>
        <el-table-column label="操作" width="60"><template #default="{ $index }"><el-button size="small" type="danger" @click="form.items.splice($index,1)"><el-icon><Delete /></el-icon></el-button></template></el-table-column>
      </el-table>
      <div class="flex-between mt-16">
        <el-button @click="form.items.push({ ...defaultItem })">+ 添加行</el-button>
        <el-button type="primary" @click="submitInquiry">提交询价单</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useInquiryStore } from '../stores/inquiry'
import { useCustomerStore } from '../stores/customer'
import { parseEml, parseEmlWithAI } from '../utils/emlParser'
import { ElMessage } from 'element-plus'

const router = useRouter()
const inquiryStore = useInquiryStore()
const customerStore = useCustomerStore()

const inputMethod = ref('eml')
const pasteText = ref('')
const emlFileName = ref('')
const emlContent = ref('')
const parsing = ref(false)
const parseMode = ref('')
const parsingStatus = ref('')
const parsedItems = ref([])
const selectedCustomerId = ref('')
const defaultItem = { brand: '', mpn: '', quantity: '', targetPrice: '', batch: '', package: '', spq: '' }

const form = reactive({ customer: { companyName: '', email: '', contactName: '' }, items: [{ ...defaultItem }], notes: '', rawEmail: '', sourceEmlFile: '' })

const customerOptions = computed(() => {
  const flat = []
  customerStore.customers.forEach(c => {
    c.contacts.forEach(ct => {
      flat.push({ id: c.id + '|' + ct.email, label: `${c.companyName || '?'} · ${ct.name || '?'} (${ct.email})`, companyName: c.companyName, contactName: ct.name, email: ct.email })
    })
  })
  return flat
})

function onCustomerSelect(val) {
  if (!val) {
    form.customer = { companyName: '', email: '', contactName: '' }
    return
  }
  const opt = customerOptions.value.find(o => o.id === val)
  if (opt) {
    form.customer = { companyName: opt.companyName, email: opt.email, contactName: opt.contactName }
  }
}

function setProgress(msg) { parsingStatus.value = msg }

async function handleEmlFile(file) {
  emlFileName.value = file.name
  try { emlContent.value = await file.raw.text() } catch { ElMessage.error('读取文件失败') }
}

async function parseFile(mode) {
  if (!emlContent.value) { ElMessage.warning('请先选择文件'); return }
  parsing.value = true; parseMode.value = mode; setProgress(mode === 'rule' ? '正在解析邮件格式…' : '正在读取邮件内容…')
  try {
    const result = mode === 'rule' ? parseEml(emlContent.value, setProgress) : await parseEmlWithAI(emlContent.value, setProgress)
    form.customer = { ...result.customer }; form.rawEmail = result.rawEmail || ''; form.sourceEmlFile = emlFileName.value
    form.items = []; parsedItems.value = result.items.map(item => ({ ...defaultItem, ...item }))
    setProgress('')
    ElMessage.success(`解析完成，找到 ${parsedItems.value.length} 行（${mode === 'rule' ? '规则解析' : 'AI 解析'}）`)
  } catch (e) { setProgress(''); ElMessage.error((mode === 'rule' ? '规则' : 'AI') + '解析失败: ' + e.message) }
  parsing.value = false
}

async function parsePasted(mode) {
  if (!pasteText.value) { ElMessage.warning('请粘贴邮件原文'); return }
  parsing.value = true; parseMode.value = mode; setProgress(mode === 'rule' ? '正在解析…' : '正在读取内容…')
  try {
    const result = mode === 'rule' ? parseEml(pasteText.value, setProgress) : await parseEmlWithAI(pasteText.value, setProgress)
    form.customer = result.customer; form.rawEmail = pasteText.value
    form.items = []; parsedItems.value = result.items.length > 0 ? result.items.map(item => ({ ...defaultItem, ...item })) : []
    setProgress('')
    if (parsedItems.value.length === 0) ElMessage.warning('未能解析到芯片数据，请尝试手动录入')
    else ElMessage.success(`解析完成，找到 ${parsedItems.value.length} 行（${mode === 'rule' ? '规则解析' : 'AI 解析'}）`)
  } catch (e) { setProgress(''); ElMessage.error('解析失败: ' + e.message) }
  parsing.value = false
}

function submitInquiry() {
  let items = inputMethod.value === 'manual' ? form.items : parsedItems.value
  items = items.filter(item => item.brand || item.mpn)
  if (!form.customer.companyName && !form.customer.email) { ElMessage.warning('请填写客户公司名称或邮箱'); return }
  if (items.length === 0) { ElMessage.warning('请至少添加一行芯片数据'); return }
  const customer = customerStore.findOrCreate(form.customer.email, form.customer.companyName, form.customer.contactName)
  const inquiry = inquiryStore.createInquiry({ customer: { companyName: customer.companyName || form.customer.companyName, email: form.customer.email || customer.contacts[0]?.email, contactName: form.customer.contactName || customer.contacts[0]?.name }, items, notes: '', rawEmail: form.rawEmail, sourceEmlFile: form.sourceEmlFile })
  ElMessage.success('询价单创建成功')
  router.push(`/inquiry/${inquiry.id}`)
}
</script>