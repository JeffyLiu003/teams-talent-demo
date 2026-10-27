// 组件库构建配置：以 lib 模式打包 src/lib.ts（仅 JS/CSS）
// 类型声明由 scripts/build-types.mjs 手写生成（见 dist/trace-monitor-vue.d.ts），
// 避免 vite-plugin-dts / api-extractor 在不同 TS 版本下的解析缺陷。
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "src/lib.ts"),
      name: "TraceMonitorVue",
      fileName: "trace-monitor-vue",
    },
    rollupOptions: {
      // 外部化 Vue 与 Element Plus、vue-router 等，避免重复打包，交由宿主应用提供
      external: ["vue", "vue-router", "element-plus", "pinia", "axios", "dayjs"],
      output: {
        exports: "named",
        globals: {
          vue: "Vue",
          "element-plus": "ElementPlus",
        },
      },
    },
  },
});
