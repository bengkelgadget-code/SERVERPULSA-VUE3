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

    const isOwner = data.user_id === user?.id
    const isStaffWhoMadeIt = data.staff_id === user?.id
    const isAdmin = profile?.role === 'superadmin' || profile?.role === 'admin'
    const isStaffUnderAdmin = profile?.role === 'staff' && profile?.admin_id === data.user_id

    if (!isOwner && !isStaffWhoMadeIt && !isAdmin && !isStaffUnderAdmin) {
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
  if (route.query.share === 'true') {
    setTimeout(() => {
      showShareModal.value = true
    }, 500)
  }
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

// Parse SN/REF data into structured parts for clean display (skip NAMA - already shown as NAMA AKUN)
const snParts = computed(() => {
  const raw = trx.value?.sn || trx.value?.ref_id || ''
  const result: { label: string; value: string }[] = []

  // Try to parse "A/N name | SN: sn_value" format
  if (raw.includes('A/N ') && raw.includes(' | SN: ')) {
    const parts = raw.split(' | SN: ')
    if (parts[1]) result.push({ label: 'SN', value: parts[1] })
  }
  // Try to parse "Nama: x, No: y, Reff: z" format
  else if (raw.includes('Nama:') && raw.includes('Reff:')) {
    const noMatch = raw.match(/No:\s*([^,]+)/)
    const reffMatch = raw.match(/Reff:\s*(.+)/)
    if (noMatch) result.push({ label: 'NO', value: noMatch[1].trim() })
    if (reffMatch) result.push({ label: 'REFF', value: reffMatch[1].trim() })
  }
  // Fallback: show raw as single line
  else {
    result.push({ label: 'SN / REF', value: raw })
  }
  
  return result
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
  
  // Wait for modal to close and UI to settle
  await new Promise(r => setTimeout(r, 300))
  
  try {
    // Clone the receipt element to avoid Tailwind CSS color function issues
    const clone = receiptRef.value.cloneNode(true) as HTMLElement
    clone.style.position = 'fixed'
    clone.style.left = '-9999px'
    clone.style.top = '0'
    clone.style.width = receiptRef.value.offsetWidth + 'px'
    clone.style.backgroundColor = '#ffffff'
    clone.style.color = '#000000'
    clone.style.fontFamily = 'monospace'
    clone.style.fontSize = '12px'
    clone.style.lineHeight = '1.3'
    clone.style.padding = '24px'
    clone.style.border = 'none'
    clone.style.boxShadow = 'none'
    
    // Remove any Tailwind classes that use modern CSS color functions
    clone.querySelectorAll('*').forEach(el => {
      const htmlEl = el as HTMLElement
      htmlEl.className = ''
      htmlEl.style.color = '#000000'
      htmlEl.style.backgroundColor = 'transparent'
    })
    
    document.body.appendChild(clone)
    
    const canvas = await html2canvas(clone, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })
    
    document.body.removeChild(clone)

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
    <!-- Header -->
    <div class="bg-primary-600 text-white p-4 flex items-center justify-between shadow-sm sticky top-0 z-10 print:hidden">
      <div class="flex items-center gap-4">
        <button @click="router.back()" class="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 class="text-xl font-bold">Nota Transaksi</h1>
      </div>
      <button @click="printReceipt" class="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors" title="Cetak">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      </button>
    </div>

    <div class="flex-1 p-4 flex items-center justify-center print:p-0 print:bg-white">
      <div v-if="loading" class="animate-spin w-8 h-8 border-[3px] border-primary-600 border-t-transparent rounded-full print:hidden"></div>
      
      <!-- THERMAL RECEIPT CONTAINER -->
      <div v-else-if="trx" class="w-full max-w-[320px] mx-auto pb-20 print:pb-0">
        <div ref="receiptRef" class="receipt-container bg-white p-6 shadow-lg font-mono text-sm leading-tight border border-neutral-200" style="color: #000; background: #fff;">
          
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
            <div class="flex"><span class="w-24 shrink-0">IDPEL</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ trx.customer_no }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">NAMA</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ plnData?.nama }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">TRF/DAYA</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ plnData?.tarif }}/{{ plnData?.daya }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">NOMINAL</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ formatRp(trx.products?.harga_modal || 0) }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">PPN</span><span class="mr-2">:</span><span class="flex-1 break-words">RP. 0,00</span></div>
            <div class="flex"><span class="w-24 shrink-0">ANGS/MAT</span><span class="mr-2">:</span><span class="flex-1 break-words">RP. 0,00/0,00</span></div>
            <div class="flex"><span class="w-24 shrink-0">RP TOKEN</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ formatRp(trx.products?.harga_modal || 0) }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">JML KWH</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ plnData?.kwh }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">BIAYA ADM</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ formatRp(trx.harga_jual - (trx.products?.harga_modal || 0)) }}</span></div>
            <div class="flex font-bold"><span class="w-24 shrink-0">TOTAL BAYAR</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ formatRp(trx.harga_jual) }}</span></div>
          </div>

          <!-- NON-PLN FORMAT -->
          <div v-else class="space-y-1 mb-4">
            <div class="flex"><span class="w-24 shrink-0">PRODUK</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ trx.products?.product_name }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">NO TUJUAN</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ trx.customer_no }}</span></div>
            <div v-if="trx.customer_name" class="flex"><span class="w-24 shrink-0">NAMA AKUN</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ trx.customer_name }}</span></div>
            <!-- SN / REF - each part on its own line -->
            <template v-if="snParts.length > 0 && snParts[0].label">
              <div v-for="(part, i) in snParts" :key="i" class="flex">
                <span class="w-24 shrink-0">{{ part.label }}</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ part.value }}</span>
              </div>
            </template>
            <div v-else class="flex"><span class="w-24 shrink-0">SN / REF</span><span class="mr-2">:</span><span class="flex-1 break-all">{{ trx.sn || trx.ref_id }}</span></div>
            <div class="flex mt-2 font-bold"><span class="w-24 shrink-0">TOTAL BAYAR</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ formatRp(trx.harga_jual) }}</span></div>
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

        <!-- Action Buttons -->
        <div class="mt-6 flex flex-col gap-3 print:hidden px-4" data-html2canvas-ignore>
          <button @click="printReceipt" class="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-primary-600/20 transition-all flex justify-center items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Cetak / Print
          </button>
          <button @click="showShareModal = true" :disabled="isSharing" class="w-full bg-white hover:bg-neutral-50 text-neutral-700 font-bold py-3.5 px-4 rounded-xl shadow-sm border border-neutral-200 transition-all flex justify-center items-center gap-2 disabled:opacity-50">
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
    <Teleport to="body">
      <div v-if="showShareModal" class="fixed inset-0 z-[9999] flex items-center justify-center p-4 print:hidden">
        <div class="absolute inset-0 bg-black/50" @click="showShareModal = false"></div>
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden relative z-10">
          <div class="p-4 border-b border-neutral-100">
            <h3 class="font-bold text-lg text-center text-neutral-800">Pilih Format Nota</h3>
          </div>
          <div class="p-2">
            <button @click="shareReceipt('jpg')" :disabled="isSharing" class="w-full text-left px-4 py-3 hover:bg-neutral-100 rounded-xl transition-colors font-medium text-neutral-700 flex items-center gap-3 disabled:opacity-50">
              <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              </div>
              Kirim sebagai Gambar (JPG)
            </button>
            <button @click="shareReceipt('pdf')" :disabled="isSharing" class="w-full text-left px-4 py-3 hover:bg-neutral-100 rounded-xl transition-colors font-medium text-neutral-700 flex items-center gap-3 disabled:opacity-50">
              <div class="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </div>
              Kirim sebagai Dokumen (PDF)
            </button>
          </div>
          <div class="p-2 border-t border-neutral-100">
            <button @click="showShareModal = false" :disabled="isSharing" class="w-full py-2.5 text-sm font-bold text-neutral-500 hover:bg-neutral-50 rounded-xl transition-colors disabled:opacity-50">
              Batal
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.receipt-container {
  background-color: #ffffff !important;
  color: #000000 !important;
}
.receipt-container * {
  color: #000000 !important;
}
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
