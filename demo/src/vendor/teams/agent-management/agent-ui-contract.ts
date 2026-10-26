/** Vendored from iCode Teams business/shared/agent-ui/contract.ts
 * Source revision: d3deae7ea4e47026925ccbd06ab6eec03f4648c7.
 * Imports are local; index.ts injects demo module loading/source labeling.
 * configuration-editor.ts labels read-only demo data explicitly. Layout, controls and interaction remain upstream.
 */
import type { ConfigurationPort, ConfigurationDefinition } from './configuration-contract.js'
import type { ObservedUiMountContext } from './ui-contract.js'

export const AGENT_UI_API = 1
export const agentCategories = ['agent', 'model', 'skill', 'mcp', 'hook', 'plugin'] as const
export type AgentCategory = typeof agentCategories[number]

/** The management page renders these facts without interpreting a tool's native schema. */
export interface AgentCategorySummary {
  category: AgentCategory
  label: string
  description: string
  count?: number
  unavailableReason?: string
}
export interface AgentUiFact { label: string; value: string }
export interface AgentUiStartup {
  cwd: string
  terminals: Array<{ id: string; name: string }>
  selectedTerminal?: string
  launchLabel: string
  hint: string
  disabledReason?: string
  chooseDirectory(cwd?: string): Promise<{ cancelled: boolean; cwd?: string }>
  selectTerminal(terminal: string): Promise<void>
  launch(input: { cwd: string; terminal?: string }): Promise<{ message: string; instructions?: string }>
}
export interface AgentConfigurationController {
  setWorkingDirectory?(cwd: string): void
  activate(): void
  selectCategory(category: AgentCategory): void
  hasDrafts(): boolean
  isBusy(): boolean
  /** Human-readable identity of the frozen draft owner, never a mutable current selection. */
  getTargetLabel(): string | undefined
  /** Optional typed native templates; unsupported event/plugin conversions stay with their adapter. */
  resourceCategories?: Array<'hook'|'plugin'>
  resourceDefinition?(): {nativeId: string; definition: ConfigurationDefinition}
  applyResource?(definition: ConfigurationDefinition): void
  dispose(): void
}
export interface AgentUiInstance {
  /** Opaque within one adapter; the common page never parses this value. */
  id: string
  name: string
  kind: string
  state: string
  version?: string
  path?: string
  identity: string
  installLabel?: string
  /** Opens the shared native installation guide; detection never installs an update. */
  updateLabel?: string
  activateSelected?(): Promise<void>
  facts: AgentUiFact[]
  categories: AgentCategorySummary[]
  startup: AgentUiStartup
  /** Independent safe overview facts; updates never replace mounted configuration drafts. */
  setWorkingDirectory?(cwd: string, updated: () => void): Promise<void>
  refreshSummary?(updated: () => void): Promise<void>
  configurationPort?: ConfigurationPort
  mountConfiguration(container: HTMLElement, context: ObservedUiMountContext): AgentConfigurationController
  mountMaintenance(container: HTMLElement, context: ObservedUiMountContext): (() => void)
}
export interface AgentUiAdapter {
  loadInstances(): Promise<AgentUiInstance[]>
  mountAdoption(container: HTMLElement, context: ObservedUiMountContext, changed: () => void): (() => void)
  mountInstallation?(container: HTMLElement, context: ObservedUiMountContext, changed: () => void): (() => void)
  dispose(): void
}
export interface AgentUiAdapterContext extends ObservedUiMountContext {
  /** Always routed through the management broker and this adapter's registered ID. */
  call<T>(command: Record<string, unknown>): Promise<T>
  /** Terminal launch uses the shared management service, including frozen adapter ownership. */
  terminal<T>(command: Record<string, unknown>): Promise<T>
  changed(): void
}
export interface AgentUiModule {
  agentUiApi: typeof AGENT_UI_API
  createAgentUi(context: AgentUiAdapterContext): AgentUiAdapter
}
export interface AgentUiRegistration {
  id: string
  name: string
  uiBundleId: string
}
