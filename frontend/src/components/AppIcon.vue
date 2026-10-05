<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ name: string; size?: number }>()
const paths: Record<string, string> = {
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  lock: 'M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4M12 15v2',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  'eye-off': 'M3 3l18 18M10 5a11 11 0 0 1 2 0c7 0 10 7 10 7a16 16 0 0 1-3 4M6 6a16 16 0 0 0-4 6s3 7 10 7a12 12 0 0 0 6-2M10 10a3 3 0 0 0 4 4',
  logout: 'M9 3H4v18h5M9 12h12m-4-4 4 4-4 4',
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  game: 'M6 8h12a4 4 0 0 1 4 4v5a3 3 0 0 1-5 2l-2-2H9l-2 2a3 3 0 0 1-5-2v-5a4 4 0 0 1 4-4ZM7 11v5m-2.5-2.5h5M16 12h.01M19 15h.01',
  members: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8m6 10v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  chart: 'M3 3v18h18M7 16v-4m5 4V7m5 9v-6',
  settings: 'm9 3-.5 2-2 .8-1.8-.5-2 3.4L4 10.2v3.6l-1.3 1.5 2 3.4 1.8-.5 2 .8.5 2h4l.5-2 2-.8 1.8.5 2-3.4L20 13.8v-3.6l1.3-1.5-2-3.4-1.8.5-2-.8-.5-2ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  clock: 'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  left: 'm15 18-6-6 6-6', right: 'm9 6 6 6-6 6', down: 'm6 9 6 6 6-6',
  plus: 'M12 5v14M5 12h14', close: 'm6 6 12 12M6 18 18 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  search: 'm21 21-4.5-4.5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  edit: 'm16 3 5 5-12 12H4v-5ZM13 6l5 5',
  crown: 'm2 7 5 4 5-7 5 7 5-4-3 12H5ZM5 22h14',
  ticket: 'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4ZM13 5v3m0 3v2m0 3v3',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6ZM9 11l2 2 4-4',
}
const d = computed(() => paths[props.name] || paths.members)
</script>
<template><svg :width="size || 20" :height="size || 20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="d" /></svg></template>
