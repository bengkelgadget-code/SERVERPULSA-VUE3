<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { Search, Plus, Pencil, Trash } from 'lucide-vue-next'
// Data states
const mitras = ref<any[]>([])
const users = ref<any[]>([])
const loading = ref(true)

// Tab state
const activeTab = ref<'mitra'|'user'>('mitra')

// Filters
const searchQuery = ref('')
const roleFilter = ref('')
const superadminBalance = ref<number>(0)

// Modals state for Mitra
const showMitraModal = ref(false)
const isEditMitra = ref(false)
const selectedMitra = ref<any>(null)
const mitraForm = ref({ nama_mitra: '', alamat: '' })

const showBalanceModal = ref(false)
const balanceAmount = ref(0)
const formattedBalanceAmount = ref('')

// Modals state for User
const showUserModal = ref(false)
const isEditUser = ref(false)
const selectedUser = ref<any>(null)
const userForm = ref({ mitra_id: '', email: '', password: '', role: 'admin' })

const actionLoading = ref(false)

const fetchData = async () => {
  loading.value = true
  try {
    const [mitrasRes, usersRes, sessionRes] = await Promise.all([
      supabase.from('mitras').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('*, mitras(nama_mitra)').order('created_at', { ascending: false }),
      supabase.auth.getSession()
    ])
    
    if (mitrasRes.data) mitras.value = mitrasRes.data
    if (usersRes.data) users.value = usersRes.data

    if (sessionRes.data?.session?.access_token) {
      const balanceRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/get-admin-balance`, {
        headers: { 'Authorization': `Bearer ${sessionRes.data.session.access_token}` }
      })
      if (balanceRes.ok) {
        const balData = await balanceRes.json()
        superadminBalance.value = balData.balance || 0
      }
    }
  } catch (err) {
    console.error('Error fetching data:', err)
  } finally {
    loading.value = false
  }
}

let realtimeChannel: any = null

onMounted(() => {
  fetchData()
  
  realtimeChannel = supabase.channel('mitra-manager-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mitras' }, () => {
      fetchData()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
      fetchData()
    })
    .subscribe()
})

onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})

const filteredMitras = computed(() => {
  return mitras.value.filter(m => 
    m.nama_mitra?.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
    m.id?.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const filteredUsers = computed(() => {
  return users.value.filter(u => {
    const matchesSearch = 
      u.email?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      u.mitras?.nama_mitra?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      u.id?.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesRole = roleFilter.value ? u.role === roleFilter.value : true
    return matchesSearch && matchesRole
  })
})

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0)
}

// =================== MITRA ACTIONS ===================

const openAddMitra = () => {
  isEditMitra.value = false
  mitraForm.value = { nama_mitra: '', alamat: '' }
  showMitraModal.value = true
}

const openEditMitra = (mitra: any) => {
  isEditMitra.value = true
  selectedMitra.value = mitra
  mitraForm.value = { nama_mitra: mitra.nama_mitra, alamat: mitra.alamat || '' }
  showMitraModal.value = true
}

const handleSaveMitra = async () => {
  if (!mitraForm.value.nama_mitra) return alert('Nama Mitra required')
  actionLoading.value = true
  try {
    if (isEditMitra.value) {
      const { error } = await supabase.from('mitras')
        .update({ nama_mitra: mitraForm.value.nama_mitra, alamat: mitraForm.value.alamat })
        .eq('id', selectedMitra.value.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('mitras')
        .insert({ nama_mitra: mitraForm.value.nama_mitra, alamat: mitraForm.value.alamat })
      if (error) throw error
    }
    showMitraModal.value = false
    fetchData()
  } catch (err: any) {
    alert('Error saving mitra: ' + err.message)
  } finally {
    actionLoading.value = false
  }
}

const openBalanceModal = (mitra: any) => {
  selectedMitra.value = mitra
  balanceAmount.value = 0
  formattedBalanceAmount.value = ''
  showBalanceModal.value = true
}

const handleBalanceInput = (e: Event) => {
  let val = (e.target as HTMLInputElement).value
  const isNegative = val.startsWith('-')
  val = val.replace(/\D/g, '')
  if (!val) {
    balanceAmount.value = 0
    formattedBalanceAmount.value = isNegative ? '-' : ''
    return
  }
  const parsed = parseInt(val, 10)
  balanceAmount.value = isNegative ? -parsed : parsed
  const formatted = new Intl.NumberFormat('id-ID').format(parsed)
  formattedBalanceAmount.value = isNegative ? '-' + formatted : formatted
}

const handleAddBalance = async () => {
  if (!selectedMitra.value || !balanceAmount.value) return
  actionLoading.value = true
  try {
    const { data: session } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session?.access_token}`
      },
      body: JSON.stringify({
        action: 'add_balance',
        payload: { mitra_id: selectedMitra.value.id, amount: balanceAmount.value }
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to add balance')
    showBalanceModal.value = false
    fetchData()
    alert('Balance added successfully')
  } catch (err: any) {
    alert('Error: ' + err.message)
  } finally {
    actionLoading.value = false
  }
}

// =================== USER ACTIONS ===================

const openAddUser = () => {
  isEditUser.value = false
  userForm.value = { mitra_id: '', email: '', password: '', role: 'admin' }
  showUserModal.value = true
}

const openEditUser = (user: any) => {
  isEditUser.value = true
  selectedUser.value = user
  userForm.value = { mitra_id: user.mitra_id || '', email: user.email, password: '', role: user.role }
  showUserModal.value = true
}

const handleSaveUser = async () => {
  if (!userForm.value.email || (!isEditUser.value && !userForm.value.password)) return alert('Isi data wajib')
  actionLoading.value = true
  try {
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const actionName = isEditUser.value ? 'update_user' : 'create_user'
    const payload: any = {
      email: userForm.value.email,
      role: userForm.value.role,
      mitra_id: (userForm.value.role === 'superadmin' || !userForm.value.mitra_id) ? null : userForm.value.mitra_id
    }
    if (userForm.value.password) payload.password = userForm.value.password
    if (isEditUser.value) payload.id = selectedUser.value.id

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: actionName, payload })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to save user')
    }

    showUserModal.value = false
    fetchData()
  } catch (err: any) {
    alert('Error: ' + err.message)
  } finally {
    actionLoading.value = false
  }
}

