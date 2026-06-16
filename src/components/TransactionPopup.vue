<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { Capacitor } from '@capacitor/core'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const isVisible = ref(false)
const transactionInfo = ref({ title: '', message: '', status: '' })
let timeoutId: any = null
let realtimeChannel: any = null
let pollingInterval: any = null
let knownStatuses = new Map<string, string>() // transaction_id -> last known status

onMounted(async () => {
  // Wait for auth to be ready
  await auth.initialize()
  if (!auth.user) return

  // Try realtime first
  setupRealtime()
  
  // Always start polling as fallback (catches updates even if realtime fails)
  startPolling()
  
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.requestPermissions()
    } catch (e) {
      console.warn('Local notifications not available')
    }
  }
})

const setupRealtime = () => {
  const userId = auth.user?.id
  if (!userId) return

  // Listen for transactions where this user is the owner OR the staff who made it
  realtimeChannel = supabase.channel('transaction-popup')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'transactions' },
      (payload: any) => {
        const txUserId = payload.new.user_id
        const txStaffId = payload.new.staff_id
        
        // Only process if this update belongs to the current user (as owner or staff)
        if (txUserId !== userId && txStaffId !== userId) return
        
        const oldStatus = payload.old.status
        const newStatus = payload.new.status
        
        if (oldStatus !== newStatus && oldStatus === 'pending') {
          showPopup(
            `Transaksi ${newStatus.toUpperCase()}`,
            `Transaksi (${payload.new.customer_no}) telah ${newStatus}.`,
            newStatus
          )
        }
      }
    )
    .subscribe()
}

const startPolling = () => {
  // Poll every 5 seconds for pending transactions
  pollingInterval = setInterval(async () => {
    await checkPendingTransactions()
  }, 5000)
  
  // Do an initial check after 2 seconds
  setTimeout(checkPendingTransactions, 2000)
}

const checkPendingTransactions = async () => {
  const userId = auth.user?.id
  if (!userId) return

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Check pending transactions for this user (as owner or staff) via the check-status API
    const { data: pendingTrx } = await supabase
      .from('transactions')
      .select('id, status, customer_no, ref_id, sku_code')
      .or(`user_id.eq.${userId},staff_id.eq.${userId}`)
      .eq('status', 'pending')
      .limit(5)

    if (!pendingTrx || pendingTrx.length === 0) return

    // Check each pending transaction status via API
    for (const trx of pendingTrx) {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/mobile/transaction/check-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ transaction_id: trx.id })
        })

        const result = await res.json()
        if (!result.success) continue

        const newStatus = result.status?.toLowerCase()
        const prevStatus = knownStatuses.get(trx.id) || 'pending'
        
        // Update known status
        knownStatuses.set(trx.id, newStatus)
        
        // Show popup only on status change from pending
        if (prevStatus === 'pending' && newStatus !== 'pending') {
          showPopup(
            `Transaksi ${newStatus.toUpperCase()}`,
            `Transaksi (${trx.customer_no}) telah ${newStatus}.`,
            newStatus
          )
        }
      } catch (e) {
        // Skip this transaction on error, continue with next
        continue
      }
    }
  } catch (e) {
    console.warn('Polling check failed:', e)
  }
}

const showPopup = async (title: string, message: string, status: string) => {
  transactionInfo.value = { title, message, status }
  isVisible.value = true
  
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body: message,
            id: Date.now(),
            schedule: { at: new Date(Date.now() + 50) },
          }
        ]
      })
    } catch (e) {
      console.warn('Failed to show local notification', e)
    }
  }

  if (timeoutId) clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    isVisible.value = false
  }, 5000)
}

onUnmounted(() => {
  if (timeoutId) clearTimeout(timeoutId)
  if (pollingInterval) clearInterval(pollingInterval)
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})
</script>

<template>
  <Transition name="slide-fade">
    <div 
      v-if="isVisible" 
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-[90vw] w-80 p-4 rounded-xl shadow-lg border-l-4 transition-all"
      :class="{
        'bg-white border-green-500 shadow-green-100': transactionInfo.status === 'sukses',
        'bg-white border-red-500 shadow-red-100': transactionInfo.status === 'gagal',
        'bg-white border-yellow-500 shadow-yellow-100': transactionInfo.status === 'pending' || !['sukses', 'gagal'].includes(transactionInfo.status)
      }"
    >
      <div class="flex items-start">
        <svg v-if="transactionInfo.status === 'sukses'" class="w-6 h-6 text-green-500 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <svg v-else-if="transactionInfo.status === 'gagal'" class="w-6 h-6 text-red-500 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <svg v-else class="w-6 h-6 text-yellow-500 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <h4 class="font-bold text-gray-900 text-sm">{{ transactionInfo.title }}</h4>
          <p class="text-xs text-gray-500 mt-1">{{ transactionInfo.message }}</p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translate(-50%, -20px);
  opacity: 0;
}
</style>
