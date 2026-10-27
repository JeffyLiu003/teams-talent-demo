// ============================================================
// trace-monitor-vue 类型声明（手写维护）
// 与 src/lib.ts 导出保持一一对应；组件用 DefineComponent 泛型标注
// 构建时由 build:lib 脚本拷贝为 dist/trace-monitor-vue.d.ts
// ============================================================
import type { App, DefineComponent, Component } from "vue";

/* ================= 类型（与 src/types/index.ts 对应） ================= */

export type SpanType = "chain" | "llm" | "tool" | "agent" | "retriever" | "span";

export interface ErrorInfo {
  errorType?: string;
  errorCode?: string;
  errorCategory?: string;
  message?: string;
  stackTrace?: string;
}

export interface Span {
  id: string;
  eventId?: string;
  traceId: string;
  parentSpanId: string | null;
  name: string;
  spanType: SpanType;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
  model?: string;
  toolName?: string;
  status: "success" | "error";
  errorInfo?: ErrorInfo;
  startedAt?: string;
}

export interface Trace {
  id: string;
  projectId: string | null;
  sessionId: string | null;
  name: string | null;
  agentName: string | null;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  reactStepCount?: number;
  toolCount?: number;
  spanCount?: number;
  status: "success" | "error";
  errorInfo?: ErrorInfo;
  startedAt?: string;
}

export interface Observation {
  id: string;
  spanId: string | null;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  input?: unknown;
  output?: unknown;
}

export interface TraceNode {
  span?: Span;
  children: TraceNode[];
}

export interface TraceListResp {
  items: Trace[];
  total: number;
  page: number;
  page_size: number;
}

export interface TraceDetailResp {
  trace: Trace;
  spans: Span[];
  observations: Observation[];
}

export interface TraceTreeResp {
  trace: Trace;
  tree: TraceNode[];
}

/** 单个节点的详情：该 Span 完整字段 + 它的 observations */
export interface SpanDetailResp {
  span: Span;
  observations: Observation[];
}

export interface LlmRequest {
  eventId: string;
  spanId?: string | null;
  model?: string;
  input?: unknown;
  output?: unknown;
  status?: string;
  errorInfo?: ErrorInfo;
  startedAt?: string;
}

export interface AppConfig {
  storageBackend: string;
}

/* ================= Trace 详情数据源回调 ================= */

/** 详情：根 Trace 摘要 + 全部 spans + observations
 *  projectId 必须为具体项目 id（行级 pid 贯穿） */
export type FetchTraceDetail = (
  projectId: string,
  traceId: string,
) => Promise<TraceDetailResp>;

/** 调用树：树形结构（按父子关系组装）
 *  projectId 必须为具体项目 id（行级 pid 贯穿） */
export type FetchTraceTree = (
  projectId: string,
  traceId: string,
) => Promise<TraceTreeResp>;

/** 真实 LLM 请求：点击 llm 节点时按 projectId + eventId 拉取单条
 *  （后端强制按项目过滤，projectId 必须为具体项目 id） */
export type FetchLlmRequests = (
  eventId: string,
  projectId: string,
) => Promise<LlmRequest | null>;

/** 节点详情：点击节点时按 projectId + traceId + spanId 拉取单个节点详情
 *  （projectId 必须为具体项目 id；file 模式后端不实现该接口，集成方请勿注入）
 *  sessionId 可选：与 fetchTraceDetail / fetchTraceTree 一致透传 */
export type FetchSpanDetail = (
  projectId: string,
  traceId: string,
  spanId: string,
  sessionId?: string | null,
) => Promise<SpanDetailResp>;

/* ================= 页面组件 ================= */

export interface TraceDetailProps {
  /** 必传：要展示的 trace 的 id，变化时自动重新加载 */
  traceId: string;
  /** 行级项目 id（贯穿详情/调用树/LLM 请求，必须为具体项目 id） */
  projectId: string;
  /** 必传：详情数据源回调（根 Trace 摘要 + spans + observations） */
  fetchDetail: FetchTraceDetail;
  /** 必传：调用树数据源回调（按父子关系组装的树） */
  fetchTree: FetchTraceTree;
  /** 必传：真实 LLM 请求数据源回调（点击 llm 节点时懒加载） */
  fetchLlmRequests: FetchLlmRequests;
  /** 可选：节点详情数据源回调（点击节点时懒加载）；缺省时回退本地 spans 查找。
   *  file 模式后端不实现该接口，集成方请勿注入 */
  fetchSpanDetail?: FetchSpanDetail;
  /** 可选：数据加载完成后的回调，集成方可借此获取摘要信息 */
  onLoaded?: (detail: { trace: Trace }) => void;
}
export declare const TraceDetail: DefineComponent<TraceDetailProps>;

