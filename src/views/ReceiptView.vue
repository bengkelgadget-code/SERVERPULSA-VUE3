<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const transactionId = route.params.id as string

const loading = ref(true)
const trx = ref<any>(null)

const fetchTransaction = async () => {
  loading.value = true
  const { data } = await supabase
    .from('transactions')
    .select('*, products(*)')
    .eq('id', transactionId)
    .single()
  
  if (data) {
    trx.value = data
  }
  loading.value = false
}

onMounted(() => {
  fetchTransaction()
})

const formatRp = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val).replace('Rp', 'RP.')
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`
}

const isPln = computed(() => {
  return trx.value?.products?.category?.toLowerCase().includes('pln') || false
})

// Parse PLN data from Digiflazz SN format: TOKEN/NAMA/TARIF/DAYA/KWH
const plnData = computed(() => {
  if (!isPln.value || !trx.value?.sn) return null
  
  const snParts = trx.value.sn.split('/')
  let token = snParts[0] || '-'
  // Format token into 4 groups of 4
  if (token.length >= 16 && !token.includes('-')) {
    token = token.match(/.{1,4}/g)?.join('-') || token
  }
  
  return {
    token: token,
    nama: snParts[1] || '-',
    tarif: snParts[2] || '-',
    daya: snParts[3] || '-',
    kwh: snParts[4] || '-',
  }
})

const printReceipt = () => {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-neutral-100 flex flex-col font-sans">
    <div class="bg-primary-600 text-white p-4 flex items-center justify-between shadow-sm sticky top-0 z-10 print:hidden">
      <div class="flex items-center gap-4">
        <button @click="router.back()" class="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 class="text-lg font-bold">Nota Transaksi</h1>
      </div>
      <button @click="printReceipt" class="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      </button>
    </div>

    <div class="flex-1 p-4 flex items-center justify-center print:p-0 print:bg-white">
      <div v-if="loading" class="animate-spin w-8 h-8 border-[3px] border-primary-600 border-t-transparent rounded-full print:hidden"></div>
      
      <!-- THERMAL RECEIPT CONTAINER -->
      <div v-else-if="trx" class="bg-white p-6 shadow-lg max-w-[320px] w-full mx-auto font-mono text-sm leading-tight receipt-container border border-neutral-200">
        
        <div class="text-center mb-4">
          <p class="font-bold text-base">** BENGKEL GADGET **</p>
          <p>{{ formatDate(trx.created_at) }} (CU)</p>
        </div>

        <div class="text-center mb-4 font-bold">
          <p v-if="isPln">STRUK PEMBELIAN LISTRIK</p>
          <p v-if="isPln">PRABAYAR</p>
          <p v-else>STRUK PEMBELIAN</p>
          <p v-if="!isPln" class="uppercase">{{ trx.products?.category }}</p>
        </div>

        <!-- PLN FORMAT -->
        <div v-if="isPln" class="space-y-1 mb-4">
          <div class="flex"><span class="w-24">IDPEL</span><span>: {{ trx.customer_no }}</span></div>
          <div class="flex"><span class="w-24">NAMA</span><span>: {{ plnData?.nama }}</span></div>
          <div class="flex"><span class="w-24">TRF/DAYA</span><span>: {{ plnData?.tarif }}/{{ plnData?.daya }}</span></div>
          <div class="flex"><span class="w-24">NOMINAL</span><span>: {{ formatRp(trx.products?.harga_modal || 0) }}</span></div>
          <div class="flex"><span class="w-24">PPN</span><span>: RP. 0,00</span></div>
          <div class="flex"><span class="w-24">ANGS/MAT</span><span>: RP. 0,00/0,00</span></div>
          <div class="flex"><span class="w-24">RP TOKEN</span><span>: {{ formatRp(trx.products?.harga_modal || 0) }}</span></div>
          <div class="flex"><span class="w-24">JML KWH</span><span>: {{ plnData?.kwh }}</span></div>
          <div class="flex"><span class="w-24">BIAYA ADM</span><span>: {{ formatRp(trx.harga_jual - (trx.products?.harga_modal || 0)) }}</span></div>
          <div class="flex font-bold"><span class="w-24">TOTAL BAYAR</span><span>: {{ formatRp(trx.harga_jual) }}</span></div>
        </div>

        <!-- NON-PLN FORMAT -->
        <div v-else class="space-y-1 mb-4">
          <div class="flex"><span class="w-24">PRODUK</span><span>: {{ trx.products?.product_name }}</span></div>
          <div class="flex"><span class="w-24">NO TUJUAN</span><span>: {{ trx.customer_no }}</span></div>
          <div class="flex"><span class="w-24">SN / REF</span><span>: {{ trx.sn || trx.ref_id }}</span></div>
          <div class="flex mt-2 font-bold"><span class="w-24">TOTAL BAYAR</span><span>: {{ formatRp(trx.harga_jual) }}</span></div>
        </div>

        <!-- TOKEN DISPLAY -->
        <div v-if="isPln" class="text-center mt-6 mb-6">
          <p class="mb-2">-- TOKEN --</p>
          <div class="font-bold text-2xl tracking-widest break-words space-y-1">
            <p>{{ plnData?.token?.split('-').slice(0,2).join('-') }}</p>
            <p>{{ plnData?.token?.split('-').slice(2,4).join('-') }}</p>
          </div>
        </div>

        <div class="text-center mt-6 border-t border-dashed border-black pt-4 text-xs">
          <p>Info Hubungi Call Center 123</p>
          <p>Atau Hubungi PLN Terdekat</p>
          <p class="mt-3">Terima Kasih</p>
        </div>

      </div>

      <div v-else class="text-center text-neutral-500">
        Transaksi tidak ditemukan
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  @page { margin: 0; }
  body { margin: 0; background-color: white; }
  .receipt-container {
    box-shadow: none !important;
    border: none !important;
    width: 100% !important;
    max-width: 100% !important;
  }
}
</style>
