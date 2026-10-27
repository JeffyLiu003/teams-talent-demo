// Mock "ask iCode to filter sessions". The real product sends the request to iCode; here a few common
// phrasings are understood locally.
import type { Session, TalentsState } from '../types.ts';
import { now, num, tokens } from './format.ts';

interface Condition { test(s: Session): boolean; text: string }

export function askICode(st: TalentsState, prompt: string, sessions: Session[]) {
  const text = prompt.replace(/\s+/g, '');
  const conds: Condition[] = [];
  function cmp(re: RegExp, field: 'turns' | 'messages' | 'tokens' | 'files', label: string, scale: boolean) {
    const m = re.exec(text);
    if (!m) return;
    const n = parseFloat(m[2]) * (scale && /万/.test(m[0]) ? 10000 : 1);
    const less = /少于|小于|低于|不到|以下|不超过|<|以内/.test(m[0]);
    conds.push({ test: s => less ? s[field] < n : s[field] > n, text: label + (less ? '少于 ' : '超过 ') + (field === 'tokens' ? tokens(n) : num(n)) });
  }
  cmp(/(轮次|轮数|轮对话|对话轮|轮)[^0-9]{0,6}?(\d+(?:\.\d+)?)/, 'turns', '对话轮次', false);
  cmp(/(超过|大于|多于|高于|少于|小于|低于|不到|不超过)(\d+(?:\.\d+)?)轮/, 'turns', '对话轮次', false);
  cmp(/(消息)[^0-9]{0,6}?(\d+(?:\.\d+)?)/, 'messages', '消息数', false);
  cmp(/(token|Token|TOKEN)[^0-9]{0,6}?(\d+(?:\.\d+)?)万?/, 'tokens', 'Token 用量', true);
  cmp(/(修改|改动)[^0-9]{0,6}?(\d+(?:\.\d+)?)个?文件/, 'files', '修改文件数', false);
  // Drop the duplicated turn condition when both phrasings match.
  if (conds.length > 1 && conds[0].text.startsWith('对话轮次') && conds[1].text.startsWith('对话轮次')) conds.splice(1, 1);

  const days = /最近(\d+)天/.exec(text);
  const today = new Date(now().replace(' ', 'T')).getTime();
  const daysAgo = (s: Session) => (today - new Date(s.updated.replace(' ', 'T')).getTime()) / 86400000;
  if (days) conds.push({ test: s => daysAgo(s) <= +days[1], text: '最近 ' + days[1] + ' 天内更新' });
  else if (/本周|这周|最近一周|近一周/.test(text)) conds.push({ test: s => daysAgo(s) <= 7, text: '最近 7 天内更新' });
  else if (/今天/.test(text)) conds.push({ test: s => daysAgo(s) < 1, text: '今天更新' });

  st.team.members.forEach(m => {
    if (text.includes(m.name)) conds.push({ test: s => s.owner === m.id, text: '由' + m.name + '共享' });
  });
  if (/问答|Q&A|QA/.test(text)) conds.push({ test: s => s.agent === 'Q&A Agent', text: '使用 Q&A Agent' });

  const topics = ['白金卡', '返现', '营销', '奖励', '资格', '明细', '账单', '通知', '权益', '入账', '账户', '交易', '测试', '幂等', '冲正', '乐观锁', '分页', '排序', '联调', '修复'];
  const topicHits = topics.filter(t => text.includes(t));
  if (/失败|报错|出错|返工|问题|缺陷|bug/i.test(text)) topicHits.push('问题');
  if (topicHits.length) {
    conds.push({
      test: s => topicHits.some(t => {
        if (t === '问题') return /问题|修复|缺陷|排查|失败|冲突/.test(s.title);
        if (t === '修复') return /修复|缺陷/.test(s.title);
        return s.title.includes(t);
      }),
      text: '主题与「' + topicHits.join('、') + '」相关',
    });
  }

  let result: Session[], answer: string;
  if (conds.length) {
    result = sessions.filter(s => conds.every(c => c.test(s)));
    const list = conds.map(c => c.text).join('，');
    answer = result.length ? '找到 ' + result.length + ' 个符合要求的会话：' + list + '。' : '没有同时满足这些条件的会话：' + list + '。';
  } else {
    // Nothing recognisable: fall back to the sessions most worth diagnosing.
    result = sessions.slice().sort((a, b) => b.turns - a.turns).slice(0, 8);
    answer = '按对话轮次和修改规模挑选了 ' + result.length + ' 个最值得诊断的会话。';
  }
  result.sort((a, b) => a.updated < b.updated ? 1 : -1);
  return { ids: result.map(s => s.id), answer };
}
