import { create } from 'zustand'
import { supabase } from '../services/supabase'

interface ProductsState {
  products: any[]
  loading: boolean
  fetchProducts: () => Promise<void>
}

export const useProductsStore = create<ProductsState>((set) => ({
  products: [],
  loading: false,
  fetchProducts: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
    
    if (data) {
      set({ products: data })
    }
    set({ loading: false })
  }
}))
