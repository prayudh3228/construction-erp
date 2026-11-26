import { DEPARTMENTS, type ProjectSummary } from '@erp/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setProjectsSource } from '@/data/projects';
import { axeViolations } from '@/test/axe';
import { currentUrl, renderApp, signIn } from '@/test/render-app';
import { sessionStore } from './session';

const sidebar = () => screen.getAllByRole('navigation', { name: 'Departments' })[0]!;
const switcher = () => screen.getByRole('button', { name: /^Project: / });

describe('sign-in guard and login page', () => {
  it('sends a signed-out user to login, remembering where they were going', async () => {
    const { router } = renderApp('/finance?project=PRJ-002');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ redirect: '/finance?project=PRJ-002' });
  });

  it('validates inline: both fields required, errors tied to the fields', async () => {
    const { user } = renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    const username = screen.getByLabelText(/Username or email/);
    const password = screen.getByLabelText(/Password/);
    expect(username).toHaveAttribute('aria-invalid', 'true');
    expect(username).toHaveAccessibleDescription('Enter your username or email.');
    expect(password).toHaveAccessibleDescription('Enter your password.');
    // The first invalid field gets focus.
    expect(username).toHaveFocus();
  });

  it('errors clear as the user fixes them', async () => {
    const { user } = renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    await user.type(screen.getByLabelText(/Username or email/), 'asha');
    expect(screen.queryByText('Enter your username or email.')).not.toBeInTheDocument();
  });

  it('does not accept a password yet (real sign-in is Phase 2), and says so', async () => {
    const { user, router } = renderApp('/login');
    await user.type(await screen.findByLabelText(/Username or email/), 'asha');
    await user.type(screen.getByLabelText(/Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/next phase/);
    expect(router.state.location.pathname).toBe('/login');
    expect(sessionStore.get()).toBeNull();
  });

  it('demo sign-in returns the user to the page they asked for', async () => {
    const { user, router } = renderApp('/finance?project=PRJ-002');
    await user.click(await screen.findByRole('button', { name: 'Continue as demo user' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Accounts and finance' }),
    ).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/finance?project=PRJ-002');
  });

  it('ignores an off-site redirect after sign-in', async () => {
    const { user, router } = renderApp('/login?redirect=%2F%2Fevil.example');
    await user.click(await screen.findByRole('button', { name: 'Continue as demo user' }));
    await screen.findByRole('heading', { level: 1, name: 'Management dashboard' });
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('a signed-in user visiting /login goes straight in', async () => {
    signIn();
    const { router } = renderApp('/login');
    await screen.findByRole('heading', { level: 1, name: 'Management dashboard' });
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('without demo mode there is no demo button and no design-system page', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(screen.queryByRole('button', { name: 'Continue as demo user' })).not.toBeInTheDocument();
  });

  it('login page has no accessibility violations', async () => {
    const { container } = renderApp('/login');
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('sidebar', () => {
  it('lists all 13 departments for full access, in groups, with the current one marked', async () => {
    signIn();
    renderApp('/purchase');
    await screen.findByRole('heading', { level: 1, name: 'Purchase' });
    const links = within(sidebar()).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(DEPARTMENTS.map((d) => d.label));
    expect(within(sidebar()).getByRole('link', { name: 'Purchase' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sidebar()).getByRole('heading', { name: 'Compliance' })).toBeInTheDocument();
  });

  it('shows only the departments a user may open', async () => {
    signIn({ departments: ['finance', 'hr'] });
    renderApp('/');
    // "/" goes to the first allowed department.
    await screen.findByRole('heading', { level: 1, name: 'Accounts and finance' });
    const links = within(sidebar()).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Accounts and finance', 'HR and labour']);
    expect(
      within(sidebar()).queryByRole('heading', { name: 'Compliance' }),
    ).not.toBeInTheDocument();
  });

  it('typing the URL of a hidden department shows no-access, not its content', async () => {
    signIn({ departments: ['finance'] });
    renderApp('/hr');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to HR and labour' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('a user with no departments gets a clear message', async () => {
    signIn({ departments: [] });
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: 'No departments are open to you yet' }),
    ).toBeInTheDocument();
  });

  it('collapses to icons, keeps names for screen readers, and remembers the choice', async () => {
    signIn();
    const { user, unmount } = renderApp('/finance');
    await screen.findByRole('heading', { level: 1, name: 'Accounts and finance' });
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(within(sidebar()).getByRole('link', { name: 'Purchase' })).toBeInTheDocument();
    expect(within(sidebar()).queryByText('Purchase')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('erp.sidebarCollapsed')).toBe('1');
    unmount();

    renderApp('/finance');
    expect(await screen.findByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('keeps the project choice when moving between departments', async () => {
    signIn();
    const { user, router } = renderApp('/finance?project=PRJ-003');
    await screen.findByRole('heading', { level: 2, name: 'District Hospital Annexe' });
    await user.click(within(sidebar()).getByRole('link', { name: 'Stores and inventory' }));
    await screen.findByRole('heading', { level: 1, name: 'Stores and inventory' });
    expect(currentUrl(router)).toBe('/stores?project=PRJ-003');
  });
});

describe('project switcher', () => {
  it('starts on All projects and lists the views and every project with its type', async () => {
    signIn();
    const { user } = renderApp('/finance');
    await screen.findByRole('table', { name: 'Projects' });
    expect(switcher()).toHaveTextContent('All projects');
    await user.click(switcher());
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('option', { name: /All projects/ })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: /Company-wide/ })).toBeInTheDocument();
    const contract = within(listbox).getByRole('option', { name: /PRJ-001/ });
    expect(contract).toHaveTextContent('Contract');
    expect(within(listbox).getByRole('option', { name: /PRJ-002/ })).toHaveTextContent(
      'Development',
    );
  });

  it('search matches city too, and choosing a project puts it in the URL', async () => {
    signIn();
    const { user, router } = renderApp('/finance');
    await screen.findByRole('table', { name: 'Projects' });
    await user.click(switcher());
    await user.type(screen.getByPlaceholderText(/Search by code/), 'nagpur');
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(1);
    await user.click(options[0]!);
    await screen.findByRole('heading', { level: 2, name: 'Ring Road Flyover Pier Works' });
    expect(currentUrl(router)).toBe('/finance?project=PRJ-005');
    expect(switcher()).toHaveTextContent('PRJ-005 · Ring Road Flyover Pier Works');
  });

  it('opens with Ctrl+K and chooses by keyboard alone', async () => {
    signIn();
    const { user, router } = renderApp('/planning');
    await screen.findByRole('table', { name: 'Projects' });
    await user.keyboard('{Control>}k{/Control}');
    const input = await screen.findByPlaceholderText(/Search by code/);
    expect(input).toHaveFocus();
    await user.type(input, 'company');
    await user.keyboard('{Enter}');
    await screen.findByRole('heading', { level: 2, name: 'Company-wide' });
    expect(currentUrl(router)).toBe('/planning?project=company');
  });

  it('choosing All projects removes the parameter from the URL', async () => {
    signIn();
    const { user, router } = renderApp('/planning?project=PRJ-001');
    await screen.findByRole('heading', { level: 2, name: 'Riverside Business Park, Block A' });
    await user.click(switcher());
    await user.click(
      within(await screen.findByRole('listbox')).getByRole('option', { name: /All projects/ }),
    );
    await screen.findByRole('table', { name: 'Projects' });
    expect(currentUrl(router)).toBe('/planning');
  });

  it('in Sales, lists development projects only', async () => {
    signIn();
    const { user } = renderApp('/sales');
    const table = await screen.findByRole('table', { name: 'Projects' });
    expect(within(table).queryByText('PRJ-001')).not.toBeInTheDocument();
    expect(within(table).getByText('PRJ-002')).toBeInTheDocument();
    await user.click(switcher());
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: /PRJ-001/ })).not.toBeInTheDocument();
    expect(within(listbox).getAllByRole('option', { name: /PRJ-00/ })).toHaveLength(3);
  });

  it('a contract project opened in Sales explains why there is nothing to show', async () => {
    signIn();
    const { user, router } = renderApp('/sales?project=PRJ-001');
    expect(
      await screen.findByRole('heading', { name: 'Sales covers development projects only' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all development projects' }));
    await screen.findByRole('table', { name: 'Projects' });
    expect(currentUrl(router)).toBe('/sales');
  });

  it('an unknown project id shows "not found" with a way back', async () => {
    signIn();
    const { user, router } = renderApp('/finance?project=PRJ-999');
    expect(await screen.findByRole('heading', { name: 'Project not found' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all projects' }));
    await screen.findByRole('table', { name: 'Projects' });
    expect(currentUrl(router)).toBe('/finance');
  });

  it('a malformed project value falls back to All projects', async () => {
    signIn();
    renderApp('/finance?project=%2E%2E%2Fetc');
    expect(await screen.findByRole('table', { name: 'Projects' })).toBeInTheDocument();
    expect(switcher()).toHaveTextContent('All projects');
  });

  it('is disabled in Admin, which is not project-specific', async () => {
    signIn();
    renderApp('/admin');
    await screen.findByRole('heading', { level: 1, name: 'Admin' });
    expect(switcher()).toBeDisabled();
    expect(switcher()).toHaveTextContent('Not project-specific');
  });

  it('clicking a project row opens that project', async () => {
    signIn();
    const { user, router } = renderApp('/execution');
    await screen.findByRole('table', { name: 'Projects' });
    await user.click(
      screen.getByRole('button', { name: 'Open PRJ-004 Lakeview Residency Towers' }),
    );
    await screen.findByRole('heading', { level: 2, name: 'Lakeview Residency Towers' });
    expect(currentUrl(router)).toBe('/execution?project=PRJ-004');
  });
});

describe('project loading states', () => {
  it('shows a loading state while projects load', async () => {
    signIn();
    setProjectsSource({ list: () => new Promise<ProjectSummary[]>(() => {}) });
    renderApp('/finance');
    expect(await screen.findByRole('status')).toHaveTextContent('Loading projects…');
  });

  it('shows an error with retry when projects fail to load, and recovers', async () => {
    signIn();
    const list = vi
      .fn<() => Promise<ProjectSummary[]>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue([
        {
          id: 'PRJ-010',
          code: 'PRJ-010',
          name: 'Test Site',
          type: 'contract',
          status: 'active',
          city: 'Pune',
        },
      ]);
    setProjectsSource({ list });
    const { user } = renderApp('/finance');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load projects');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Test Site')).toBeInTheDocument();
  });

  it('shows an empty state when there are no projects', async () => {
    signIn();
    setProjectsSource({ list: () => Promise.resolve([]) });
    renderApp('/finance');
    expect(await screen.findByRole('heading', { name: 'No projects yet' })).toBeInTheDocument();
  });
});

describe('pages and account menu', () => {
  it('an unknown department shows "page not found" inside the shell', async () => {
    signIn();
    renderApp('/payroll');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(sidebar()).toBeInTheDocument();
  });

  it('signing out clears the session and returns to login', async () => {
    signIn(undefined, 'Asha Rao');
    const { user, router } = renderApp('/finance');
    await screen.findByRole('heading', { level: 1, name: 'Accounts and finance' });
    await user.click(screen.getByRole('button', { name: 'Account menu for Asha Rao' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(router.state.location.pathname).toBe('/login');
    expect(sessionStore.get()).toBeNull();
    expect(window.sessionStorage.getItem('erp.demoSession')).toBeNull();
  });

  it('a corrupt stored session counts as signed out', async () => {
    window.sessionStorage.setItem('erp.demoSession', '{not json');
    renderApp('/finance');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('the design-system page is reachable in demo mode', async () => {
    signIn();
    renderApp('/design-system');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Design system' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Sample bills' })).toBeInTheDocument();
  });

  it('the design-system page does not exist outside demo mode', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    signIn();
    renderApp('/design-system');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('shell and department page have no accessibility violations', async () => {
    signIn();
    const { container } = renderApp('/finance');
    await screen.findByRole('table', { name: 'Projects' });
    expect(await axeViolations(container)).toEqual([]);
  });

  it('design-system page has no accessibility violations', async () => {
    signIn();
    const { container } = renderApp('/design-system');
    await screen.findByRole('table', { name: 'Sample bills' });
    await waitFor(async () => expect(await axeViolations(container)).toEqual([]));
  });
});
