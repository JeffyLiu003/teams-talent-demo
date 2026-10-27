import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import "element-plus/dist/index.css";
import App from "./App.vue";
import router from "./router";
import { setTraceApiBase } from "@/utils/request";
// 内嵌页全局样式（:root token + 全局重置 + 列表页 Element Plus 覆写）
import "./styles/dev-shell.scss";
// 组件级样式（与组件库产物同一份）
import "./styles/index.scss";

// 后端由 demo 服务端代理：/trace-api -> trace-server /api/v1
setTraceApiBase(import.meta.env.VITE_API_BASE || "/trace-api");

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");
