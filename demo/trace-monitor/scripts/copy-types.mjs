// 构建收尾：把手写的类型声明拷贝为包入口 dist/trace-monitor-vue.d.ts
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
copyFileSync(
  resolve(root, "src/types/trace-monitor-vue.d.ts"),
  resolve(root, "dist/trace-monitor-vue.d.ts"),
);
console.log("types copied -> dist/trace-monitor-vue.d.ts");
