import { DEPARTMENT_GROUP_LABELS, type Department, type DepartmentGroup } from '@erp/shared';
import { Link } from '@tanstack/react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { useBranding } from '@/app/branding';
import { cn } from '@/lib/cn';
import { DEPARTMENT_ICONS } from './department-icons';

interface SidebarProps {
  departments: readonly Department[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Called after a link is chosen (closes the drawer on small screens). */
  onNavigate?: () => void;
}

/** Department-first navigation. Shows only the departments the user may open. */
export function Sidebar({
  departments,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: SidebarProps) {
  const branding = useBranding();
  const groups = new Map<DepartmentGroup, Department[]>();
  for (const d of departments) groups.set(d.group, [...(groups.get(d.group) ?? []), d]);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          'flex h-(--topbar-height) shrink-0 items-center gap-3 border-b border-sidebar-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <img
          src={branding.logoUrl}
          alt={collapsed ? branding.companyName : ''}
          className="size-8 shrink-0 rounded-md"
        />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-foreground">{branding.companyName}</p>
            <p className="truncate text-xs text-sidebar-muted-foreground">{branding.productName}</p>
          </div>
        )}
      </div>

      <nav aria-label="Departments" className="flex-1 overflow-y-auto px-2 py-3">
        {departments.length === 0 && (
          <p className="px-2 text-sm text-sidebar-muted-foreground">
            No departments are open to you yet. Ask the admin for access.
          </p>
        )}
        {[...groups].map(([group, items]) => (
          <div key={group} className="mb-4 last:mb-0">
            {collapsed ? (
              <div className="mx-3 mb-2 h-px bg-sidebar-border first:hidden" aria-hidden />
            ) : (
              <h2 className="px-3 pb-1 text-xs font-medium tracking-wide text-sidebar-muted-foreground uppercase">
                {DEPARTMENT_GROUP_LABELS[group]}
              </h2>
            )}
            <ul className="space-y-0.5">
              {items.map((d) => {
                const Icon = DEPARTMENT_ICONS[d.id];
                return (
                  <li key={d.id}>
                    <Tooltip content={d.label} side="right" enabled={collapsed}>
                      <Link
                        to="/$departmentId"
                        params={{ departmentId: d.id }}
                        search={true}
                        onClick={onNavigate}
                        aria-label={collapsed ? d.label : undefined}
                        className={cn(
                          'relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors hover:bg-surface-muted hover:text-foreground',
                          'data-[status=active]:bg-sidebar-active data-[status=active]:text-sidebar-active-foreground',
                          'data-[status=active]:before:absolute data-[status=active]:before:inset-y-1.5 data-[status=active]:before:left-0 data-[status=active]:before:w-0.75 data-[status=active]:before:rounded-full data-[status=active]:before:bg-primary',
                          collapsed && 'justify-center px-0',
                        )}
                      >
                        <Icon className="size-4.5 shrink-0" aria-hidden />
                        {!collapsed && <span className="truncate">{d.label}</span>}
                      </Link>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {onToggleCollapsed && (
        <div className="border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            className={cn(
              'flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-sidebar-muted-foreground hover:bg-surface-muted hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4.5" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4.5" aria-hidden />
            )}
            <span className={cn(collapsed && 'sr-only')}>
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
