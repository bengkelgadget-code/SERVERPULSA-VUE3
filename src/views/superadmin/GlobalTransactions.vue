<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { Search, CheckCircle, XCircle, Clock } from 'lucide-vue-next'

const transactions = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')
const statusFilter = ref('')

const checkingStatus = ref<Record<string, boolean>>({})

const checkStatus = async (transactionId: string) => {
  if (checkingStatus.value[transactionId]) return
  checkingStatus.value[transactionId] = true
  
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.session?.access_token}`
      },
      body: JSON.stringify({
        action: 'check_transaction_status',
        payload: { transaction_id: transactionId }
      })
    })
    
    const result = await res.json()
    if (result.success) {
      alert(`Status updated: ${result.status}`)
      fetchTransactions()
    } else {
      alert(result.error || 'Failed to check status')
    }
  } catch (err) {
    console.error('Check status error:', err)
    alert('Error checking status')
  } finally {
    checkingStatus.value[transactionId] = false
  }
}

const fetchTransactions = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, users!user_id(nama_toko, email), staff:users!staff_id(email)')
      .order('created_at', { ascending: false })
      .limit(500) // Limit to last 500 for performance
      
    if (error) throw error
    if (data) {
      transactions.value = data
    }
  } catch (err) {
    console.error('Error fetching transactions:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchTransactions()
})

const filteredTransactions = computed(() => {
  return transactions.value.filter(t => {
    const searchLower = searchQuery.value.toLowerCase()
    const matchesSearch = 
      t.id?.toLowerCase().includes(searchLower) || 
      t.product_name?.toLowerCase().includes(searchLower) ||
      t.customer_no?.toLowerCase().includes(searchLower) ||
      t.users?.nama_toko?.toLowerCase().includes(searchLower) ||
      t.users?.email?.toLowerCase().includes(searchLower) ||
      t.staff?.email?.toLowerCase().includes(searchLower)
    const matchesStatus = statusFilter.value ? t.status === statusFilter.value : true
    return matchesSearch && matchesStatus
  })
})

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value || 0)
}
</script>

<template>
  <div class="h-full overflow-y-auto space-y-6 pb-8 pr-2">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <h2 class="text-3xl font-bold text-gray-800">Global Transactions</h2>
      
      <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <!-- Search -->
        <div class="relative w-full sm:w-64">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search class="h-5 w-5 text-gray-400" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Search trx ID, product, number..."
          />
        </div>
        
        <!-- Status Filter -->
        <select
          v-model="statusFilter"
          class="block w-full sm:w-40 pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="Sukses">Sukses</option>
          <option value="Gagal">Gagal</option>
        </select>
        
        <button 
          @click="fetchTransactions"
          class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Data Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full table-fixed divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="w-[20%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction Info</th>
              <th scope="col" class="w-[25%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User / Mitra</th>
              <th scope="col" class="w-[30%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Number</th>
              <th scope="col" class="w-[15%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price / Cost</th>
              <th scope="col" class="w-[10%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="loading">
              <td colspan="5" class="px-6 py-10 text-center text-gray-500">
                <div class="flex justify-center items-center">
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading transactions...
                </div>
              </td>
            </tr>
            <tr v-else-if="filteredTransactions.length === 0">
              <td colspan="5" class="px-6 py-10 text-center text-gray-500">
                No transactions found matching your criteria.
              </td>
            </tr>
            <tr v-for="trx in filteredTransactions" :key="trx.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-3 py-3 truncate break-words">
                <div class="text-sm font-medium text-gray-900 truncate" :title="trx.product_name">{{ trx.product_name }}</div>
                <div class="text-xs text-gray-500">{{ new Date(trx.created_at).toLocaleString('id-ID') }}</div>
                <div class="text-xs text-gray-400 font-mono mt-0.5 truncate" :title="trx.id">Ref: {{ trx.id.substring(0, 8) }}...</div>
              </td>
              <td class="px-3 py-3 break-words">
                <div class="text-sm font-medium text-gray-900 truncate" :title="trx.users?.nama_toko">{{ trx.users?.nama_toko || 'Unknown' }}</div>
                <div class="text-xs text-gray-500 truncate" :title="trx.users?.email">{{ trx.users?.email || '' }}</div>
                <div v-if="trx.staff" class="text-xs text-blue-600 mt-1 truncate" :title="trx.staff.email">Kasir: {{ trx.staff.email }}</div>
              </td>
              <td class="px-3 py-3 break-words">
                <div class="text-sm font-medium text-gray-900 break-all">{{ trx.customer_no }}</div>
                <div v-if="trx.sn" class="text-xs text-gray-500 mt-1 line-clamp-3" :title="trx.sn">SN: {{ trx.sn }}</div>
              </td>
              <td class="px-3 py-3">
                <div class="text-sm font-bold text-gray-900">{{ formatCurrency(trx.price) }}</div>
                <div class="text-xs text-gray-500 mt-0.5">
                  Markup: {{ formatCurrency(trx.price - (trx.original_price || trx.price)) }}
                </div>
              </td>
              <td class="px-3 py-3">
                <div class="flex flex-col gap-2 items-start">
                  <span v-if="trx.status === 'sukses'" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle class="w-3.5 h-3.5" /> Sukses
                  </span>
                  <span v-else-if="trx.status === 'pending'" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    <Clock class="w-3.5 h-3.5" /> Pending
                  </span>
                  <span v-else class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <XCircle class="w-3.5 h-3.5" /> Gagal
                  </span>
                  <button 
                    v-if="trx.status === 'pending'" 
                    @click="checkStatus(trx.id)"
                    :disabled="checkingStatus[trx.id]"
                    class="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    {{ checkingStatus[trx.id] ? 'Mengecek...' : 'Cek Status' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
        <div class="text-sm text-gray-500">
          Showing <span class="font-medium">{{ filteredTransactions.length }}</span> latest transactions
        </div>
      </div>
    </div>
  </div>
</template>
