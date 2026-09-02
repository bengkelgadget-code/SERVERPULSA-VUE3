<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Plus, Trash2, Edit2, Wallet } from 'lucide-vue-next'

const auth = useAuthStore()
const funds = ref<any[]>([])
const loading = ref(true)
const showModal = ref(false)
const modalMode = ref('add')
const selectedId = ref('')

const form = ref({
  nama_akun: '',
  kategori: 'BANK',
  saldo: 0
})

const fetchFunds = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('sumber_dana')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (error) throw error
    funds.value = data || []
  } catch (err: any) {
    console.error('Error fetching funds:', err)
  } finally {
    loading.value = false
  }
}

const openModal = (mode = 'add', fund: any = null) => {
  modalMode.value = mode
  if (mode === 'edit' && fund) {
    selectedId.value = fund.id
    form.value = {
      nama_akun: fund.nama_akun,
      kategori: fund.kategori,
      saldo: fund.saldo
    }
  } else {
    form.value = { nama_akun: '', kategori: 'BANK', saldo: 0 }
  }
  showModal.value = true
}

const saveFund = async () => {
  try {
    if (modalMode.value === 'add') {
      const { data: profile } = await supabase.from('users').select('admin_id, role').eq('id', auth.user?.id).single()
      const mitraId = (profile?.role === 'staff') ? profile.admin_id : auth.user?.id
      
      await supabase.from('sumber_dana').insert({
        mitra_id: mitraId,
        nama_akun: form.value.nama_akun,
        kategori: form.value.kategori,
        saldo: form.value.saldo
      })
    } else {
      await supabase.from('sumber_dana').update({
        nama_akun: form.value.nama_akun,
        kategori: form.value.kategori,
        saldo: form.value.saldo,
        updated_at: new Date().toISOString()
      }).eq('id', selectedId.value)
    }
    showModal.value = false
    fetchFunds()
  } catch (err: any) {
    alert('Gagal menyimpan data: ' + err.message)
  }
}

const deleteFund = async (id: string) => {
  if (!confirm('Hapus sumber dana ini?')) return
  try {
    await supabase.from('sumber_dana').delete().eq('id', id)
    fetchFunds()
  } catch (err: any) {
    alert('Gagal menghapus: ' + err.message)
  }
}

onMounted(() => {
  fetchFunds()
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
          <Wallet class="w-6 h-6 text-blue-500" />
          Sumber Dana
        </h1>
        <p class="text-sm text-gray-500 mt-1">Kelola data bank, e-wallet, dan kas tunai konter.</p>
      </div>
      <button @click="openModal('add')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
        <Plus class="w-4 h-4" />
        Tambah Akun
      </button>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)]">
        <table class="w-full text-sm text-left">
          <thead class="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
            <tr>
              <th class="px-4 py-2.5">Nama Akun</th>
              <th class="px-4 py-2.5">Kategori</th>
              <th class="px-4 py-2.5 text-right">Saldo Terkini</th>
              <th class="px-4 py-2.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="loading">
              <td colspan="4" class="px-4 py-6 text-center text-gray-400">Memuat data...</td>
            </tr>
            <tr v-else-if="funds.length === 0">
              <td colspan="4" class="px-4 py-6 text-center text-gray-400">Belum ada sumber dana ditambahkan</td>
            </tr>
            <tr v-else v-for="fund in funds" :key="fund.id" class="hover:bg-gray-50/50 transition-colors">
              <td class="px-4 py-2.5 font-semibold text-gray-800">{{ fund.nama_akun }}</td>
              <td class="px-4 py-2.5">
                <span class="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide" 
                      :class="fund.kategori === 'BANK' ? 'bg-blue-100 text-blue-700' : fund.kategori === 'E-WALLET' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'">
                  {{ fund.kategori }}
                </span>
              </td>
              <td class="px-4 py-2.5 text-right font-bold text-gray-700">{{ formatRp(fund.saldo) }}</td>
              <td class="px-4 py-2.5">
                <div class="flex items-center justify-center gap-2">
                  <button @click="openModal('edit', fund)" class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 class="w-4 h-4" /></button>
                  <button @click="deleteFund(fund.id)" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 class="w-4 h-4" /></button>
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
          <h3 class="font-bold text-lg text-gray-900">{{ modalMode === 'add' ? 'Tambah' : 'Edit' }} Sumber Dana</h3>
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Nama Akun (Misal: BCA, Kasir 1)</label>
            <input v-model="form.nama_akun" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Kategori</label>
            <select v-model="form.kategori" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all">
              <option value="BANK">BANK</option>
              <option value="E-WALLET">E-WALLET</option>
              <option value="CASH">CASH</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Saldo Awal / Terkini (Rp)</label>
            <input :value="formatInputRp(form.saldo)" @input="handleRpInput('saldo', $event)" type="text" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all">
          </div>
        </div>
        <div class="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button @click="showModal = false" class="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">Batal</button>
          <button @click="saveFund" class="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm">Simpan</button>
        </div>
      </div>
    </div>
  </div>
</template>
