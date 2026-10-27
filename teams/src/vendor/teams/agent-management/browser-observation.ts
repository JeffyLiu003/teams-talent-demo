/** Vendored from iCode Teams framework/client/ui/src/contracts/browser-observation.ts
 * Source revision: d3deae7ea4e47026925ccbd06ab6eec03f4648c7.
 * Imports are local; index.ts injects demo module loading/source labeling.
 * configuration-editor.ts labels read-only demo data explicitly. Layout, controls and interaction remain upstream.
 */
export interface BrowserOperation {
  event(name: string, attributes: Record<string, string | number | boolean>, error?: unknown): void
}

/** Host-provided observation for existing browser requests; owns no SDK or transport state. */
export interface BrowserObservation {
  observeBrowserOperation<T>(name: string, attributes: Record<string, string | number | boolean>, body: (operation: BrowserOperation) => Promise<T>): Promise<T>
  tracedFetch(name: string, input: RequestInfo | URL, init?: RequestInit): Promise<Response>
  tracedJson<T = unknown>(name: string, input: RequestInfo | URL, init?: RequestInit): Promise<{ response: Response; value: T }>
}
