# Tally export

Built in Phase 22 (import of ledgers, parties and opening balances; export of Tally-importable XML and Excel/CSV; ledger mapping; export batches with no double export; monthly reconciliation).

Before finalising the format we need a real Tally sample from the company (see OPEN_QUESTIONS.md). Amounts in exports are written with `toRupeeString()` from `@erp/shared` (two decimals, no grouping).
