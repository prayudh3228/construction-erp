import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '@/test/axe';
import {
  FAKE_PASSWORD,
  FAKE_RECOVERY,
  FAKE_RECOVERY_CODES,
  FAKE_TOTP,
  fakeAuth,
  fakeMe,
  signIn,
} from '@/test/fake-auth';
import { currentUrl, renderApp } from '@/test/render-app';

async function passwordSignIn(user: ReturnType<typeof renderApp>['user'], username: string) {
  await user.type(await screen.findByLabelText(/Username or email/), username);
  await user.type(screen.getByLabelText(/^Password/), FAKE_PASSWORD);
  await user.click(screen.getByRole('button', { name: /^Sign in$/ }));
}

describe('entering a code after the password', () => {
  it('goes to the code step, refuses a wrong code, and signs in with the right one where the user was heading', async () => {
    const { user, router } = renderApp('/purchase?project=PRJ-003');
    await passwordSignIn(user, 'asha.mfa-on');
    expect(await screen.findByRole('heading', { name: 'Two-factor sign-in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/two-factor');

    await user.type(screen.getByLabelText(/6-digit code/), '111111');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not right/);
    expect(screen.getByLabelText(/6-digit code/)).toHaveValue('');

    await user.type(screen.getByLabelText(/6-digit code/), FAKE_TOTP);
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await screen.findByRole('heading', { level: 1, name: 'Purchase' });
    expect(currentUrl(router)).toBe('/purchase?project=PRJ-003');
  });

  it('a lost phone: a recovery code works instead', async () => {
    const { user } = renderApp('/login');
    await passwordSignIn(user, 'asha.mfa-on');
    await user.click(await screen.findByRole('button', { name: /Use a recovery code/ }));
    await user.type(screen.getByLabelText(/Recovery code/), FAKE_RECOVERY.toLowerCase());
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await screen.findByRole('heading', { level: 1, name: 'Management dashboard' });
    expect(fakeAuth.mfaVerify).toHaveBeenCalledWith({ recoveryCode: FAKE_RECOVERY.toLowerCase() });
  });

  it('too many wrong codes: the account locks and the user is back at sign-in', async () => {
    const { user, router } = renderApp('/login');
    await passwordSignIn(user, 'asha.mfa-on');
    await screen.findByRole('heading', { name: 'Two-factor sign-in' });
    for (let i = 0; i < 5; i++) {
      await user.type(screen.getByLabelText(/6-digit code/), '000000');
      await user.click(screen.getByRole('button', { name: 'Verify' }));
      if (i < 4) await screen.findByRole('alert');
    }
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(router.state.location.search).toMatchObject({ reason: 'expired' });
  });

  it('Cancel signs the half-signed-in session out', async () => {
    const { user, router } = renderApp('/login');
    await passwordSignIn(user, 'asha.mfa-on');
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(fakeAuth.logout).toHaveBeenCalled();
    expect(router.state.location.search).toMatchObject({ reason: 'signed-out' });
  });

  it('no page of the app opens until the code is entered', async () => {
    fakeAuth.current = fakeMe({ mfa: { enabled: true, required: true } }, { stage: 'mfa_verify' });
    const { router } = renderApp('/finance');
    await screen.findByRole('heading', { name: 'Two-factor sign-in' });
    expect(router.state.location.pathname).toBe('/two-factor');
    expect(screen.queryByRole('navigation', { name: 'Departments' })).not.toBeInTheDocument();
  });

  it('the code page has no accessibility violations', async () => {
    fakeAuth.current = fakeMe({ mfa: { enabled: true, required: true } }, { stage: 'mfa_verify' });
    const { container } = renderApp('/two-factor');
    await screen.findByRole('heading', { name: 'Two-factor sign-in' });
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('setting up (required roles)', () => {
  it('shows a QR code and the key, confirms with a code, then the recovery codes must be saved', async () => {
    const { user, router } = renderApp('/login');
    await passwordSignIn(user, 'asha.mfa-setup');
    expect(
      await screen.findByRole('heading', { name: 'Set up two-factor sign-in' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/two-factor/setup');
    const qr = await screen.findByRole('img', { name: /QR code to scan/ });
    expect(qr.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(screen.getByLabelText('Setup key')).toHaveTextContent('JBSW Y3DP EHPK 3PXP');

    await user.type(screen.getByLabelText(/6-digit code/), '111111');
    await user.click(screen.getByRole('button', { name: 'Turn on two-factor sign-in' }));
    expect(await screen.findByText(/not right/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/6-digit code/), FAKE_TOTP);
    await user.click(screen.getByRole('button', { name: 'Turn on two-factor sign-in' }));
    const list = await screen.findByRole('list', { name: 'Recovery codes' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(FAKE_RECOVERY_CODES);

    const go = screen.getByRole('button', { name: 'Continue' });
    expect(go).toBeDisabled();
    await user.click(screen.getByLabelText('I have saved my recovery codes'));
    await user.click(go);
    await screen.findByRole('heading', { level: 1, name: 'Management dashboard' });
  });

  it('a new starter in a required role changes the temporary password first, then sets up two-factor', async () => {
    const { user } = renderApp('/login');
    fakeAuth.login.mockImplementationOnce(async () => {
      fakeAuth.current = fakeMe(
        { role: 'finance', mustChangePassword: true, mfa: { enabled: false, required: true } },
        { stage: 'mfa_setup' },
      );
      return fakeAuth.current;
    });
    await passwordSignIn(user, 'new.starter');
    // The setup page cannot be reached yet: the password change comes first.
    await screen.findByRole('heading', { name: 'Choose a new password' });
    await user.type(screen.getByLabelText(/Current password/), FAKE_PASSWORD);
    await user.type(screen.getByLabelText(/^New password/), 'brand new lantern 58');
    await user.type(screen.getByLabelText(/Repeat new password/), 'brand new lantern 58');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await screen.findByRole('heading', { name: 'Set up two-factor sign-in' });
    // Just typed the password: no password field here.
    expect(screen.queryByLabelText(/Your password/)).not.toBeInTheDocument();
    await user.type(await screen.findByLabelText(/6-digit code/), FAKE_TOTP);
    await user.click(screen.getByRole('button', { name: 'Turn on two-factor sign-in' }));
    await user.click(await screen.findByLabelText('I have saved my recovery codes'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { level: 1, name: 'Management dashboard' });
  });

  it('a required role can only sign out from setup, not skip it', async () => {
    fakeAuth.current = fakeMe(
      { role: 'director', mfa: { enabled: false, required: true } },
      { stage: 'mfa_setup' },
    );
    const { user, router } = renderApp('/finance');
    await screen.findByRole('heading', { name: 'Set up two-factor sign-in' });
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(router.state.location.search).toMatchObject({ reason: 'signed-out' });
  });

  it('the setup page has no accessibility violations', async () => {
    fakeAuth.current = fakeMe(
      { role: 'admin', mfa: { enabled: false, required: true } },
      { stage: 'mfa_setup' },
    );
    const { container } = renderApp('/two-factor/setup');
    await screen.findByRole('img', { name: /QR code/ });
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('account security page', () => {
  it('two-factor off (optional role): offers to turn it on, and setup returns here', async () => {
    signIn(undefined, 'Asha Rao');
    const { user, router } = renderApp('/account/security');
    await screen.findByRole('heading', { level: 1, name: 'Account security' });
    expect(await screen.findByText('Off')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Turn on two-factor sign-in' }));
    await screen.findByRole('heading', { name: 'Set up two-factor sign-in' });
    // From an ordinary signed-in session the password is asked again.
    expect(await screen.findByLabelText(/Your password/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/account/security'));
  });

  it('on: new recovery codes need an app code and are shown once', async () => {
    signIn(undefined, 'Asha Rao', { mfa: { enabled: true, required: false } });
    const { user } = renderApp('/account/security');
    expect(await screen.findByText('On')).toBeInTheDocument();
    expect(screen.getByText(/Recovery codes left/)).toHaveTextContent('10');
    await user.click(screen.getByRole('button', { name: 'Make new recovery codes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Make new recovery codes?' });
    await user.type(within(dialog).getByLabelText(/Your password/), FAKE_PASSWORD);
    await user.type(within(dialog).getByLabelText(/6-digit code/), FAKE_TOTP);
    await user.click(within(dialog).getByRole('button', { name: 'Make new codes' }));
    expect(await screen.findByRole('list', { name: 'Recovery codes' })).toBeInTheDocument();
    expect(fakeAuth.mfaRegenerateCodes).toHaveBeenCalledWith(FAKE_TOTP, FAKE_PASSWORD);
  });

  it('an optional role can turn it off with a code', async () => {
    signIn(undefined, 'Asha Rao', { mfa: { enabled: true, required: false } });
    const { user } = renderApp('/account/security');
    await user.click(await screen.findByRole('button', { name: 'Turn off' }));
    const dialog = await screen.findByRole('dialog', { name: 'Turn off two-factor sign-in?' });
    await user.type(within(dialog).getByLabelText(/Your password/), FAKE_PASSWORD);
    await user.type(within(dialog).getByLabelText(/6-digit code/), FAKE_TOTP);
    await user.click(within(dialog).getByRole('button', { name: 'Turn off' }));
    expect(await screen.findByText('Off')).toBeInTheDocument();
  });

  it('a required role sees no way to turn it off', async () => {
    signIn(undefined, 'Asha Rao', { role: 'finance', mfa: { enabled: true, required: true } });
    renderApp('/account/security');
    expect(await screen.findByText('Required for your role')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn off' })).not.toBeInTheDocument();
  });

  it('is reached from the account menu', async () => {
    signIn(undefined, 'Asha Rao');
    const { user } = renderApp('/finance');
    await screen.findByRole('heading', { level: 1, name: 'Accounts and finance' });
    await user.click(screen.getByRole('button', { name: 'Account menu for Asha Rao' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Account security' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Account security' }),
    ).toBeInTheDocument();
  });
});

describe('confirming with the password', () => {
  it('switching two-factor on from an ordinary session sends the password with the code', async () => {
    signIn(undefined, 'Asha Rao');
    const { user } = renderApp('/two-factor/setup');
    await user.type(await screen.findByLabelText(/Your password/), FAKE_PASSWORD);
    await user.type(screen.getByLabelText(/6-digit code/), FAKE_TOTP);
    await user.click(screen.getByRole('button', { name: 'Turn on two-factor sign-in' }));
    expect(await screen.findByRole('list', { name: 'Recovery codes' })).toBeInTheDocument();
    expect(fakeAuth.mfaEnable).toHaveBeenCalledWith(FAKE_TOTP, FAKE_PASSWORD);
  });

  it('a wrong password in the account dialog is shown and nothing changes', async () => {
    signIn(undefined, 'Asha Rao', { mfa: { enabled: true, required: false } });
    const { user } = renderApp('/account/security');
    await user.click(await screen.findByRole('button', { name: 'Turn off' }));
    const dialog = await screen.findByRole('dialog', { name: 'Turn off two-factor sign-in?' });
    await user.type(within(dialog).getByLabelText(/Your password/), 'not it');
    await user.type(within(dialog).getByLabelText(/6-digit code/), FAKE_TOTP);
    await user.click(within(dialog).getByRole('button', { name: 'Turn off' }));
    expect(await within(dialog).findByText('Your password is not right.')).toBeInTheDocument();
    expect(fakeAuth.current?.user.mfa.enabled).toBe(true);
  });
});
