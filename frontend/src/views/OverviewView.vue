<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useDataStore, memberStatus } from '../stores/data'
const store=useDataStore(),route=useRoute()
const stats=computed(()=>[{label:'全部会员',value:store.members.length,icon:'members'},{label:'游戏场次',value:store.games.length,icon:'game'},{label:'即将到期',value:store.members.filter(m=>memberStatus(m)==='即将到期').length,icon:'calendar'}])
</script>
<template><section class="panel overview-panel"><div class="section-heading"><div><h1>{{route.path==='/statistics'?'数据统计':'店铺工作台'}}</h1><p class="subtitle">{{store.shop}} · 会员与游戏概览</p></div></div><div class="stat-grid"><article v-for="s in stats" :key="s.label" class="stat-card times"><div class="stat-icon"><AppIcon :name="s.icon" :size="26"/></div><div><p>{{s.label}}</p><strong>{{s.value}}</strong></div></article></div><div class="overview-links"><RouterLink to="/members"><AppIcon name="members"/><div><strong>会员管理</strong><p>查看会员卡、剩余次数和使用记录</p></div><AppIcon name="right"/></RouterLink><RouterLink to="/games"><AppIcon name="game"/><div><strong>游戏记录</strong><p>查看场次和玩家出勤情况</p></div><AppIcon name="right"/></RouterLink></div><p class="form-hint">数据由服务器同步，会员与对局记录在手机和电脑上共用。</p></section></template>
