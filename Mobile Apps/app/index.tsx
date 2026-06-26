import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/auth'

export default function Index() {
  const { session, isInitialized, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [])

  if (!isInitialized) {
    return (
      <View className="flex-1 justify-center items-center bg-blue-50">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    )
  }

  if (session) {
    return <Redirect href="/home" />
  }

  return <Redirect href="/login" />
}
