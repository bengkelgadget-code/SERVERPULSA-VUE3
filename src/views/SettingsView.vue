<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePrinterStore } from '@/stores/printer'
import { useBluetooth } from '@/composables/useBluetooth'
import BottomNav from '@/components/BottomNav.vue'
import { supabase } from '@/lib/supabase'

const router = useRouter()
const auth = useAuthStore()
const printerStore = usePrinterStore()
const bluetooth = useBluetooth()

const namaToko = ref('')
const alamat = ref('')
const showPrinterModal = ref(false)

onMounted(() => {
  namaToko.value = auth.userProfile?.nama_toko || ''
  alamat.value = auth.userProfile?.alamat_toko || '' 
  selectedTheme.value = localStorage.getItem('app_theme') || 'default'
})

const selectedTheme = ref('default')

const changeTheme = (theme: string) => {
  selectedTheme.value = theme
  localStorage.setItem('app_theme', theme)
  if (theme === 'neumorph') {
    document.body.classList.add('theme-neumorph')
  } else {
    document.body.classList.remove('theme-neumorph')
  }
}

const isSaving = ref(false)

const handleSave = async () => {
  if (!auth.user?.id) return
  isSaving.value = true
  
  try {
    // 1. Save to Auth Metadata (always works for own user)
    const { error: authError } = await supabase.auth.updateUser({
      data: { nama_toko: namaToko.value, alamat_toko: alamat.value }
    })
    if (authError) console.warn('Update auth metadata failed', authError)

    // 2. Try saving to public.mitras if admin
    if (auth.userProfile?.role === 'admin' && auth.userProfile?.mitra_id) {
      const { error } = await supabase.from('mitras')
        .update({ nama_mitra: namaToko.value })
        .eq('id', auth.userProfile.mitra_id)
        
      if (error) {
        console.warn('Update to mitras failed (RLS issue?), falling back to local storage', error)
      }
    }
    
    // Save locally so it always sticks on this device even if DB fails
    localStorage.setItem('custom_nama_toko', namaToko.value)
    localStorage.setItem('custom_alamat_toko', alamat.value)
    
    // Update local store
    if (auth.userProfile) {
      auth.userProfile.nama_toko = namaToko.value
      auth.userProfile.alamat_toko = alamat.value
    }
    
    alert('Pengaturan berhasil disimpan!')
  } catch (err) {
    console.error('Error saving settings:', err)
    alert('Gagal menyimpan pengaturan')
  } finally {
    isSaving.value = false
  }
}

const connectPrinter = async () => {
  if (printerStore.isConnected) {
    await bluetooth.disconnect()
    printerStore.clearDevice()
    alert('Printer terputus')
    return
  }

  const devices = await bluetooth.scanDevices()
  if (devices.length > 0) {
    showPrinterModal.value = true
  } else {
    alert('Tidak ada perangkat bluetooth yang ditemukan.\n\nPENTING: Pastikan Bluetooth AKTIF dan printer sudah di-PAIR (dipasangkan) terlebih dahulu di menu Pengaturan Bluetooth HP Anda.')
  }
}

const selectPrinter = async (address: string, name: string) => {
  showPrinterModal.value = false
  const success = await bluetooth.connect(address)
  if (success) {
    printerStore.saveDevice(address, name)
    alert(`Berhasil terhubung ke ${name}`)
  } else {
    alert('Gagal terhubung ke printer')
  }
}

