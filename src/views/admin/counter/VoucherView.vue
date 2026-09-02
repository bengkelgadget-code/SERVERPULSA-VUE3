<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Plus, Trash2, Edit2, Ticket , Search } from 'lucide-vue-next'

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
      .eq('jenis', 'VOUCHER')
      .order('created_at', { ascending: false })
      
    if (error) throw error
    products.value = data || []
  } catch (err: any) {
    console.error('Error fetching vouchers:', err)
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
        jenis: 'VOUCHER',
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
  if (!confirm('Hapus voucher ini?')) return
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

const parseVoucherName = (name: string) => {
  const match = name.match(/^(.*?)\b(\d+(?:\.\d+)?)\s*[a-zA-Z]*\s*\/\s*(\d+)\s*[a-zA-Z]*\s*$/)
  if (match) {
    return {
      prefix: match[1].trim().toLowerCase(),
      kuota: parseFloat(match[2]),
      hari: parseInt(match[3], 10),
      isMatched: true
    }
  }
  return { isMatched: false, raw: name.toLowerCase() }
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
    const nameA = a.nama_produk || ''
    const nameB = b.nama_produk || ''
    
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
      .eq('tipe', 'PROVIDER')
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
        tipe: 'PROVIDER',
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
          <Ticket class="w-6 h-6 text-purple-500" />
          Data Voucher
        </h1>
        <p class="text-sm text-gray-500 mt-1">Kelola stok dan harga modal/jual voucher fisik.</p>
      </div>
      <button @click="openModal('add')" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
        <Plus class="w-4 h-4" />
        Tambah Voucher
      </button>
    </div>

    
    <!-- Filter & Search -->
    <div class="flex flex-col md:flex-row gap-3 mb-4">
      <div class="relative flex-1">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search class="w-4 h-4 text-gray-400" />
        </div>
        <input v-model="searchQuery" type="text" placeholder="Cari nama produk..." class="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-sm transition-all shadow-sm">
      </div>
      <div class="w-full md:w-64">
        <select v-model="filterProvider" class="w-full px-4 py-2 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-sm transition-all shadow-sm">
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
              <th class="px-4 py-2.5">Nama Voucher</th>
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
              <td colspan="7" class="px-4 py-6 text-center text-gray-400">Belum ada data voucher</td>
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
                  <button @click="openModal('edit', item)" class="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"><Edit2 class="w-4 h-4" /></button>
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
          <h3 class="font-bold text-lg text-gray-900">{{ modalMode === 'add' ? 'Tambah' : 'Edit' }} Voucher</h3>
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Provider (Cth: Telkomsel, XL)</label>
            
            <div class="flex items-center gap-2">
              <select v-model="form.provider_kategori" class="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-sm transition-all">
                <option value="">-- Pilih Provider --</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.nama">{{ cat.nama }}</option>
              </select>
              <button type="button" @click="openCategoryModal()" class="px-3 py-2 bg-purple-100 text-purple-600 hover:bg-purple-200 rounded-xl transition-colors shadow-sm flex items-center justify-center font-bold">
                <Plus class="w-4 h-4 mr-1" /> Kelola
              </button>
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Nama Voucher</label>
            <input v-model="form.nama_produk" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-sm transition-all">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">Harga Beli (Rp)</label>
              <input :value="formatInputRp(form.harga_beli)" @input="handleRpInput('harga_beli', $event)" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-sm transition-all">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">Harga Jual (Rp)</label>
              <input :value="formatInputRp(form.harga_jual)" @input="handleRpInput('harga_jual', $event)" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-sm transition-all">
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Stok</label>
            <input :value="formatInputRp(form.stok)" @input="handleRpInput('stok', $event)" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-sm transition-all">
          </div>
        </div>
        <div class="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button @click="showModal = false" class="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">Batal</button>
          <button @click="saveProduct" class="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors shadow-sm">Simpan</button>
        </div>
      </div>
    </div>
  
    <!-- Category Management Modal -->
    <div v-if="showCategoryModal" class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 class="font-bold text-lg text-gray-900">Kelola Provider</h3>
          <button @click="showCategoryModal = false" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div class="p-4 space-y-4">
          <div class="flex gap-2">
            <input v-model="categoryForm.nama" type="text" class="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-sm transition-all" placeholder="Nama Provider baru...">
            <button @click="saveCategory" :disabled="catLoading" class="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors shadow-sm disabled:opacity-50">
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
  </div>
</template>