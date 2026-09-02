<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Plus, Trash2, Edit2, Settings2 } from 'lucide-vue-next'

const auth = useAuthStore()
const margins = ref<any[]>([])
const loading = ref(true)
const showModal = ref(false)
const modalMode = ref('add')
const selectedId = ref('')


const availableServices = ['TRANSFER', 'JASA TRANSFER', 'TARIK TUNAI', 'E-WALLET', 'PPOB', 'TOKEN PLN', 'VOUCHER', 'PERDANA', 'PULSA', 'KUOTA INTERNET', 'ACC', 'GAME']
const isDropdownOpen = ref(false)

const toggleService = (svc: string) => {
  const idx = form.value.layanan_terkait.indexOf(svc)
  if (idx > -1) {
    form.value.layanan_terkait.splice(idx, 1)
  } else {
    form.value.layanan_terkait.push(svc)
  }
}
const removeService = (svc: string) => {
  const idx = form.value.layanan_terkait.indexOf(svc)
  if (idx > -1) form.value.layanan_terkait.splice(idx, 1)
}

const form = ref({
  tipe_perhitungan: 'Range Nominal',
  layanan_terkait: [] as string[],
  nominal_awal: 0,
  akhir_persentase: 0,
  keuntungan: 0
})

const fetchMargins = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('pengaturan_margin')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (error) throw error
    margins.value = data || []
  } catch (err: any) {
    console.error('Error fetching margins:', err)
  } finally {
    loading.value = false
  }
}

const openModal = (mode = 'add', item: any = null) => {
  modalMode.value = mode
  if (mode === 'edit' && item) {
    selectedId.value = item.id
    form.value = {
      tipe_perhitungan: item.tipe_perhitungan,
      layanan_terkait: item.layanan_terkait ? item.layanan_terkait.split(', ') : [],
      nominal_awal: item.nominal_awal,
      akhir_persentase: item.akhir_persentase,
      keuntungan: item.keuntungan
    }
  } else {
    form.value = { tipe_perhitungan: 'Range Nominal', layanan_terkait: [], nominal_awal: 0, akhir_persentase: 0, keuntungan: 0 }
  }
  showModal.value = true
}

const saveMargin = async () => {
  try {
    if (modalMode.value === 'add') {
      const { data: profile } = await supabase.from('users').select('admin_id, role').eq('id', auth.user?.id).single()
      const mitraId = (profile?.role === 'staff') ? profile.admin_id : auth.user?.id
      
      await supabase.from('pengaturan_margin').insert({
        mitra_id: mitraId,
        tipe_perhitungan: form.value.tipe_perhitungan,
        layanan_terkait: Array.isArray(form.value.layanan_terkait) ? form.value.layanan_terkait.join(', ') : form.value.layanan_terkait,
        nominal_awal: form.value.nominal_awal,
        akhir_persentase: form.value.akhir_persentase,
        keuntungan: form.value.keuntungan
      })
    } else {
      await supabase.from('pengaturan_margin').update({
        tipe_perhitungan: form.value.tipe_perhitungan,
        layanan_terkait: Array.isArray(form.value.layanan_terkait) ? form.value.layanan_terkait.join(', ') : form.value.layanan_terkait,
        nominal_awal: form.value.nominal_awal,
        akhir_persentase: form.value.akhir_persentase,
        keuntungan: form.value.keuntungan,
        updated_at: new Date().toISOString()
      }).eq('id', selectedId.value)
    }
    showModal.value = false
    fetchMargins()
  } catch (err: any) {
    alert('Gagal menyimpan data: ' + err.message)
  }
}

const deleteMargin = async (id: string) => {
  if (!confirm('Hapus pengaturan margin ini?')) return
  try {
    await supabase.from('pengaturan_margin').delete().eq('id', id)
    fetchMargins()
  } catch (err: any) {
    alert('Gagal menghapus: ' + err.message)
  }
}

