<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { Users, ArrowLeftRight, CreditCard, Package } from 'lucide-vue-next'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const myBalance = ref<number | null>(null)
const totalProfit = ref<number | null>(null)
const stats = ref([
  { name: 'Total Kasir/Staff', value: 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
  { name: 'Total Transaksi', value: 0, icon: ArrowLeftRight, color: 'text-green-600', bg: 'bg-green-100' },
  { name: 'Riwayat Topup', value: 0, icon: CreditCard, color: 'text-orange-600', bg: 'bg-orange-100' }
])

const loading = ref(true)
let realtimeChannel: any = null

const fetchStats = async () => {
  loading.value = true
  try {
    // Fetch my balance
    const { data: myUser } = await supabase
      .from('users')
      .select('saldo')
      .eq('id', auth.user?.id)
      .single()
    myBalance.value = myUser?.saldo || 0

    // Fetch staff count
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', auth.user?.id)
    
    // Fetch transactions count for my staff
    const { data: staffData } = await supabase.from('users').select('id').eq('admin_id', auth.user?.id)
    const staffIds = staffData?.map(u => u.id) || []
    
    let txCount = 0
    let profit = 0
    if (staffIds.length > 0) {
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .in('user_id', staffIds)
      txCount = count || 0
      
      const { data: txData } = await supabase
        .from('transactions')
        .select('harga_jual, harga_modal')
        .eq('status', 'sukses')
        .in('user_id', staffIds)
        
      profit = txData?.reduce((acc, tx) => acc + (Number(tx.harga_jual) - Number(tx.harga_modal)), 0) || 0
    }
    
    // Fetch my deposits count
    const { count: depositsCount } = await supabase
      .from('deposits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.user?.id)
      
    stats.value[0].value = usersCount || 0
    stats.value[1].value = txCount || 0
    stats.value[2].value = depositsCount || 0
    totalProfit.value = profit
  } catch (error) {
    console.error('Error fetching stats:', error)
  } finally {
    loading.value = false
  }
}

let fetchTimeout: any = null
const debouncedFetchStats = () => {
  if (fetchTimeout) clearTimeout(fetchTimeout)
  fetchTimeout = setTimeout(() => {
    fetchStats()
  }, 1000)
}

const setupRealtime = () => {
  realtimeChannel = supabase.channel('admin-dashboard-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
      debouncedFetchStats()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
      debouncedFetchStats()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'deposits' }, () => {
      debouncedFetchStats()
    })
    .subscribe()
}

onMounted(() => {
  fetchStats()
  setupRealtime()
})

import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (fetchTimeout) clearTimeout(fetchTimeout)
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
  }
})
</script>

<template>
  <div class="h-full overflow-y-auto space-y-6 pb-8 pr-2">
    <!-- Saldo Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Saldo Mitra -->
      <div class="bg-gradient-to-r from-[#f59e0b] to-[#d97706] rounded-2xl p-6 text-white shadow-md shadow-orange-200">
        <div class="text-sm font-bold opacity-90 mb-1 tracking-wide flex justify-between items-center">
          SISA SALDO ANDA
        </div>
        <div class="text-3xl font-extrabold tracking-tight">
          <span v-if="myBalance !== null">{{ new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(myBalance) }}</span>
          <span v-else class="animate-pulse">Loading...</span>
        </div>
      </div>
      
      <!-- Total Profit -->
      <div class="bg-gradient-to-r from-[#10b981] to-[#059669] rounded-2xl p-6 text-white shadow-md shadow-green-200">
        <div class="text-sm font-bold opacity-90 mb-1 tracking-wide flex justify-between items-center">
          TOTAL KEUNTUNGAN KASIR
        </div>
        <div class="text-3xl font-extrabold tracking-tight">
          <span v-if="totalProfit !== null">{{ new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalProfit) }}</span>
          <span v-else class="animate-pulse">Loading...</span>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between mt-8">
      <h2 class="text-3xl font-bold text-gray-800">Overview</h2>
      <button 
        @click="fetchStats" 
        class="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
        :disabled="loading"
      >
        {{ loading ? 'Refreshing...' : 'Refresh Data' }}
      </button>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div 
        v-for="stat in stats" 
        :key="stat.name"
        class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center"
      >
        <div :class="['w-14 h-14 rounded-full flex items-center justify-center mr-4', stat.bg]">
          <component :is="stat.icon" :class="['w-7 h-7', stat.color]" />
        </div>
        <div>
          <p class="text-sm font-medium text-gray-500 mb-1">{{ stat.name }}</p>
          <h3 class="text-2xl font-bold text-gray-900">
            <span v-if="loading" class="animate-pulse bg-gray-200 text-transparent rounded">000</span>
            <span v-else>{{ stat.value }}</span>
          </h3>
        </div>
      </div>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div class="grid grid-cols-2 gap-4">
          <router-link to="/admin/deposits" class="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group">
            <CreditCard class="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2" />
            <span class="text-sm font-medium text-gray-700 group-hover:text-blue-700">Approve Deposits</span>
          </router-link>
          <router-link to="/admin/users" class="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group">
            <Users class="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2" />
            <span class="text-sm font-medium text-gray-700 group-hover:text-blue-700">Manage Users</span>
          </router-link>
          <router-link to="/admin/products" class="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group">
            <Package class="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2" />
            <span class="text-sm font-medium text-gray-700 group-hover:text-blue-700">Update Prices</span>
          </router-link>
          <router-link to="/admin/transactions" class="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group">
            <ArrowLeftRight class="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2" />
            <span class="text-sm font-medium text-gray-700 group-hover:text-blue-700">View Logs</span>
          </router-link>
        </div>
      </div>
      
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center items-center text-center">
        <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <svg class="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-gray-900 mb-2">System Running Smoothly</h3>
        <p class="text-gray-500 max-w-sm">
          Server Pulsa backend is operating normally. All services including Vercel Webhook for DigiFlazz integration are active.
        </p>
      </div>
    </div>
  </div>
</template>
