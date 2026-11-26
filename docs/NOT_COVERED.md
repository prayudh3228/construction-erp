# Rules the software does not cover

This list grows as compliance phases are built (TDS, GST, payroll, labour law). Nothing is excluded yet.

- Known limits of sign-in protection: someone who knows a username can keep that account locked (5 tries every 15 minutes) from changing addresses; per-address throttling slows this but cannot stop a distributed attempt. Accounts whose password hash predates a cost increase answer slightly faster until their next sign-in. Sign-in events are recorded in the audit log from Phase 4.
- Tax rates, thresholds and due dates are seeded as defaults only and must be verified with the company's CA before go-live.
