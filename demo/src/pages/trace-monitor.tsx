// 开发会话轨迹：同源内嵌去壳后的 trace_monitor_vue 只读监控页。
// 页面自身已去掉 Vue 外壳，这里只负责铺满主内容区，不重复 Teams 的顶栏/侧栏。
export function TraceMonitor() {
  return (
    <div className="trace-monitor-page">
      <iframe className="trace-monitor-frame" src="/trace-monitor/" title="开发会话轨迹" />
    </div>
  );
}
