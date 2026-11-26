# Permissions

Built in Phase 3. This file will hold the full role × module × action matrix, which is tested automatically.

Principles fixed by the brief:

- Roles: Admin, Director/CEO, and department users (Finance, HR, Purchase, Stores, Planning, Site, Sales, …).
- Actions: view, create, edit, approve, delete, export.
- Department users see only their department and only the projects assigned to them.
- Only Admin and Director/CEO see everything. Admin manages users and settings; Director sees all business data. Admin does not see payroll by default (configurable).
- Extra restrictions on payroll, vendor bank details and tender pricing.
- Every rule is enforced in the API. Hiding screens is only a convenience.