/* ================= 基础组件 ================= */

export declare const TraceTree: DefineComponent<{
  tree: TraceNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}>;

export declare const TraceTreeNode: DefineComponent<{
  node: TraceNode;
  depth: number;
  selectedId?: string | null;
  defaultOpen?: boolean;
  hasSiblingBelow?: boolean;
}>;

export declare const DetailPanel: DefineComponent<{
  trace: Trace;
  /** 行级项目 id（贯穿详情/调用树/LLM 请求，必须为具体项目 id） */
  projectId: string;
  /** 会话 id（可选）：file 后端按 <pid>/<sid>/<trace_id>.jsonl 路径直查提速 */
  sessionId?: string | null;
  traceId: string;
  selectedSpanId: string | null;
  spans: Span[];
  observations: Observation[];
  /** 必传：真实 LLM 请求数据源回调（点击 llm 节点时懒加载） */
  fetchLlmRequests: FetchLlmRequests;
  /** 可选：节点详情数据源回调（点击节点时懒加载）；缺省时回退本地 spans 查找。
   *  file 模式后端不实现该接口，集成方请勿注入 */
  fetchSpanDetail?: FetchSpanDetail;
}>;

export declare const JsonView: DefineComponent<{
  data?: unknown;
  depth?: number;
  name?: string;
}>;

export declare const MetaChips: DefineComponent<{
  span?: Span;
}>;

export declare const StatusBadge: DefineComponent<{
  status: string;
}>;

/* ================= API / 工具 ================= */

/** 组件库集成方在应用运行时指定后端 API baseURL（如 "/api/v1" 或完整地址） */
export declare function setTraceApiBase(url: string): void;

/** 当前生效的 API baseURL */
export declare function getTraceApiBase(): string;

/** 组件库内部使用的 axios 实例 */
export declare const api: import("axios").AxiosInstance;

/** 统一错误消息提取 */
export declare function extractError(e: unknown, fallback?: string): string;

/* ================= 数据源取数函数（与 TraceDetail fetch 回调签名一致） ================= */

/** 详情：GET /projects/{projectId}/traces/{traceId}?session_id=（行级 pid 贯穿）
 *  sessionId 可选：file 后端按路径直查提速 */
export declare function fetchTraceDetail(
  projectId: string,
  traceId: string,
  sessionId?: string | null,
): Promise<TraceDetailResp>;

/** 调用树：GET /projects/{projectId}/traces/{traceId}/tree?session_id=
 *  sessionId 可选：file 后端按路径直查提速 */
export declare function fetchTraceTree(
  projectId: string,
  traceId: string,
  sessionId?: string | null,
): Promise<TraceTreeResp>;

/** 节点详情：GET /projects/{projectId}/traces/{traceId}/spans/{spanId}?session_id=
 *  （行级 pid 贯穿；file 模式后端不实现该接口，集成方请勿注入）
 *  sessionId 可选：file 后端按路径直查提速 */
export declare function fetchSpanDetail(
  projectId: string,
  traceId: string,
  spanId: string,
  sessionId?: string | null,
): Promise<SpanDetailResp>;

/** 真实 LLM 请求：GET /projects/{projectId}/llm_requests/{eventId}
 *  （后端强制按项目过滤，projectId 必须为具体项目 id） */
export declare function fetchLlmRequests(
  eventId: string,
  projectId: string,
): Promise<LlmRequest | null>;

/** 还原下载：GET /projects/{projectId}/traces/{traceId}/export?session_id=
 *  把该 trace 还原成文件模式的 <traceId>.jsonl 并触发浏览器下载（database 重拼行，file 回吐原文）
 *  sessionId 可选，file 后端按 <pid>/<sid>/<trace_id>.jsonl 路径直查提速 */
export declare function downloadTraceJsonl(
  projectId: string,
  traceId: string,
  sessionId?: string | null,
): Promise<void>;

/* ================= 插件对象 ================= */

export interface TraceMonitorOptions {
  /** 后端 API baseURL，等效于调用 setTraceApiBase */
  baseURL?: string;
}

export interface TraceMonitorPlugin {
  install(app: App, options?: TraceMonitorOptions): void;
}

declare const TraceMonitor: TraceMonitorPlugin;

export default TraceMonitor;

/* ================= 全组件注册表 ================= */
export declare const components: Record<string, Component>;
