<script setup lang="ts">
import { computed, ref, reactive, nextTick, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import DeleteConfirm from '../components/DeleteConfirm.vue'
import { addCalendarMonth, monthRenewalBase } from '../utils/memberDates.mjs'
import { badgeClass, memberStatus, useDataStore, localDateTime, memberTypes, type Member, type CardType } from '../stores/data'
const store=useDataStore()
const search=ref(''),typeFilter=ref(''),statusFilter=ref(''),tab=ref('会员列表'),month=ref(localDateTime().slice(0,7)),page=ref(1)
const selected=ref<Member|null>(null), showHistory=ref(false),adjustOpen=ref(false),adjustValue=ref(0),confirmUse=ref(false),notice=ref('')
const deleteMemberOpen=ref(false)
const addMemberOpen=ref(false),addError=ref(''),memberNameInput=ref<HTMLInputElement|null>(null)
const newMember=reactive({name:'',type:'月卡' as CardType,total:10,purchased:'',expiry:'',monthMode:'add' as 'add'|'custom'})
const newMemberExpiry=computed(()=>{if(newMember.type!=='月卡'||newMember.monthMode==='custom')return newMember.expiry;try{return addCalendarMonth(newMember.purchased.slice(0,10))}catch{return ''}})
function suggestExpiry(){
  if(newMember.type==='普通会员'){newMember.expiry='';return}
  const date=new Date(`${newMember.purchased.slice(0,10)}T12:00:00`)
  if(!Number.isFinite(date.getTime()))return
  if(newMember.type==='月卡'){newMember.expiry=addCalendarMonth(newMember.purchased.slice(0,10));return}
  date.setDate(date.getDate()+90)
  newMember.expiry=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
async function openAddMember(){
  Object.assign(newMember,{name:'',type:'月卡',total:10,monthMode:'add',purchased:localDateTime().replace(' ','T')})
  suggestExpiry();addError.value='';addMemberOpen.value=true
  await nextTick();memberNameInput.value?.focus()
}
async function saveNewMember(){
  addError.value=''
  try{
    await store.addMember({...newMember,expiry:newMemberExpiry.value,purchased:newMember.purchased.replace('T',' ')})
    search.value='';typeFilter.value='';statusFilter.value='';page.value=1;tab.value='会员列表'
    addMemberOpen.value=false
    toast(`会员 ${newMember.name.trim()} 已添加`)
  }catch(error){addError.value=error instanceof Error?error.message:'添加失败，请重试。'}
}
const typeChangeOpen=ref(false),typeChangeError=ref('')
const typeChange=reactive({type:'普通会员' as CardType,total:10,remaining:10,expiry:'',monthMode:'add' as 'add'|'custom'})
const today=computed(()=>localDateTime().slice(0,10))
const renewalBase=computed(()=>monthRenewalBase(selected.value,today.value))
const changedMonthExpiry=computed(()=>typeChange.monthMode==='custom'?typeChange.expiry:addCalendarMonth(renewalBase.value))
function openTypeChange(){
  const member=selected.value;if(!member)return
  Object.assign(typeChange,{type:member.type,total:member.type==='次卡'?member.total:10,remaining:member.type==='次卡'?member.remaining:10,expiry:member.expiry>=today.value?member.expiry:addCalendarMonth(today.value),monthMode:'add'})
  typeChangeError.value='';typeChangeOpen.value=true
}
function updateChangeType(){
  typeChangeError.value=''
  if(typeChange.type==='次卡'&&selected.value?.type!=='次卡'){typeChange.total=10;typeChange.remaining=10}
  if(typeChange.type!=='普通会员'&&typeChange.expiry<today.value)typeChange.expiry=addCalendarMonth(today.value)
}
async function saveTypeChange(){
  if(!selected.value)return
  typeChangeError.value=''
  try{
    await store.changeMemberType(selected.value.id,{...typeChange})
    typeChangeOpen.value=false
    search.value='';typeFilter.value='';statusFilter.value='';page.value=1
    toast('会员类型与卡片设置已更新')
  }catch(error){typeChangeError.value=error instanceof Error?error.message:'更新失败，请重试。'}
}
const filtered=computed(()=>store.members.filter(m=>(!search.value||m.name.toLowerCase().includes(search.value.toLowerCase()))&&(!typeFilter.value||m.type===typeFilter.value)&&(!statusFilter.value||memberStatus(m)===statusFilter.value)))
const paged=computed(()=>filtered.value.slice((page.value-1)*8,page.value*8))
const stats=computed(()=>[{title:'月卡会员',value:store.members.filter(m=>m.type==='月卡').length,icon:'crown',class:'month'},{title:'次卡会员',value:store.members.filter(m=>m.type==='次卡').length,icon:'ticket',class:'times'},{title:'普通会员',value:store.members.filter(m=>m.type==='普通会员').length,icon:'shield',class:'regular'},{title:'全部会员',value:store.members.length,icon:'members',class:'all'}])
const history=computed(()=>store.records.filter(r=>selected.value&&r.memberId===selected.value.id))
const tabRecords=computed(()=>store.records.filter(r=>r.time.startsWith(month.value)&&(tab.value!=='购买记录'||r.action==='购买')&&(!search.value||r.member.toLowerCase().includes(search.value.toLowerCase()))))
function toast(s:string){notice.value=s;setTimeout(()=>notice.value='',2600)}
function openMember(m:Member){selected.value=m;showHistory.value=false}
function closeMember(){selected.value=null;showHistory.value=false;adjustOpen.value=false;confirmUse.value=false;deleteMemberOpen.value=false;typeChangeOpen.value=false}
async function useOnce(){const m=selected.value;if(!m)return;try{await store.useMember(m.id);confirmUse.value=false;toast('已记录使用 1 次')}catch(e){toast(e instanceof Error?e.message:'操作失败')}}
function openAdjust(){if(!selected.value)return;adjustValue.value=selected.value.remaining;adjustOpen.value=true}
async function saveAdjust(){const m=selected.value;if(!m)return;try{await store.adjustMember(m.id,adjustValue.value);adjustOpen.value=false;toast('剩余次数已调整')}catch(e){toast(e instanceof Error?e.message:'操作失败')}}
async function deleteMember(){
  const member=selected.value
  if(!member)return
  try{await store.deleteMember(member.id);page.value=Math.min(page.value,Math.max(1,Math.ceil(filtered.value.length/8)));closeMember();toast(`会员 ${member.name} 已删除`)}catch(e){toast(e instanceof Error?e.message:'删除失败')}
}
watch(()=>store.members.map(m=>m.id),()=>{if(selected.value&&!store.members.some(m=>m.id===selected.value!.id))closeMember()})
watch(()=>filtered.value.length,()=>{page.value=Math.min(page.value,Math.max(1,Math.ceil(filtered.value.length/8)))})
function onFilter(){page.value=1}
</script>
<template>
  <section class="panel member-panel">
    <div class="section-heading"><div><h1>会员管理</h1><p class="subtitle">查看会员的购卡、剩余次数、使用记录和到期情况</p></div><div class="member-heading-actions"><label class="month-picker" :class="{'records-month':tab!=='会员列表'}"><AppIcon name="calendar" :size="18"/><input v-model="month" type="month" aria-label="记录月份"/></label><button class="btn primary add-member-button" @click="openAddMember"><AppIcon name="plus" :size="17"/>新增会员</button></div></div>
    <div class="stat-grid"><article v-for="stat in stats" :key="stat.title" class="stat-card" :class="stat.class"><div class="stat-icon"><AppIcon :name="stat.icon" :size="26"/></div><div><p>{{stat.title}}</p><strong>{{stat.value}}</strong><span class="stat-unit">人</span></div></article></div>
    <div class="tabs" role="tablist" aria-label="会员记录类型"><button v-for="t in ['会员列表','使用记录','购买记录']" :key="t" role="tab" :aria-selected="tab===t" :class="{active:tab===t}" @click="tab=t;page=1">{{t}}</button></div>
    <div class="filter-row"><label class="search-input"><AppIcon name="search" :size="18"/><input v-model="search" type="search" placeholder="搜索昵称" aria-label="搜索昵称" @input="onFilter"/></label><template v-if="tab==='会员列表'"><select v-model="typeFilter" aria-label="筛选卡种" @change="onFilter"><option value="">全部卡种</option><option v-for="type in memberTypes" :key="type" :value="type">{{type}}</option></select><select v-model="statusFilter" aria-label="筛选状态" @change="onFilter"><option value="">全部状态</option><option>正常</option><option>即将到期</option><option>已用完</option><option>已到期</option></select></template><span v-else class="filter-note">{{month}} · {{tabRecords.length}} 条记录</span></div>
    <template v-if="tab==='会员列表'">
      <div class="table-wrap desktop-member-table"><table class="data-table"><thead><tr><th>昵称</th><th>会员类型</th><th>剩余次数 / 有效期</th><th>状态</th><th class="action-cell">操作</th></tr></thead><tbody><tr v-for="m in paged" :key="m.id"><td class="member-name">{{m.name}}</td><td><span class="badge" :class="badgeClass(m.type)">{{m.type}}{{m.type==='次卡'?`（${m.total}次）`:''}}</span></td><td class="secondary-text">{{m.type==='普通会员'?'无会员卡':m.type==='月卡'?m.expiry+' 到期':`${m.remaining} / ${m.total} 次`}}</td><td><span class="badge" :class="badgeClass(memberStatus(m))">{{memberStatus(m)}}</span></td><td class="action-cell"><button class="btn small" @click="openMember(m)">详情</button></td></tr></tbody></table></div>
      <div class="mobile-member-list"><button v-for="m in paged" :key="m.id" class="member-list-row" @click="openMember(m)"><strong>{{m.name}}</strong><span class="badge" :class="badgeClass(m.type)">{{m.type}}</span><span class="member-balance">{{m.type==='普通会员'?'无会员卡':m.type==='月卡'?m.expiry:`${m.remaining} / ${m.total}`}}</span><span class="badge" :class="badgeClass(memberStatus(m))">{{memberStatus(m)}}</span><AppIcon name="right" :size="14"/></button></div>
      <div v-if="!filtered.length" class="empty-state"><AppIcon name="search" :size="32"/><h3>没有找到匹配的会员</h3><p>尝试其他昵称，或清除筛选条件。</p><button class="btn" @click="search='';typeFilter='';statusFilter=''">清除筛选</button></div>
      <div v-if="filtered.length" class="table-footer"><span>共 {{filtered.length}} 位会员</span><div class="pagination"><button class="icon-button" :disabled="page===1" aria-label="上一页" @click="page--"><AppIcon name="left" :size="16"/></button><span>{{page}} / {{Math.ceil(filtered.length/8)}}</span><button class="icon-button" :disabled="page*8>=filtered.length" aria-label="下一页" @click="page++"><AppIcon name="right" :size="16"/></button></div></div>
    </template>
    <template v-else><div class="table-wrap"><table class="data-table record-table"><thead><tr><th>时间</th><th>昵称</th><th>操作</th><th>备注</th></tr></thead><tbody><tr v-for="r in tabRecords" :key="r.id"><td>{{r.time}}</td><td>{{r.member}}</td><td><span :class="['badge',badgeClass(r.action)]">{{r.action}}</span></td><td>{{r.note}}</td></tr></tbody></table></div><div v-if="!tabRecords.length" class="empty-state"><AppIcon name="calendar" :size="32"/><h3>本月暂无{{tab}}</h3><p>选择其他月份查看历史记录。</p></div></template>
  </section>
  <div v-if="selected" class="dialog-overlay member-detail-overlay" @click.self="closeMember"><section class="dialog member-detail" role="dialog" aria-modal="true" aria-labelledby="member-detail-title"><div class="dialog-heading"><button class="icon-button mobile-back" aria-label="返回会员列表" @click="showHistory?showHistory=false:closeMember()"><AppIcon name="left"/></button><h2 id="member-detail-title">{{showHistory?'使用记录':'会员详情'}}</h2><button class="icon-button desktop-close" aria-label="关闭会员详情" @click="closeMember"><AppIcon name="close"/></button></div><template v-if="!showHistory"><dl class="detail-fields"><div><dt>昵称</dt><dd>{{selected.name}}</dd></div><div><dt>会员类型</dt><dd><span :class="['badge',badgeClass(selected.type)]">{{selected.type}}{{selected.type==='次卡'?`（${selected.total}次）`:''}}</span></dd></div><div v-if="selected.type==='次卡'"><dt>剩余次数</dt><dd>{{selected.remaining}} / {{selected.total}} 次</dd></div><div><dt>{{selected.type==='普通会员'?'登记时间':'购买时间'}}</dt><dd>{{selected.purchased}}</dd></div><div v-if="selected.type!=='普通会员'"><dt>有效期</dt><dd>{{selected.expiry}}</dd></div><div><dt>状态</dt><dd><span :class="['badge',badgeClass(memberStatus(selected))]">{{memberStatus(selected)}}</span></dd></div></dl><div class="detail-buttons"><button v-if="selected.type!=='普通会员'" class="btn primary" :disabled="['已用完','已到期'].includes(memberStatus(selected))" @click="confirmUse=true">使用 1 次</button><button v-if="selected.type==='次卡'" class="btn pale" @click="openAdjust">调整次数</button><button class="btn pale change-member-type" @click="openTypeChange">转换类型 / 续卡</button><button class="history-link" @click="showHistory=true">查看使用记录 <AppIcon name="right" :size="15"/></button><button class="btn danger-outline" @click="deleteMemberOpen=true"><AppIcon name="trash" :size="16"/>删除会员</button></div></template><template v-else><div class="table-wrap"><table class="data-table history-table"><thead><tr><th>时间</th><th>操作</th><th>备注</th></tr></thead><tbody><tr v-for="r in history" :key="r.id"><td>{{r.time}}</td><td><span :class="['badge',badgeClass(r.action)]">{{r.action}}</span></td><td>{{r.note}}</td></tr></tbody></table></div><p v-if="!history.length" class="empty-state">暂无使用记录</p></template></section></div>
  <div v-if="adjustOpen" class="dialog-overlay nested-overlay" @click.self="adjustOpen=false"><section class="dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="adjust-title"><div class="dialog-heading"><h2 id="adjust-title">调整剩余次数</h2><button class="icon-button" aria-label="关闭调整" @click="adjustOpen=false"><AppIcon name="close"/></button></div><form @submit.prevent="saveAdjust"><label for="remaining" class="field-label">{{selected?.name}} · 剩余次数</label><input id="remaining" v-model.number="adjustValue" class="field-input" type="number" min="0" :max="selected?.total" step="1" required/><div class="dialog-actions"><button type="button" class="btn" @click="adjustOpen=false">取消</button><button class="btn primary" :disabled="store.busy">保存</button></div></form></section></div>
  <div v-if="confirmUse" class="dialog-overlay nested-overlay" @click.self="confirmUse=false"><section class="dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="use-title"><div class="dialog-heading"><h2 id="use-title">确认使用会员卡</h2><button class="icon-button" aria-label="关闭确认" @click="confirmUse=false"><AppIcon name="close"/></button></div><p class="confirm-copy">将为 {{selected?.name}} 记录一次使用{{selected?.type==='次卡'?'，并扣除 1 次余额':''}}。</p><div class="dialog-actions"><button class="btn" @click="confirmUse=false">取消</button><button class="btn primary" :disabled="store.busy" @click="useOnce">确认使用</button></div></section></div>
  <div v-if="addMemberOpen" class="dialog-overlay add-member-overlay" @click.self="addMemberOpen=false">
    <section class="dialog add-member-dialog" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
      <div class="dialog-heading"><h2 id="add-member-title">新增会员</h2><button class="icon-button" aria-label="关闭新增会员" @click="addMemberOpen=false"><AppIcon name="close"/></button></div>
      <form class="create-form" @submit.prevent="saveNewMember">
        <label for="new-member-name">玩家昵称<input id="new-member-name" ref="memberNameInput" v-model="newMember.name" class="field-input" placeholder="请输入玩家昵称" required maxlength="24" autocomplete="off"/></label>
        <label for="new-member-type">会员类型<select id="new-member-type" v-model="newMember.type" @change="suggestExpiry"><option v-for="type in memberTypes" :key="type" :value="type">{{type}}</option></select></label>
        <label v-if="newMember.type==='次卡'" for="new-member-total">购买次数<input id="new-member-total" v-model.number="newMember.total" type="number" class="field-input" min="1" max="1000" step="1" required/><span class="field-help">新增次卡的剩余次数等于购买次数。</span></label>
        <label for="new-member-purchased">{{newMember.type==='普通会员'?'登记时间':'购买时间'}}<input id="new-member-purchased" v-model="newMember.purchased" type="datetime-local" class="field-input" required/></label>
        <fieldset v-if="newMember.type==='月卡'" class="month-mode-field"><legend>月卡有效期</legend><div class="month-mode-options"><label><input v-model="newMember.monthMode" type="radio" value="add"/>添加一个月</label><label><input v-model="newMember.monthMode" type="radio" value="custom"/>选择有效期</label></div><p v-if="newMember.monthMode==='add'" class="field-help">从购买日期添加一个自然月，有效期至 {{newMemberExpiry||'请选择购买时间'}}。</p></fieldset>
        <label v-if="newMember.type==='次卡'||(newMember.type==='月卡'&&newMember.monthMode==='custom')" for="new-member-expiry">有效期至<input id="new-member-expiry" v-model="newMember.expiry" type="date" class="field-input" :min="newMember.purchased.slice(0,10)" required/></label>
        <p v-if="addError" class="form-error" role="alert">{{addError}}</p>
        <div class="dialog-actions"><button type="button" class="btn" @click="addMemberOpen=false">取消</button><button class="btn primary" :disabled="store.busy">添加会员</button></div>
      </form>
    </section>
  </div>
  <div v-if="typeChangeOpen&&selected" class="dialog-overlay nested-overlay" @click.self="typeChangeOpen=false">
    <section class="dialog type-change-dialog" role="dialog" aria-modal="true" aria-labelledby="type-change-title">
      <div class="dialog-heading"><h2 id="type-change-title">转换类型 / 续卡</h2><button class="icon-button" aria-label="关闭类型转换" @click="typeChangeOpen=false"><AppIcon name="close"/></button></div>
      <p class="type-change-member">{{selected.name}} · 当前为{{selected.type}}</p>
      <form class="create-form" @submit.prevent="saveTypeChange">
        <label for="change-member-type">会员类型<select id="change-member-type" v-model="typeChange.type" @change="updateChangeType"><option v-for="type in memberTypes" :key="type" :value="type">{{type}}</option></select></label>
        <template v-if="typeChange.type==='次卡'"><label for="change-total">总次数<input id="change-total" v-model.number="typeChange.total" type="number" class="field-input" min="1" max="1000" step="1" required/></label><label for="change-remaining">剩余次数<input id="change-remaining" v-model.number="typeChange.remaining" type="number" class="field-input" min="0" :max="typeChange.total" step="1" required/></label></template>
        <fieldset v-if="typeChange.type==='月卡'" class="month-mode-field"><legend>月卡有效期</legend><div class="month-mode-options"><label><input v-model="typeChange.monthMode" type="radio" value="add"/>添加一个月</label><label><input v-model="typeChange.monthMode" type="radio" value="custom"/>选择有效期</label></div><p v-if="typeChange.monthMode==='add'" class="field-help">从 {{renewalBase}} 添加一个自然月，有效期至 {{changedMonthExpiry}}。</p></fieldset>
        <label v-if="typeChange.type==='次卡'||(typeChange.type==='月卡'&&typeChange.monthMode==='custom')" for="change-expiry">有效期至<input id="change-expiry" v-model="typeChange.expiry" type="date" class="field-input" :min="today" required/></label>
        <p v-if="typeChange.type!==selected.type" class="field-help">转换为{{typeChange.type}}后，原卡片的次数和有效期将替换为新设置，历史记录保留。</p>
        <p v-if="typeChangeError" class="form-error" role="alert">{{typeChangeError}}</p>
        <div class="dialog-actions"><button type="button" class="btn" @click="typeChangeOpen=false">取消</button><button class="btn primary" :disabled="store.busy">保存设置</button></div>
      </form>
    </section>
  </div>
  <DeleteConfirm :busy="store.busy" v-if="deleteMemberOpen&&selected" title="删除会员" :message="`确认删除会员「${selected.name}」吗？会员档案删除后无法恢复，历史使用与购买记录将保留。`" @cancel="deleteMemberOpen=false" @confirm="deleteMember"/>
  <div v-if="notice" class="toast" role="status">{{notice}}</div>
</template>
