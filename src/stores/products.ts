import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export const useProductsStore = defineStore('products', () => {
  const products = ref<any[]>([])
  const loading = ref(false)

  async function fetchProducts() {
    loading.value = true
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('harga_jual')
    
    if (data) {
      products.value = data
    }
    loading.value = false
  }

  return {
    products,
    loading,
    fetchProducts
  }
})
