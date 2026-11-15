# Research Resource Manager API

The API uses Node.js, Express, Sequelize, and PostgreSQL. Resource endpoints
follow `docs/openapi.yaml`; the database schema is in
`docs/research_resource_manager.sql`.

## Setup

1. Create the target PostgreSQL database, then apply the schema from the
   repository root. For a new local database, run these from PowerShell with a
   PostgreSQL administrator account:

   ```powershell
   createdb -U your_db_user research_resource_manager
   psql -U your_db_user -d research_resource_manager -f .\docs\research_resource_manager.sql
   ```

   You can also create the database and execute the SQL file using pgAdmin or
   DBeaver. This schema is the initial database setup; the API does not run
   `sequelize.sync()` or create tables at startup. The SQL creates the full
   schema, including the resource, user, reservation, enum, extension, and
   constraint definitions.

2. In PowerShell, change to this directory and run
   `Copy-Item .env.example .env`. Edit `DATABASE_URL` with your PostgreSQL
   username and password, URL-encoding special characters in the password.
   Set `JWT_SECRET` to a random value of at least 32 characters. Keep `.env`
   local; never commit credentials.
3. Install dependencies with `npm.cmd ci`.
4. Create the initial manager account. In PowerShell, set the values for the
   current process and run the script:

   ```powershell
   $env:ADMIN_EMAIL = 'manager@example.edu'
   $env:ADMIN_NAME = 'Resource Manager'
   $env:ADMIN_PASSWORD = 'replace-with-a-long-password'
   npm.cmd run create:manager
   ```

   Use a unique email address and a password of at least 12 characters.

5. Start the API with `npm.cmd run dev`. It listens on port 3001 by default.
   `/api/health` confirms that Express is running; successful startup also
   confirms that Sequelize can connect to PostgreSQL.

The Vite frontend defaults to `http://localhost:3001/api` and port 8443.
Open it as `http://localhost:8443` (not `127.0.0.1`) so the browser sends the
HttpOnly, SameSite=Strict session cookie to the API. Set `VITE_API_BASE_URL`
when the API is hosted elsewhere. Set `FRONTEND_ORIGIN` to the exact frontend
origin. The API accepts browser write requests only from that origin.

Login allows 10 failed attempts per IP per 15 minutes; successful attempts do
not count and rate-limit events are logged. The default limiter store is
in-memory and resets on process restart; configure a shared store if deploying
multiple API instances.

## Endpoints

- `POST /api/auth/login`, `GET /api/auth/me`, and `POST /api/auth/logout`
- `GET /api/resources`, `GET /api/resources/archived`, and
  `GET /api/resources/:resourceId`
- `POST /api/resources`, `PUT /api/resources/:resourceId`, and
  `DELETE /api/resources/:resourceId` (manager/administrator only)
- `POST /api/resources/:resourceId/restore` (manager/administrator only)

DELETE archives a resource (`is_active = false`) rather than physically
deleting it. Active and upcoming reservations prevent archiving. Archived
resources remain in PostgreSQL for historical references but are excluded from
catalog results. Session cookies are HttpOnly and validated against the
current database account on each authenticated request, so role changes and
account deactivation take effect immediately.

Run API tests with `npm.cmd test`.
