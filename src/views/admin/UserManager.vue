<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Search, Plus, Pencil, Trash } from 'lucide-vue-next'

const auth = useAuthStore()
const users = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')
const roleFilter = ref('')

const isSuperadmin = computed(() => auth.userProfile?.role === 'superadmin')

// Modals state
const showBalanceModal = ref(false)
const showEditModal = ref(false)
const selectedUser = ref<any>(null)
const balanceAmount = ref(0)
const editNamaToko = ref('')
const editEmail = ref('')
const editRole = ref('staff')
const actionLoading = ref(false)

const showAddModal = ref(false)
const addNamaToko = ref('')
const addEmail = ref('')
const addPassword = ref('')
const addRole = ref('staff')

const fetchUsers = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`id.eq.${auth.user?.id},admin_id.eq.${auth.user?.id}`)
      .neq('role', 'superadmin')
      .order('created_at', { ascending: false })
      
    if (error) throw error
    if (data) {
      users.value = data
    }
  } catch (err) {
    console.error('Error fetching users:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchUsers()
})

const filteredUsers = computed(() => {
  return users.value.filter(u => {
    const matchesSearch = 
      u.nama_toko?.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      u.id?.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesRole = roleFilter.value ? u.role === roleFilter.value : true
    return matchesSearch && matchesRole
  })
})

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value || 0)
}

const openBalanceModal = (user: any) => {
  selectedUser.value = user
  balanceAmount.value = 0
  showBalanceModal.value = true
}

const openEditModal = (user: any) => {
  selectedUser.value = user
  editNamaToko.value = user.nama_toko || ''
  editEmail.value = user.email || ''
  if (user.role === 'superadmin') {
    editRole.value = 'superadmin'
  } else {
    editRole.value = user.role === 'admin' || user.role === 'staff' ? user.role : 'staff'
  }
  showEditModal.value = true
}

const handleEditUser = async () => {
  if (!selectedUser.value) return
  actionLoading.value = true
  try {
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token

    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'update_user',
        payload: {
          id: selectedUser.value.id,
          nama_toko: editNamaToko.value,
          email: editEmail.value,
          role: editRole.value
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update user profile')
    }

    alert('User updated successfully')
    showEditModal.value = false
    fetchUsers()
  } catch (err: any) {
    console.error('Error updating user:', err)
    alert(err.message || 'Failed to update user')
  } finally {
    actionLoading.value = false
  }
}

const handleCreateUser = async () => {
  if (!addEmail.value || !addPassword.value || !addNamaToko.value) {
    alert('Tolong isi semua kolom (Nama Staff, Email, Password)')
    return
  }
  
  actionLoading.value = true
  try {
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token

    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'create_user',
        payload: {
          nama_toko: addNamaToko.value,
          email: addEmail.value,
          password: addPassword.value,
          role: addRole.value
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create user')
    }

    alert('Berhasil membuat Staff/Kasir baru!')
    showAddModal.value = false
    addNamaToko.value = ''
    addEmail.value = ''
    addPassword.value = ''
    fetchUsers()
  } catch (err: any) {
    console.error('Error creating user:', err)
    alert(err.message || 'Failed to create user')
  } finally {
    actionLoading.value = false
  }
}

const openAddModal = () => {
  addNamaToko.value = ''
  addEmail.value = ''
  addPassword.value = ''
  addRole.value = 'staff'
  showAddModal.value = true
}

const handleDeleteUser = async (user: any) => {
  if (!confirm(`Are you sure you want to delete user ${user.nama_toko || user.email}?`)) return
  try {
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token

    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'delete_user',
        payload: { id: user.id }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to delete user')
    }

    fetchUsers()
  } catch (err: any) {
    console.error('Error deleting user:', err)
    alert(err.message || 'Failed to delete user')
  }
}

