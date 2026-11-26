import { paise, rupees } from '@erp/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { initials } from '@/app/shell/UserMenu';
import { IndianDate, Money } from './format';
import { EmptyState, ErrorState, LoadingState } from './states';
import { Button } from './ui/button';
import { FormField } from './ui/form-field';
import { Input } from './ui/input';

describe('Money', () => {
  it('formats with lakh/crore grouping and paise', () => {
    // 1,23,45,678.90 = one crore, twenty-three lakh, ...
    render(<Money value={rupees('12345678.9')} />);
    expect(screen.getByText('₹1,23,45,678.90')).toBeInTheDocument();
  });

  it('can round to whole rupees', () => {
    // 1234.50 rounds half up to 1235
    render(<Money value={rupees('1234.50')} decimals={0} />);
    expect(screen.getByText('₹1,235')).toBeInTheDocument();
  });

  it('colours negatives only when asked', () => {
    const { rerender } = render(<Money value={rupees('-500')} />);
    expect(screen.getByText('-₹500.00')).not.toHaveClass('text-danger');
    rerender(<Money value={rupees('-500')} colorNegative />);
    expect(screen.getByText('-₹500.00')).toHaveClass('text-danger');
  });

  it('shows zero plainly', () => {
    render(<Money value={paise(0)} colorNegative />);
    expect(screen.getByText('₹0.00')).not.toHaveClass('text-danger');
  });
});

describe('IndianDate', () => {
  it('shows DD-MM-YYYY with the ISO date in dateTime', () => {
    render(<IndianDate value="2027-03-31" />);
    const el = screen.getByText('31-03-2027');
    expect(el.tagName).toBe('TIME');
    expect(el).toHaveAttribute('datetime', '2027-03-31');
  });

  it('converts an instant to the India calendar date', () => {
    // 31-03-2026 20:00 UTC is 01-04-2026 01:30 in India: a new financial year.
    render(<IndianDate value={new Date('2026-03-31T20:00:00Z')} />);
    expect(screen.getByText('01-04-2026')).toHaveAttribute('datetime', '2026-04-01');
  });
});

describe('FormField', () => {
  it('links the label, hint and error to the control', () => {
    render(
      <FormField label="Quantity" hint="Up to 3 decimals." error="Enter a number." required>
        <Input />
      </FormField>,
    );
    const input = screen.getByLabelText(/Quantity/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAccessibleDescription('Up to 3 decimals. Enter a number.');
  });

  it('is not marked invalid without an error', () => {
    render(
      <FormField label="Name">
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-describedby');
  });

  it('keeps an id the control already has', () => {
    render(
      <FormField label="Code">
        <Input id="my-code" />
      </FormField>,
    );
    expect(screen.getByLabelText('Code')).toHaveAttribute('id', 'my-code');
  });
});

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button');
  });

  it('is disabled and busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('state components', () => {
  it('error state is an alert with a working retry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Could not load" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('error state has no retry button when there is nothing to retry', () => {
    render(<ErrorState title="Broken" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('empty state shows title, description and action', () => {
    render(<EmptyState title="No bills" description="Add one." action={<Button>Add</Button>} />);
    expect(screen.getByRole('heading', { name: 'No bills' })).toBeInTheDocument();
    expect(screen.getByText('Add one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('loading state announces its label', () => {
    render(<LoadingState label="Loading bills…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading bills…');
  });
});

describe('initials', () => {
  it.each([
    ['Demo Director', 'DD'],
    ['asha', 'A'],
    ['  Ravi  Kumar Shah ', 'RS'],
    ['', '?'],
  ])('%j -> %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
