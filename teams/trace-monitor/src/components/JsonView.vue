<script setup lang="ts">
// 结构化 JSON 树展示：递归渲染对象/数组，支持折叠（深度 >=3 默认折叠）
// 超长字符串默认折叠为前 120 字符，点击「展开」查看全文
import { computed, ref, watch } from "vue";

// 允许组件在自身模板中递归引用自身
defineOptions({ name: "JsonView" });

const props = defineProps<{ data?: unknown; depth?: number; name?: string }>();

const collapsed = ref((props.depth ?? 0) >= 3);

// 长字符串折叠阈值（仅影响默认展示长度，不丢失内容）
const PREVIEW_LEN = 120;
const expanded = ref(false);

const isLongStr = computed(
  () => typeof props.data === "string" && props.data.length > PREVIEW_LEN,
);

// 切换节点/值后回到默认折叠态
watch(
  () => props.data,
  () => {
    expanded.value = false;
  },
);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isArr(v: unknown): v is unknown[] {
  return Array.isArray(v);
}
function kind(v: unknown): string {
  if (typeof v === "string") return "str";
  if (typeof v === "number") return "num";
  if (typeof v === "boolean") return "bool";
  if (v === null) return "null";
  return "num";
}
function display(v: unknown): string {
  if (typeof v === "string") {
    if (isLongStr.value && !expanded.value) return `"${v.slice(0, PREVIEW_LEN)}…"`;
    return `"${v}"`;
  }
  if (v === null) return "null";
  return String(v);
}
function keys(v: unknown): Array<string | number> {
  if (isArr(v)) return v.map((_, i) => i);
  if (isObject(v)) return Object.keys(v);
  return [];
}
function shownKeys(v: unknown): Array<string | number> {
  const ks = keys(v);
  return collapsed.value ? ks.slice(0, 3) : ks;
}
function childValue(v: unknown, k: string | number): unknown {
  if (isArr(v)) return v[k as number];
  return (v as Record<string, unknown>)[String(k)];
}
</script>

<template>
  <span v-if="props.data === undefined || props.data === null" class="tm-scope tm-json tm-json-null">—</span>
  <template v-else-if="isObject(props.data) || isArr(props.data)">
    <div
      class="tm-scope tm-json-node row"
      :style="{ paddingLeft: (props.depth ?? 0) * 16 + 'px', lineHeight: '20px', cursor: 'pointer' }"
      @click="collapsed = !collapsed"
    >
      <span class="tm-json-caret">{{ collapsed ? "▸" : "▾" }}</span>
      <span class="tm-json-name">{{ props.name ?? (isArr(props.data) ? "array" : "object") }}</span>
      <span class="tm-json-meta">
        {{ (isArr(props.data) ? "[" + props.data.length + "]" : "{" + keys(props.data).length + "}") + (collapsed ? " …" : "") }}
      </span>
    </div>
    <template v-if="!collapsed">
      <JsonView
        v-for="k in shownKeys(props.data)"
        :key="String(k)"
        :name="String(k)"
        :data="childValue(props.data, k)"
        :depth="(props.depth ?? 0) + 1"
      />
    </template>
  </template>
  <div
    v-else
    class="tm-scope tm-json-node row"
    :style="{ paddingLeft: (props.depth ?? 0) * 16 + 'px', lineHeight: '20px' }"
  >
    <span class="tm-json-key">{{ props.name ? props.name + ": " : "" }}</span>
    <span :class="'tm-json-' + kind(props.data)">{{ display(props.data) }}</span>
    <span
      v-if="isLongStr"
      class="tm-json-toggle"
      :title="expanded ? '收起' : '展开全文'"
      @click.stop="expanded = !expanded"
    >{{ expanded ? "收起" : "展开" }}</span>
  </div>
</template>

<style scoped lang="scss">
.tm-json {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 20px;
}
.tm-json-key {
  color: var(--ink-mid);
}
.tm-json-str {
  color: #0b8570;
}
.tm-json-num {
  color: #d15a2a;
}
.tm-json-bool {
  color: #7c5dfa;
}
.tm-json-null {
  color: var(--ink-faint);
  font-style: italic;
}
.tm-json-node {
  cursor: pointer;
}
.tm-json-node.row {
  cursor: default;
}
.tm-json-caret {
  color: var(--ink-weak);
  margin-right: 3px;
  display: inline-block;
}
.tm-json-name {
  color: var(--ink);
  font-weight: 600;
}
.tm-json-meta {
  color: var(--ink-faint);
}
.tm-json-toggle {
  margin-left: 8px;
  color: var(--accent);
  font-size: 11.5px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.tm-json-toggle:hover {
  text-decoration: underline;
}
</style>
