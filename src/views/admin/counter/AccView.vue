<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Plus, Trash2, Edit2, Headphones , Search } from 'lucide-vue-next'

const auth = useAuthStore()
const products = ref<any[]>([])
const loading = ref(true)
const showModal = ref(false)
const modalMode = ref('add')
const selectedId = ref('')

const form = ref({
  provider_kategori: '',
  nama_produk: '',
  harga_beli: 0,
  harga_jual: 0,
  stok: 0
})

const fetchProducts = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('counter_products')
      .select('*')
      .eq('jenis', 'ACC')
      .order('created_at', { ascending: false })
      
    if (error) throw error
    products.value = data || []
  } catch (err: any) {
    console.error('Error fetching ACCs:', err)
  } finally {
    loading.value = false
  }
}

const openModal = (mode = 'add', item: any = null) => {
  modalMode.value = mode
  if (mode === 'edit' && item) {
    selectedId.value = item.id
    form.value = {
      provider_kategori: item.provider_kategori,
      nama_produk: item.nama_produk,
      harga_beli: item.harga_beli,
      harga_jual: item.harga_jual,
      stok: item.stok
    }
  } else {
    form.value = { provider_kategori: '', nama_produk: '', harga_beli: 0, harga_jual: 0, stok: 0 }
  }
  showModal.value = true
}

const saveProduct = async () => {
  try {
    if (modalMode.value === 'add') {
      const { data: profile } = await supabase.from('users').select('admin_id, role').eq('id', auth.user?.id).single()
      const mitraId = (profile?.role === 'staff') ? profile.admin_id : auth.user?.id
      
      await supabase.from('counter_products').insert({
        mitra_id: mitraId,
        jenis: 'ACC',
        provider_kategori: form.value.provider_kategori,
        nama_produk: form.value.nama_produk,
        harga_beli: form.value.harga_beli,
        harga_jual: form.value.harga_jual,
        stok: form.value.stok
      })
    } else {
      await supabase.from('counter_products').update({
        provider_kategori: form.value.provider_kategori,
        nama_produk: form.value.nama_produk,
        harga_beli: form.value.harga_beli,
        harga_jual: form.value.harga_jual,
        stok: form.value.stok,
        updated_at: new Date().toISOString()
      }).eq('id', selectedId.value)
    }
    showModal.value = false
    fetchProducts()
  } catch (err: any) {
    alert('Gagal menyimpan data: ' + err.message)
  }
}

const deleteProduct = async (id: string) => {
  if (!confirm('Hapus ACC ini?')) return
  try {
    await supabase.from('counter_products').delete().eq('id', id)
    fetchProducts()
  } catch (err: any) {
    alert('Gagal menghapus: ' + err.message)
  }
}


const searchQuery = ref('')
const filterProvider = ref('')

const uniqueProviders = computed(() => {
  const providers = products.value.map((p: any) => p.provider_kategori || '').filter(Boolean)
  return [...new Set(providers)].sort()
})

const parseVoucherName = (name: any) => {
  const strName = (name || '').toString()
  const match = strName.match(/^(.*?)\b(\d+(?:\.\d+)?)\s*[a-zA-Z]*\s*\/\s*(\d+)\s*[a-zA-Z]*\s*$/)
  if (match) {
    return {
      isMatched: true,
      prefix: match[1].trim().toLowerCase(),
      kuota: parseFloat(match[2]),
      hari: parseInt(match[3], 10),
      raw: strName.toLowerCase()
    }
  }
  return { 
    isMatched: false, 
    prefix: '', 
    kuota: 0, 
    hari: 0, 
    raw: strName.toLowerCase() 
  }
}

const filteredProducts = computed(() => {
  let result = products.value
  
  if (filterProvider.value) {
    result = result.filter((p: any) => p.provider_kategori === filterProvider.value)
  }
  
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((p: any) => (p.nama_produk || '').toLowerCase().includes(q))
  }
  
  return result.slice().sort((a: any, b: any) => {
    const nameA = (a.nama_produk || '').toString()
    const nameB = (b.nama_produk || '').toString()
    
    const parsedA = parseVoucherName(nameA)
    const parsedB = parseVoucherName(nameB)
    
    if (parsedA.isMatched && parsedB.isMatched) {
      // 1. Sort by Prefix
      const prefixCmp = parsedA.prefix.localeCompare(parsedB.prefix)
      if (prefixCmp !== 0) return prefixCmp
      
      // 2. Sort by Hari (smallest first)
      if (parsedA.hari !== parsedB.hari) {
        return parsedA.hari - parsedB.hari
      }
      
      // 3. Sort by Kuota (smallest first)
      if (parsedA.kuota !== parsedB.kuota) {
        return parsedA.kuota - parsedB.kuota
      }
    }
    
    // Fallback to natural numeric sort
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' })
  })
})


