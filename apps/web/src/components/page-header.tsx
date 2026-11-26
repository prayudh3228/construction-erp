import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Small line above the title, e.g. the current project scope. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
}

/** The single h1 of a page, with its description and page-level actions. */
export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {eyebrow && <div className="text-sm text-muted-foreground">{eyebrow}</div>}
        <h1 tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {title}
        </h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}
