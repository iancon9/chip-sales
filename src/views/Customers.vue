<template>
  <div>
    <div class="page-header flex-between">
      <div><h2>客户管理</h2><p class="text-muted">按联系人管理客户</p></div>
      <el-button type="primary" @click="openAdd"><el-icon><Plus /></el-icon> 新增联系人</el-button>
    </div>

    <div class="card-minimal mb-16"><el-input v-model="filterKw" placeholder="搜索姓名、邮箱或公司" size="small" style="width:300px" clearable /></div>

    <el-table :data="flatContacts" size="small" style="width:100%">
      <el-table-column label="姓名" width="120"><template #default="{ row }"><strong>{{ row.name || '-' }}</strong></template></el-table-column>
      <el-table-column label="邮箱" min-width="200"><template #default="{ row }">{{ row.email }}</template></el-table-column>
      <el-table-column label="公司" width="150"><template #default="{ row }">{{ row.companyName }}</template></el-table-column>
      <el-table-column label="评级" width="80"><template #default="{ row }"><el-tag size="small" :type="row.rating==='A'?'success':row.rating==='D'?'danger':''">{{ row.rating }}</el-tag></template></el-table-column>
      <el-table-column label="电话" width="130"><template #default="{ row }">{{ row.phone || '-' }}</template></el-table-column>
      <el-table-column label="操作" width="160"><template #default="{ row }"><el-button size="small" @click="editContact(row)">编辑</el-button><el-popconfirm title="确定删除？" @confirm="handleDelete(row)"><template #reference><el-button size="small" type="danger">删除</el-button></template></el-popconfirm></template></el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="编辑联系人" width="500px">
      <el-form :model="editForm" label-width="80px" size="small" v-if="editForm">
        <el-form-item label="姓名"><el-input v-model="editForm.name" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="editForm.email" /></el-form-item>
        <el-form-item label="公司"><el-input v-model="editForm.companyName" /></el-form-item>
        <el-form-item label="评级"><el-select v-model="editForm.rating"><el-option v-for="r in ['A','B','C','D']" :key="r" :label="r" :value="r" /></el-select></el-form-item>
        <el-form-item label="电话"><el-input v-model="editForm.phone" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="saveContact">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useCustomerStore } from '../stores/customer'
import { ElMessage } from 'element-plus'

const store = useCustomerStore(); const filterKw = ref(''); const dialogVisible = ref(false); const editForm = ref(null); const isNew = ref(false); const editingCompanyId = ref(''); const editingContactIdx = ref(-1)

const flatContacts = computed(() => {
  const all = []
  store.customers.forEach(c => { c.contacts.forEach((ct, idx) => { all.push({ companyId: c.id, companyName: c.companyName, contactIdx: idx, name: ct.name, email: ct.email, phone: ct.phone, rating: ct.rating || 'B', originalEmail: ct.email }) }) })
  if (!filterKw.value) return all
  const kw = filterKw.value.toLowerCase()
  return all.filter(x => (x.name||'').toLowerCase().includes(kw) || (x.email||'').toLowerCase().includes(kw) || (x.companyName||'').toLowerCase().includes(kw))
})

function openAdd() { isNew.value = true; editingCompanyId.value = ''; editForm.value = { name:'', email:'', companyName:'', rating:'B', phone:'' }; dialogVisible.value = true }

function editContact(row) { isNew.value = false; editingCompanyId.value = row.companyId; editingContactIdx.value = row.contactIdx; editForm.value = { name:row.name, email:row.email, companyName:row.companyName, rating:row.rating, phone:row.phone, originalEmail:row.originalEmail || row.email }; dialogVisible.value = true }

function saveContact() {
  if (isNew.value) {
    const existing = store.customers.find(c => c.companyName.toUpperCase() === (editForm.value.companyName || '').toUpperCase())
    if (existing) { store.addContact(existing.id, { name:editForm.value.name, email:editForm.value.email, phone:editForm.value.phone, rating:editForm.value.rating }) }
    else { const nc = { id:'CUS-'+Date.now().toString(36).toUpperCase(), companyName:editForm.value.companyName||editForm.value.name||'Unknown', contacts:[{ name:editForm.value.name, email:editForm.value.email, phone:editForm.value.phone, rating:editForm.value.rating }] }; store.customers.push(nc); localStorage.setItem('chip_sales_customers', JSON.stringify(store.customers)) }
    ElMessage.success('已添加')
  } else {
    store.updateContactRating(editingCompanyId.value, editForm.value.originalEmail || editForm.value.email, editForm.value.rating)
    const c = store.customers.find(x => x.id === editingCompanyId.value)
    if (c && c.contacts[editingContactIdx.value]) { Object.assign(c.contacts[editingContactIdx.value], { name:editForm.value.name, email:editForm.value.email, phone:editForm.value.phone, rating:editForm.value.rating }); c.companyName = editForm.value.companyName || c.companyName; c.updatedAt = new Date().toISOString(); localStorage.setItem('chip_sales_customers', JSON.stringify(store.customers)) }
    ElMessage.success('已保存')
  }
  dialogVisible.value = false
}

function handleDelete(row) { const c = store.customers.find(x => x.id === row.companyId); if(!c)return; c.contacts.splice(row.contactIdx,1); if(c.contacts.length===0){store.deleteCustomer(row.companyId)}else{c.updatedAt=new Date().toISOString();localStorage.setItem('chip_sales_customers',JSON.stringify(store.customers))}; ElMessage.success('已删除') }
</script>