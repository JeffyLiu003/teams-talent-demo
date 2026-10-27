export interface SkillApplicationScope {
  projectId: string;
  resourceId: string;
  version: string;
  sha256: string;
}
export interface SkillApplicationPlan extends SkillApplicationScope {
  scope: 'native-user';
  projectName: string;
  targetDirectory: string | null;
  skillDirectory: string | null;
  files: Array<{ path: string; sha256: string }>;
  planToken: string;
  canApply: boolean;
  reason?: string;
}
export interface SkillApplicationReceipt extends SkillApplicationScope {
  scope: 'native-user';
  requestId: string;
  status: 'applied' | 'already-applied';
  targetDirectory: string;
  skillDirectory: string;
  appliedAt: string;
  discovery: { status: 'discovered-and-read' | 'not-verified' | 'failed'; note: string; source?: string; nativeVersion?: string; evidencePath?: string };
  note: string;
}
