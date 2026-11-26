import {
  ALL_PROJECTS,
  COMPANY_WIDE,
  type Department,
  PROJECT_TYPE_LABELS,
  type ProjectScope,
  type ProjectSummary,
  departmentAppliesTo,
  sameScope,
} from '@erp/shared';
import { Briefcase, Check, ChevronsUpDown, FolderOpen, Layers } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProjects } from '@/data/projects';
import { cn } from '@/lib/cn';
import { useProjectScope } from './use-project-scope';

export function scopeLabel(scope: ProjectScope, projects: readonly ProjectSummary[] | undefined) {
  if (scope.kind === 'all') return 'All projects';
  if (scope.kind === 'company') return 'Company-wide';
  const p = projects?.find((x) => x.id === scope.projectId);
  return p ? `${p.code} · ${p.name}` : scope.projectId;
}

/** Projects the switcher offers in this department (Sales lists development projects only). */
export function projectsForDepartment(
  projects: readonly ProjectSummary[],
  department: Department | undefined,
): ProjectSummary[] {
  if (!department) return [...projects];
  return projects.filter((p) => departmentAppliesTo(department, p.type));
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * "All projects", "Company-wide" or one project. The choice lives in the URL, so it survives a
 * reload, can be shared as a link, and carries across departments.
 */
export function ProjectSwitcher({ department }: { department: Department | undefined }) {
  const [open, setOpen] = useState(false);
  const { scope, setScope } = useProjectScope();
  const projects = useProjects();
  const disabled = department?.projectScoped === false;
  const list = projectsForDepartment(projects.data ?? [], department);

  // Ctrl+K (Cmd+K on Mac) opens the switcher from anywhere.
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled]);

  const choose = (next: ProjectScope) => {
    setOpen(false);
    if (!sameScope(next, scope)) setScope(next);
  };

  const label = disabled ? 'Not project-specific' : scopeLabel(scope, projects.data);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 max-w-[min(28rem,60vw)] justify-between gap-2 px-3 font-normal"
          disabled={disabled}
          aria-label={`Project: ${label}. Change project`}
          aria-keyshortcuts={disabled ? undefined : 'Control+K Meta+K'}
        >
          <FolderOpen className="text-muted-foreground" aria-hidden />
          <span className="truncate">{label}</span>
          {!disabled && (
            <kbd className="ml-1 hidden rounded border border-border bg-surface-muted px-1.5 text-[11px] text-muted-foreground md:inline">
              {isMac() ? '⌘K' : 'Ctrl K'}
            </kbd>
          )}
          <ChevronsUpDown className="text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(26rem,calc(100vw-2rem))] p-0">
        <Command
          label="Choose a project"
          // Match on code, name, city and type, not just the visible text.
          filter={(value, search, keywords) => {
            const hay = [value, ...(keywords ?? [])].join(' ').toLowerCase();
            return search
              .toLowerCase()
              .split(/\s+/)
              .filter(Boolean)
              .every((w) => hay.includes(w))
              ? 1
              : 0;
          }}
        >
          <CommandInput placeholder="Search by code, name or city…" />
          <CommandList>
            <CommandEmpty>No project matches that search.</CommandEmpty>
            <CommandGroup heading="Views">
              <ScopeItem
                value="view:all"
                keywords={['all', 'projects']}
                selected={scope.kind === 'all'}
                onSelect={() => choose(ALL_PROJECTS)}
                icon={<Layers aria-hidden />}
              >
                All projects
              </ScopeItem>
              <ScopeItem
                value="view:company"
                keywords={['company', 'wide', 'head office']}
                selected={scope.kind === 'company'}
                onSelect={() => choose(COMPANY_WIDE)}
                icon={<Briefcase aria-hidden />}
              >
                Company-wide
              </ScopeItem>
            </CommandGroup>
            <CommandGroup
              className="mt-1 border-t border-border pt-1"
              heading={
                department?.appliesTo === 'development' ? 'Development projects' : 'Projects'
              }
            >
              {projects.isPending && (
                <p className="px-2 py-2 text-muted-foreground" role="status">
                  Loading projects…
                </p>
              )}
              {projects.isError && (
                <div className="px-2 py-2 text-danger" role="alert">
                  Could not load projects.{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void projects.refetch()}
                  >
                    Try again
                  </button>
                </div>
              )}
              {projects.isSuccess && list.length === 0 && (
                <p className="px-2 py-2 text-muted-foreground">No projects yet.</p>
              )}
              {list.map((p) => (
                <ScopeItem
                  key={p.id}
                  // Prefixed so a project id can never collide with a view item.
                  value={`project:${p.id}`}
                  keywords={[p.code, p.name, p.city, PROJECT_TYPE_LABELS[p.type]]}
                  selected={scope.kind === 'project' && scope.projectId === p.id}
                  onSelect={() => choose({ kind: 'project', projectId: p.id })}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      <span className="tabular text-muted-foreground">{p.code}</span> {p.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">{p.city}</span>
                  </span>
                  <Badge tone={p.type === 'development' ? 'info' : 'neutral'}>
                    {PROJECT_TYPE_LABELS[p.type]}
                  </Badge>
                </ScopeItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ScopeItem({
  selected,
  icon,
  children,
  ...props
}: {
  value: string;
  keywords: string[];
  selected: boolean;
  onSelect: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <CommandItem {...props} data-checked={selected}>
      <Check className={cn('size-4 shrink-0 text-primary', !selected && 'invisible')} aria-hidden />
      {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
      {children}
      {selected && <span className="sr-only">(current)</span>}
    </CommandItem>
  );
}