const categories = ref<any[]>([])
const showCategoryModal = ref(false)
const categoryForm = ref({ id: '', nama: '' })
const catLoading = ref(false)

const fetchCategories = async () => {
  try {
    const { data } = await supabase
      .from('counter_categories')
      .select('*')
      .eq('tipe', 'ACC_KATEGORI')
      .order('nama')
    categories.value = data || []
  } catch (err) {
    console.error(err)
  }
}

const openCategoryModal = (cat: any = null) => {
  if (cat) {
    categoryForm.value = { id: cat.id, nama: cat.nama }
  } else {
    categoryForm.value = { id: '', nama: '' }
  }
  showCategoryModal.value = true
}

const saveCategory = async () => {
  if (!categoryForm.value.nama) return
  catLoading.value = true
  try {
    const profile = auth.user?.user_metadata || auth.user
    const mitraId = (profile?.role === 'staff') ? profile.admin_id : auth.user?.id

    if (categoryForm.value.id) {
      await supabase.from('counter_categories').update({ nama: categoryForm.value.nama }).eq('id', categoryForm.value.id)
    } else {
      await supabase.from('counter_categories').insert({
        mitra_id: mitraId,
        tipe: 'ACC_KATEGORI',
        nama: categoryForm.value.nama
      })
    }
    await fetchCategories()
    categoryForm.value = { id: '', nama: '' }
  } catch (err: any) {
    alert('Gagal menyimpan: ' + err.message)
  } finally {
    catLoading.value = false
  }
}

const deleteCategory = async (id: string) => {
  if (!confirm('Hapus kategori ini?')) return
  try {
    await supabase.from('counter_categories').delete().eq('id', id)
    await fetchCategories()
  } catch (err: any) {
    alert('Gagal menghapus: ' + err.message)
  }
}



const showDuplicateModal = ref(false)
const duplicateItems = ref<any[]>([])
const newItems = ref<any[]>([])

const processUpload = async (toInsert: any[], toUpdate: any[]) => {
  loading.value = true
  try {
    if (toInsert.length > 0) {
      const { error } = await supabase.from('counter_products').insert(toInsert)
      if (error) throw error
    }
    if (toUpdate.length > 0) {
      const upsertData = toUpdate.map(u => ({ id: u.existingId, ...u.newData }))
      const { error } = await supabase.from('counter_products').upsert(upsertData)
      if (error) throw error
    }
    alert('Upload selesai! ' + (toInsert.length + toUpdate.length) + ' data diproses.')
    showDuplicateModal.value = false
    await fetchProducts()
  } catch (err: any) {
    alert('Gagal memproses upload: ' + err.message)
  } finally {
    loading.value = false
  }
}

const showBatchModal = ref(false)
const batchForm = ref<any[]>([])

const openBatchModal = () => {
  batchForm.value = [
    { provider_kategori: '', nama_produk: '', harga_beli: 0, harga_jual: 0, stok: 0 }
  ]
  showBatchModal.value = true
}

const addBatchRow = () => {
  batchForm.value.push({ provider_kategori: '', nama_produk: '', harga_beli: 0, harga_jual: 0, stok: 0 })
}

const removeBatchRow = (index: number) => {
  batchForm.value.splice(index, 1)
  if (batchForm.value.length === 0) addBatchRow()
}

const handleBatchRpInput = (index: number, field: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const numericVal = parseInt(target.value.replace(/[^\d]/g, '')) || 0
  batchForm.value[index][field] = numericVal
  // the `:value="formatInputRp(...)"` in template will handle formatting automatically on render
}

