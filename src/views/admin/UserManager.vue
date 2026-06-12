<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Search, Plus, ShieldAlert } from 'lucide-vue-next'

const auth = useAuthStore()
const users = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')
const roleFilter = ref('')

const isSuperadmin = computed(() => auth.userProfile?.role === 'superadmin')

// Modals state
const showBalanceModal = ref(false)
const showRoleModal = ref(false)
const selectedUser = ref<any>(null)
const balanceAmount = ref(0)
const selectedRole = ref('')
const actionLoading = ref(false)

const fetchUsers = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
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
      u.full_name?.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
      u.phone?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
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

const openRoleModal = (user: any) => {
  selectedUser.value = user
  selectedRole.value = user.role
  showRoleModal.value = true
}

const handleAddBalance = async () => {
  if (!selectedUser.value || !balanceAmount.value) return
  
  actionLoading.value = true
  try {
    const { error } = await supabase.rpc('add_balance', {
      user_id: selectedUser.value.id,
      amount: balanceAmount.value
    })
    
    if (error) throw error
    
    alert('Balance added successfully')
    showBalanceModal.value = false
    fetchUsers() // Refresh
  } catch (err) {
    console.error('Error adding balance:', err)
    alert('Failed to add balance')
  } finally {
    actionLoading.value = false
  }
}

const handleUpdateRole = async () => {
  if (!selectedUser.value || !selectedRole.value) return
  
  actionLoading.value = true
  try {
    const { error } = await supabase.rpc('update_user_role', {
      user_id: selectedUser.value.id,
      new_role: selectedRole.value
    })
    
    if (error) throw error
    
    alert('Role updated successfully')
    showRoleModal.value = false
    fetchUsers() // Refresh
  } catch (err) {
    console.error('Error updating role:', err)
    alert('Failed to update role')
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <h2 class="text-2xl font-bold text-gray-800">User Manager</h2>
      
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
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
        
        <button 
          @click="fetchUsers"
          class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Refresh
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
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="loading">
              <td colspan="5" class="px-6 py-10 text-center text-gray-500">
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
              <td colspan="5" class="px-6 py-10 text-center text-gray-500">
                No users found matching your criteria.
              </td>
            </tr>
            <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                    {{ (user.full_name || 'U').charAt(0).toUpperCase() }}
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ user.full_name || 'No Name' }}</div>
                    <div class="text-sm text-gray-500">{{ user.phone }}</div>
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
                <div class="text-sm font-semibold text-gray-900">{{ formatCurrency(user.balance) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ new Date(user.created_at).toLocaleDateString('id-ID') }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end gap-2">
                  <button 
                    @click="openBalanceModal(user)"
                    class="inline-flex items-center gap-1 text-green-600 hover:text-green-900 bg-green-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus class="w-4 h-4" />
                    <span>Balance</span>
                  </button>
                  <button 
                    v-if="isSuperadmin && user.id !== auth.userProfile?.id"
                    @click="openRoleModal(user)"
                    class="inline-flex items-center gap-1 text-purple-600 hover:text-purple-900 bg-purple-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ShieldAlert class="w-4 h-4" />
                    <span>Role</span>
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
          <p class="font-medium">{{ selectedUser?.full_name }} ({{ selectedUser?.phone }})</p>
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

    <!-- Update Role Modal -->
    <div v-if="showRoleModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Change User Role</h3>
        <div class="mb-4">
          <p class="text-sm text-gray-500 mb-1">User</p>
          <p class="font-medium">{{ selectedUser?.full_name }} ({{ selectedUser?.phone }})</p>
        </div>
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Select New Role</label>
          <select 
            v-model="selectedRole"
            class="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <p class="mt-2 text-xs text-gray-500">
            Admins have access to products and users. Superadmins can also change roles.
          </p>
        </div>
        <div class="flex justify-end gap-3">
          <button 
            @click="showRoleModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            :disabled="actionLoading"
          >
            Cancel
          </button>
          <button 
            @click="handleUpdateRole"
            class="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700 flex items-center"
            :disabled="actionLoading || selectedRole === selectedUser?.role"
          >
            <span v-if="actionLoading" class="mr-2">
              <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            </span>
            Update Role
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
