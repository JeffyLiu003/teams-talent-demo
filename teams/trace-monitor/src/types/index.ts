// 与后端 P4 API 响应结构一一对应（camelCase）

// 与 langfuse 6 类 span_type 对齐：后端可能返回 chain/llm/tool/agent/retriever/span
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
  name: string; // 原样透传的节点名
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

// ============================================================
// Trace 详情数据获取回调（组件不内置取数实现，由集成方按需注入）
// ============================================================

/** 详情：根 Trace 摘要 + 全部 spans + observations
 *  projectId 必须为具体项目 id（行级 pid 贯穿）
 *  sessionId 可选：file 后端按 <pid>/<sid>/<trace_id>.jsonl 路径直查提速 */
export type FetchTraceDetail = (
  projectId: string,
  traceId: string,
  sessionId?: string | null,
) => Promise<TraceDetailResp>;

/** 调用树：树形结构（按父子关系组装）
 *  projectId 必须为具体项目 id（行级 pid 贯穿）
 *  sessionId 可选：file 后端按路径直查提速 */
export type FetchTraceTree = (
  projectId: string,
  traceId: string,
  sessionId?: string | null,
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
