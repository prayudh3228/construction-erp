# Phase 1 user guide: finding your way around

1. Start the system with `docker compose up --build` and open http://localhost:8080.
2. The **Sign in** page opens. This is a demo with fake data, so click **Continue as demo user**. (Signing in with a username and password arrives in Phase 2.)
3. **Departments** are in the left sidebar, grouped as Overview, Projects and site, Business, Compliance and System. Click one to open it. Users will only see the departments they are allowed to use (from Phase 3).
4. The **project switcher** at the top chooses what you are looking at:
   - **All projects:** a summary and a table of every project. Click a project's code to open it.
   - **Company-wide:** items that do not belong to one project (head office, shared costs).
   - **One project:** that project's records in the current department.

   Press **Ctrl+K** (⌘K on a Mac) to open it from anywhere and type a code, name or city. Your choice stays when you move between departments and when you reload the page, and you can share the address with a colleague.

5. **Sales** only works with development projects. If a contract project is selected, the page says so and offers to show all development projects. **Admin** is not project-specific, so the switcher is greyed out there.
6. Tables have a search box, filters, sortable column headings, a **Columns** button to show or hide columns, and page controls at the bottom.
7. On a tablet the sidebar is hidden; open it with the **menu** button at the top left. On a desktop, **Collapse sidebar** (bottom left) shrinks it to icons; the choice is remembered.
8. The account menu (top right) has **System status**, the **Design system** reference page (demo only) and **Sign out**.

Keyboard: **Tab** first reaches **Skip to content**; every control can be used without a mouse.
