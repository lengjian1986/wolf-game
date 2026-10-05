<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useAuthStore } from '../stores/auth'
const route=useRoute(), router=useRouter(), auth=useAuthStore()
const username=ref(''),password=ref(''),showPassword=ref(false),loading=ref(false),error=ref('')
async function submit(){
  if(loading.value)return
  error.value='';loading.value=true
  try{
    await auth.login(username.value.trim(),password.value)
    password.value=''
    const redirect=typeof route.query.redirect==='string'?route.query.redirect:'/members'
    await router.replace(redirect.startsWith('/')&&!redirect.startsWith('//')&&!redirect.startsWith('/login')?redirect:'/members')
  }catch(e){error.value=e instanceof TypeError?'无法连接登录服务，请稍后重试。':e instanceof Error?e.message:'登录失败，请稍后重试。'}
  finally{loading.value=false}
}
</script>
<template>
  <main class="login-page">
    <section class="login-brand-panel"><div class="login-brand"><span class="wolf-logo"></span><div><strong>狼人杀</strong><span>店铺管理系统</span></div></div><div class="login-intro"><span class="login-eyebrow">STORE MANAGEMENT</span><h1>把店铺日常，<br/>管理得井井有条。</h1><p>会员、场次与出勤记录，<br/>一个工作台轻松掌握。</p><div class="login-features"><span><AppIcon name="members"/>会员管理</span><span><AppIcon name="game"/>游戏记录</span><span><AppIcon name="chart"/>数据统计</span></div></div><p class="login-brand-footer">狼人杀 · 店铺管理工作台</p></section>
    <section class="login-form-panel"><div class="login-card"><div class="login-mobile-brand"><span class="wolf-logo"></span><strong>狼人杀</strong><span>店铺管理系统</span></div><div class="login-heading"><span class="eyebrow">欢迎回来</span><h2>登录店铺工作台</h2><p>请输入你的账号和密码</p></div><form class="login-form" @submit.prevent="submit"><label for="login-username">账号</label><div class="login-input"><AppIcon name="members" :size="19"/><input id="login-username" v-model="username" name="username" placeholder="请输入账号" autocomplete="username" required maxlength="100" :disabled="loading" autofocus/></div><label for="login-password">密码</label><div class="login-input"><AppIcon name="lock" :size="19"/><input id="login-password" v-model="password" name="password" :type="showPassword?'text':'password'" placeholder="请输入密码" autocomplete="current-password" required maxlength="256" :disabled="loading"/><button type="button" class="password-toggle" :aria-label="showPassword?'隐藏密码':'显示密码'" :aria-pressed="showPassword" @click="showPassword=!showPassword"><AppIcon :name="showPassword?'eye-off':'eye'" :size="19"/></button></div><p v-if="error" class="login-error" role="alert">{{error}}</p><button class="btn primary login-submit" :disabled="loading">{{loading?'正在登录…':'登 录'}}<AppIcon v-if="!loading" name="right" :size="18"/></button></form><div class="login-note"><AppIcon name="shield" :size="16"/><span>仅限店铺授权人员访问</span></div></div><p class="login-footer">狼人杀会员管理系统</p></section>
  </main>
</template>
