<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Search, CheckCircle, XCircle, Clock } from 'lucide-vue-next'

const auth = useAuthStore()

const deposits = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')
const statusFilter = ref('pending')

const isSuperadmin = computed(() => auth.userProfile?.role === 'superadmin')

const fetchDeposits = async () => {
  loading.value = true
  try {
    let query = supabase
      .from('deposits')
      .select('*, users(nama_toko, email)')
      .order('created_at', { ascending: false })
      
    if (!isSuperadmin.value) {
      query = query.eq('user_id', auth.user?.id)
    }
    
    const { data, error } = await query
      
    if (error) throw error
    if (data) {
      deposits.value = data
    }
  } catch (err) {
    console.error('Error fetching deposits:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDeposits()
})

const filteredDeposits = computed(() => {
  return deposits.value.filter(d => {
    const searchLower = searchQuery.value.toLowerCase()
    const matchesSearch = 
      d.id?.toLowerCase().includes(searchLower) || 
      d.users?.nama_toko?.toLowerCase().includes(searchLower) ||
      d.users?.email?.toLowerCase().includes(searchLower)
    const matchesStatus = statusFilter.value ? d.status === statusFilter.value : true
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
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <h2 class="text-3xl font-bold text-gray-800">Riwayat Top Up Saldo</h2>
      
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
            placeholder="Search ID, name, phone..."
          />
        </div>
        
        <!-- Status Filter -->
        <select
          v-model="statusFilter"
          class="block w-full sm:w-40 pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
        
        <button 
          @click="fetchDeposits"
          class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Data Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deposit Info</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
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
                  Loading deposits...
                </div>
              </td>
            </tr>
            <tr v-else-if="filteredDeposits.length === 0">
              <td colspan="5" class="px-6 py-10 text-center text-gray-500">
                No deposits found matching your criteria.
              </td>
            </tr>
            <tr v-for="deposit in filteredDeposits" :key="deposit.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900">{{ deposit.payment_method || 'Manual Transfer' }}</div>
                <div class="text-xs text-gray-500">{{ new Date(deposit.created_at).toLocaleString('id-ID') }}</div>
                <div class="text-xs text-gray-400 font-mono mt-0.5">{{ deposit.id }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">{{ deposit.users?.nama_toko || 'Unknown User' }}</div>
                <div class="text-sm text-gray-500">{{ deposit.users?.email || '' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-bold text-gray-900">{{ formatCurrency(deposit.amount) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span v-if="deposit.status === 'success'" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircle class="w-3.5 h-3.5" /> Success
                </span>
                <span v-else-if="deposit.status === 'pending'" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  <Clock class="w-3.5 h-3.5" /> Pending
                </span>
                <span v-else class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  <XCircle class="w-3.5 h-3.5" /> Failed
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
