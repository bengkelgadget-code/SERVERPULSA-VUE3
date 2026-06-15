import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

export function useSpeechToText() {
  const isListening = ref(false)
  const isSupported = ref(false)

  async function checkAvailability() {
    if (Capacitor.getPlatform() !== 'android') return
    try {
      const { available } = await SpeechRecognition.available()
      isSupported.value = available
    } catch (e) {
      console.error('Speech recognition availability error:', e)
    }
  }

  async function checkPermissions(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return false
    try {
      const { speechRecognition } = await SpeechRecognition.checkPermissions()
      if (speechRecognition !== 'granted') {
        const { speechRecognition: req } = await SpeechRecognition.requestPermissions()
        return req === 'granted'
      }
      return true
    } catch (e) {
      console.error('Speech permission error:', e)
      return false
    }
  }

  async function startListening(): Promise<string | null> {
    if (Capacitor.getPlatform() !== 'android') {
      alert('Fitur speech-to-text hanya tersedia di aplikasi Android.')
      return null
    }

    const hasPermission = await checkPermissions()
    if (!hasPermission) {
      alert('Izin mikrofon diperlukan untuk mendengarkan suara.')
      return null
    }

    isListening.value = true
    return new Promise((resolve) => {
      let resolved = false
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          stopListening()
          resolve(null)
        }
      }, 10000) // 10 seconds timeout
      
      SpeechRecognition.start({
        language: 'id-ID',
        maxResults: 1,
        prompt: 'Ucapkan nomor pelanggan',
        partialResults: false
      }).then((result) => {
        resolved = true
        clearTimeout(timeout)
        isListening.value = false
        if (result.matches && result.matches.length > 0) {
          // Process string: remove spaces, take only numbers if it's for phone number
          const text = result.matches[0]
          resolve(text.replace(/[^0-9+]/g, ''))
        } else {
          resolve(null)
        }
      }).catch((e) => {
        resolved = true
        clearTimeout(timeout)
        isListening.value = false
        console.error('Speech recognition error:', e)
        resolve(null)
      })
    })
  }

  async function stopListening(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return
    try {
      await SpeechRecognition.stop()
      isListening.value = false
    } catch (e) {
      console.error('Stop speech recognition error:', e)
    }
  }

  checkAvailability()

  return {
    isListening,
    isSupported,
    startListening,
    stopListening
  }
}
