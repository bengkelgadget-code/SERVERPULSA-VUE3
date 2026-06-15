import { Capacitor } from '@capacitor/core'
import { Contacts } from '@capacitor-community/contacts'

export function useContacts() {
  async function requestPermissions(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return false
    try {
      const { contacts } = await Contacts.requestPermissions()
      return contacts === 'granted'
    } catch (e) {
      console.error('Contacts permission error:', e)
      return false
    }
  }

  async function pickContact(): Promise<string | null> {
    if (Capacitor.getPlatform() === 'android') {
      try {
        const hasPermission = await requestPermissions()
        if (!hasPermission) {
          alert('Izin membaca kontak diperlukan.')
          return null
        }

        const result = await Contacts.pickContact({
          projection: {
            name: true,
            phones: true
          }
        })

        if (result && result.contact && result.contact.phones && result.contact.phones.length > 0) {
          let phone = result.contact.phones[0].number || ''
          return normalizePhone(phone)
        }
        return null
      } catch (e) {
        console.error('Pick contact error:', e)
        return null
      }
    } else {
      // Fallback for web
      if (!('contacts' in navigator && 'ContactsManager' in window)) {
        alert('Fitur membaca kontak tidak didukung di browser ini.')
        return null
      }
      try {
        const props = ['name', 'tel']
        const opts = { multiple: false }
        const contacts = await (navigator as any).contacts.select(props, opts)
        
        if (contacts.length > 0 && contacts[0].tel && contacts[0].tel.length > 0) {
          let phone = contacts[0].tel[0]
          return normalizePhone(phone)
        }
        return null
      } catch (e) {
        console.error('Web contacts error:', e)
        return null
      }
    }
  }

  function normalizePhone(phone: string): string {
    phone = phone.replace(/\\D/g, '') // remove all non-digits
    if (phone.startsWith('62')) {
      phone = '0' + phone.substring(2)
    } else if (phone.startsWith('+62')) {
      phone = '0' + phone.substring(3)
    }
    return phone
  }

  return {
    pickContact,
    requestPermissions
  }
}
