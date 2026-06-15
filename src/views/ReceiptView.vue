<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { usePrinterStore } from '@/stores/printer'
import { useBluetooth } from '@/composables/useBluetooth'

const route = useRoute()
const router = useRouter()
const printerStore = usePrinterStore()
const bluetooth = useBluetooth()
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
    const authStore = (await import('@/stores/auth')).useAuthStore()
    const user = authStore.user
    const profile = authStore.userProfile

    if (data.user_id !== user?.id && profile?.role !== 'superadmin' && profile?.role !== 'admin') {
      alert('Unauthorized access to receipt')
      router.push('/')
      return
    }
    trx.value = data
  } else {
    alert('Transaction not found')
    router.push('/')
  }
  loading.value = false
}

onMounted(() => {
  fetchTransaction()
})

import { formatRp as baseFormatRp } from '@/utils/format'
const formatRp = (val: number) => {
  return baseFormatRp(val).replace('Rp', 'RP.')
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

import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const printReceipt = async () => {
  if (printerStore.isConnected) {
    const authStore = (await import('@/stores/auth')).useAuthStore()
    const storeName = authStore.userProfile?.nama_toko || 'KONTER PULSA'
    const text = bluetooth.formatReceipt(trx.value, storeName)
    const success = await bluetooth.print(text)
    if (success) {
      alert('Struk berhasil dicetak ke printer Bluetooth.')
    } else {
      alert('Gagal mencetak. Pastikan printer terhubung dan nyala.')
    }
  } else {
    // Fallback to browser print if no bluetooth printer is connected
    window.print()
  }
}

const showShareModal = ref(false)
const isSharing = ref(false)
const receiptRef = ref<HTMLElement | null>(null)

const shareReceipt = async (format: 'jpg' | 'pdf') => {
  if (!receiptRef.value) return
  
  isSharing.value = true
  showShareModal.value = false
  
  try {
    const canvas = await html2canvas(receiptRef.value, {
      scale: 2,
      backgroundColor: '#ffffff'
    })

    let fileToShare: File

    if (format === 'jpg') {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) throw new Error('Gagal membuat gambar JPG')
      fileToShare = new File([blob], `Nota-${trx.value.sn || trx.value.ref_id}.jpg`, { type: 'image/jpeg' })
    } else {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      })
      const imgData = canvas.toDataURL('image/jpeg', 1.0)
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2)
      const pdfBlob = pdf.output('blob')
      fileToShare = new File([pdfBlob], `Nota-${trx.value.sn || trx.value.ref_id}.pdf`, { type: 'application/pdf' })
    }

    if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
      await navigator.share({
        title: 'Nota Transaksi',
        text: 'Berikut adalah nota transaksi Anda.',
        files: [fileToShare]
      })
    } else {
      // Fallback: download file
      const url = URL.createObjectURL(fileToShare)
      const a = document.createElement('a')
      a.href = url
      a.download = fileToShare.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      alert('Perangkat ini tidak mendukung fitur Share secara langsung. File telah diunduh.')
    }
  } catch (err: any) {
    alert(err.message || 'Terjadi kesalahan saat memproses file')
  } finally {
    isSharing.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-100 flex flex-col font-sans">
    <div class="bg-primary-600 text-white p-4 flex items-center justify-between shadow-sm sticky top-0 z-10 print:hidden">
      <div class="flex items-center gap-4">
        <button @click="router.back()" class="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 class="text-xl font-bold">Nota Transaksi</h1>
      </div>
      <button @click="printReceipt" class="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      </button>
    </div>

    <div class="flex-1 p-4 flex items-center justify-center print:p-0 print:bg-white">
      <div v-if="loading" class="animate-spin w-8 h-8 border-[3px] border-primary-600 border-t-transparent rounded-full print:hidden"></div>
      
      <!-- THERMAL RECEIPT CONTAINER -->
      <div v-else-if="trx" class="w-full max-w-[320px] mx-auto pb-20 print:pb-0">
        <div ref="receiptRef" class="bg-white p-6 shadow-lg font-mono text-sm leading-tight receipt-container border border-neutral-200">
          
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
            <div v-if="trx.customer_name" class="flex"><span class="w-24">NAMA AKUN</span><span>: {{ trx.customer_name }}</span></div>
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

        <!-- Action Buttons (Hidden when printing or screenshotting) -->
        <div class="mt-6 flex flex-col gap-3 print:hidden px-4" data-html2canvas-ignore>
          <button @click="showShareModal = true" class="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-primary-600/20 transition-all flex justify-center items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            {{ isSharing ? 'Memproses...' : 'Kirim / Bagikan' }}
          </button>
          <button @click="router.push('/history')" class="w-full bg-white hover:bg-neutral-50 text-neutral-700 font-bold py-3.5 px-4 rounded-xl shadow-sm border border-neutral-200 transition-all flex justify-center items-center gap-2">
            Kembali ke Riwayat
          </button>
        </div>
      </div>

      <div v-else class="text-center text-neutral-500">
        Transaksi tidak ditemukan
      </div>
    </div>

    <!-- Share Format Modal -->
    <div v-if="showShareModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div class="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" @click="showShareModal = false"></div>
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-xs overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        <div class="p-4 border-b border-neutral-100">
          <h3 class="font-bold text-lg text-center text-neutral-800">Pilih Format Nota</h3>
        </div>
        <div class="p-2">
          <button @click="shareReceipt('jpg')" class="w-full text-left px-4 py-3 hover:bg-primary-50 rounded-xl transition-colors font-medium text-neutral-700 flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            </div>
            Kirim sebagai Gambar (JPG)
          </button>
          <button @click="shareReceipt('pdf')" class="w-full text-left px-4 py-3 hover:bg-primary-50 rounded-xl transition-colors font-medium text-neutral-700 flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            Kirim sebagai Dokumen (PDF)
          </button>
        </div>
        <div class="p-2 border-t border-neutral-100">
          <button @click="showShareModal = false" class="w-full py-2.5 text-sm font-bold text-neutral-500 hover:bg-neutral-50 rounded-xl transition-colors">
            Batal
          </button>
        </div>
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
