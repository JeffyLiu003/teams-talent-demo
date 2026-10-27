// 应用配置全局单例：storageBackend 供顶栏展示 + 节点详情懒加载 gating
// 全应用只拉一次 /config（并发去重），避免 App.vue 与 TraceList.vue 各自重复请求
import { defineStore } from "pinia";
import { ref } from "vue";
import { fetchConfig } from "@/api/metrics";

export const useAppConfigStore = defineStore("appConfig", () => {
  // 顶栏展示用；默认 "database" 保持现有 AppTopbar 行为不变
  const storageBackend = ref("database");
  // 是否已成功拿到配置：gating 必须依赖它（默认值 database 不能作为判断依据）
  const loaded = ref(false);
  let inflight: Promise<void> | null = null; // 并发去重：多处同时 load() 只发 1 次请求

  function load() {
    if (loaded.value) return Promise.resolve();
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const cfg = await fetchConfig();
        storageBackend.value = cfg.storageBackend;
        loaded.value = true;
      } catch {
        /* 失败保持默认值，loaded 仍为 false */
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  /** 节点详情懒加载是否启用：必须同时满足「已加载」与「database」
   *  未确认模式期间一律返回 false（走本地 spans 全量兜底，失败方向永远偏向不懒加载） */
  const lazyDetailEnabled = () => loaded.value && storageBackend.value === "database";

  return { storageBackend, loaded, lazyDetailEnabled, load };
});