const saveBatch = async () => {
  const profile = auth.user?.user_metadata || auth.user
  const mitraId = (profile?.role === 'staff') ? profile.admin_id : auth.user?.id

  const itemsToInsert = batchForm.value
    .map(row => ({
      mitra_id: mitraId,
      tipe_produk: 'ACC',
      provider_kategori: row.provider_kategori.trim(),
      nama_produk: row.nama_produk.trim(),
      harga_beli: row.harga_beli || 0,
      harga_jual: row.harga_jual || 0,
      stok: row.stok || 0
    }))
    .filter(item => item.nama_produk && item.provider_kategori)
    
  if (itemsToInsert.length === 0) {
    alert('Tidak ada baris data yang lengkap (Provider & Nama wajib diisi).')
    return
  }

  const existingMap = new Map()
  products.value.forEach(p => {
    existingMap.set(p.provider_kategori.toLowerCase() + '|' + p.nama_produk.toLowerCase(), p)
  })

  const newEntries: any[] = []
  const duplicateEntries: any[] = []

  itemsToInsert.forEach(item => {
    const key = item.provider_kategori.toLowerCase() + '|' + item.nama_produk.toLowerCase()
    if (existingMap.has(key)) {
      duplicateEntries.push({
        existingId: existingMap.get(key).id,
        existingStok: existingMap.get(key).stok,
        newData: item
      })
    } else {
      newEntries.push(item)
    }
  })

  if (duplicateEntries.length > 0) {
    duplicateItems.value = duplicateEntries
    newItems.value = newEntries
    showDuplicateModal.value = true
  } else {
    await processUpload(newEntries, [])
    showBatchModal.value = false
  }
}

onMounted(() => {
  fetchCategories()
  fetchProducts()
})

const formatRp = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
}

