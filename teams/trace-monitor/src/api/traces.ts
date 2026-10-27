// Trace 接口封装：列表 / 详情 / 调用树 / 节点详情 / 真实 LLM 请求
// 详情 / 调用树 / 节点详情 / LLM 请求四个函数签名与 TraceDetail 的 fetch 回调一致，
// 组件库集成方可直接复用它们构造 <TraceDetail> 的 fetch 回调（端点格式由本文件集中维护）
import { api } from "@/utils/request";
import type {
  FetchLlmRequests,
  FetchSpanDetail,
  FetchTraceDetail,
  FetchTraceTree,
  LlmRequest,
  SpanDetailResp,
  TraceDetailResp,
  TraceListResp,
  TraceTreeResp,
} from "@/types";

export interface TraceQuery {
  page: number;
  pageSize: number;
  agentName?: string;
  status?: string;
  sessionId?: string;
  traceId?: string;
}

// 列表：GET /projects/{pid}/traces?page=&page_size=&agent_name=&status=&session_id=&trace_id=
export async function fetchTraces(
  projectId: string,
  params: TraceQuery,
): Promise<TraceListResp> {
  const { data } = await api.get<TraceListResp>(`/projects/${projectId}/traces`, {
    params: {
      page: params.page,
      page_size: params.pageSize,
      agent_name: params.agentName || undefined,
      status: params.status || undefined,
      session_id: params.sessionId || undefined,
      trace_id: params.traceId || undefined,
    },
  });
  return data;
}

// 详情：GET /projects/{projectId}/traces/{traceId}?session_id=
// projectId 必须为具体项目 id（行级 pid 贯穿）
// sessionId 可选：file 后端按 <pid>/<sid>/<trace_id>.jsonl 路径直查提速
export const fetchTraceDetail: FetchTraceDetail = async (
  projectId,
  traceId,
  sessionId,
) => {
  const { data } = await api.get<TraceDetailResp>(
    `/projects/${projectId}/traces/${traceId}`,
    { params: { session_id: sessionId || undefined } },
  );
  return data;
};

// 调用树：GET /projects/{projectId}/traces/{traceId}/tree?session_id=
export const fetchTraceTree: FetchTraceTree = async (
  projectId,
  traceId,
  sessionId,
) => {
  const { data } = await api.get<TraceTreeResp>(
    `/projects/${projectId}/traces/${traceId}/tree`,
    { params: { session_id: sessionId || undefined } },
  );
  return data;
};

// 节点详情：GET /projects/{projectId}/traces/{traceId}/spans/{spanId}?session_id=
// projectId 必须为具体项目 id（行级 pid 贯穿）
// 注意：file 模式后端不实现该端点，集成方在 file 模式下请勿注入
export const fetchSpanDetail: FetchSpanDetail = async (
  projectId,
  traceId,
  spanId,
  sessionId,
) => {
  const { data } = await api.get<SpanDetailResp>(
    `/projects/${projectId}/traces/${traceId}/spans/${spanId}`,
    { params: { session_id: sessionId || undefined } },
  );
  return data;
};

// 真实 LLM 请求：GET /projects/{projectId}/llm_requests/{eventId}
// 后端强制按项目过滤（projectId 必须为具体项目 id）
export const fetchLlmRequests: FetchLlmRequests = async (eventId, projectId) => {
  const { data } = await api.get<LlmRequest>(
    `/projects/${projectId}/llm_requests/${eventId}`,
  );
  return data ?? null;
};

// 还原下载：GET /projects/{projectId}/traces/{traceId}/export?session_id=
// 把该 trace 还原成文件模式的 <traceId>.jsonl，直接触发浏览器下载
// database 模式从库表重拼行，file 模式回吐磁盘原文，两种模式都支持
// sessionId 可选：file 后端按 <pid>/<sid>/<trace_id>.jsonl 路径直查提速
export async function downloadTraceJsonl(
  projectId: string,
  traceId: string,
  sessionId?: string | null,
): Promise<void> {
  const { data } = await api.get<Blob>(
    `/projects/${projectId}/traces/${traceId}/export`,
    {
      params: { session_id: sessionId || undefined },
      responseType: "blob",
    },
  );
  const url = URL.createObjectURL(data);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${traceId}.jsonl`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
