<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Search, Plus, Pencil, Trash } from 'lucide-vue-next'

const auth = useAuthStore()
const users = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')

// Modals state
const showEditModal = ref(false)
const selectedUser = ref<any>(null)
const editEmail = ref('')
const editPassword = ref('')
const actionLoading = ref(false)

const showAddModal = ref(false)
const addEmail = ref('')
const addPassword = ref('')

const fetchUsers = async () => {
  loading.value = true
  try {
    let query = supabase
      .from('users')
      .select('*')
      .eq('mitra_id', auth.userProfile?.mitra_id)
      .eq('role', 'staff')
      .order('created_at', { ascending: false })
      
    const { data, error } = await query
      
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
    return u.email?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
           u.id?.toLowerCase().includes(searchQuery.value.toLowerCase())
  })
})

const openEditModal = (user: any) => {
  selectedUser.value = user
  editEmail.value = user.email || ''
  editPassword.value = ''
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
          email: editEmail.value,
          password: editPassword.value || undefined,
          role: 'staff'
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update user profile')
    }

    alert('Staff updated successfully')
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
  if (!addEmail.value || !addPassword.value) {
    alert('Tolong isi semua kolom (Email, Password)')
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
          email: addEmail.value,
          password: addPassword.value,
          role: 'staff'
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create user')
    }

    alert('Berhasil membuat Staff/Kasir baru!')
    showAddModal.value = false
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
  addEmail.value = ''
  addPassword.value = ''
  showAddModal.value = true
}

const handleDeleteUser = async (user: any) => {
  if (!confirm(`Are you sure you want to delete staff ${user.email}?`)) return
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
            placeholder="Search email, ID..."
          />
        </div>
        
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
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="loading">
              <td colspan="4" class="px-6 py-10 text-center text-gray-500">Loading...</td>
            </tr>
            <tr v-else-if="filteredUsers.length === 0">
              <td colspan="4" class="px-6 py-10 text-center text-gray-500">No staff found.</td>
            </tr>
            <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900">{{ user.email }}</div>
                <div class="text-xs text-gray-400 font-mono mt-0.5">{{ user.id }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                  {{ user.role }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ new Date(user.created_at).toLocaleDateString('id-ID') }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end gap-2">
                  <button @click="openEditModal(user)" class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors" title="Edit Staff">
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button @click="handleDeleteUser(user)" class="inline-flex items-center gap-1 text-red-600 hover:text-red-900 bg-red-50 px-3 py-1.5 rounded-lg transition-colors" title="Delete Staff">
                    <Trash class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div v-if="showEditModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Edit Staff</h3>
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input type="email" v-model="editEmail" class="block w-full border-gray-300 rounded-lg px-3 py-2 border" />
        </div>
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Password Baru <span class="text-xs text-gray-400 font-normal">(Kosongkan jika tidak diubah)</span></label>
          <input type="password" v-model="editPassword" placeholder="Minimal 8 karakter" class="block w-full border-gray-300 rounded-lg px-3 py-2 border" />
        </div>
        <div class="flex justify-end gap-3">
          <button @click="showEditModal = false" class="px-4 py-2 border rounded-lg" :disabled="actionLoading">Cancel</button>
          <button @click="handleEditUser" class="px-4 py-2 bg-blue-600 text-white rounded-lg" :disabled="actionLoading">Save Changes</button>
        </div>
      </div>
    </div>
    
    <!-- Add Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" @click="showAddModal = false"></div>
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Tambah Staff Baru</h3>
        <form @submit.prevent="handleCreateUser" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" v-model="addEmail" required class="block w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" v-model="addPassword" required minlength="8" class="block w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div class="flex gap-3 mt-4">
            <button type="button" @click="showAddModal = false" class="flex-1 border rounded-lg py-2">Batal</button>
            <button type="submit" class="flex-1 bg-blue-600 text-white rounded-lg py-2" :disabled="actionLoading">Buat Staff</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
