<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import AppIcon from './AppIcon.vue'
defineProps<{ title: string; message: string; busy?: boolean }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()
const cancelButton = ref<HTMLButtonElement | null>(null)
const previousFocus = document.activeElement as HTMLElement | null
onMounted(() => cancelButton.value?.focus())
onUnmounted(() => { if (previousFocus?.isConnected) previousFocus.focus() })
</script>
<template>
  <div class="dialog-overlay nested-overlay" @click.self="emit('cancel')">
    <section class="dialog compact-dialog delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-message">
      <div class="dialog-heading">
        <h2 id="delete-confirm-title">{{title}}</h2>
        <button class="icon-button" aria-label="关闭删除确认" @click="emit('cancel')"><AppIcon name="close"/></button>
      </div>
      <p id="delete-confirm-message" class="confirm-copy">{{message}}</p>
      <div class="dialog-actions">
        <button ref="cancelButton" class="btn" @click="emit('cancel')">取消</button>
        <button class="btn danger" :disabled="busy" @click="emit('confirm')">确认删除</button>
      </div>
    </section>
  </div>
</template>
