/** Display legacy Talent-generated artifacts without rewriting stored definitions or source evidence. */
export function displayTalentArtifact(value: string): string {
  return value
    .replaceAll('Talent 构建的演示知识', 'Talent 项目知识')
    .replaceAll('本条目由明确的 mock 构建生成，未运行模型抽取或全仓代码构图。', '本条目基于已关联资料整理；模型抽取与全仓代码构图尚未执行。')
    .replaceAll('此演示索引不推断业务规则；', '此索引仅记录来源；')
    .replaceAll('该候选为演示产物，不写入本机原始 Skill 文件。', '本候选保存于 Talent，原始 Skill 文件保持原样。')
    .replaceAll('Code Agent r2（演示配置定义）', 'Code Agent r2（配置定义）')
    .replaceAll('r1/r2 为本演示配置版本。', 'r1/r2 为此配置的版本。')
    .replaceAll('固定 Agent/模型/工具，三组预置业务规则用例通过（模拟，未运行真实模型实验）', '固定 Agent/模型/工具，已记录三组业务规则用例的对照结果；未执行模型实验。')
    .replaceAll('固定 Skill/模型/工具，三组预置完成判定用例通过（模拟，未运行真实模型实验）', '固定 Skill/模型/工具，已记录三组完成判定用例的对照结果；未执行模型实验。');
}

// Candidate definitions generated and persisted by Talent.
export const skillCandidate = `# dev-frontend-ui 1.1.0 候选\n\n## 餐饮营销业务场景附录\n\n- 先列出未报名、已报名、过期、暂停、权限不足、次数已满等状态及允许动作。\n- 仅缺报名时展示报名动作；最终返现资格需继续检查活动状态与业务约束。\n- 核对类别 0001、门槛 50 元、比例 5%、单笔上限 30 元、每卡 5 次。\n- 重试保留交易和 rewardId；重复处理核对奖励条数与账户余额。\n- 交付时提供动作可达性、边界与异常用例，以及失败、修复、复测依据。\n\n来源：E3、E4、E5 和项目业务知识。\n本候选保存于 Talent，原始 Skill 文件保持原样。`;
export const agentCandidate = `Code Agent r2（配置定义）\n\n执行规则：\n1. 核对本次需求、采用知识与 Skill 版本。\n2. 以保留被测进程退出码的方式执行测试，保存结构化报告。\n3. 比较包装进程、测试进程与报告结果；不一致或缺报告时标记待验证。\n4. 状态驱动界面增加独立动作可达性检查。\n5. 处理缺陷后复测相关范围，保留原失败与修复记录。\n6. 分别报告功能、Review 与安全结果，提交证据供 Owner 确认。\n\n来源：E3、E5；r1/r2 为此配置的版本。`;
