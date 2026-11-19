# Leave browser testing (local only)

This workflow is intended only for synthetic Leave acceptance testing. It uses a
separate Spring profile, frontend configuration, port, and PostgreSQL database.
It must not be pointed at `class_management_db` or the development backend.

## Suite selection

The default Playwright configuration is Leave-only. It matches the three
specifications under `e2e/leave/` and does not scan Advertisement,
Admin-password-reset, or other E2E directories.

```bash
# Alias for the Leave-only configuration.
npm run e2e

# Explicit equivalent.
npm run e2e:leave
```

Both commands use `playwright.config.ts`, the Leave global setup and teardown,
frontend `browser-test` configuration, frontend port `14200`, and the backend
at `http://localhost:18080`.

## Current prepared configuration

- Frontend: `http://localhost:14200`, started automatically by Playwright with the
  `browser-test` Angular configuration.
- Backend: `http://localhost:18080`, started by the backend repository's
  `scripts/run-leave-browser-backend.sh`.
- Database: `jdbc:postgresql://localhost:5432/cms_leave_test` only.
- Browser runner: `@playwright/test` 1.64.1, Chromium, one worker.

The backend launcher rejects `DB_URL`, `DATABASE_URL`, and
`SPRING_DATASOURCE_URL`, requires `TEST_DB_USERNAME`, `TEST_DB_PASSWORD`, and
`JWT_SECRET`, refuses an occupied port 18080, and uses an application-owned
fixed datasource. Its identity endpoint must report `cms_leave_test`, port
5432, and a loopback server address before browser tests may run.

## Fixture lifecycle

Fixture setup, cleanup, migrations, and browser execution each require separate
authorization and must use the reviewed fixture script,
`scripts/leave-browser-fixtures.sh`; it uses the fixed database URL below,
requires a private `PGPASSFILE`, and accepts the BCrypt hash only through a
private file. Setup creates the marker-derived synthetic topology in one
transaction and writes a 0600 manifest before commit. The fixture script uses a
native PostgreSQL URI for `psql`, then verifies the connected database,
server/client loopback addresses, and port before any fixture SQL runs. Cleanup
validates every manifest identity and relationship before its first delete and
deletes only manifest-owned rows in child-to-parent order. A missing,
duplicate, or mismatched row aborts cleanup without deleting anything.

The current specs require four login identities plus a shared password and run
marker. A fifth, cross-tenant identity is still required for the planned
isolation scenarios; it is not silently invented here. The supplied inputs are
environment variables rather than tracked files:

```text
LEAVE_BROWSER_ADMIN_EMAIL
LEAVE_BROWSER_TEACHER_EMAIL
LEAVE_BROWSER_RESTRICTED_TEACHER_EMAIL
LEAVE_BROWSER_STUDENT_EMAIL
LEAVE_BROWSER_TEST_PASSWORD
LEAVE_BROWSER_RUN_MARKER
LEAVE_BROWSER_MANIFEST_FILE
LEAVE_BROWSER_FIXTURE_SCRIPT
```

The fixture setup additionally requires `LEAVE_BROWSER_DB_URL` to equal
`jdbc:postgresql://localhost:5432/cms_leave_test`, `LEAVE_BROWSER_MANIFEST_DIR`,
`PGPASSFILE`, and `LEAVE_BROWSER_BCRYPT_HASH_FILE`. The backend launcher uses
`TEST_DB_USERNAME` and `TEST_DB_PASSWORD` for its fixed datasource. The
manifest file is `${LEAVE_BROWSER_MANIFEST_DIR}/${LEAVE_BROWSER_RUN_MARKER}.manifest`.

The current specs are intentionally limited to non-authoritative UI smoke
coverage until run-scoped fixtures exist. They do not constitute acceptance
evidence for persisted decisions, cancellation, cross-tenant denial, or
history state.

## Later, separately authorized order

The following commands are documentation only and were **NOT EXECUTED**:

```bash
# Backend, in the backend repository; use only the guarded launcher.
bash scripts/run-leave-browser-backend.sh

# After the exact target and inputs are independently reviewed:
# (NOT EXECUTED)
bash scripts/leave-browser-fixtures.sh setup

# After browser execution, using only the recorded run manifest:
bash scripts/leave-browser-fixtures.sh cleanup

# Browser run; Playwright starts a non-reused Angular browser-test server on
# port 14200, only after identity and fixture checks pass:
npm run e2e:leave
```

The browser-created Student request is appended to the same manifest from the
successful POST response. If that local append fails, teardown refuses to
discover the request by query; it aborts safely for manual reconciliation.
`globalTeardown` invokes the fixture cleanup script only when
`LEAVE_BROWSER_CLEANUP_AFTER_TESTS=true` is explicitly supplied. The default
leaves the run manifest and fixtures untouched, and a global-setup validation
failure never invokes cleanup. This guide does not make a claim about any
particular local run.

## Interrupted-run recovery

Manifest output is written before the database transaction commits so a
rollback leaves evidence that cleanup can reject safely. This is not an atomic
database/filesystem transaction and the file is not fsync-durable. A process
crash can therefore leave a partial manifest, a committed database row whose
browser-request append was not recorded, or a marker lock directory.

If setup or cleanup is interrupted, do not delete the lock, manifest, or
database rows manually. Do not reuse the marker. Preserve the files, confirm
that no browser-test process is still running, and inspect the manifest and
database identity using the guarded procedures. Cleanup must be allowed to run
only when every manifest row validates; otherwise stop and reconcile the exact
database IDs manually under a separately approved procedure. If a browser
request was committed but its manifest append failed, automatic cleanup is
intentionally refused because ownership cannot be proven. A stale lock also
requires evidence that the owning run has stopped before any separately
reviewed recovery action.
