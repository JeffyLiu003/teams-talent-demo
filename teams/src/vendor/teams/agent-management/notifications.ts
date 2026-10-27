/** Vendored from iCode Teams framework/client/ui/src/contracts/notifications.ts
 * Source revision: d3deae7ea4e47026925ccbd06ab6eec03f4648c7.
 * Imports are local; index.ts injects demo module loading/source labeling.
 * configuration-editor.ts labels read-only demo data explicitly. Layout, controls and interaction remain upstream.
 */
export type NoticeLevel = 'info' | 'success' | 'warning' | 'error'
export interface UiNotice {
  /** Stable within the plugin; change revision only when the event materially changes. */
  id: string
  revision: string
  title: string
  message?: string
  level: NoticeLevel
}
export interface UiAttention extends UiNotice {
  action?: { label: string } & ({ href: string; onInvoke?: never } | { onInvoke: () => void | Promise<void>; href?: never })
}
/** Host-scoped to the plugin. Dismissal affects presentation, never business state. */
export interface UiNotifications {
  notify(notice: UiNotice): void
  attention(notice: UiAttention): void
  resolveAttention(id: string): void
}
