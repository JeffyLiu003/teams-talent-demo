# 组件模板

```text
<ComponentName>/
  index.tsx            # 组件入口
  styles.ts            # 样式（设计令牌）
  types.ts             # 类型定义
  __tests__/           # 组件单测
```

要点：复用组件库、状态可控、loading/error/empty三态、i18n key。

---

## L3 必填深度字段

| 字段 | 要求 |
|------|------|
| 三态 | loading/error/empty |
| 兼容矩阵 | 浏览器/分辨率 |
