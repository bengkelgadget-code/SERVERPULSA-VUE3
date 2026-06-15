import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePrinterStore = defineStore('printer', () => {
  const connectedAddress = ref<string | null>(localStorage.getItem('printer_address'))
  const connectedName = ref<string | null>(localStorage.getItem('printer_name'))
  const isConnected = ref(false)

  function saveDevice(address: string, name: string) {
    connectedAddress.value = address
    connectedName.value = name
    localStorage.setItem('printer_address', address)
    localStorage.setItem('printer_name', name)
    isConnected.value = true
  }

  function clearDevice() {
    connectedAddress.value = null
    connectedName.value = null
    localStorage.removeItem('printer_address')
    localStorage.removeItem('printer_name')
    isConnected.value = false
  }

  return {
    connectedAddress,
    connectedName,
    isConnected,
    saveDevice,
    clearDevice
  }
})
