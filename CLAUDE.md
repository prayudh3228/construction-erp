# Working on this repository

- Start every session by reading `docs/PROGRESS.md`; it says what is done, what is next and how to run things.
- Build one phase at a time and stop for approval at the end of each phase (the phase list is in `docs/PROGRESS.md`).
- Money is always integer paise (`bigint`), never floating point. Use `@erp/shared` money helpers.
- Tax rates, thresholds and limits are dated settings, never constants in code. Label defaults "verify with the company's CA before go-live".
- Only fake demo data. Never commit secrets; `.env` files are ignored, `.env.example` holds demo values.
- Enforce access rules in the API, never only in the UI.
- Record assumptions in `docs/ASSUMPTIONS.md` and real questions in `docs/OPEN_QUESTIONS.md`.
