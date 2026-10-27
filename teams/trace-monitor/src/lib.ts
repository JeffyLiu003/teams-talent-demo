// ============================================================
// Trace Monitor 组件库统一入口（lib 构建）
// 供第三方应用以组件方式集成 —— 只组件化「Trace 详情展示」：
//   <TraceDetail :trace-id="'xxx'" />
// 列表、菜单、外壳等业务页面由集成方自行实现。
// ============================================================
import type { App } from "vue";
import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
// 样式说明：
//   · 这里只引入「组件级」样式（全部挂 .tm-scope，不污染宿主全局）
//   · Element Plus 基础样式由宿主自行引入（import "element-plus/dist/index.css"），
//     本组件库不再全局注入，避免覆盖宿主的 EP 主题配置
import "./styles/index.scss";

import { extractError, getTraceApiBase, setTraceApiBase, api } from "@/utils/request";
import { fetchTraceDetail, fetchTraceTree, fetchLlmRequests, fetchSpanDetail, downloadTraceJsonl } from "@/api/traces";

// 核心导出：Trace 详情展示组件（不依赖路由，projectId + traceId 驱动）
// ★ TraceDetail 不内置取数：需由集成方以 fetchDetail / fetchTree / fetchLlmRequests
//   三个 prop 注入数据源回调，可直接复用下方导出的取数函数；
//   可选注入 fetchSpanDetail 开启节点详情懒加载（file 模式后端不实现该接口，请勿注入）
import TraceDetail from "@/views/TraceDetail.vue";

// 基础组件：可被集成方按需组合
import TraceTree from "@/components/TraceTree.vue";
import TraceTreeNode from "@/components/TraceTreeNode.vue";
import DetailPanel from "@/components/DetailPanel.vue";
import JsonView from "@/components/JsonView.vue";
import MetaChips from "@/components/MetaChips.vue";
import StatusBadge from "@/components/StatusBadge.vue";

// 具名导出：详情组件 + 基础组件 + 数据源取数函数 + API 工具
export {
  TraceDetail,
  TraceTree,
  TraceTreeNode,
  DetailPanel,
  JsonView,
  MetaChips,
  StatusBadge,
  // 数据源取数函数：与 TraceDetail 的 fetch 回调签名一致，可直接复用构造回调
  fetchTraceDetail,
  fetchTraceTree,
  fetchLlmRequests,
  fetchSpanDetail,
  downloadTraceJsonl,
  setTraceApiBase,
  getTraceApiBase,
  extractError,
  api,
};

// 全组件注册表（供 app.component 按名注册）
export const components = {
  TraceDetail,
  TraceTree,
  TraceTreeNode,
  DetailPanel,
  JsonView,
  MetaChips,
  StatusBadge,
};

export type * from "@/types/index";

// 插件对象：可整包 use，也可按需 import 具名组件
const TraceMonitor = {
  install(app: App, options?: { baseURL?: string }) {
    if (options?.baseURL) setTraceApiBase(options.baseURL);
    // 全局注册 Element Plus（zh-cn），页面组件按需 import
    app.use(ElementPlus, { locale: zhCn });
  },
};

export default TraceMonitor;
