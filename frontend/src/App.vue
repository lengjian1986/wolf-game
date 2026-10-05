<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './components/AppIcon.vue'
import { useDataStore } from './stores/data'
import { useAuthStore } from './stores/auth'
const route=useRoute(), router=useRouter(), store=useDataStore()
const auth=useAuthStore(),loggingOut=ref(false)
watch(()=>auth.user,user=>{if(user)store.startSync();else store.stopSync()},{immediate:true})
const menuOpen=ref(false), settingsOpen=ref(false), shopDraft=ref(''), notice=ref('')
const nav=[{label:'首页',path:'/overview',icon:'home'},{label:'会员管理',path:'/members',icon:'shield'},{label:'游戏记录',path:'/games',icon:'game'},{label:'数据统计',path:'/statistics',icon:'chart'}]
const active=computed(()=>route.path.startsWith('/members')?'/members':route.path)
async function logout(){
  if(loggingOut.value)return
  loggingOut.value=true
  try{await auth.logout();menuOpen.value=false;settingsOpen.value=false;await router.replace('/login')}
  catch{notice.value='退出失败，请重试。';setTimeout(()=>notice.value='',2500)}
  finally{loggingOut.value=false}
}
function openSettings(){shopDraft.value=store.shop;settingsOpen.value=true;menuOpen.value=false}
async function saveSettings(){if(!shopDraft.value.trim())return;try{await store.saveSettings(shopDraft.value.trim());settingsOpen.value=false;notice.value='店铺名称已保存'}catch(e){notice.value=e instanceof Error?e.message:'保存失败'}setTimeout(()=>notice.value='',2500)}
function modalKeyboard(event:KeyboardEvent){
  const dialogs=[...document.querySelectorAll<HTMLElement>('.dialog-overlay')]
  const top=dialogs.at(-1)
  if(event.key==='Escape'){
    if(top){const close=top.querySelector<HTMLButtonElement>('button[aria-label^="关闭"],button[aria-label^="返回"]');close?.click()}else menuOpen.value=false
  }
  if(event.key==='Tab'&&top){
    const controls=[...top.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(e=>e.offsetParent!==null)
    const first=controls[0],last=controls.at(-1)
    if(!first||!last)return
    if(event.shiftKey&&(document.activeElement===first||!top.contains(document.activeElement))){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&(document.activeElement===last||!top.contains(document.activeElement))){event.preventDefault();first.focus()}
  }
}
onMounted(()=>document.addEventListener('keydown',modalKeyboard))
onUnmounted(()=>{document.removeEventListener('keydown',modalKeyboard);store.stopSync()})
function go(path:string){router.push(path);menuOpen.value=false}
</script>
<template>
  <RouterView v-if="route.meta.public"/>
  <div v-else-if="auth.user" class="app-shell">
    <div v-if="menuOpen" class="nav-scrim" @click="menuOpen=false"></div>
    <aside class="sidebar" :class="{open:menuOpen}">
      <a class="brand" href="/members" @click.prevent="go('/members')"><span class="wolf-logo"></span><div><strong>狼人杀</strong><span>店铺管理系统</span></div></a>
      <nav aria-label="主导航"><button v-for="item in nav" :key="item.path" class="nav-item" :class="{active:active===item.path}" @click="go(item.path)"><AppIcon :name="item.icon" :size="21"/><span>{{item.label}}</span></button><button class="nav-item" @click="openSettings"><AppIcon name="settings" :size="21"/><span>系统设置</span></button><button class="nav-item mobile-logout" :disabled="loggingOut" @click="logout"><AppIcon name="logout" :size="21"/><span>退出登录</span></button></nav>
      <div class="sidebar-foot"><span class="online-dot"></span>店铺管理工作台</div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="mobile-brand"><span class="wolf-logo"></span><strong>狼人杀</strong><span>店铺管理</span></div><span class="desktop-breadcrumb">店铺工作台 <span>/</span> {{route.meta.title || '会员管理'}}</span><div class="topbar-actions"><button class="shop-switch" @click="openSettings">{{store.shop}}<AppIcon name="down" :size="15"/></button><span class="account-name">{{auth.user?.username}}</span><button class="icon-button desktop-logout" :disabled="loggingOut" aria-label="退出登录" title="退出登录" @click="logout"><AppIcon name="logout" :size="20"/></button><button class="icon-button mobile-menu" aria-label="打开导航菜单" @click="menuOpen=!menuOpen"><AppIcon name="menu" :size="24"/></button></div></header>
      <main class="page-area"><p v-if="store.error" class="data-error" role="alert">{{store.error}} <button class="btn small" @click="store.load">重新加载</button></p><p v-if="!store.loaded&&!store.error" class="empty-state">正在加载数据…</p><RouterView v-if="store.loaded"/></main>
    </div>
    <div v-if="settingsOpen" class="dialog-overlay" @click.self="settingsOpen=false"><section class="dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div class="dialog-heading"><h2 id="settings-title">店铺设置</h2><button class="icon-button" aria-label="关闭设置" @click="settingsOpen=false"><AppIcon name="close"/></button></div><form @submit.prevent="saveSettings"><label class="field-label" for="shop-name">店铺名称</label><input id="shop-name" v-model="shopDraft" required maxlength="24" class="field-input"/><p class="form-hint">设置保存后会同步到其他设备。</p><div class="dialog-actions"><button type="button" class="btn" @click="settingsOpen=false">取消</button><button class="btn primary" :disabled="store.busy">保存</button></div></form></section></div>
    <div v-if="notice" class="toast" role="status">{{notice}}</div>
  </div>
</template>
