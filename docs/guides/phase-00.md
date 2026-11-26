# Phase 0 user guide: starting the system

1. Install Docker Desktop.
2. In the project folder run `docker compose up --build`. The first build takes a few minutes.
3. Open http://localhost:8080. The **System status** card should show API **Running** and Database **Connected**.
4. Stop with `Ctrl+C`, or `docker compose down`. Add `-v` to also delete the demo database.

If the card says **Server unreachable**, the API is not up yet or has failed; run `docker compose logs api` to see why.
