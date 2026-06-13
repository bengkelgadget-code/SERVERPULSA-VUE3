import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export const useProductsStore = defineStore('products', () => {
  const products = ref<any[]>([])
  const loading = ref(false)

  async function fetchProducts() {
    loading.value = true
    try {
      let allProdData: any[] = []
      let from = 0
      const step = 1000
      
      while (true) {
        const { data: prodData, error } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('category')
          .order('harga_jual')
          .range(from, from + step - 1)
          
        if (error) throw error
        if (prodData && prodData.length > 0) {
          allProdData = allProdData.concat(prodData)
          if (prodData.length < step) break
          from += step
        } else {
          break
        }
      }
      
      const prodData = allProdData
      const { data: { user } } = await supabase.auth.getUser()
      if (user && prodData) {
        const { data: profile } = await supabase.from('users').select('role, admin_id').eq('id', user.id).single()
        
        if (profile && (profile.role === 'admin' || profile.role === 'staff')) {
          const mitraId = profile.role === 'admin' ? user.id : profile.admin_id
          
          if (mitraId) {
            const { data: pricingData } = await supabase
              .from('mitra_pricing')
              .select('product_sku, markup_amount')
              .eq('mitra_id', mitraId)
            
            if (pricingData && pricingData.length > 0) {
              const pricingMap: Record<string, number> = {}
              pricingData.forEach(p => {
                pricingMap[p.product_sku] = p.markup_amount
              })

              // Override harga_jual in prodData
              prodData.forEach(p => {
                const markup = pricingMap[p.sku_code] || 0
                // For transactions, the true selling price for customer/staff is Superadmin's selling price + Mitra Markup
                p.harga_jual = p.harga_jual + markup
              })
            }
          }
        }
      }

      if (prodData) {
        products.value = prodData
      }
    } catch (err) {
      console.error('Error fetching products with pricing:', err)
    } finally {
      loading.value = false
    }
  }

  return {
    products,
    loading,
    fetchProducts
  }
})