const handleDeleteUser = async (user: any) => {
  if (!confirm(`Hapus user ${user.email}?`)) return
  try {
    const { data: session } = await supabase.auth.getSession()
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.session?.access_token}` },
      body: JSON.stringify({ action: 'delete_user', payload: { id: user.id } })
    })
    if (!response.ok) throw new Error('Failed to delete')
    fetchData()
  } catch (err: any) {
    alert('Error: ' + err.message)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-3xl font-bold text-gray-800">Manajemen SAAS</h2>
        <div class="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold border border-blue-100">
          <span>Saldo Superadmin:</span>
          <span class="font-bold font-mono">{{ formatCurrency(superadminBalance) }}</span>
        </div>
      </div>
      
      <div class="flex bg-gray-100 p-1 rounded-lg">
        <button 
          @click="activeTab = 'mitra'" 
          :class="['px-4 py-2 rounded-md text-sm font-medium transition-colors', activeTab === 'mitra' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900']"
        >
          Data Mitra
        </button>
        <button 
          @click="activeTab = 'user'" 
          :class="['px-4 py-2 rounded-md text-sm font-medium transition-colors', activeTab === 'user' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900']"
        >
          Data User
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="relative w-full sm:w-64">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search class="h-5 w-5 text-gray-400" />
        </div>
        <input v-model="searchQuery" type="text" class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Search..." />
      </div>
      
      <select v-if="activeTab === 'user'" v-model="roleFilter" class="block w-full sm:w-40 pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
        <option value="">Semua Role</option>
        <option value="superadmin">Superadmin</option>
        <option value="admin">Admin</option>
        <option value="staff">Staff</option>
      </select>
      
      <div class="flex-grow"></div>
      
      <button v-if="activeTab === 'mitra'" @click="openAddMitra" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
        <Plus class="w-4 h-4" /> Tambah Mitra
      </button>
      <button v-if="activeTab === 'user'" @click="openAddUser" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
        <Plus class="w-4 h-4" /> Tambah User
      </button>
    </div>

    <!-- Data Table MITRA -->
    <div v-if="activeTab === 'mitra'" class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mitra</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TF Saldo</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="loading"><td colspan="5" class="px-6 py-10 text-center text-gray-500">Loading...</td></tr>
            <tr v-else-if="filteredMitras.length === 0"><td colspan="5" class="px-6 py-10 text-center text-gray-500">No data found.</td></tr>
            <tr v-for="mitra in filteredMitras" :key="mitra.id" class="hover:bg-gray-50">
              <td class="px-6 py-4">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                    {{ (mitra.nama_mitra || 'M').charAt(0).toUpperCase() }}
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ mitra.nama_mitra }}</div>
                    <div class="text-xs text-gray-400 font-mono mt-0.5 truncate w-32" :title="mitra.id">{{ mitra.id }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{{ formatCurrency(mitra.saldo) }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <button @click="openBalanceModal(mitra)" class="inline-flex items-center gap-1 text-green-600 hover:text-green-900 bg-green-50 px-3 py-1.5 rounded-lg">
                  <Plus class="w-4 h-4" /> <span>Balance</span>
                </button>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ new Date(mitra.created_at).toLocaleDateString('id-ID') }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button @click="openEditMitra(mitra)" class="inline-flex items-center text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"><Pencil class="w-4 h-4" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Data Table USER -->
    <div v-if="activeTab === 'user'" class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mitra</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="loading"><td colspan="4" class="px-6 py-10 text-center text-gray-500">Loading...</td></tr>
            <tr v-else-if="filteredUsers.length === 0"><td colspan="4" class="px-6 py-10 text-center text-gray-500">No data found.</td></tr>
            <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ user.email }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ user.mitras?.nama_mitra || '-' }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="['px-2.5 py-1 inline-flex text-xs font-semibold rounded-full', user.role === 'superadmin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800']">
                  {{ user.role }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                <button @click="openEditUser(user)" class="inline-flex items-center text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"><Pencil class="w-4 h-4" /></button>
                <button v-if="user.role !== 'superadmin'" @click="handleDeleteUser(user)" class="inline-flex items-center text-red-600 bg-red-50 px-3 py-1.5 rounded-lg"><Trash class="w-4 h-4" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modals -->

    <!-- Mitra Modal -->
    <div v-if="showMitraModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">{{ isEditMitra ? 'Edit Mitra' : 'Tambah Mitra' }}</h3>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Nama Mitra</label>
          <input type="text" v-model="mitraForm.nama_mitra" class="block w-full border-gray-300 rounded-lg px-3 py-2 border" />
        </div>
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">Alamat (Opsional)</label>
          <textarea v-model="mitraForm.alamat" class="block w-full border-gray-300 rounded-lg px-3 py-2 border"></textarea>
        </div>
        <div class="flex justify-end gap-3">
          <button @click="showMitraModal = false" class="px-4 py-2 border rounded-lg">Batal</button>
          <button @click="handleSaveMitra" :disabled="actionLoading" class="px-4 py-2 bg-blue-600 text-white rounded-lg">Simpan</button>
        </div>
      </div>
    </div>

    <!-- Balance Modal -->
    <div v-if="showBalanceModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Transfer Saldo Mitra</h3>
        <p class="font-medium mb-4">{{ selectedMitra?.nama_mitra }}</p>
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Jumlah Saldo (IDR)</label>
          <input type="text" :value="formattedBalanceAmount" @input="handleBalanceInput" class="block w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="50.000 atau -50.000" />
        </div>
        <div class="flex justify-end gap-3">
          <button @click="showBalanceModal = false" class="px-4 py-2 border rounded-lg">Batal</button>
          <button @click="handleAddBalance" :disabled="actionLoading" class="px-4 py-2 bg-blue-600 text-white rounded-lg">Konfirmasi</button>
        </div>
      </div>
    </div>

    <!-- User Modal -->
    <div v-if="showUserModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">{{ isEditUser ? 'Edit User' : 'Tambah User' }}</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select v-model="userForm.role" class="block w-full border-gray-300 rounded-lg px-3 py-2 border">
            <option value="superadmin">Superadmin</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </div>

        <div class="mb-4" v-if="userForm.role !== 'superadmin'">
          <label class="block text-sm font-medium text-gray-700 mb-1">Pilih Mitra</label>
          <select v-model="userForm.mitra_id" class="block w-full border-gray-300 rounded-lg px-3 py-2 border">
            <option value="" disabled>-- Pilih Mitra --</option>
            <option v-for="m in mitras" :key="m.id" :value="m.id">{{ m.nama_mitra }}</option>
          </select>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" v-model="userForm.email" class="block w-full border-gray-300 rounded-lg px-3 py-2 border" />
        </div>

        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">Password <span class="text-xs text-gray-400">{{ isEditUser ? '(Kosongkan jika tak diubah)' : '' }}</span></label>
          <input type="password" v-model="userForm.password" class="block w-full border-gray-300 rounded-lg px-3 py-2 border" />
        </div>
        
        <div class="flex justify-end gap-3">
          <button @click="showUserModal = false" class="px-4 py-2 border rounded-lg">Batal</button>
          <button @click="handleSaveUser" :disabled="actionLoading" class="px-4 py-2 bg-blue-600 text-white rounded-lg">Simpan</button>
        </div>
      </div>
    </div>
  </div>
</template>
