import { z } from 'zod';
import type { ProjectType } from './departments.js';

/**
 * What the project switcher has selected. It travels in the URL as `?project=`:
 * no parameter = all projects, `company` = company-wide items, anything else = one project id.
 */
export type ProjectScope =
  { kind: 'all' } | { kind: 'company' } | { kind: 'project'; projectId: string };

export const PROJECT_SCOPE_PARAM = 'project';
export const COMPANY_SCOPE_VALUE = 'company';
export const ALL_SCOPE_VALUE = 'all';

const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const ALL_PROJECTS: ProjectScope = { kind: 'all' };
export const COMPANY_WIDE: ProjectScope = { kind: 'company' };

/** Read the URL value. Anything missing or malformed falls back to "all projects". */
export function parseProjectScope(value: unknown): ProjectScope {
  if (typeof value !== 'string' || value === '' || value === ALL_SCOPE_VALUE) return ALL_PROJECTS;
  if (value === COMPANY_SCOPE_VALUE) return COMPANY_WIDE;
  if (PROJECT_ID_PATTERN.test(value)) return { kind: 'project', projectId: value };
  return ALL_PROJECTS;
}

/** URL value for a scope. "All projects" is the default, so it is left out of the URL. */
export function serializeProjectScope(scope: ProjectScope): string | undefined {
  switch (scope.kind) {
    case 'all':
      return undefined;
    case 'company':
      return COMPANY_SCOPE_VALUE;
    case 'project':
      return scope.projectId;
  }
}

export function sameScope(a: ProjectScope, b: ProjectScope): boolean {
  return serializeProjectScope(a) === serializeProjectScope(b);
}

/**
 * Minimal project shape the shells need (switcher, summaries). PROVISIONAL: the real project
 * master arrives in Phase 5 and will extend this, not replace it.
 */
export const projectStatusSchema = z.enum(['planned', 'active', 'on_hold', 'completed']);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  contract: 'Contract',
  development: 'Development',
};

/** "all" and "company" mean something else in the URL, so they can never be project ids. */
export const RESERVED_PROJECT_IDS: readonly string[] = [ALL_SCOPE_VALUE, COMPANY_SCOPE_VALUE];

export const projectIdSchema = z
  .string()
  .regex(PROJECT_ID_PATTERN, 'Use letters, digits, - or _ (up to 64).')
  .refine((v) => !RESERVED_PROJECT_IDS.includes(v.toLowerCase()), 'This id is reserved.');

export const projectSummarySchema = z.object({
  id: projectIdSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['contract', 'development']),
  status: projectStatusSchema,
  city: z.string().min(1),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
