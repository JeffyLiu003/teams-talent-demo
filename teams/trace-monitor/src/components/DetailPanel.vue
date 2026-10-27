<script setup lang="ts">
// 右侧详情面板：Input/Output + 元数据 Chips + Formatted JSON + Real LLM Request + 错误详情
// 真实 LLM 请求数据源以 fetchLlmRequests 回调注入，组件不内置取数实现
// 节点详情（input/output/errorInfo/observations）以 fetchSpanDetail 回调按需注入：
//   注入时点击节点懒加载（详情优先，本地 spans 兜底）；未注入时回退本地内存查找
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import type {
  FetchLlmRequests,
  FetchSpanDetail,
  LlmRequest,
  Observation,
  Span,
  SpanDetailResp,
  Trace,
} from "@/types";
import JsonView from "@/components/JsonView.vue";
import MetaChips from "@/components/MetaChips.vue";

const props = defineProps<{
  trace: Trace;
  /** 行级项目 id（贯穿详情/调用树/LLM 请求，必须为具体项目 id） */
  projectId: string;
  /** 会话 id（可选）：file 后端按 <pid>/<sid>/<trace_id>.jsonl 路径直查提速 */
  sessionId?: string | null;
  traceId: string;
  // selectedSpanId === null 表示选中根 Trace
  selectedSpanId: string | null;
  spans: Span[];
  observations: Observation[];
  /** 必传：真实 LLM 请求数据源回调（点击 llm 节点时懒加载） */
  fetchLlmRequests: FetchLlmRequests;
  /** 可选：节点详情数据源回调；缺省时回退到 spans 内查找（向后兼容）
   *  注意：file 模式后端不实现该接口，集成方请勿注入 */
  fetchSpanDetail?: FetchSpanDetail;
}>();

const tab = ref("io");
const llmRequests = ref<LlmRequest[]>([]);
const llmLoading = ref(false);

// ===== 节点详情懒加载：详情优先，本地兜底 =====
const spanDetail = ref<SpanDetailResp | null>(null);
const spanLoading = ref(false);
const spanError = ref(false);
const detailCache = new Map<string, SpanDetailResp>(); // key = spanId，无 TTL，切 trace/project 时清空
let detailSeq = 0; // 竞态序号：连点节点时丢弃迟到响应

// 本地 span（来自 props.spans，即 /detail 的 spans 数组）
const localSpan = computed<Span | undefined>(() =>
  props.selectedSpanId ? props.spans.find((s) => s.id === props.selectedSpanId) : undefined,
);
// 最终展示用的 span：优先用懒加载回来的详情，未到达时先用本地渲染
const span = computed<Span | undefined>(() => spanDetail.value?.span ?? localSpan.value);
// observations：优先用懒加载结果；注入回调时懒加载中/失败均不显示本地那份
const spanObs = computed(() => {
  if (spanDetail.value) return spanDetail.value.observations;
  if (props.fetchSpanDetail) return [];
  return props.selectedSpanId
    ? props.observations.filter((o) => o.spanId === props.selectedSpanId)
    : [];
});

async function loadSpanDetail(sid: string | null, force = false) {
  // 先占号：任何早退（切根节点 / 未注入回调）都会让在途响应失效，避免串号
  const seq = ++detailSeq;
  spanDetail.value = null;
  spanError.value = false;
  spanLoading.value = false;

  const fetcher = props.fetchSpanDetail;
  const pid = props.projectId || props.trace.projectId || "";
  // 根 Trace（sid 为空）或未注入回调 → 不懒加载，走本地 spans / trace 兜底
  if (!fetcher || !sid || !pid || !props.traceId) return;

  if (force) detailCache.delete(sid);
  const hit = detailCache.get(sid);
  if (hit) {
    spanDetail.value = hit; // 命中缓存：零请求零闪烁
    return;
  }

  spanLoading.value = true;
  try {
    const resp = await fetcher(pid, props.traceId, sid, props.sessionId);
    if (seq !== detailSeq) return; // 已切走，丢弃
    detailCache.set(sid, resp);
    spanDetail.value = resp;
  } catch {
    if (seq !== detailSeq) return;
    spanError.value = true; // 单节点失败不污染整页
  } finally {
    if (seq === detailSeq) spanLoading.value = false;
  }
}

function retrySpanDetail() {
  loadSpanDetail(props.selectedSpanId, true);
}

// 缓存失效：切 trace / project / session 时清空（先于懒加载 watch 注册，避免用到上一个 trace 的缓存）
watch(
  [() => props.traceId, () => props.projectId, () => props.sessionId],
  () => detailCache.clear(),
);

