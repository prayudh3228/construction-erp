import {
  ALL_PROJECTS,
  COMPANY_WIDE,
  type Department,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  type ProjectStatus,
  type ProjectSummary,
  departmentAppliesTo,
  visibleDepartments,
} from '@erp/shared';
import { useParams } from '@tanstack/react-router';
import { type ColumnDef } from '@tanstack/react-table';
import { Briefcase, Lock, SearchX } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { usePageTitle } from '@/app/page-title';
import { useSession } from '@/app/session';
import { DEPARTMENT_ICONS } from '@/app/shell/department-icons';
import { projectsForDepartment } from '@/app/shell/ProjectSwitcher';
import { useCurrentDepartment, useProjectScope } from '@/app/shell/use-project-scope';
import { DataTable } from '@/components/data-table/data-table';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjects } from '@/data/projects';
import { NotFoundPage } from './NotFoundPage';

const STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  planned: 'neutral',
  active: 'success',
  on_hold: 'warning',
  completed: 'info',
};

/**
 * Template every department page follows: an "All projects" summary, one project's view, or the
 * Company-wide section, depending on the project switcher. Later phases fill in the real content.
 */
export function DepartmentPage() {
  const department = useCurrentDepartment();
  const session = useSession();
  const params = useParams({ strict: false }) as { departmentId?: string };
  usePageTitle(
    department?.label ?? (params.departmentId === undefined ? 'Start' : 'Page not found'),
  );
  if (!session) return null;
  if (!department && params.departmentId !== undefined) return <NotFoundPage />;
  if (!department) {
    // Only reached on "/" when the user has no departments at all.
    return (
      <EmptyState
        icon={<Lock aria-hidden />}
        title="No departments are open to you yet"
        description="Ask the admin to give you access."
      />
    );
  }

  const allowed = visibleDepartments(session.access).some((d) => d.id === department.id);
  if (!allowed) {
    return (
      <EmptyState
        icon={<Lock aria-hidden />}
        title={`You do not have access to ${department.label}`}
        description="Ask the admin if you need it."
      />
    );
  }

  return <DepartmentView key={department.id} department={department} />;
}

function DepartmentView({ department }: { department: Department }) {
  const Icon = DEPARTMENT_ICONS[department.id];

  if (!department.projectScoped) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={department.label}
          description={department.description}
          eyebrow={<HeaderIcon icon={<Icon aria-hidden />} text="Company settings" />}
        />
        <EmptyState
          title="Settings arrive soon"
          description="Users and sign-in come in Phase 2, roles and permissions in Phase 3, and company settings in Phase 4."
        />
      </div>
    );
  }

  return <ProjectScopedView department={department} />;
}

function HeaderIcon({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 [&_svg]:size-4">
      {icon}
      {text}
    </span>
  );
}

function ProjectScopedView({ department }: { department: Department }) {
  const Icon = DEPARTMENT_ICONS[department.id];
  const { scope, setScope } = useProjectScope();
  const projects = useProjects();

  const eyebrowText =
    scope.kind === 'all' ? 'All projects' : scope.kind === 'company' ? 'Company-wide' : 'Project';

  const header = (
    <PageHeader
      title={department.label}
      description={department.description}
      eyebrow={<HeaderIcon icon={<Icon aria-hidden />} text={eyebrowText} />}
    />
  );

  if (scope.kind === 'company') {
    return (
      <div className="space-y-6">
        {header}
        <CompanyWideSection department={department} />
      </div>
    );
  }

  if (projects.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingState label="Loading projects…" rows={4} />
      </div>
    );
  }

  if (projects.isError) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState
          title="Could not load projects"
          description="Check your connection and try again."
          onRetry={() => void projects.refetch()}
          retrying={projects.isFetching}
        />
      </div>
    );
  }

  if (scope.kind === 'project') {
    const project = projects.data.find((p) => p.id === scope.projectId);
    if (!project) {
      return (
        <div className="space-y-6">
          {header}
          <EmptyState
            icon={<SearchX aria-hidden />}
            title="Project not found"
            description={`There is no project "${scope.projectId}", or it is not assigned to you.`}
            action={
              <Button variant="outline" onClick={() => setScope(ALL_PROJECTS)}>
                Show all projects
              </Button>
            }
          />
        </div>
      );
    }
    if (!departmentAppliesTo(department, project.type)) {
      return (
        <div className="space-y-6">
          {header}
          <EmptyState
            title={`${department.label} covers ${department.appliesTo} projects only`}
            description={`${project.code} · ${project.name} is a ${PROJECT_TYPE_LABELS[project.type].toLowerCase()} project.`}
            action={
              <Button variant="outline" onClick={() => setScope(ALL_PROJECTS)}>
                Show all {department.appliesTo} projects
              </Button>
            }
          />
        </div>
      );
    }
    return (
      <div className="space-y-6">
        {header}
        <ProjectCard project={project} />
        <EmptyState
          title={`No ${department.label.toLowerCase()} records yet`}
          description="This department's screens arrive in later phases. Records will appear here for this project."
        />
      </div>
    );
  }

  const list = projectsForDepartment(projects.data, department);
  return (
    <div className="space-y-6">
      {header}
      <SummaryCards projects={list} />
      <Card aria-labelledby="all-projects-heading">
        <CardHeader>
          <CardTitle id="all-projects-heading">All projects</CardTitle>
          <CardDescription>
            {department.appliesTo === 'development'
              ? 'Development projects only. Choose one to see its records.'
              : 'Choose a project to see its records.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectsTable
            projects={list}
            onOpen={(p) => setScope({ kind: 'project', projectId: p.id })}
          />
        </CardContent>
      </Card>
      <CompanyWideSection department={department} compact />
    </div>
  );
}

