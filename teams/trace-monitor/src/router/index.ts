// 路由配置（Vue Router 4）
// base 取自 Vite 的 BASE_URL：demo 内嵌时挂在 /trace-monitor/ 下
import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "traces",
      component: () => import("@/views/TraceList.vue"),
    },
    {
      path: "/traces/:projectId/:sessionId?/:traceId",
      name: "trace-detail",
      component: () => import("@/views/TraceDetailPage.vue"),
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],
});

export default router;
