/** Current candidate content; no historical artifact text rewriting. */
export function displayTalentArtifact(value: string): string { return value; }
export const skillCandidate = `# dev-frontend-ui 1.1.0 候选

## 白金卡消费返现规则
- 卡片资格独立于金额计算；普通卡反向输入必须覆盖。
- 三个月期间检查开始、结束与时区边界。
- 金额以整数分计算额外0.5%，说明舍入约定。
- 重复处理核对交易条数、奖励和账户余额。
- 功能验收不替代生产安全核验。

来源：当前工作流检查 E3、修复 E4、复测 E5。本地规则记录，不是外部模型实验。
本候选保存于 Talent，原始 Skill 文件保持原样。`;
export const agentCandidate = `Code Agent r2（配置定义）

执行规则：
1. 核对当前需求、规则参数与采用的知识版本。
2. 为资格、期间与金额规则安排正反向用例。
3. 以真实执行报告判定完成；固定记录或缺报告时不宣称外部执行通过。
4. 修复后重跑受影响范围，保留原失败和修改依据。
5. 分别报告功能、安全与模型实验的状态。

来源：当前工作流 E3、E5；r1/r2为配置版本。`;
