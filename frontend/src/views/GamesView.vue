<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import DeleteConfirm from '../components/DeleteConfirm.vue'
import { badgeClass, referenceDate, localDateTime, useDataStore, type Game, type Seat, type Attendance } from '../stores/data'
const store=useDataStore(),selectedId=ref<number|null>(null),seatDraft=ref<Seat|null>(null),statusOpen=ref(false),notice=ref(''),createOpen=ref(false)
const gameToDelete=ref<Game|null>(null)
const playerToDelete=ref<{gameId:number;number:number;name:string}|null>(null)
const seatGameId=ref<number|null>(null)
const seatGame=computed(()=>store.games.find(g=>g.id===seatGameId.value))
const addingSeat=ref(false),seatMemberId=ref(''),legacyPlayerName=ref(''),seatError=ref('')
const draft=reactive({date:referenceDate,start:'13:00',end:'15:30',capacity:12})
const sortedGames=computed(()=>[...store.games].sort((a,b)=>b.date.localeCompare(a.date)||b.start.localeCompare(a.start)||b.id-a.id))
const selected=computed(()=>store.games.find(g=>g.id===selectedId.value))
const weekday=computed(()=>selected.value?new Date(`${selected.value.date}T12:00:00`).toLocaleDateString('zh-CN',{weekday:'long'}):'')
function openGame(g:Game){selectedId.value=g.id}
function openCreate(){draft.date=localDateTime().slice(0,10);createOpen.value=true}
const availableMembers=computed(()=>store.members.filter(m=>!(seatDraft.value?seatGame.value:selected.value)?.seats.some(s=>s.number!==seatDraft.value?.number&&(s.memberId===m.id||(!s.memberId&&s.name===m.name)))))
function openSeat(s:Seat){
  seatGameId.value=selected.value?.id||null;addingSeat.value=false;seatDraft.value={...s};statusOpen.value=false;seatError.value=''
  const member=store.members.find(m=>s.memberId?m.id===s.memberId:m.name===s.name)
  seatMemberId.value=member?String(member.id):'legacy'
  legacyPlayerName.value=member?'':s.name
}
function setSeatMember(){
  if(!seatDraft.value)return
  const member=store.members.find(m=>String(m.id)===seatMemberId.value)
  seatDraft.value.name=member?.name||(seatMemberId.value==='legacy'?legacyPlayerName.value:'')
  seatDraft.value.memberId=member?.id
  seatError.value=''
}
function toast(s:string){notice.value=s;setTimeout(()=>notice.value='',2600)}
async function saveSeat(){
  if(!seatDraft.value||!seatGame.value)return
  seatError.value=''
  const member=availableMembers.value.find(m=>String(m.id)===seatMemberId.value)
  if(!member&&(addingSeat.value||seatMemberId.value!=='legacy')){seatError.value='请从会员列表选择一位尚未加入本局的玩家。';return}
  const role=seatDraft.value.role.trim()
  if(role.length>24){seatError.value='身份最多填写 24 个字符。';return}
  const saved:Seat={...seatDraft.value,role,name:member?.name||legacyPlayerName.value,memberId:member?.id}
  try{await store.saveSeat(seatGame.value.id,saved,addingSeat.value)}
  catch(e){seatError.value=e instanceof Error?e.message:'保存失败';return}
  seatDraft.value=null;statusOpen.value=false
  toast(addingSeat.value?'会员玩家已添加':'座位信息已保存')
}
function requestDeletePlayer(){
  if(addingSeat.value||!seatDraft.value||!seatGame.value)return
  const seat=seatGame.value.seats.find(s=>s.number===seatDraft.value!.number)
  if(seat)playerToDelete.value={gameId:seatGame.value.id,number:seat.number,name:seat.name}
}
async function deletePlayer(){
  const target=playerToDelete.value
  if(!target)return
  try{await store.deleteSeat(target.gameId,target.number);playerToDelete.value=null;seatDraft.value=null;statusOpen.value=false;toast(`${target.name} 已从本局移除`)}catch(e){toast(e instanceof Error?e.message:'删除失败')}
}
async function createGame(){
  const existing=new Set(store.games.map(g=>g.id))
  try{await store.createGame({...draft});const game=store.games.find(g=>!existing.has(g.id));selectedId.value=game?.id||null;createOpen.value=false;toast('游戏场次已创建')}catch(e){toast(e instanceof Error?e.message:'创建失败')}
}
async function deleteGame(){
  const game=gameToDelete.value
  if(!game)return
  try{await store.deleteGame(game.id);gameToDelete.value=null;selectedId.value=null;seatDraft.value=null;statusOpen.value=false;toast(`第${game.id}局游戏已删除`)}catch(e){toast(e instanceof Error?e.message:'删除失败')}
}
function addSeat(){
  if(!selected.value||selected.value.seats.length>=selected.value.capacity)return
  const used=new Set(selected.value.seats.map(s=>s.number));let number=1;while(used.has(number))number++
  seatGameId.value=selected.value.id;addingSeat.value=true;seatMemberId.value='';legacyPlayerName.value='';seatError.value='';statusOpen.value=false
  seatDraft.value={number,name:'',role:'',arrival:selected.value.start,status:'准时',note:''}
}
const pendingStatus=ref<Attendance>('准时')
function openStatus(){if(!seatDraft.value)return;pendingStatus.value=seatDraft.value.status;statusOpen.value=true}
function confirmStatus(){if(seatDraft.value)seatDraft.value.status=pendingStatus.value;statusOpen.value=false}
watch(()=>store.games.map(g=>g.id),()=>{if(seatDraft.value&&!seatGame.value){seatDraft.value=null;statusOpen.value=false;playerToDelete.value=null;toast('该对局已删除')}})
const attendanceOptions:Attendance[]=['准时','迟到','早退']
</script>
<template>
  <div class="games-layout games-records-layout" :class="{'show-mobile-detail':selected}">
    <section v-if="!selected" class="panel games-list-panel"><div class="section-heading"><div><h1>游戏记录</h1><p class="subtitle">全部游戏场次按时间从新到旧排列，点击查看人员配置和出勤情况</p></div><button class="btn primary create-desktop" @click="openCreate"><AppIcon name="plus" :size="18"/>新增游戏场次</button></div>
      <div class="table-wrap desktop-games-table"><table class="data-table games-table"><thead><tr><th>场次</th><th>游戏日期</th><th>开始时间</th><th>结束时间</th><th>游戏人数</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="g in sortedGames" :key="g.id"><td>第{{g.id}}局</td><td>{{g.date}}</td><td>{{g.start}}</td><td>{{g.end}}</td><td>{{g.seats.length}} / {{g.capacity}}</td><td><span :class="['badge',badgeClass(g.state)]">{{g.state}}</span></td><td><button class="btn" @click="openGame(g)">详情</button></td></tr></tbody></table></div>
      <div class="mobile-game-list"><button v-for="g in sortedGames" :key="g.id" class="game-card" :class="{running:g.state==='进行中'}" @click="openGame(g)"><div><strong>第{{g.id}}局</strong><p>{{g.date}}</p><p>{{g.start}} ～ {{g.end}}</p></div><span>{{g.seats.length}} / {{g.capacity}}</span><span :class="['badge',badgeClass(g.state)]">{{g.state}}</span><AppIcon name="right" :size="16"/></button></div>
      <div v-if="!sortedGames.length" class="empty-state"><AppIcon name="calendar" :size="34"/><h3>还没有游戏记录</h3><p>新增一场游戏，开始记录店铺活动。</p></div><button class="btn primary mobile-create" @click="openCreate"><AppIcon name="plus"/>新增游戏场次</button>
    </section>
    <section v-if="selected" class="panel game-detail-panel"><div class="section-heading"><h2><button class="icon-button" aria-label="返回游戏记录" @click="selectedId=null"><AppIcon name="left"/></button>第{{selected.id}}局 详情</h2><div class="game-heading-actions"><button class="btn edit-game-button" @click="selected.seats.length?openSeat(selected.seats[0]!):addSeat()"><AppIcon name="edit" :size="16"/>编辑</button><button class="btn danger-outline delete-game-button" @click="gameToDelete=selected"><AppIcon name="trash" :size="16"/>删除</button></div></div><div class="game-meta"><span><AppIcon name="calendar" :size="16"/>{{selected.date}}（{{weekday}}）</span><span><AppIcon name="clock" :size="16"/>{{selected.start}} ～ {{selected.end}}</span><span><AppIcon name="game" :size="16"/>{{selected.capacity}}人局 · 标准板子</span></div>
      <div class="table-wrap seat-table-wrap"><table class="data-table seat-table"><thead><tr><th>座位号</th><th>玩家昵称</th><th>身份</th><th>到场时间</th><th>状态</th><th class="seat-note">备注</th></tr></thead><tbody><tr v-for="s in selected.seats" :key="s.number" tabindex="0" role="button" :aria-label="`编辑 ${s.name} 的座位信息`" @click="openSeat(s)" @keydown.enter.prevent="openSeat(s)" @keydown.space.prevent="openSeat(s)"><td>{{s.number}}</td><td>{{s.name}}</td><td><span :class="['badge',badgeClass(s.role)]" :title="s.role">{{s.role || '-'}}</span></td><td>{{s.arrival}}</td><td><span :class="['badge',badgeClass(s.status)]">{{s.status}}</span></td><td class="seat-note secondary-text">{{s.note||'-'}}</td></tr></tbody></table></div><div v-if="!selected.seats.length" class="empty-state"><AppIcon name="members" :size="32"/><h3>暂无玩家</h3><p>为这场游戏添加第一位玩家。</p></div><div class="detail-table-footer"><span>点击玩家行可编辑座位信息</span><button v-if="selected.seats.length<selected.capacity" class="btn small" @click="addSeat"><AppIcon name="plus" :size="14"/>添加玩家</button></div>
    </section>
  </div>
  <div v-if="seatDraft" class="dialog-overlay seat-edit-overlay" @click.self="seatDraft=null"><section class="dialog seat-edit" role="dialog" aria-modal="true" aria-labelledby="seat-edit-title"><div class="dialog-heading"><button class="icon-button mobile-back" aria-label="返回游戏详情" @click="seatDraft=null"><AppIcon name="left"/></button><h2 id="seat-edit-title">{{addingSeat?'添加会员玩家':'座位状态编辑'}}</h2><button class="icon-button desktop-close" aria-label="关闭座位编辑" @click="seatDraft=null"><AppIcon name="close"/></button></div><form class="seat-form" @submit.prevent="saveSeat"><div class="form-row"><label>座位号</label><span>{{seatDraft.number}}</span></div><div class="form-row"><label for="player-name">玩家昵称</label><div class="member-picker-field"><select id="player-name" v-model="seatMemberId" required @change="setSeatMember"><option disabled value="">请选择会员玩家</option><option v-if="legacyPlayerName&&!addingSeat" value="legacy">{{legacyPlayerName}}（未关联会员）</option><option v-for="m in availableMembers" :key="m.id" :value="String(m.id)">{{m.name}} · {{m.type}}</option></select><p v-if="!availableMembers.length" class="field-help">没有可选会员，<RouterLink to="/members">前往新增会员</RouterLink></p></div></div><div class="form-row"><label for="player-role">身份</label><input id="player-role" v-model="seatDraft.role" class="field-input" placeholder="选填，如村民、狼人" maxlength="24"/></div><div class="form-row"><label for="player-arrival">到场时间</label><div class="arrival-control"><span>{{seatGame?.date}}</span><input id="player-arrival" v-model="seatDraft.arrival" type="time" required/></div></div><div class="form-row"><label>状态</label><button type="button" class="status-select" :class="badgeClass(seatDraft.status)" @click="openStatus">{{seatDraft.status}}<AppIcon name="down" :size="16"/></button></div><div class="form-row textarea-row"><label for="player-note">备注</label><textarea id="player-note" v-model="seatDraft.note" class="field-input" rows="3" maxlength="200"/></div><p v-if="seatError" class="form-error" role="alert">{{seatError}}</p><div class="dialog-actions"><button v-if="!addingSeat" type="button" class="btn danger-outline delete-player-button" @click="requestDeletePlayer"><AppIcon name="trash" :size="16"/>删除玩家</button><button type="button" class="btn" @click="seatDraft=null">取消</button><button class="btn primary" :disabled="store.busy">{{addingSeat?'添加玩家':'保存'}}</button></div></form></section></div>
  <div v-if="statusOpen&&seatDraft" class="dialog-overlay nested-overlay sheet-overlay" @click.self="statusOpen=false"><section class="dialog status-sheet" role="dialog" aria-modal="true" aria-labelledby="status-title"><div class="dialog-heading"><h2 id="status-title">状态</h2><button class="icon-button" aria-label="关闭状态选择" @click="statusOpen=false"><AppIcon name="close"/></button></div><label v-for="s in attendanceOptions" :key="s" class="status-option"><input v-model="pendingStatus" type="radio" name="attendance" :value="s"/><span :class="['badge',badgeClass(s)]">{{s}}</span></label><button class="btn primary" @click="confirmStatus">确定</button></section></div>
  <div v-if="createOpen" class="dialog-overlay" @click.self="createOpen=false"><section class="dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title"><div class="dialog-heading"><h2 id="create-title">新增游戏场次</h2><button class="icon-button" aria-label="关闭新增场次" @click="createOpen=false"><AppIcon name="close"/></button></div><form class="create-form" @submit.prevent="createGame"><label>游戏日期<input v-model="draft.date" type="date" class="field-input" required/></label><div class="time-fields"><label>开始时间<input v-model="draft.start" type="time" class="field-input" required/></label><label>结束时间<input v-model="draft.end" type="time" class="field-input" required/></label></div><label>游戏人数<input v-model.number="draft.capacity" type="number" class="field-input" min="6" max="20" required/></label><div class="dialog-actions"><button type="button" class="btn" @click="createOpen=false">取消</button><button class="btn primary" :disabled="store.busy">创建场次</button></div></form></section></div>
  <DeleteConfirm :busy="store.busy" v-if="playerToDelete" title="删除对局玩家" :message="`确认将 ${playerToDelete.name} 从本局移除吗？该玩家在本局的座位和出勤信息将被删除，会员资料仍保留。`" @cancel="playerToDelete=null" @confirm="deletePlayer"/>
  <DeleteConfirm :busy="store.busy" v-if="gameToDelete" title="删除游戏场次" :message="`确认删除 ${gameToDelete.date} 的第${gameToDelete.id}局（${gameToDelete.start} ～ ${gameToDelete.end}）吗？该场次及所有座位、出勤信息将一并删除，删除后无法恢复。`" @cancel="gameToDelete=null" @confirm="deleteGame"/>
  <div v-if="notice" class="toast" role="status">{{notice}}</div>
</template>
