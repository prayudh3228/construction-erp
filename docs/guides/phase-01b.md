# Phase 1b user guide: the site app

The phone app is for site staff. It uses big buttons, needs little typing, and keeps working without signal.

1. Start it with `pnpm --filter @erp/mobile start` and open it in Expo Go or a development build on your phone. This is a demo with fake data: tap **Continue as demo user**. (Signing in with a password arrives in Phase 2.)
2. The four tabs at the bottom are always within thumb reach:
   - **Today:** today's date and **Your site**. Tap **Choose site** (or **Change site**) to pick the project you are working on. Below are the site actions (attendance, goods receipt, material issue, site voucher, progress photo); each tile says the phase it arrives in.
   - **Capture:** where you will take a photo first and add details after (camera arrives in Phase 29).
   - **Sync:** whether the phone is online, how many entries are waiting to be sent, and when it last synced.
   - **More:** who you are signed in as, which departments to use on the office web app, and **Sign out**.
3. The pill at the top right of every screen shows sync status (for example **Not synced yet**, **3 to send**, **Offline**). Tap it to open **Sync**.
4. With no signal (or Wi-Fi with no internet) a yellow **You are offline** banner appears on every screen. Keep working: from Phase 28, entries are saved on the phone and sent when you are back online.
