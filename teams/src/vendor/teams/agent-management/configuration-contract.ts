/** Vendored from iCode Teams business/shared/agent-protocol/configuration-contract.ts
 * Source revision: d3deae7ea4e47026925ccbd06ab6eec03f4648c7.
 * Imports are local; index.ts injects demo module loading/source labeling.
 * configuration-editor.ts labels read-only demo data explicitly. Layout, controls and interaction remain upstream.
 */
export type ManagedCategory = 'agent' | 'model' | 'skill' | 'mcp'
export interface ConfigurationResource { id: string; name: string; description?: string; scope: string; source?: string; readOnly?: boolean }
export interface ConfigurationDocument { resource: ConfigurationResource; content: string; revision: string | null; format: string; path?: string; readOnly?: boolean; native: unknown; originalContent?: string; rawTitle?: string; formatDescription?: string; contentReadOnly?: boolean }
export interface ConfigurationField {
  id: string; label: string; value: string; kind?: 'text' | 'password' | 'textarea' | 'select' | 'number' | 'toggle' | 'list' | 'map' | 'checklist' | 'table'; choices?: Array<[string,string]>; hint?: string; readOnly?: boolean; unsetLabel?: string; sensitive?: boolean
  columns?: Array<{key: string; label: string; kind?: 'text' | 'number' | 'select' | 'textarea'; choices?: Array<[string,string]>}>
}
export interface ConfigurationGroup { title: string; description?: string; fields: ConfigurationField[]; advanced?: boolean; tab?: string }
/** Native projections, never a lossy universal schema. Resource definition and target policy are separate groups. */
export interface ConfigurationPort {
  target: string
  toolType?: string
  /** Export the definition without target policies. Unsupported conversions fail explicitly. */
  definition?(category: ManagedCategory, document: ConfigurationDocument, content: string): ConfigurationDefinition
  applyDefinition?(category: ManagedCategory, definition: ConfigurationDefinition, destination?: ConfigurationDocument, applicationTarget?: string): Promise<ConfigurationDocument>
  applicationTargets?(category: ManagedCategory): Array<[string,string]>
  categories: ManagedCategory[]
  list(category: ManagedCategory, cwd?: string): Promise<ConfigurationResource[]>
  read(category: ManagedCategory, resource: ConfigurationResource, cwd?: string): Promise<ConfigurationDocument>
  groups(category: ManagedCategory, document: ConfigurationDocument, content: string): ConfigurationGroup[]
  patch(category: ManagedCategory, document: ConfigurationDocument, content: string, field: string, value: string): string
  validate(category: ManagedCategory, document: ConfigurationDocument, content: string): void
  save(category: ManagedCategory, document: ConfigurationDocument, content: string): Promise<ConfigurationDocument>
  creation?(category: ManagedCategory): {title: string; nameLabel: string; fields: ConfigurationField[]} | undefined
  create?(category: ManagedCategory, id: string, values?: Record<string,string>): Promise<ConfigurationDocument>
  canCreate?(category: ManagedCategory): boolean
  canRemove?(category: ManagedCategory, document: ConfigurationDocument): boolean
  remove?(category: ManagedCategory, document: ConfigurationDocument): Promise<void>
  actions?(category: ManagedCategory, document: ConfigurationDocument): Array<{label: string; run(): Promise<void>}>
  mountExtras?(container: HTMLElement, category: ManagedCategory, document: ConfigurationDocument, draft: {content(): string; changed(value: string): void; error(message: string): void; signal: AbortSignal; openResource?(category: ManagedCategory, id: string, section?: string): void}): void
}
export const isManagedCategory = (category: ManagedCategory | 'hook' | 'plugin'): category is ManagedCategory => ['agent','model','skill','mcp'].includes(category)

export type ResourceCategory = ManagedCategory | 'hook' | 'plugin'
/** A reusable definition; native policies and target bindings are deliberately excluded from portable MCP connections. */
export interface ConfigurationDefinition {
  category: ResourceCategory
  name: string
  description?: string
  /** null denotes a portable definition. Native definitions retain the adapter tool type. */
  toolType: string | null
  payload: { kind: 'mcp'; transport: 'stdio' | 'http'; command?: string; args?: string[]; env?: Record<string,string>; url?: string; headers?: Record<string,string> }
    | { kind: 'skill'; directory: string; content: string }
    | { kind: 'native'; format: string; content: string }
}
export interface SharedConfigurationResource extends ConfigurationDefinition { id: string; revision: string }
export interface ConfigurationApplication { resourceId: string; target: string; category: ResourceCategory; nativeId: string; appliedRevision: string }
export interface ConfigurationCatalog { resources: SharedConfigurationResource[]; applications: ConfigurationApplication[]; revision: string | null }
export interface ConfigurationCatalogClient {
  read(): Promise<ConfigurationCatalog>
  isAcquired?(id: string): Promise<boolean>
  save(definition: ConfigurationDefinition, expectedRevision: string | null, id?: string): Promise<ConfigurationCatalog>
  bind(application: ConfigurationApplication, expectedRevision: string): Promise<ConfigurationCatalog>
  unbind(target: string, category: ResourceCategory, nativeId: string, expectedRevision: string): Promise<ConfigurationCatalog>
}
