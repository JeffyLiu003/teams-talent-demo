<script setup lang="ts">
// 调用树容器：工具栏（全部展开/折叠）+ 可滚动节点列表
import { ref } from "vue";
import type { TraceNode } from "@/types";
import TraceTreeNode from "@/components/TraceTreeNode.vue";

defineProps<{
  tree: TraceNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}>();

const allOpen = ref(false);
/** 重挂计数：每次「全部展开/折叠」自增并重挂整棵树，所有节点 open 状态被重置。
 *  不能用固定 key（open/closed），否则从默认状态切换回去时 key 不变、树不重挂。 */
const remountCounter = ref(0);

function toggleAll(open: boolean) {
  allOpen.value = open;
  remountCounter.value++;
}
</script>

<template>
  <div class="tm-scope tm-tree-wrap">
    <div class="tm-tree-toolbar">
      <el-button size="small" @click="toggleAll(true)">全部展开</el-button>
      <el-button size="small" @click="toggleAll(false)">全部折叠</el-button>
    </div>
    <div class="tm-tree-scroll">
      <el-empty v-if="tree.length === 0" description="无节点" :image-size="60" />
      <div v-else :key="remountCounter">
        <TraceTreeNode
          v-for="(n, idx) in tree"
          :key="n.span?.id"
          :node="n"
          :depth="0"
          :selected-id="selectedId"
          :default-open="allOpen"
          :has-sibling-below="idx < tree.length - 1"
          @select="(id: string) => onSelect(id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tm-tree-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.tm-tree-toolbar {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border-subtle);
  align-items: center;
}
.tm-tree-scroll {
  flex: 1;
  overflow: auto;
  padding: 8px 10px 16px;
}
</style>