const formatInputRp = (val: any) => {
  if (val === 0 || val === '0') return '0';
  if (!val) return '';
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const handleRpInput = (field: any, event: any) => {
  const target = event.target as HTMLInputElement;
  let val = target.value.replace(/[^0-9]/g, '');
  (form.value as any)[field] = val ? parseInt(val, 10) : 0;
  target.value = formatInputRp((form.value as any)[field]);
};

</script>

<template>
  <div class="max-w-6xl mx-auto p-4 md:p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Headphones class="w-6 h-6 text-amber-500" />
          Data ACC
        </h1>
        <p class="text-sm text-gray-500 mt-1">Kelola stok dan harga modal/jual ACC fisik.</p>
      </div>
      <div class="flex items-center gap-2">
        
        <button @click="openBatchModal" class="bg-amber-100 hover:bg-amber-200 text-amber-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          Input Massal
        </button>
        <button @click="openModal('add')" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
          <Plus class="w-4 h-4" />
          Tambah ACC
        </button>
      </div>
    </div>

    
    <!-- Filter & Search -->
    <div class="flex flex-col md:flex-row gap-3 mb-4">
      <div class="relative flex-1">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search class="w-4 h-4 text-gray-400" />
        </div>
        <input v-model="searchQuery" type="text" placeholder="Cari nama produk..." class="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm transition-all shadow-sm">
      </div>
      <div class="w-full md:w-64">
        <select v-model="filterProvider" class="w-full px-4 py-2 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm transition-all shadow-sm">
          <option value="">Semua Kategori / Provider</option>
          <option v-for="prov in uniqueProviders" :key="prov" :value="prov">{{ prov }}</option>
        </select>
      </div>
    </div>
    
    <!-- Table -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)]">
        <table class="w-full text-sm text-left">
          <thead class="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
            <tr>
              <th class="px-4 py-2.5">Provider</th>
              <th class="px-4 py-2.5">Nama ACC</th>
              <th class="px-4 py-2.5 text-right">Harga Beli</th>
              <th class="px-4 py-2.5 text-right">Harga Jual</th>
              <th class="px-4 py-2.5 text-right">Margin</th>
              <th class="px-4 py-2.5 text-center">Stok</th>
              <th class="px-4 py-2.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="loading">
              <td colspan="7" class="px-4 py-6 text-center text-gray-400">Memuat data...</td>
            </tr>
            <tr v-else-if="filteredProducts.length === 0">
              <td colspan="7" class="px-4 py-6 text-center text-gray-400">Belum ada data ACC</td>
            </tr>
            <tr v-else v-for="item in filteredProducts" :key="item.id" class="hover:bg-gray-50/50 transition-colors">
              <td class="px-4 py-2.5 font-semibold text-gray-700">{{ item.provider_kategori }}</td>
              <td class="px-4 py-2.5 font-semibold text-gray-900">{{ item.nama_produk }}</td>
              <td class="px-4 py-2.5 text-right font-medium text-gray-500">{{ formatRp(item.harga_beli) }}</td>
              <td class="px-4 py-2.5 text-right font-bold text-gray-800">{{ formatRp(item.harga_jual) }}</td>
              <td class="px-4 py-2.5 text-right font-bold text-green-600">{{ formatRp(item.harga_jual - item.harga_beli) }}</td>
              <td class="px-4 py-2.5 text-center">
                <span class="px-2.5 py-1 rounded-lg text-xs font-bold" :class="item.stok > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                  {{ item.stok }}
                </span>
              </td>
              <td class="px-4 py-2.5">
                <div class="flex items-center justify-center gap-2">
                  <button @click="openModal('edit', item)" class="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><Edit2 class="w-4 h-4" /></button>
                  <button @click="deleteProduct(item.id)" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 class="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <h3 class="font-bold text-lg text-gray-900">{{ modalMode === 'add' ? 'Tambah' : 'Edit' }} ACC</h3>
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Kategori ACC (Cth: Charger, Case)</label>
            
            <div class="flex items-center gap-2">
              <select v-model="form.provider_kategori" class="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm transition-all">
                <option value="">-- Pilih Kategori --</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.nama">{{ cat.nama }}</option>
              </select>
              <button type="button" @click="openCategoryModal()" class="px-3 py-2 bg-amber-100 text-amber-600 hover:bg-amber-200 rounded-xl transition-colors shadow-sm flex items-center justify-center font-bold">
                <Plus class="w-4 h-4 mr-1" /> Kelola
              </button>
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Nama ACC</label>
            <input v-model="form.nama_produk" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm transition-all">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">Harga Beli (Rp)</label>
              <input :value="formatInputRp(form.harga_beli)" @input="handleRpInput('harga_beli', $event)" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm transition-all">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">Harga Jual (Rp)</label>
              <input :value="formatInputRp(form.harga_jual)" @input="handleRpInput('harga_jual', $event)" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm transition-all">
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Stok</label>
            <input :value="formatInputRp(form.stok)" @input="handleRpInput('stok', $event)" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm transition-all">
          </div>
        </div>
        <div class="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button @click="showModal = false" class="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">Batal</button>
          <button @click="saveProduct" class="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-sm">Simpan</button>
        </div>
      </div>
    </div>
  
    <!-- Category Management Modal -->
    <div v-if="showCategoryModal" class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 class="font-bold text-lg text-gray-900">Kelola Kategori</h3>
          <button @click="showCategoryModal = false" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div class="p-4 space-y-4">
          <div class="flex gap-2">
            <input v-model="categoryForm.nama" type="text" class="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm transition-all" placeholder="Nama Kategori baru...">
            <button @click="saveCategory" :disabled="catLoading" class="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-sm disabled:opacity-50">
              {{ categoryForm.id ? 'Simpan' : 'Tambah' }}
            </button>
            <button v-if="categoryForm.id" @click="categoryForm = {id:'', nama:''}" class="px-3 py-2 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Batal</button>
          </div>
          
          <div class="mt-4 border border-gray-100 rounded-xl overflow-hidden">
            <div class="max-h-64 overflow-y-auto">
              <table class="w-full text-sm text-left">
                <tbody class="divide-y divide-gray-100">
                  <tr v-if="categories.length === 0">
                    <td class="px-4 py-4 text-center text-gray-400">Belum ada data</td>
                  </tr>
                  <tr v-else v-for="cat in categories" :key="cat.id" class="hover:bg-gray-50">
                    <td class="px-4 py-2.5 font-semibold text-gray-700">{{ cat.nama }}</td>
                    <td class="px-4 py-2.5 text-right w-24">
                      <div class="flex items-center justify-end gap-2">
                        <button @click="openCategoryModal(cat)" class="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 class="w-3.5 h-3.5" /></button>
                        <button @click="deleteCategory(cat.id)" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 class="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  
    
    <!-- Batch Input Modal -->
    <div v-if="showBatchModal" class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="font-bold text-lg text-gray-900 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            Input Massal ACC
          </h3>
          <button @click="showBatchModal = false" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        
        <div class="p-5 overflow-y-auto flex-1 bg-gray-50/30">
          <div class="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <table class="w-full text-sm text-left">
              <thead class="bg-gray-50 text-gray-500 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th class="px-4 py-3 w-48">Kategori</th>
                  <th class="px-4 py-3">Nama Produk</th>
                  <th class="px-4 py-3 w-40">Harga Beli (Rp)</th>
                  <th class="px-4 py-3 w-40">Harga Jual (Rp)</th>
                  <th class="px-4 py-3 w-24">Stok</th>
                  <th class="px-4 py-3 w-16 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="(row, idx) in batchForm" :key="idx" class="hover:bg-gray-50/50 group">
                  <td class="p-2">
                    <select v-model="row.provider_kategori" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm">
                      <option value="">-- Pilih --</option>
                      <option v-for="cat in categories" :key="cat.id" :value="cat.nama">{{ cat.nama }}</option>
                    </select>
                  </td>
                  <td class="p-2">
                    <input v-model="row.nama_produk" type="text" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm" placeholder="Nama Produk">
                  </td>
                  <td class="p-2">
                    <input :value="formatInputRp(row.harga_beli)" @input="handleBatchRpInput(idx, 'harga_beli', $event)" type="text" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm text-right">
                  </td>
                  <td class="p-2">
                    <input :value="formatInputRp(row.harga_jual)" @input="handleBatchRpInput(idx, 'harga_jual', $event)" type="text" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm text-right font-semibold">
                  </td>
                  <td class="p-2">
                    <input :value="formatInputRp(row.stok)" @input="handleBatchRpInput(idx, 'stok', $event)" type="text" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm text-center">
                  </td>
                  <td class="p-2 text-center">
                    <button @click="removeBatchRow(idx)" class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Hapus Baris">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button @click="addBatchRow" class="mt-4 flex items-center gap-2 text-sm font-semibold text-amber-600 hover:text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors">
            <Plus class="w-4 h-4" /> Tambah Baris
          </button>
        </div>
        
        <div class="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button @click="showBatchModal = false" class="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Batal</button>
          <button @click="saveBatch" class="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-sm flex items-center gap-2">
            Simpan Semua Data
          </button>
        </div>
      </div>
    </div>

    <!-- Duplicate Warning Modal -->
    <div v-if="showDuplicateModal" class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-yellow-50">
          <h3 class="font-bold text-lg text-yellow-800 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Peringatan: Data Duplikat Ditemukan
          </h3>
          <button @click="showDuplicateModal = false" class="text-yellow-600 hover:text-yellow-800">&times;</button>
        </div>
        <div class="p-5 overflow-y-auto flex-1">
          <p class="text-sm text-gray-600 mb-4">
            Ditemukan <strong>{{ duplicateItems.length }}</strong> data di dalam Excel yang sudah ada di sistem (Nama & Provider Sama). 
            Selain itu, ada <strong>{{ newItems.length }}</strong> data baru.
          </p>
          <div class="border border-gray-200 rounded-xl overflow-hidden">
            <table class="w-full text-sm text-left">
              <thead class="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th class="px-4 py-3">Nama Produk</th>
                  <th class="px-4 py-3 text-center">Stok Lama</th>
                  <th class="px-4 py-3 text-center">Stok Excel</th>
                  <th class="px-4 py-3 text-right">Harga Excel</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="(dup, idx) in duplicateItems" :key="idx" class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-800">{{ dup.newData.provider_kategori }} - {{ dup.newData.nama_produk }}</td>
                  <td class="px-4 py-3 text-center text-red-500 font-bold">{{ dup.existingStok }}</td>
                  <td class="px-4 py-3 text-center text-green-600 font-bold">{{ dup.newData.stok }}</td>
                  <td class="px-4 py-3 text-right text-gray-600">{{ formatRp(dup.newData.harga_jual) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
          <button @click="showDuplicateModal = false" class="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-200 rounded-xl transition-colors">Batal (Batalkan Semua)</button>
          <button @click="processUpload(newItems, [])" class="px-4 py-2.5 text-sm font-semibold text-blue-600 bg-blue-100 hover:bg-blue-200 rounded-xl transition-colors">Abaikan Duplikat (Hanya Data Baru)</button>
          <button @click="processUpload(newItems, duplicateItems)" class="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm">Timpa Data (Replace)</button>
        </div>
      </div>
    </div>
  </div>
</template>