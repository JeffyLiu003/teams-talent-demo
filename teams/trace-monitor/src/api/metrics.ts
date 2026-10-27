// 系统接口封装
import { api } from "@/utils/request";
import type { AppConfig } from "@/types";

// 运行时配置：存储后端模式（file/database）
export async function fetchConfig(): Promise<AppConfig> {
  const { data } = await api.get<AppConfig>("/config");
  return data;
}
