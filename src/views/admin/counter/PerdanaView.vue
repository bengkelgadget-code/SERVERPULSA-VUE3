<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Plus, Trash2, Edit2, Smartphone } from 'lucide-vue-next'

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
      .eq('jenis', 'PERDANA')
      .order('created_at', { ascending: false })
      
    if (error) throw error
    products.value = data || []
  } catch (err: any) {
    console.error('Error fetching PERDANAs:', err)
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
        jenis: 'PERDANA',
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
  if (!confirm('Hapus PERDANA ini?')) return
  try {
    await supabase.from('counter_products').delete().eq('id', id)
    fetchProducts()
  } catch (err: any) {
    alert('Gagal menghapus: ' + err.message)
  }
}

onMounted(() => {
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
          <Smartphone class="w-6 h-6 text-emerald-500" />
          Data PERDANA
        </h1>
        <p class="text-sm text-gray-500 mt-1">Kelola stok dan harga modal/jual PERDANA fisik.</p>
      </div>
      <button @click="openModal('add')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
        <Plus class="w-4 h-4" />
        Tambah PERDANA
      </button>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)]">
        <table class="w-full text-sm text-left">
          <thead class="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
            <tr>
              <th class="px-4 py-2.5">Provider</th>
              <th class="px-4 py-2.5">Nama PERDANA</th>
              <th class="px-4 py-2.5 text-right">Harga Beli</th>
              <th class="px-4 py-2.5 text-right">Harga Jual</th>
              <th class="px-4 py-2.5 text-center">Stok</th>
              <th class="px-4 py-2.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="loading">
              <td colspan="6" class="px-4 py-6 text-center text-gray-400">Memuat data...</td>
            </tr>
            <tr v-else-if="products.length === 0">
              <td colspan="6" class="px-4 py-6 text-center text-gray-400">Belum ada data PERDANA</td>
            </tr>
            <tr v-else v-for="item in products" :key="item.id" class="hover:bg-gray-50/50 transition-colors">
              <td class="px-4 py-2.5 font-semibold text-gray-700">{{ item.provider_kategori }}</td>
              <td class="px-4 py-2.5 font-semibold text-gray-900">{{ item.nama_produk }}</td>
              <td class="px-4 py-2.5 text-right font-medium text-gray-500">{{ formatRp(item.harga_beli) }}</td>
              <td class="px-4 py-2.5 text-right font-bold text-gray-800">{{ formatRp(item.harga_jual) }}</td>
              <td class="px-4 py-2.5 text-center">
                <span class="px-2.5 py-1 rounded-lg text-xs font-bold" :class="item.stok > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                  {{ item.stok }}
                </span>
              </td>
              <td class="px-4 py-2.5">
                <div class="flex items-center justify-center gap-2">
                  <button @click="openModal('edit', item)" class="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit2 class="w-4 h-4" /></button>
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
          <h3 class="font-bold text-lg text-gray-900">{{ modalMode === 'add' ? 'Tambah' : 'Edit' }} PERDANA</h3>
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Provider (Cth: Telkomsel, XL)</label>
            <input v-model="form.provider_kategori" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Nama PERDANA</label>
            <input v-model="form.nama_produk" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">Harga Beli (Rp)</label>
              <input :value="formatInputRp(form.harga_beli)" @input="handleRpInput('harga_beli', $event)" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">Harga Jual (Rp)</label>
              <input :value="formatInputRp(form.harga_jual)" @input="handleRpInput('harga_jual', $event)" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all">
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Stok</label>
            <input :value="formatInputRp(form.stok)" @input="handleRpInput('stok', $event)" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all">
          </div>
        </div>
        <div class="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button @click="showModal = false" class="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">Batal</button>
          <button @click="saveProduct" class="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm">Simpan</button>
        </div>
      </div>
    </div>
  </div>
</template>
