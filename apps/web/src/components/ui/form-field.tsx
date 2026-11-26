import { type ReactElement, cloneElement, useId } from 'react';
import { cn } from '@/lib/cn';
import { Label } from './label';

interface FieldControlProps {
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
}

interface FormFieldProps {
  label: string;
  /** The input. It receives id, aria-invalid and aria-describedby automatically. */
  children: ReactElement<FieldControlProps>;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  className?: string;
}

/**
 * Label + control + hint + inline error, wired up for screen readers: the control points at the
 * hint and error with aria-describedby, and is marked aria-invalid when there is an error.
 */
export function FormField({ label, children, error, hint, required, className }: FormFieldProps) {
  const autoId = useId();
  const id = children.props.id ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-danger" aria-hidden>
            {' '}
            *
          </span>
        )}
      </Label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