onMounted(() => {
  fetchMargins()
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
          <Settings2 class="w-6 h-6 text-gray-700" />
          Pengaturan Margin
        </h1>
        <p class="text-sm text-gray-500 mt-1">Atur margin keuntungan otomatis untuk data konter.</p>
      </div>
      <button @click="openModal('add')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
        <Plus class="w-4 h-4" />
        Tambah Margin
      </button>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)]">
        <table class="w-full text-sm text-left">
          <thead class="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
            <tr>
              <th class="px-4 py-2.5">Tipe Perhitungan</th>
              <th class="px-4 py-2.5">Layanan Terkait</th>
              <th class="px-4 py-2.5 text-right">Nominal Awal</th>
              <th class="px-4 py-2.5 text-right">Akhir / Persen</th>
              <th class="px-4 py-2.5 text-right">Keuntungan</th>
              <th class="px-4 py-2.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="loading">
              <td colspan="6" class="px-4 py-6 text-center text-gray-400">Memuat data...</td>
            </tr>
            <tr v-else-if="margins.length === 0">
              <td colspan="6" class="px-4 py-6 text-center text-gray-400">Belum ada data pengaturan margin</td>
            </tr>
            <tr v-else v-for="item in margins" :key="item.id" class="hover:bg-gray-50/50 transition-colors">
              <td class="px-4 py-2.5 font-semibold text-gray-700">{{ item.tipe_perhitungan }}</td>
              <td class="px-4 py-2.5 font-semibold text-gray-900">{{ item.layanan_terkait }}</td>
              <td class="px-4 py-2.5 text-right font-medium text-gray-500">{{ formatRp(item.nominal_awal) }}</td>
              <td class="px-4 py-2.5 text-right font-medium text-gray-500">{{ item.tipe_perhitungan === 'Persentase' ? item.akhir_persentase + '%' : (item.akhir_persentase ? formatRp(item.akhir_persentase) : 'Maksimal') }}</td>
              <td class="px-4 py-2.5 text-right font-bold text-green-600">{{ formatRp(item.keuntungan) }}</td>
              <td class="px-4 py-2.5">
                <div class="flex items-center justify-center gap-2">
                  <button @click="openModal('edit', item)" class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 class="w-4 h-4" /></button>
                  <button @click="deleteMargin(item.id)" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 class="w-4 h-4" /></button>
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
          <h3 class="font-bold text-lg text-gray-900">{{ modalMode === 'add' ? 'Tambah' : 'Edit' }} Margin</h3>
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
                        <div class="p-6 space-y-4 relative">
          <!-- Row 1: ID Margin and Tipe Perhitungan -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">ID Margin</label>
              <input type="text" :value="modalMode === 'add' ? 'AUTO' : 'PM-' + selectedId.substring(0,6).toUpperCase()" disabled class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 outline-none text-sm cursor-not-allowed">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">Tipe Perhitungan</label>
              <select v-model="form.tipe_perhitungan" class="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all shadow-sm">
                <option value="Range Nominal">Range Nominal</option>
                <option value="Persentase">Persentase</option>
              </select>
            </div>
          </div>

          <!-- Row 2: Custom Multi-Select Layanan Terkait -->
          <div class="relative w-full">
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Layanan Terkait</label>
            <div 
              class="min-h-[42px] px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 flex flex-wrap items-center gap-1.5 cursor-pointer shadow-sm relative z-20" 
              @click="isDropdownOpen = !isDropdownOpen"
              :class="isDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : ''"
            >
              <!-- Selected Tags -->
              <span 
                v-for="item in form.layanan_terkait" 
                :key="item" 
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white border border-gray-300 text-gray-700 shadow-sm"
              >
                {{ item }}
                <button type="button" @click.stop="removeService(item)" class="focus:outline-none flex items-center justify-center">
                  <div class="w-3.5 h-3.5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-[10px] leading-none transition-colors">
                    <span class="-mt-[1px]">&times;</span>
                  </div>
                </button>
              </span>
              
              <!-- Placeholder -->
              <span v-if="form.layanan_terkait.length === 0" class="text-sm text-gray-400 px-2 py-1">Pilih layanan...</span>
              
              <!-- Chevron -->
              <div class="ml-auto pr-2 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <!-- Transparent Overlay to close dropdown -->
            <div v-if="isDropdownOpen" class="fixed inset-0 z-10" @click="isDropdownOpen = false"></div>

            <!-- Dropdown List -->
            <div v-if="isDropdownOpen" class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              <div 
                v-for="svc in availableServices" 
                :key="svc"
                @click="toggleService(svc)"
                class="px-4 py-2.5 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between"
                :class="form.layanan_terkait.includes(svc) ? 'bg-blue-50/50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'"
              >
                <span>{{ svc }}</span>
                <svg v-if="form.layanan_terkait.includes(svc)" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <!-- Row 3: Range / Persen Fields -->
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Nominal Awal (>=)</label>
            <input :value="formatInputRp(form.nominal_awal)" @input="handleRpInput('nominal_awal', $event)" type="text" class="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all shadow-sm">
          </div>
          
          <div v-if="form.tipe_perhitungan === 'Range Nominal'" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">Nominal Akhir (<) (Opsional)</label>
              <input :value="formatInputRp(form.akhir_persentase)" @input="handleRpInput('akhir_persentase', $event)" type="text" class="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all shadow-sm" placeholder="Kosongkan jika maks">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">Margin / Keuntungan (Rp)</label>
              <input :value="formatInputRp(form.keuntungan)" @input="handleRpInput('keuntungan', $event)" type="text" class="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all shadow-sm">
            </div>
          </div>

          <div v-if="form.tipe_perhitungan === 'Persentase'">
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Besaran Persentase (%)</label>
            <input v-model.number="form.akhir_persentase" type="number" class="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all shadow-sm">
          </div>
        </div>
        <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button @click="showModal = false" class="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold rounded-lg transition-colors">Batal</button>
          <button @click="saveMargin" class="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm">Simpan Data</button>
        </div>
      </div>
    </div>
  </div>
</template>