const doLogout = async () => {
  await auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 pb-24">
    <!-- Header -->
    <div class="bg-primary-600 text-white p-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
      <h1 class="text-xl font-bold ml-2">Pengaturan</h1>
    </div>

    <div class="p-4 space-y-6">
      <!-- Profile Settings -->
      <div class="card p-5 shadow-sm bg-white rounded-2xl">
        <h3 class="font-bold text-lg text-neutral-800 mb-4 border-b pb-2">Profil Mitra</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-neutral-700 mb-1">Nama Toko / Mitra</label>
            <input 
              v-model="namaToko" 
              type="text" 
              class="input-field py-2.5 px-3 w-full bg-neutral-50 focus:bg-white" 
            />
          </div>
          
          <div>
            <label class="block text-sm font-semibold text-neutral-700 mb-1">Alamat Lengkap</label>
            <textarea 
              v-model="alamat" 
              rows="3"
              class="input-field py-2.5 px-3 w-full bg-neutral-50 focus:bg-white resize-none" 
            ></textarea>
          </div>

          <button @click="handleSave" :disabled="isSaving" class="btn-primary w-full py-3 rounded-xl font-bold mt-2 disabled:opacity-50">
            {{ isSaving ? 'Menyimpan...' : 'Simpan Profil' }}
          </button>
        </div>
      </div>

      <!-- Tampilan Aplikasi -->
      <div class="card p-5 shadow-sm bg-white rounded-2xl">
        <h3 class="font-bold text-lg text-neutral-800 mb-4 border-b pb-2">Tampilan Aplikasi</h3>
        
        <div>
          <label class="block text-sm font-semibold text-neutral-700 mb-2">Pilih Tema</label>
          <select 
            v-model="selectedTheme" 
            @change="changeTheme(selectedTheme)"
            class="input-field py-3 px-4 w-full bg-neutral-50 focus:bg-white border border-neutral-200 rounded-xl outline-none"
          >
            <option value="default">Bawaan (Default) - Desain modern standar</option>
            <option value="neumorph">Neumorphism - Desain timbul elegan (Soft UI)</option>
          </select>
        </div>
      </div>

      <!-- Printer Settings -->
      <div class="card p-5 shadow-sm bg-white rounded-2xl">
        <h3 class="font-bold text-lg text-neutral-800 mb-4 border-b pb-2">Hardware & Perangkat</h3>
        
        <div class="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            </div>
            <div>
              <p class="font-bold text-sm text-neutral-800">Printer Thermal Bluetooth</p>
              <p class="text-xs" :class="printerStore.isConnected ? 'text-green-600' : 'text-neutral-500'">
                {{ printerStore.isConnected ? 'Terhubung: ' + printerStore.connectedName : 'Belum terhubung' }}
              </p>
            </div>
          </div>
          <button @click="connectPrinter" :disabled="bluetooth.isConnecting.value || bluetooth.isScanning.value" class="text-sm font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg disabled:opacity-50">
            {{ bluetooth.isScanning.value ? 'Scanning...' : bluetooth.isConnecting.value ? 'Menghubungkan...' : printerStore.isConnected ? 'Putus' : 'Hubungkan' }}
          </button>
        </div>
      </div>

      <!-- Printer Selection Modal -->
      <div v-if="showPrinterModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col">
          <div class="p-4 border-b flex items-center justify-between">
            <h3 class="font-bold text-lg">Pilih Printer</h3>
            <button @click="showPrinterModal = false" class="text-neutral-500 hover:text-neutral-800">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="p-4 overflow-y-auto">
            <div v-if="bluetooth.devices.value.length === 0" class="text-center py-4 text-neutral-500">
              Tidak ada perangkat ditemukan
            </div>
            <div v-for="dev in bluetooth.devices.value" :key="dev.address" @click="selectPrinter(dev.address, dev.name)" class="p-3 border-b border-neutral-100 active:bg-neutral-50 rounded-lg cursor-pointer flex flex-col gap-1">
              <span class="font-bold text-neutral-800">{{ dev.name }}</span>
              <span class="text-xs text-neutral-500">{{ dev.address }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Account Actions -->
      <div class="card p-5 shadow-sm bg-white rounded-2xl border border-red-50">
        <button @click="doLogout" class="flex items-center justify-center w-full gap-2 text-red-600 font-bold py-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Keluar Akun
        </button>
      </div>

    </div>

    <!-- Bottom Navigation -->
    <BottomNav />
  </div>
</template>
