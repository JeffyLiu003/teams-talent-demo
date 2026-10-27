// 项目状态管理（Pinia）：紧凑工具条单选过滤
// ★ 项目 ID 由集成方/上报方自带，前端不再管理项目元数据，
//   仅在 localStorage 记录最近使用的项目 ID 历史（key: "tm_recent_projects"）
import { defineStore } from "pinia";
import { ref } from "vue";

const STORAGE_KEY = "tm_recent_projects";
const MAX_HISTORY = 8;
// iCode 实时采集默认写入的项目 id（见 start-icode-trace2.bat 的 TRACE2_PROJECT）
const DEFAULT_PROJECT = "icode";

function readHistory(): { id: string; name: string }[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeHistory(list: { id: string; name: string }[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* 写入失败不影响主流程 */
  }
}

export const useProjectStore = defineStore("project", () => {
  // 最近使用的项目 ID 历史（name 即项目 ID 本身，仅为兼容结构保留）
  const projects = ref<{ id: string; name: string }[]>([]);
  // 当前选中的项目 id；初始取历史最近一条，无历史时回落到 iCode 采集项目
  const selected = ref<string>(readHistory()[0]?.id ?? DEFAULT_PROJECT);

  /** 当前生效的项目 id */
  const projectId = () => selected.value;

  /** 从 localStorage 读取最近使用历史（不再请求后端） */
  function load() {
    projects.value = readHistory();
  }

  /** 工具条下拉单选统一入口：记录到历史头部（去重、最多保留 8 条） */
  function applySelection(v: string) {
    selected.value = v;
    if (!v) return;
    const next = [{ id: v, name: v }, ...projects.value.filter((p) => p.id !== v)];
    projects.value = next.slice(0, MAX_HISTORY);
    writeHistory(projects.value);
  }

  return { projects, selected, projectId, load, applySelection };
});
