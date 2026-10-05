import { defineStore, acceptHMRUpdate } from 'pinia'
import { computed, ref } from 'vue'
export const memberTypes = ['月卡', '次卡', '普通会员'] as const
export type CardType = typeof memberTypes[number]
export type Attendance = '准时' | '迟到' | '早退'
export interface Member { id: number; name: string; type: CardType; total: number; remaining: number; expiry: string; purchased: string }
export interface RecordItem { id: number; memberId: number; member: string; time: string; action: '使用' | '购买' | '调整'; note: string; amount: number }
export interface Seat { memberId?: number; number: number; name: string; role: string; arrival: string; status: Attendance; note: string }
export interface Game { id: number; date: string; start: string; end: string; state: '已结束' | '进行中' | '未开始'; seats: Seat[]; capacity: number }
interface AppData { members: Member[]; records: RecordItem[]; games: Game[]; shop: string }
export const referenceDate = localDateTime().slice(0,10)
export function localDateTime(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}

export const useDataStore = defineStore('data', () => {
  const data=ref<AppData>({members:[],records:[],games:[],shop:''})
  const error=ref(''),busy=ref(false),loaded=ref(false)
  let timer:ReturnType<typeof setInterval>|undefined, loading:Promise<void>|undefined, generation=0
  try { localStorage.removeItem('werewolf-demo-v1') } catch {}
  const members=computed(()=>data.value.members),games=computed(()=>data.value.games),records=computed(()=>data.value.records),shop=computed(()=>data.value.shop)
  function apply(incoming:AppData){
    const oldMembers=new Map(data.value.members.map(m=>[m.id,m]))
    incoming.members=incoming.members.map(m=>{const old=oldMembers.get(m.id);return old?Object.assign(old,m):m})
    const oldGames=new Map(data.value.games.map(g=>[g.id,g]))
    incoming.games=incoming.games.map(g=>{const old=oldGames.get(g.id);return old?Object.assign(old,g):g})
    data.value=incoming;loaded.value=true;error.value=''
  }
  async function request(path:string,method='GET',body?:unknown){
    const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})
    const result=await response.json()
    if(!response.ok)throw new Error(result.message||'请求失败，请重试。')
    return result.data as AppData
  }
  async function load(){
    if(busy.value)return
    if(loading)return loading
    const current=generation
    loading=(async()=>{try{const incoming=await request('/api/data');if(current===generation)apply(incoming)}catch(e){error.value=e instanceof Error?e.message:'数据加载失败。'}finally{loading=undefined}})()
    return loading
  }
  async function mutate(path:string,method:string,input?:unknown){
    if(busy.value)throw new Error('正在保存，请稍候。')
    busy.value=true;const current=++generation
    try{const incoming=await request(path,method,input);if(current===generation)apply(incoming);return incoming}
    catch(e){const message=e instanceof Error?e.message:'保存失败，请重试。';error.value=message;throw new Error(message)}
    finally{busy.value=false}
  }
  async function addMember(input:Omit<Member,'id'|'remaining'>){return mutate('/api/members','POST',input)}
  async function changeMemberType(id:number,input:{type:CardType;total:number;remaining:number;expiry:string;monthMode:'add'|'custom'}){return mutate(`/api/members/${id}/card`,'PATCH',input)}
  async function useMember(id:number){return mutate(`/api/members/${id}/use`,'POST',{})}
  async function adjustMember(id:number,remaining:number){return mutate(`/api/members/${id}/balance`,'PATCH',{remaining})}
  async function deleteMember(id:number){return mutate(`/api/members/${id}`,'DELETE')}
  async function createGame(input:{date:string;start:string;end:string;capacity:number}){return mutate('/api/games','POST',input)}
  async function deleteGame(id:number){return mutate(`/api/games/${id}`,'DELETE')}
  async function saveSeat(id:number,input:Seat,adding:boolean){return mutate(adding?`/api/games/${id}/seats`:`/api/games/${id}/seats/${input.number}`,adding?'POST':'PUT',input)}
  async function deleteSeat(id:number,number:number){return mutate(`/api/games/${id}/seats/${number}`,'DELETE')}
  async function saveSettings(shop:string){return mutate('/api/settings','PATCH',{shop})}
  function startSync(){if(timer)return;void load();timer=setInterval(()=>{if(!document.hidden)void load()},5000);window.addEventListener('focus',refresh)}
  function refresh(){void load()}
  function stopSync(){if(timer)clearInterval(timer);timer=undefined;window.removeEventListener('focus',refresh);generation++;data.value={members:[],records:[],games:[],shop:''};loaded.value=false;error.value=''}
  return {data,members,games,records,shop,error,busy,loaded,load,startSync,stopSync,addMember,changeMemberType,useMember,adjustMember,deleteMember,createGame,deleteGame,saveSeat,deleteSeat,saveSettings}
})
export function memberStatus(m:Member): string { if(m.type==='普通会员')return '正常';if(m.expiry<localDateTime().slice(0,10))return '已到期';if(m.type==='次卡'&&m.remaining===0)return '已用完';const days=(new Date(m.expiry).getTime()-new Date(localDateTime().slice(0,10)).getTime())/86400000;return days<=15?'即将到期':'正常' }
export function badgeClass(label:string): string { return ({'普通会员':'gray','月卡':'purple','次卡':'blue','正常':'green','即将到期':'orange','已到期':'red','已用完':'red','已结束':'gray','进行中':'green','未开始':'blue','准时':'green','迟到':'red','早退':'blue','村民':'gray','狼人':'red','预言家':'blue','女巫':'purple','猎人':'yellow','白痴':'pink','购买':'blue','调整':'orange'} as Record<string,string>)[label] || 'gray' }

if(import.meta.hot)import.meta.hot.accept(acceptHMRUpdate(useDataStore,import.meta.hot))
