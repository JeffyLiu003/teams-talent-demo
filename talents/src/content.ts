// Artifact text bundled from content/ (tools/bundle-content.mjs), so previews need no extra requests.
import bundle from './generated/content.json';

const files: Record<string, string> = bundle.files;
const trees: Record<string, string[]> = bundle.trees;

export function content(key: string): string | null { return files[key] ?? null; }
export function skillTree(name: string): string[] { return trees['skills/' + name] ?? ['SKILL.md']; }
