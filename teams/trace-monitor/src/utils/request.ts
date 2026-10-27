// 统一 HTTP 封装：基于 axios 实例，禁止业务侧直接 new Axios（对齐公司编码规范）
// baseURL 支持两种方式配置：
//   1. 环境变量 VITE_API_BASE（应用内构建时）
//   2. setTraceApiBase()（以组件库方式集成时，运行时覆盖）
import axios from "axios";

let apiBase: string = import.meta.env.VITE_API_BASE || "/api/v1";

/** 组件库集成方在应用运行时指定后端地址 */
export function setTraceApiBase(url: string) {
  apiBase = url;
}

/** 当前生效的 API base */
export function getTraceApiBase(): string {
  return apiBase;
}

export const api = axios.create({
  timeout: 60000,
});

// 每次请求动态注入 baseURL，保证 setTraceApiBase 在实例创建后仍生效
api.interceptors.request.use((config) => {
  config.baseURL = apiBase;
  // API 请求统一禁用浏览器缓存，避免拿到旧版本 SPA 回退页（HTML）导致解析失败
  config.headers["Cache-Control"] = "no-cache, no-store";
  return config;
});

// 统一错误消息提取：axios 错误 / 后端 detail / 兜底
export function extractError(e: unknown, fallback = "请求失败"): string {
  if (axios.isAxiosError(e)) {
    const detail = (e.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (e.message) return e.message;
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
