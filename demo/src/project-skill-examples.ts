/** User-scope capabilities: local Teams demo integration plus separate Office examples. */
export const userSkillExamples = [
  { name: 'Teams 协作', id: 'teams-collaboration', description: '通过 Teams 演示 CLI 读取任务节点上下文，记录采用依据并回传进度、阻塞和成果。', content: '演示接入可用。Skill 文件：demo/skills/teams-demo-collaboration/SKILL.md。命令：node demo/scripts/teams-demo.mjs --help。使用启动材料中的 endpoint、projectId、taskId、nodeId 和 runId；先 context get，再 inputs adopt，然后 progress add / result submit。启动只提供读取入口，实际阅读与采用由原生会话确认。'  },
  { name: 'Word 文件处理', id: 'office-word', description: '阅读与编写 Word 文档，整理需求、评审意见和交付说明。', content: '处理 .docx 文档中的结构、段落、表格和评审意见，并检查导出后的版式。项目材料与输出文件由当前任务指定。' },
  { name: 'Excel 文件处理', id: 'office-excel', description: '整理表格数据、公式和图表，分析项目清单与验收结果。', content: '处理电子表格的数据、公式、格式与图表，用于需求清单、测试结果和项目分析。读取与修改范围由当前任务指定。' },
  { name: 'PowerPoint 文件处理', id: 'office-powerpoint', description: '制作与修改演示文稿，呈现方案、评审和交付汇报。', content: '整理演示文稿结构、页面内容与版式，并预览检查。可在不同项目中复用同一用户技能。' },
] as const;
