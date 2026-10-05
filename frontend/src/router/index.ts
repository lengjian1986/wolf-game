import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {path:'/login',name:'login',component:()=>import('../views/LoginView.vue'),meta:{title:'登录',public:true}},
    {path:'/',redirect:'/members'},
    {path:'/members',name:'members',component:()=>import('../views/MembersView.vue'),meta:{title:'会员管理'}},
    {path:'/games',name:'games',component:()=>import('../views/GamesView.vue'),meta:{title:'游戏记录'}},
    {path:'/overview',name:'overview',component:()=>import('../views/OverviewView.vue'),meta:{title:'首页'}},
    {path:'/statistics',name:'statistics',component:()=>import('../views/OverviewView.vue'),meta:{title:'数据统计'}},
    {path:'/:pathMatch(.*)*',redirect:'/members'},
  ],
  scrollBehavior:()=>({top:0}),
})

router.beforeEach(async to => {
  const auth = useAuthStore()
  try {
    const user = await auth.checkSession()
    if (!user && !to.meta.public) return { path: '/login', query: { redirect: to.fullPath } }
    if (user && to.path === '/login') return '/members'
  } catch {
    auth.user = null
    if (!to.meta.public) return { path: '/login', query: { redirect: to.fullPath } }
  }
})
export default router
