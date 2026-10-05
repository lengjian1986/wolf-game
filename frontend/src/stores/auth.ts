import { defineStore } from 'pinia'
import { ref } from 'vue'
interface User { username: string }
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  async function checkSession() {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) throw new Error('登录服务暂时不可用，请稍后重试。')
    const data = await response.json()
    user.value = data.user
    return user.value
  }
  async function login(username: string, password: string) {
    const response = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || '登录失败，请重试。')
    user.value = data.user
  }
  async function logout() {
    const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    if (!response.ok) throw new Error('退出失败，请重试。')
    user.value = null
  }
  return { user, checkSession, login, logout }
})
