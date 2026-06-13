<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  onRefresh: () => Promise<void>
}>()

const pullContainer = ref<HTMLElement | null>(null)
const startY = ref(0)
const currentY = ref(0)
const refreshing = ref(false)
const distance = ref(0)
const maxDistance = 80 // max pull distance in px

const handleTouchStart = (e: TouchEvent) => {
  if (window.scrollY === 0) {
    startY.value = e.touches[0].clientY
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (startY.value > 0 && window.scrollY === 0 && !refreshing.value) {
    currentY.value = e.touches[0].clientY
    const diff = currentY.value - startY.value
    if (diff > 0) {
      // Prevent default scrolling when pulling down
      if (e.cancelable) e.preventDefault()
      // Adding resistance to the pull
      distance.value = Math.min(diff * 0.4, maxDistance)
    }
  }
}

const handleTouchEnd = async () => {
  if (distance.value > 50 && !refreshing.value) {
    refreshing.value = true
    distance.value = 50 // Keep the spinner visible
    try {
      await props.onRefresh()
    } finally {
      refreshing.value = false
      distance.value = 0
    }
  } else {
    distance.value = 0
  }
  startY.value = 0
  currentY.value = 0
}

onMounted(() => {
  if (pullContainer.value) {
    pullContainer.value.addEventListener('touchstart', handleTouchStart, { passive: true })
    pullContainer.value.addEventListener('touchmove', handleTouchMove, { passive: false })
    pullContainer.value.addEventListener('touchend', handleTouchEnd)
  }
})

onUnmounted(() => {
  if (pullContainer.value) {
    pullContainer.value.removeEventListener('touchstart', handleTouchStart)
    pullContainer.value.removeEventListener('touchmove', handleTouchMove)
    pullContainer.value.removeEventListener('touchend', handleTouchEnd)
  }
})
</script>

<template>
  <div ref="pullContainer" class="relative w-full h-full">
    <!-- Refresh Indicator -->
    <div 
      class="absolute left-0 right-0 flex justify-center z-50 overflow-hidden pointer-events-none transition-all duration-300 ease-out"
      :style="{ 
        height: `${distance}px`,
        opacity: distance / maxDistance 
      }"
    >
      <div 
        class="mt-4 bg-white shadow-md rounded-full w-8 h-8 flex items-center justify-center transition-transform"
        :class="{ 'animate-spin': refreshing }"
        :style="{ transform: `rotate(${distance * 4}deg)` }"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-600">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
      </div>
    </div>

    <!-- Content slot -->
    <div 
      class="transition-transform duration-300 ease-out h-full"
      :style="{ transform: `translateY(${distance}px)` }"
    >
      <slot></slot>
    </div>
  </div>
</template>
