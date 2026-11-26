import { z } from 'zod';

/**
 * Department registry: the single list that drives the web sidebar, the mobile "More" screen and
 * (from Phase 3) department-level permissions. Order here is the order users see.
 */

export const DEPARTMENT_IDS = [
  'dashboard',
  'planning',
  'execution',
  'purchase',
  'stores',
  'equipment',
  'finance',
  'sales',
  'hr',
  'quality',
  'safety',
  'legal',
  'admin',
] as const;

export const departmentIdSchema = z.enum(DEPARTMENT_IDS);
export type DepartmentId = z.infer<typeof departmentIdSchema>;

export type ProjectType = 'contract' | 'development';

export type DepartmentGroup = 'overview' | 'projects' | 'business' | 'compliance' | 'system';

export const DEPARTMENT_GROUP_LABELS: Record<DepartmentGroup, string> = {
  overview: 'Overview',
  projects: 'Projects and site',
  business: 'Business',
  compliance: 'Compliance',
  system: 'System',
};

export interface Department {
  id: DepartmentId;
  label: string;
  description: string;
  group: DepartmentGroup;
  /** Which project types this department works with. */
  appliesTo: 'all' | ProjectType;
  /** False for departments with no project view at all (Admin). */
  projectScoped: boolean;
}

export const DEPARTMENTS: readonly Department[] = [
  {
    id: 'dashboard',
    label: 'Management dashboard',
    description: 'Company and project health at a glance.',
    group: 'overview',
    appliesTo: 'all',
    projectScoped: true,
  },
  {
    id: 'planning',
    label: 'Planning',
    description: 'Intake, BOQ, estimates, budgets and schedules.',
    group: 'projects',
    appliesTo: 'all',
    projectScoped: true,
  },
  {
    id: 'execution',
    label: 'Execution (site)',
    description: 'Daily progress, measurements, labour and equipment on site.',
    group: 'projects',
    appliesTo: 'all',
    projectScoped: true,
  },
  {
    id: 'purchase',
    label: 'Purchase',
    description: 'Indents, RFQs, quotations and purchase orders.',
    group: 'projects',
    appliesTo: 'all',
    projectScoped: true,
  },
  {
    id: 'stores',
    label: 'Stores and inventory',
    description: 'Receipts, issues, transfers and stock by site.',
    group: 'projects',
    appliesTo: 'all',
    projectScoped: true,
  },
  {
    id: 'equipment',
    label: 'Equipment and hire',
    description: 'Hired items, returnables, usage logs and hire bills.',
    group: 'projects',
    appliesTo: 'all',
    projectScoped: true,
  },
  {
    id: 'finance',
    label: 'Accounts and finance',
    description: 'Bills, payments, journals, TDS, GST and Tally export.',
    group: 'business',
    appliesTo: 'all',
    projectScoped: true,
  },
  {
    id: 'sales',
    label: 'Sales',
    description: 'Units, leads, bookings and collections for development projects.',
    group: 'business',
    appliesTo: 'development',
    projectScoped: true,
  },
  {
    id: 'hr',
    label: 'HR and labour',
    description: 'Employees, attendance, payroll and labour contractors.',
    group: 'business',
    appliesTo: 'all',
    projectScoped: true,
  },
  {
    id: 'quality',
    label: 'Quality',
    description: 'Inspections and test reports.',
    group: 'compliance',
    appliesTo: 'all',
    projectScoped: true,
  },
  {
    id: 'safety',
    label: 'Safety',
    description: 'Incidents, toolbox talks and permits.',
    group: 'compliance',
    appliesTo: 'all',
    projectScoped: true,
  },
  {
    id: 'legal',
    label: 'Legal and compliance',
    description: 'Licences, approvals, insurance and expiry tracking.',
    group: 'compliance',
    appliesTo: 'all',
    projectScoped: true,
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Users, roles, company settings and branding.',
    group: 'system',
    appliesTo: 'all',
    projectScoped: false,
  },
];

const byId = new Map(DEPARTMENTS.map((d) => [d.id, d]));

export function getDepartment(id: DepartmentId): Department {
  const d = byId.get(id);
  if (!d) throw new Error(`Unknown department: ${id}`);
  return d;
}

export function isDepartmentId(value: unknown): value is DepartmentId {
  return departmentIdSchema.safeParse(value).success;
}

/**
 * What a user may open. Phase 3 fills this from the server; until then the demo user has `all`.
 * The UI only uses it to decide what to SHOW. The API enforces access separately.
 */
export type DepartmentAccess =
  { all: true } | { all?: false; departments: readonly DepartmentId[] };

/** Departments the user can see, in registry order. Unknown ids in the access list are ignored. */
export function visibleDepartments(access: DepartmentAccess): Department[] {
  if (access.all) return [...DEPARTMENTS];
  const allowed = new Set(access.departments);
  return DEPARTMENTS.filter((d) => allowed.has(d.id));
}

/** Whether a project of this type belongs in the department (Sales is development-only). */
export function departmentAppliesTo(department: Department, type: ProjectType): boolean {
  return department.appliesTo === 'all' || department.appliesTo === type;
}
