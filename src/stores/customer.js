import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'chip_sales_customers'

function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] } }
function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }

export const useCustomerStore = defineStore('customer', () => {
  const customers = ref(load())

  function generateId() { return 'CUS-' + Date.now().toString(36).toUpperCase() }

  function findOrCreate(email, companyName, contactName) {
    const domain = email.split('@')[1]
    let customer = customers.value.find(c =>
      c.contacts.some(ct => ct.email.toLowerCase() === email.toLowerCase())
    )
    if (customer) return customer

    customer = customers.value.find(c =>
      c.contacts.some(ct => ct.email.includes(domain))
    )
    if (!customer) {
      if (!companyName) companyName = domain.split('.')[0].toUpperCase()
      customer = {
        id: generateId(), companyName,
        contacts: [{ name: contactName || '', email: email || '', phone: '', rating: 'B' }],
        inquiryCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }
      customers.value.push(customer)
    } else {
      const exists = customer.contacts.some(ct => ct.email.toLowerCase() === email.toLowerCase())
      if (!exists && email) {
        customer.contacts.push({ name: contactName || '', email, phone: '', rating: 'B' })
        customer.updatedAt = new Date().toISOString()
      }
    }
    save(customers.value)
    return customer
  }

  function getRatingByEmail(email) {
    for (const c of customers.value) {
      const ct = c.contacts.find(x => x.email.toLowerCase() === email.toLowerCase())
      if (ct) return ct.rating || 'B'
    }
    return 'B'
  }

  function updateCustomer(id, updates) {
    const idx = customers.value.findIndex(c => c.id === id)
    if (idx !== -1) {
      customers.value[idx] = { ...customers.value[idx], ...updates, updatedAt: new Date().toISOString() }
      save(customers.value)
    }
  }

  function addContact(customerId, contact) {
    const c = customers.value.find(x => x.id === customerId)
    if (c) { c.contacts.push({ ...contact, rating: contact.rating || 'B' }); c.updatedAt = new Date().toISOString(); save(customers.value) }
  }

  function updateContactRating(customerId, contactEmail, rating) {
    const c = customers.value.find(x => x.id === customerId)
    if (c) {
      const ct = c.contacts.find(x => x.email === contactEmail)
      if (ct) { ct.rating = rating; c.updatedAt = new Date().toISOString(); save(customers.value) }
    }
  }

  function deleteCustomer(id) {
    customers.value = customers.value.filter(c => c.id !== id)
    save(customers.value)
  }

  function getByEmail(email) {
    return customers.value.find(c => c.contacts.some(ct => ct.email === email))
  }

  return { customers, findOrCreate, getRatingByEmail, updateCustomer, addContact, updateContactRating, deleteCustomer, getByEmail }
})