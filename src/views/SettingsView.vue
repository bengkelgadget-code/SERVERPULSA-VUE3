<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BottomNav from '@/components/BottomNav.vue'
import { supabase } from '@/lib/supabase'

const router = useRouter()
const auth = useAuthStore()

const namaToko = ref('')
const alamat = ref('')
const isPrinterConnected = ref(false)

onMounted(() => {
  namaToko.value = auth.userProfile?.nama_toko || ''
  alamat.value = 'Jl. Contoh Alamat No 123' // Placeholder, if we add address to DB later
})

const isSaving = ref(false)

const handleSave = async () => {
  if (!auth.user?.id) return
  isSaving.value = true
  
  try {
    const { error } = await supabase.from('users')
      .update({ nama_toko: namaToko.value })
      .eq('id', auth.user.id)
      
    if (error) throw error
    
    // Update local store
    if (auth.userProfile) {
      auth.userProfile.nama_toko = namaToko.value
    }
    
    alert('Pengaturan berhasil disimpan!')
  } catch (err) {
    console.error('Error saving settings:', err)
    alert('Gagal menyimpan pengaturan')
  } finally {
    isSaving.value = false
  }
}

const connectPrinter = () => {
  alert('Fitur Koneksi Bluetooth Printer segera hadir!')
}

const doLogout = () => {
  auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 pb-24">
    <!-- Header -->
    <div class="bg-primary-600 text-white p-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
      <h1 class="text-lg font-bold ml-2">Pengaturan</h1>
    </div>

    <div class="p-4 space-y-6">
      <!-- Profile Settings -->
      <div class="card p-5 shadow-sm bg-white rounded-2xl">
        <h3 class="font-bold text-neutral-800 mb-4 border-b pb-2">Profil Mitra</h3>
        
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

      <!-- Printer Settings -->
      <div class="card p-5 shadow-sm bg-white rounded-2xl">
        <h3 class="font-bold text-neutral-800 mb-4 border-b pb-2">Hardware & Perangkat</h3>
        
        <div class="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            </div>
            <div>
              <p class="font-bold text-sm text-neutral-800">Printer Thermal Bluetooth</p>
              <p class="text-xs" :class="isPrinterConnected ? 'text-green-600' : 'text-neutral-500'">
                {{ isPrinterConnected ? 'Terhubung (POS-58)' : 'Belum terhubung' }}
              </p>
            </div>
          </div>
          <button @click="connectPrinter" class="text-sm font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg">
            {{ isPrinterConnected ? 'Putus' : 'Hubungkan' }}
          </button>
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