// 选中节点变化时按 projectId + traceId + spanId 拉取该节点详情
watch(
  [() => props.selectedSpanId, () => props.projectId, () => props.traceId, () => props.sessionId],
  ([sid]) => {
    loadSpanDetail(sid as string | null);
  },
  { immediate: true },
);

const isRoot = computed(() => !span.value);
const isLlm = computed(() => !isRoot.value && span.value!.spanType === "llm");
const title = computed(() =>
  isRoot.value
    ? props.trace.name || props.trace.agentName || "Trace"
    : span.value!.name,
);
const input = computed(() => (isRoot.value ? props.trace.input : span.value!.input));
const output = computed(() => (isRoot.value ? props.trace.output : span.value!.output));
const errorInfo = computed(() =>
  isRoot.value ? props.trace.errorInfo : span.value!.errorInfo,
);

// 切节点时若当前 tab 在该节点上不存在（如非 llm 节点的 "Real LLM Request"），
// 重置回 "io"，避免消失 tab 残留
watch([tab, isLlm, () => props.selectedSpanId], ([t, llm]) => {
  if (t === "llm" && !llm) tab.value = "io";
});

// 选中 llm 节点时按 projectId + eventId 拉取真实 LLM 请求（1:1 关联）
// 后端强制按项目过滤：projectId 取组件传入的行级 pid（detail 根 trace 的
// projectId 兜底），必须是具体项目 id
// 依赖 eventId 而非 span 对象引用：一次点击里 span 会先取本地 brief（props.spans）、
// 后取懒加载详情（detailCache/接口返回），两者引用不同但 eventId 相同；
// 直接依赖 span 会让同一节点发两次一模一样的请求
watch(
  [
    () => props.selectedSpanId,
    isLlm,
    () => span.value?.eventId,
    () => props.projectId,
    () => props.trace.projectId,
  ],
  async ([, llm, ev]) => {
    const pid = props.projectId || props.trace.projectId || "";
    if (!llm || !ev || !pid) {
      llmRequests.value = [];
      return;
    }
    llmLoading.value = true;
    try {
      const item = await props.fetchLlmRequests(ev, pid);
      llmRequests.value = item ? [item] : [];
    } catch {
      llmRequests.value = [];
    } finally {
      llmLoading.value = false;
    }
  },
  { immediate: true },
);

function copyJson() {
  const payload = JSON.stringify(
    normalize({ input: input.value, output: output.value, error: errorInfo.value }),
    null,
    2,
  );
  navigator.clipboard?.writeText(payload);
  ElMessage.success("已复制 JSON");
}

// 后端可能把 input/output 双层编码为 JSON 字符串（如 tool 的 HTTP 响应体），
// 直接 stringify 会把引号、换行全部转义成 \" 与 \n，无法阅读；
// 这里递归把「本身就是 JSON 的字符串」解析回结构后再格式化
// 解析层数上限：兼容嵌套编码，同时防御恶意构造的深层嵌套字符串
const MAX_PARSE_DEPTH = 8;

function normalize(v: unknown, depth = 0): unknown {
  if (typeof v === "string") {
    if (depth >= MAX_PARSE_DEPTH) return v;
    const s = v.trim();
    // 只尝试对象/数组，避免把 "123"、普通文本误解析成其它类型
    if (!s.startsWith("{") && !s.startsWith("[")) return v;
    try {
      return normalize(JSON.parse(s), depth + 1);
    } catch {
      return v;
    }
  }
  if (Array.isArray(v)) return v.map((x) => normalize(x, depth + 1));
  if (v !== null && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, normalize(x, depth + 1)]),
    );
  }
  return v;
}

function fmt(v: unknown): string {
  return JSON.stringify(normalize(v) ?? null, null, 2);
}
</script>

