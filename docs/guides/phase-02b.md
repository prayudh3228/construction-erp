# Phase 2b user guide: two-factor sign-in

Two-factor sign-in adds a second step after your password: a 6-digit code from an authenticator app on your phone (for example Google Authenticator or Microsoft Authenticator). It is **required for Admin, Director and Finance**, and anyone else may switch it on.

**Setting it up (first time)**

1. Sign in with your password. If you were given a temporary password, choose your own first. Then, if your role requires two-factor, the setup page opens.
2. In your authenticator app, add an account and scan the QR code. If you cannot scan, type the key shown under it.
3. Enter the 6-digit code the app shows, then **Turn on two-factor sign-in**.
4. You now see **10 recovery codes**. Copy or download them and keep them somewhere safe, away from your phone. Tick **I have saved my recovery codes** and continue. They are not shown again.

**Signing in afterwards**

1. Enter your username and password.
2. Enter the 6-digit code from your app. Codes change every 30 seconds and each works only once.
3. **Lost your phone?** Choose **Use a recovery code** and type one of your saved codes. Each recovery code works once. Then make new codes (below), and tell the admin if the phone may have been stolen.

Five wrong tries in a row (passwords and codes together) lock the account for 15 minutes.

**Account security** (account menu, top right)

- See whether two-factor is on and how many recovery codes are left.
- **Make new recovery codes**: needs your password and a code from your app; the old codes stop working.
- **Turn off**: only for roles that do not require two-factor; needs your password and a code from your app.
- **Turn on** (roles where it is optional): asks for your password too.

In the local demo, **Continue as demo user** skips this step. To try it, sign in as `demo.admin` with the demo password and add the demo key `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` to an authenticator app. `demo.director` shows the setup page (sign out there to leave it unchanged).
