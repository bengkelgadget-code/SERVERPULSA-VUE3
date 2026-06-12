<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const categoryParam = route.params.category as string
const favorites = ref<any[]>([])
const loading = ref(true)

const showAddModal = ref(false)
const newName = ref('')
const newNumber = ref('')
const saving = ref(false)

const fetchFavorites = async () => {
  loading.value = true
  const { data } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', auth.user?.id)
    .eq('category', categoryParam)
    .order('created_at', { ascending: false })
  
  if (data) {
    favorites.value = data
  }
  loading.value = false
}

onMounted(() => {
  fetchFavorites()
})

const selectFavorite = (customerNo: string) => {
  if (categoryParam === 'ewallet') {
    // We don't have ewallet setup fully with params yet, but if so:
    // ewallet is in EwalletInputView which takes id, wait, the user requested it from CategoryInputView.
    router.push({ path: `/category/${categoryParam}`, query: { phone: customerNo } })
  } else {
    router.push({ path: `/category/${categoryParam}`, query: { phone: customerNo } })
  }
}

const saveFavorite = async () => {
  if (!newName.value || !newNumber.value) {
    window.alert('Nama dan Nomor harus diisi')
    return
  }
  
  saving.value = true
  const { error } = await supabase.from('favorites').insert({
    user_id: auth.user?.id,
    name: newName.value,
    customer_no: newNumber.value,
    category: categoryParam
  })
  
  saving.value = false
  
  if (error) {
    window.alert('Gagal menyimpan favorit')
    console.error(error)
  } else {
    newName.value = ''
    newNumber.value = ''
    showAddModal.value = false
    fetchFavorites()
  }
}

const deleteFavorite = async (id: string) => {
  if (window.confirm('Hapus favorit ini?')) {
    await supabase.from('favorites').delete().eq('id', id)
    fetchFavorites()
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 pb-24 relative">
    <!-- Header -->
    <div class="bg-primary-600 text-white p-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
      <button @click="router.back()" class="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-lg font-bold">Daftar Favorit</h1>
    </div>

    <div class="p-4">
      <div v-if="loading" class="text-center py-10">
        <div class="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-primary-600 rounded-full"></div>
      </div>
      
      <div v-else-if="favorites.length === 0" class="text-center py-10 text-neutral-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3 opacity-20"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        <p>Belum ada data favorit</p>
      </div>

      <div v-else class="space-y-3">
        <div 
          v-for="fav in favorites" 
          :key="fav.id" 
          class="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between border border-transparent hover:border-primary-300 transition-all active:scale-[0.98] cursor-pointer"
          @click="selectFavorite(fav.customer_no)"
        >
          <div>
            <h3 class="font-bold text-neutral-800">{{ fav.name }}</h3>
            <p class="text-sm font-medium text-neutral-500 font-mono mt-0.5">{{ fav.customer_no }}</p>
          </div>
          <button @click.stop="deleteFavorite(fav.id)" class="p-2 text-neutral-400 hover:text-red-500 bg-neutral-50 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- FAB -->
    <button 
      @click="showAddModal = true"
      class="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-700 active:scale-95 transition-all z-20"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
    </button>

    <!-- Modal Form -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <h2 class="text-lg font-bold mb-4">Tambah Favorit</h2>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-bold text-neutral-700 mb-1">Nama Panggilan</label>
            <input v-model="newName" type="text" class="input-field w-full" placeholder="Contoh: Meteran Rumah" />
          </div>
          <div>
            <label class="block text-sm font-bold text-neutral-700 mb-1">Nomor Meteran / Tujuan</label>
            <input v-model="newNumber" type="text" inputmode="numeric" class="input-field w-full" placeholder="Ketik nomor..." />
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <button @click="showAddModal = false" class="flex-1 py-2.5 rounded-xl font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200">
            Batal
          </button>
          <button @click="saveFavorite" :disabled="saving" class="flex-1 py-2.5 rounded-xl font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50">
            {{ saving ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