<template>
  <div class="tm-scope tm-detail">
    <div class="tm-detail-head">
      <div class="tm-detail-title">{{ title }}</div>
    </div>

    <div class="tm-detail-body">
      <MetaChips v-if="!isRoot" :span="span" />

      <el-alert
        v-if="errorInfo"
        type="error"
        :closable="false"
        show-icon
        :title="errorInfo.message || errorInfo.errorType || '错误'"
        class="tm-error-alert"
      >
        <div>
          <div v-if="errorInfo.errorType">类型: {{ errorInfo.errorType }}</div>
          <div v-if="errorInfo.errorCode">编码: {{ errorInfo.errorCode }}</div>
          <div v-if="errorInfo.errorCategory">类别: {{ errorInfo.errorCategory }}</div>
          <pre v-if="errorInfo.stackTrace" class="tm-json-block tm-stack">{{ errorInfo.stackTrace }}</pre>
        </div>
      </el-alert>

      <div v-if="spanObs.length > 0" class="tm-obs">
        <div class="tm-section-label">Token 明细 (observation)</div>
        <div class="tm-obs-list">
          <div v-for="o in spanObs" :key="o.id" class="tm-meta-chip">
            <span class="tm-obs-model">{{ o.model }}</span>
            <span>·</span>
            <span>prompt {{ o.promptTokens ?? 0 }}</span>
            <span>/</span>
            <span>completion {{ o.completionTokens ?? 0 }}</span>
          </div>
        </div>
      </div>

      <el-tabs v-model="tab" size="small" class="tm-tabs">
        <template #extra>
          <el-button size="small" @click="copyJson">复制</el-button>
        </template>
        <el-tab-pane label="Input / Output" name="io">
          <div v-loading="spanLoading">
            <div v-if="spanError" class="tm-empty">
              <div>节点详情加载失败</div>
              <el-button size="small" type="primary" link @click="retrySpanDetail">点击重试</el-button>
            </div>
            <div v-else-if="input !== undefined || output !== undefined || errorInfo !== undefined">
              <div class="tm-section-label">Input</div>
              <div class="tm-json-block"><JsonView :data="input" /></div>
              <div class="tm-section-label">Output</div>
              <div class="tm-json-block"><JsonView :data="output" /></div>
              <div class="tm-section-label">Error</div>
              <div class="tm-json-block"><JsonView :data="errorInfo" /></div>
            </div>
            <div v-else class="tm-empty">
              <div>无数据</div>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="Formatted JSON" name="json">
          <div v-loading="spanLoading">
            <pre v-if="!spanError" class="tm-json-block">{{ fmt({ input, output, error: errorInfo }) }}</pre>
            <div v-else class="tm-empty">
              <div>节点详情加载失败</div>
              <el-button size="small" type="primary" link @click="retrySpanDetail">点击重试</el-button>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane v-if="isLlm && llmRequests.length > 0" label="Real LLM Request" name="llm">
          <div v-loading="llmLoading">
            <div v-for="r in llmRequests" :key="r.eventId" class="tm-llm-item">
              <div v-if="r.model" class="tm-meta-chip">
                <span class="tm-obs-model">{{ r.model }}</span>
                <span>·</span>
                <span :class="r.status === 'error' ? 'tm-status error' : 'tm-status success'">
                  {{ r.status === "error" ? "失败" : "成功" }}
                </span>
              </div>
              <div class="tm-section-label">Input</div>
              <pre class="tm-json-block">{{ fmt(r.input) }}</pre>
              <div class="tm-section-label">Output</div>
              <pre class="tm-json-block">{{ fmt(r.output) }}</pre>
              <template v-if="r.errorInfo">
                <div class="tm-section-label">Error</div>
                <pre class="tm-json-block">{{ fmt(r.errorInfo) }}</pre>
              </template>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tm-detail {
  height: 100%;
  overflow: auto;
  padding: 0;
}
.tm-detail-head {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--bg-elevated);
  padding: 10px 18px 12px;
  border-bottom: 1px solid var(--border-subtle);
}
.tm-detail-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-strong);
  word-break: break-all;
  line-height: 1.4;
}
.tm-detail-body {
  padding: 14px 18px 24px;
}
.tm-error-alert {
  margin-bottom: 12px;
  border-radius: var(--radius-md);
}
.tm-stack {
  background: var(--danger-soft);
  margin-top: 8px;
  white-space: pre-wrap;
}
.tm-obs {
  margin-bottom: 14px;
}
.tm-obs-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tm-obs-model {
  color: var(--ink-strong);
  font-weight: 600;
}
.tm-llm-item {
  margin-bottom: 16px;
}
.tm-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--bg-subtle);
  color: var(--ink-mid);
  border: 1px solid var(--border-subtle);
  align-self: flex-start;
  margin-bottom: 8px;
}
.tm-section-label {
  font-size: 11.5px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-weak);
  margin: 14px 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tm-section-label::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}
.tm-json-block {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  font-family: var(--font-mono);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--ink);
}
.tm-empty {
  padding: 48px 0;
  text-align: center;
  color: var(--ink-weak);
  font-size: 12.5px;
}
.tm-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  padding: 1px 8px;
  height: 20px;
  border-radius: 999px;
  line-height: 1;
}
.tm-status.success {
  color: var(--success);
  background: var(--success-soft);
}
.tm-status.error {
  color: var(--danger);
  background: var(--danger-soft);
}
</style>
