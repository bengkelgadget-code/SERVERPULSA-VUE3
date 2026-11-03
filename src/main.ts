import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import { isSupabaseConfigured } from '@/lib/supabase'

import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'

if (Capacitor.isNativePlatform()) {
  CapacitorUpdater.notifyAppReady().catch(() => {})
}

if (!isSupabaseConfigured) {
  console.error('Konfigurasi Supabase belum lengkap. Hubungi developer.')
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.innerHTML = `
      <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; color: #1f2937;">
        <div style="font-size: 56px; margin-bottom: 16px;">⚠️</div>
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #dc2626;">Konfigurasi Belum Lengkap</h2>
        <p style="font-size: 15px; color: #4b5563; max-width: 320px; line-height: 1.6; margin: 0 0 16px 0;">
          Konfigurasi Supabase belum lengkap. Hubungi developer.
        </p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px; font-size: 12px; color: #991b1b; font-family: monospace;">
          VITE_SUPABASE_URL / ANON_KEY is empty
        </div>
      </div>
    `
  }
} else {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)

  app.mount('#app')
}
