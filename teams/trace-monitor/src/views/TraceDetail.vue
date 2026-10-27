<script setup lang="ts">
// Trace 详情组件：左侧调用树 + 右侧详情面板
// 以 props.traceId 驱动，不依赖路由，集成方自行控制数据获取时机
// ★ 组件不内置取数实现：详情 / 调用树 / LLM 请求 / 节点详情四个数据源均由集成方以
//   fetchDetail / fetchTree / fetchLlmRequests / fetchSpanDetail 回调注入（可复用组件库导出的取数函数）
import { computed, ref, watch } from "vue";
import dayjs from "dayjs";
import { ElMessage } from "element-plus";
import { Loading } from "@element-plus/icons-vue";
import type {
  FetchLlmRequests,
  FetchSpanDetail,
  FetchTraceDetail,
  FetchTraceTree,
  Observation,
  Span,
  Trace,
  TraceNode,
} from "@/types";
import TraceTree from "@/components/TraceTree.vue";
import DetailPanel from "@/components/DetailPanel.vue";

const props = withDefaults(
  defineProps<{
    /** Trace ID，变化时自动重新加载 */
    traceId: string;
    /** 行级项目 id（贯穿详情/调用树/LLM 请求，必须为具体项目 id） */
    projectId: string;
    /** 可选：session id，file 后端按 <pid>/<sid>/<trace_id>.jsonl 路径直查提速 */
    sessionId?: string | null;
    /** 必传：详情数据源回调（根 Trace 摘要 + spans + observations） */
    fetchDetail: FetchTraceDetail;
    /** 必传：调用树数据源回调（按父子关系组装的树） */
    fetchTree: FetchTraceTree;
    /** 必传：真实 LLM 请求数据源回调（点击 llm 节点时懒加载） */
    fetchLlmRequests: FetchLlmRequests;
    /** 可选：节点详情数据源回调（点击节点时懒加载）；缺省时回退本地 spans 查找。
     *  file 模式后端不实现该接口，集成方请勿注入（详见按存储模式 gating） */
    fetchSpanDetail?: FetchSpanDetail;
    /** 数据加载完成后的回调，集成方可借此获取摘要信息 */
    onLoaded?: (detail: { trace: Trace }) => void;
  }>(),
  {},
);

const treeData = ref<{ trace: Trace; tree: TraceNode[] } | null>(null);
const detail = ref<{ trace: Trace; spans: Span[]; observations: Observation[] } | null>(null);
const selectedId = ref<string | null>(null);
const loading = ref(false);

async function load() {
  if (!props.traceId || !props.projectId) return;
  loading.value = true;
  selectedId.value = null;
  try {
    const [t, d] = await Promise.all([
      props.fetchTree(props.projectId, props.traceId, props.sessionId),
      props.fetchDetail(props.projectId, props.traceId, props.sessionId),
    ]);
    treeData.value = t;
    detail.value = d;
    props.onLoaded?.({ trace: t.trace });
  } catch {
    ElMessage.error("加载详情失败，请确认 API 可用");
  } finally {
    loading.value = false;
  }
}

watch(
  [() => props.traceId, () => props.projectId, () => props.sessionId],
  ([id, pid]) => {
    if (id && pid) load();
  },
  { immediate: true },
);

const trace = computed(() => detail.value?.trace ?? treeData.value?.trace);

function fmtTime(v?: string) {
  return v ? dayjs(v).format("YYYY-MM-DD HH:mm:ss") : "—";
}
</script>

<template>
  <div v-if="loading" class="tm-scope tm-loading">
    <el-icon class="is-loading tm-spinner" :size="28"><Loading /></el-icon>
  </div>
  <div v-else-if="treeData && detail" class="tm-scope tm-page">
    <div class="tm-detail-layout">
      <div class="tm-panel tm-left-panel">
        <div class="tm-summary">
        <el-descriptions :column="2" size="small" class="tm-desc">
          <el-descriptions-item label="Trace ID">
            <code class="tm-code" :title="trace?.id">{{ trace?.id }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="Agent">
            {{ trace?.agentName || "—" }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <span :class="`tm-status ${trace?.status === 'success' ? 'success' : 'error'}`">
              {{ trace?.status === "success" ? "成功" : "失败" }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="耗时">
            {{ trace?.durationMs != null ? `${trace?.durationMs}ms` : "—" }}
          </el-descriptions-item>
          <el-descriptions-item label="Token">
            {{ trace?.totalTokens ?? "—" }}
          </el-descriptions-item>
          <el-descriptions-item label="ReAct 步数">
            {{ trace?.reactStepCount ?? "—" }}
          </el-descriptions-item>
          <el-descriptions-item label="工具数">
            {{ trace?.toolCount ?? "—" }}
          </el-descriptions-item>
          <el-descriptions-item label="环节数">
            {{ trace?.spanCount ?? "—" }}
          </el-descriptions-item>
          <el-descriptions-item label="时间" :span="2">
            {{ fmtTime(trace?.startedAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <div class="tm-tree-area">
        <TraceTree :tree="treeData.tree" :selected-id="selectedId" :on-select="(id: string) => (selectedId = id)" />
      </div>
    </div>
    <div class="tm-panel tm-right-panel">
      <DetailPanel
        :trace="detail.trace"
        :project-id="props.projectId"
        :trace-id="props.traceId"
        :selected-span-id="selectedId"
        :spans="detail.spans"
        :observations="detail.observations"
        :session-id="props.sessionId"
        :fetch-span-detail="props.fetchSpanDetail"
        :fetch-llm-requests="props.fetchLlmRequests"
      />
    </div>
  </div>
  </div>
</template>

<style scoped lang="scss">
.tm-loading {
  min-height: 60vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
}
.tm-spinner {
  --el-color-primary: var(--accent);
}
.tm-page {
  height: 100%;
  min-height: 440px;
}
.tm-detail-layout {
  display: flex;
  gap: 6px;
  height: 100%;
  min-height: 440px;
}
.tm-left-panel {
  flex: 0 0 42%;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tm-summary {
  flex: none;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--border-subtle);
}
.tm-tree-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.tm-right-panel {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.tm-panel {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: 0 1px 2px rgba(20, 24, 20, 0.03), 0 4px 16px rgba(20, 24, 20, 0.04);
}
@media (max-width: 900px) {
  .tm-detail-layout {
    flex-direction: row;
    height: 100%;
  }
  .tm-left-panel {
    flex: 0 0 40%;
    min-width: 240px;
  }
  .tm-right-panel {
    min-width: 0;
    overflow: hidden;
  }
}
.tm-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  padding: 1px 10px;
  height: 22px;
  border-radius: 999px;
  line-height: 1;
}
.tm-status::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
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
