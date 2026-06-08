<template>
  <div>
    <div class="page-header"><h2>报价参数配置</h2><p class="text-muted">配置报价公式的五维系数及品牌档位</p></div>

    <!-- Base Margin -->
    <div class="card-minimal">
      <h4 class="mb-8">基础利润率</h4>
      <el-form label-width="120px" size="small">
        <el-form-item label="基础利润率"><el-input-number v-model="pricing.baseMargin" :min="0" :max="1" :step="0.01" :precision="2" /><span class="text-sm text-muted" style="margin-left:8px">如 0.15 = 15%</span></el-form-item>
      </el-form>
    </div>

    <!-- Customer Rating Coefficients -->
    <div class="card-minimal">
      <h4 class="mb-8">客户评级系数（按联系人邮箱）</h4>
      <el-table :data="ratingRows" size="small" style="width:100%">
        <el-table-column label="评级" width="80"><template #default="{ row }"><strong>{{ row.rating }}</strong></template></el-table-column>
        <el-table-column label="系数"><template #default="{ row, $index }"><el-input-number v-model="pricing.ratingCoefficient[ratingRows[$index].rating]" :min="0.8" :max="2.0" :step="0.01" :precision="2" size="small" /></template></el-table-column>
        <el-table-column label="说明" min-width="140"><template #default="{ row }">{{ ratingDesc[row.rating] }}</template></el-table-column>
      </el-table>
    </div>

    <!-- Quantity Tiers -->
    <div class="card-minimal">
      <h4 class="mb-8">数量折扣系数</h4>
      <el-table :data="pricing.quantityTiers" size="small" style="width:100%">
        <el-table-column label="最小数量" min-width="140"><template #default="{ row, $index }"><el-input-number v-model="pricing.quantityTiers[$index].min" :min="0" size="small" /></template></el-table-column>
        <el-table-column label="最大数量" min-width="140"><template #default="{ row, $index }"><el-input-number v-model="pricing.quantityTiers[$index].max" :min="0" size="small" /></template></el-table-column>
        <el-table-column label="系数" min-width="160"><template #default="{ row, $index }"><el-input-number v-model="pricing.quantityTiers[$index].coeff" :min="0.5" :max="2.0" :step="0.01" :precision="2" size="small" /></template></el-table-column>
        <el-table-column label="操作" width="80"><template #default="{ $index }"><el-button size="small" type="danger" @click="pricing.quantityTiers.splice($index,1)"><el-icon><Delete /></el-icon></el-button></template></el-table-column>
      </el-table>
    </div>

    <!-- Batch Premiums -->
    <div class="card-minimal">
      <h4 class="mb-8">批次溢价系数</h4>
      <el-row :gutter="12">
        <el-col :span="8" v-for="(coeff, key) in pricing.batchPremiums" :key="key">
          <div class="profit-card">
            <div class="label">{{ batchLabels[key] }}</div>
            <el-input-number v-model="pricing.batchPremiums[key]" :min="0.8" :max="2.0" :step="0.01" :precision="2" size="small" style="margin-top:8px;width:100%" />
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- Brand Tiers -->
    <div class="card-minimal">
      <h4 class="mb-8">品牌档位系数</h4>
      <el-table :data="pricing.brandTiers" size="small" style="width:100%">
        <el-table-column prop="name" label="档位" width="120" />
        <el-table-column prop="tier" label="标识" width="100" />
        <el-table-column label="系数" width="150"><template #default="{ row, $index }"><el-input-number v-model="pricing.brandTiers[$index].coeff" :min="0.8" :max="2.0" :step="0.01" :precision="2" size="small" /></template></el-table-column>
      </el-table>

      <el-divider>品牌 → 档位映射</el-divider>
      <el-table :data="brandTierTable" size="small" style="width:100%">
        <el-table-column label="品牌" width="150"><template #default="{ row, $index }"><el-input v-model="brandTierTable[$index].brand" size="small" /></template></el-table-column>
        <el-table-column label="档位" width="140"><template #default="{ row, $index }"><el-select v-model="brandTierTable[$index].tier" size="small"><el-option v-for="t in tierList" :key="t.tier" :label="`${t.name} (${t.coeff})`" :value="t.tier" /></el-select></template></el-table-column>
        <el-table-column label="操作" width="60"><template #default="{ $index }"><el-button size="small" type="danger" @click="brandTierTable.splice($index,1); saveAll()"><el-icon><Delete /></el-icon></el-button></template></el-table-column>
      </el-table>
      <el-button size="small" class="mt-8" @click="brandTierTable.push({ brand:'', tier:'general' })">+ 添加品牌映射</el-button>
    </div>

    <div style="margin-top:16px;text-align:right">
      <el-button type="primary" @click="saveAll" size="large">保存所有配置</el-button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { getPricingConfig } from '../utils/pricingEngine'
import { ElMessage } from 'element-plus'

const ratingDesc = { A: '优质客户', B: '普通客户（默认）', C: '风险客户', D: '高风险客户' }
const batchLabels = { newBatch: '新批次', oldBatch: '旧批次 (>2年)', usedNew: '散新/翻新' }
const tierList = [{ tier: 'tier1', name: '一线', coeff: 1.00 },{ tier: 'tier2', name: '二线', coeff: 1.03 },{ tier: 'general', name: '通用', coeff: 1.05 },{ tier: 'scarce', name: '稀缺', coeff: 1.08 },{ tier: 'custom', name: '定制', coeff: 1.12 }]

const pricing = reactive(getPricingConfig())
const ratingRows = computed(() => pricing.ratingCoefficient ? Object.entries(pricing.ratingCoefficient).map(([k]) => ({ rating: k })) : [])
const brandTierTable = ref(Object.entries(pricing.brandTierMap || {}).map(([brand, tier]) => ({ brand, tier })))

watch(pricing, () => { localStorage.setItem('chip_sales_pricing', JSON.stringify(pricing)) }, { deep: true })

function saveAll() {
  const map = {}
  brandTierTable.value.forEach(({ brand, tier }) => { if (brand) map[brand.toUpperCase()] = tier })
  pricing.brandTierMap = map
  localStorage.setItem('chip_sales_pricing', JSON.stringify(pricing))
  ElMessage.success('所有配置已保存')
}
</script>