function SummaryCards({ projects }: { projects: readonly ProjectSummary[] }) {
  const count = (pred: (p: ProjectSummary) => boolean) => projects.filter(pred).length;
  const items = [
    { label: 'Projects', value: projects.length },
    { label: 'Active', value: count((p) => p.status === 'active') },
    { label: 'Contract', value: count((p) => p.type === 'contract') },
    { label: 'Development', value: count((p) => p.type === 'development') },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl border border-border bg-surface p-4 shadow-xs">
          <dt className="text-sm text-muted-foreground">{i.label}</dt>
          <dd className="tabular mt-1 text-2xl font-semibold">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProjectsTable({
  projects,
  onOpen,
}: {
  projects: readonly ProjectSummary[];
  onOpen: (p: ProjectSummary) => void;
}) {
  const columns = useMemo<ColumnDef<ProjectSummary, unknown>[]>(
    () => [
      { accessorKey: 'code', header: 'Code', enableHiding: false },
      { accessorKey: 'name', header: 'Name' },
      {
        accessorKey: 'type',
        header: 'Type',
        filterFn: 'equalsString',
        meta: {
          filterAllLabel: 'All types',
          searchText: (p) => PROJECT_TYPE_LABELS[p.type],
          filterOptions: Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => ({
            value,
            label,
          })),
        },
        cell: ({ row }) => (
          <Badge tone={row.original.type === 'development' ? 'info' : 'neutral'}>
            {PROJECT_TYPE_LABELS[row.original.type]}
          </Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        filterFn: 'equalsString',
        meta: {
          filterAllLabel: 'All statuses',
          searchText: (p) => PROJECT_STATUS_LABELS[p.status],
          filterOptions: Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          })),
        },
        cell: ({ row }) => (
          <Badge tone={STATUS_TONE[row.original.status]}>
            {PROJECT_STATUS_LABELS[row.original.status]}
          </Badge>
        ),
      },
      { accessorKey: 'city', header: 'City' },
    ],
    [],
  );

  return (
    <DataTable
      label="Projects"
      columns={columns}
      data={projects}
      getRowId={(p) => p.id}
      searchPlaceholder="Search projects…"
      onRowClick={onOpen}
      rowActionLabel={(p) => `Open ${p.code} ${p.name}`}
      empty={{
        title: 'No projects yet',
        description: 'Projects are created in Planning (Phase 5).',
      }}
    />
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Card aria-labelledby="project-heading">
      <CardContent className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="tabular text-sm text-muted-foreground">{project.code}</p>
          <h2 id="project-heading" className="text-lg font-semibold">
            {project.name}
          </h2>
          <p className="text-sm text-muted-foreground">{project.city}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone={project.type === 'development' ? 'info' : 'neutral'}>
            {PROJECT_TYPE_LABELS[project.type]}
          </Badge>
          <Badge tone={STATUS_TONE[project.status]}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function CompanyWideSection({
  department,
  compact = false,
}: {
  department: Department;
  compact?: boolean;
}) {
  const { setScope } = useProjectScope();
  return (
    <Card aria-labelledby="company-wide-heading">
      <CardHeader>
        <CardTitle id="company-wide-heading">Company-wide</CardTitle>
        <CardDescription>
          {department.label} items that do not belong to a single project (head office, shared
          costs).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EmptyState
          icon={<Briefcase aria-hidden />}
          title="No company-wide items yet"
          description="They will appear here as the department's screens are built."
          action={
            compact ? (
              <Button variant="outline" onClick={() => setScope(COMPANY_WIDE)}>
                Open company-wide view
              </Button>
            ) : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
