<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { App as CapacitorApp } from '@capacitor/app'
import { Toast } from '@capacitor/toast'
import { Capacitor } from '@capacitor/core'
import TransactionPopup from '@/components/TransactionPopup.vue'
import { usePrinterStore } from '@/stores/printer'
import { useBluetooth } from '@/composables/useBluetooth'
import { CapacitorUpdater } from '@capgo/capacitor-updater'

const auth = useAuthStore()
const printer = usePrinterStore()
const bluetooth = useBluetooth()
const router = useRouter()
let lastBackPress = 0


const isAdminRoute = computed(() => {
  const path = router.currentRoute.value.path
  const isDisplayRole = auth.userProfile?.role === 'display'
  return path.startsWith('/admin') || path.startsWith('/superadmin') || path.startsWith('/tv') || isDisplayRole
})

onMounted(() => {
  auth.initialize()
  
  if (Capacitor.isNativePlatform()) {

    
    // Check for self-hosted updates
    let isUpdating = false
    const checkForUpdates = async () => {
      if (isUpdating) return
      try {
        const response = await fetch('https://serverpulsa-vue-3.vercel.app/version.json', { cache: 'no-store' })
        const data = await response.json()
        
        const currentVersion = localStorage.getItem('app_version')
        if (!currentVersion) {
          if (data.version) localStorage.setItem('app_version', data.version)
          return
        }
        if (data.version && data.version !== currentVersion) {
          isUpdating = true
          console.log('New update found:', data.version)
          Toast.show({ text: 'Mengunduh pembaruan...', duration: 'short' })
          
          try {
            const version = await CapacitorUpdater.download({
              url: `https://serverpulsa-vue-3.vercel.app${data.url}`,
              version: data.version
            })
            
            // Simpan versi sebelum set() karena set() langsung merefresh webview
            localStorage.setItem('app_version', data.version)
            Toast.show({ text: 'Memuat pembaruan...', duration: 'short' })
            await CapacitorUpdater.set(version)
          } catch (updateErr) {
            console.error('Failed to apply OTA update:', updateErr)
            localStorage.removeItem('app_version')
            isUpdating = false
          }
        }
      } catch (err) {
        console.error('Failed to check for updates', err)
      }
    }
    
    checkForUpdates()
    
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
  <div v-if="auth.loading" class="min-h-screen flex items-center justify-center" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #fafafa;">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" style="width: 32px; height: 32px; border-radius: 50%; border: 3px solid #e5e7eb; border-top-color: #2563eb; animation: spin 1s linear infinite;"></div>
  </div>
  <div v-else :class="!isAdminRoute ? 'min-h-screen w-full flex justify-center bg-gray-100 desktop-outer' : ''">
    <div 
      :class="{
        'w-full max-w-[480px] min-h-screen bg-white relative shadow-[0_0_50px_rgba(0,0,0,0.1)] overflow-hidden mobile-app-wrapper': !isAdminRoute,
        'w-full min-h-screen': isAdminRoute
      }"
    >
      <router-view></router-view>
      <TransactionPopup v-if="auth.user" />
    </div>
  </div>
</template>

<style>
.mobile-app-wrapper {
  width: 100%;
  max-width: 480px;
  min-height: 100vh;
  position: relative;
  box-sizing: border-box;
}
.desktop-outer {
  min-height: 100vh;
  width: 100%;
  display: flex;
  justify-content: center;
}
</style>