const handleAddBalance = async () => {
  if (!selectedUser.value || !balanceAmount.value) return
  actionLoading.value = true
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.session?.access_token}`
      },
      body: JSON.stringify({
        action: 'add_balance',
        payload: {
          user_id: selectedUser.value.id,
          amount: balanceAmount.value
        }
      })
    })
    
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to add balance')
    
    alert('Balance added successfully')
    showBalanceModal.value = false
    fetchUsers() // Refresh
  } catch (err: any) {
    console.error('Error adding balance:', err)
    alert('Failed to add balance')
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <h2 class="text-3xl font-bold text-gray-800">Manajemen Kasir / Staff</h2>
      
      <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <!-- Search -->
        <div class="relative w-full sm:w-64">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search class="h-5 w-5 text-gray-400" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Search name, phone, ID..."
          />
        </div>
        
        <!-- Role Filter -->
        <select
          v-model="roleFilter"
          class="block w-full sm:w-40 pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option value="">All Roles</option>
          <option value="staff">Staff / Kasir</option>
        </select>
        
        <button 
          @click="openAddModal"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus class="w-4 h-4" /> Tambah Staff
        </button>
      </div>
    </div>

    <!-- Data Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TF Saldo</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="loading">
              <td colspan="6" class="px-6 py-10 text-center text-gray-500">
                <div class="flex justify-center items-center">
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading users...
                </div>
              </td>
            </tr>
            <tr v-else-if="filteredUsers.length === 0">
              <td colspan="6" class="px-6 py-10 text-center text-gray-500">
                No users found matching your criteria.
              </td>
            </tr>
            <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                    {{ (user.nama_toko || 'U').charAt(0).toUpperCase() }}
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ user.nama_toko || 'No Name' }}</div>
                    <div class="text-sm text-gray-500">{{ user.email }}</div>
                    <div class="text-xs text-gray-400 font-mono mt-0.5 truncate w-32" :title="user.id">{{ user.id }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="[
                  'px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full',
                  user.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                  user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                ]">
                  {{ user.role }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-semibold text-gray-900">{{ formatCurrency(user.saldo) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <button 
                  @click="openBalanceModal(user)"
                  class="inline-flex items-center gap-1 text-green-600 hover:text-green-900 bg-green-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus class="w-4 h-4" />
                  <span>Balance</span>
                </button>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ new Date(user.created_at).toLocaleDateString('id-ID') }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end gap-2">
                  <button 
                    @click="openEditModal(user)"
                    class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                    title="Edit User"
                  >
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button 
                    v-if="user.role !== 'superadmin'"
                    @click="handleDeleteUser(user)"
                    class="inline-flex items-center gap-1 text-red-600 hover:text-red-900 bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                    title="Delete User"
                  >
                    <Trash class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add Balance Modal -->
    <div v-if="showBalanceModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Add Balance</h3>
        <div class="mb-4">
          <p class="text-sm text-gray-500 mb-1">User</p>
          <p class="font-medium">{{ selectedUser?.nama_toko }} ({{ selectedUser?.email }})</p>
        </div>
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Amount to Add (IDR)</label>
          <input 
            type="number" 
            v-model="balanceAmount"
            class="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border"
            placeholder="e.g. 50000"
          />
        </div>
        <div class="flex justify-end gap-3">
          <button 
            @click="showBalanceModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            :disabled="actionLoading"
          >
            Cancel
          </button>
          <button 
            @click="handleAddBalance"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 flex items-center"
            :disabled="actionLoading || !balanceAmount"
          >
            <span v-if="actionLoading" class="mr-2">
              <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            </span>
            Confirm Add
          </button>
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div v-if="showEditModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Edit User</h3>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Nama Toko</label>
          <input 
            type="text" 
            v-model="editNamaToko"
            class="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border"
          />
        </div>
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input 
            type="email" 
            v-model="editEmail"
            class="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border"
          />
        </div>
        <div class="mb-6" v-if="isSuperadmin && selectedUser?.role !== 'superadmin'">
          <label class="block text-sm font-medium text-gray-700 mb-2">Role</label>
          <select 
            v-model="editRole"
            class="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border"
          >
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </div>
        <div class="flex justify-end gap-3">
          <button 
            @click="showEditModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            :disabled="actionLoading"
          >
            Cancel
          </button>
          <button 
            @click="handleEditUser"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 flex items-center"
            :disabled="actionLoading"
          >
            <span v-if="actionLoading" class="mr-2">
              <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            </span>
            Save Changes
          </button>
        </div>
      </div>
    </div>
    
    <!-- Add Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" @click="showAddModal = false"></div>
      
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 class="text-lg font-bold text-gray-900">Tambah Staff Baru</h3>
          <button @click="showAddModal = false" class="text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div class="p-6">
          <form @submit.prevent="handleCreateUser" class="space-y-4" autocomplete="off">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nama Staff</label>
              <input type="text" v-model="addNamaToko" required autocomplete="off" class="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500" />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" v-model="addEmail" required autocomplete="off" data-lpignore="true" class="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500" />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" v-model="addPassword" required minlength="6" autocomplete="new-password" data-lpignore="true" class="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500" />
            </div>
            
            <div class="flex gap-3 pt-4">
              <button type="button" @click="showAddModal = false" class="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                Batal
              </button>
              <button type="submit" :disabled="actionLoading" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center disabled:opacity-50">
                <svg v-if="actionLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Buat Staff
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
