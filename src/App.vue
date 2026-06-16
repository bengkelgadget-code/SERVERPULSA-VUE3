<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { App as CapacitorApp } from '@capacitor/app'
import { Toast } from '@capacitor/toast'
import { Capacitor } from '@capacitor/core'
import TransactionPopup from '@/components/TransactionPopup.vue'
import { usePrinterStore } from '@/stores/printer'
import { useBluetooth } from '@/composables/useBluetooth'

const auth = useAuthStore()
const printer = usePrinterStore()
const bluetooth = useBluetooth()
const router = useRouter()
let lastBackPress = 0

onMounted(() => {
  auth.initialize()
  
  if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener('backButton', () => {
      const currentPath = router.currentRoute.value.path
      if (currentPath === '/' || currentPath === '/login' || currentPath === '/riwayat' || currentPath === '/settings') {
        const now = Date.now()
        if (now - lastBackPress < 2000) {
          CapacitorApp.exitApp()
        } else {
          lastBackPress = now
          Toast.show({
            text: 'Tekan sekali lagi untuk keluar',
            duration: 'short'
          })
        }
      } else {
        router.back()
      }
    })
    
    // Auto-reconnect printer on startup
    const tryReconnectPrinter = async () => {
      if (printer.connectedAddress) {
        try {
          const success = await bluetooth.connect(printer.connectedAddress)
          printer.isConnected = success
        } catch (e) {
          printer.isConnected = false
        }
      }
    }
    
    tryReconnectPrinter()

    // Reconnect when app resumes from background
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && printer.connectedAddress && !printer.isConnected) {
        tryReconnectPrinter()
      }
    })
  }
  
  // Initialize Theme
  const savedTheme = localStorage.getItem('app_theme') || 'default'
  if (savedTheme === 'neumorph') {
    document.body.classList.add('theme-neumorph')
  } else {
    document.body.classList.remove('theme-neumorph')
  }
})
</script>

<template>
  <div v-if="auth.loading" class="min-h-screen flex items-center justify-center">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
  <div v-else>
    <router-view></router-view>
    <TransactionPopup v-if="auth.user" />
  </div>
</template>
