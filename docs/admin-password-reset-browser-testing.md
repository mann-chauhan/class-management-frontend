# Admin Password Reset browser testing (local only)

This suite is isolated from Leave and Advertisement E2E. It uses
`playwright.admin-password-reset.config.ts`, the files under
`e2e/admin-password-reset/`, and its own global setup and teardown.

## Suite selection

```bash
npm run e2e:admin-password-reset
```

The configuration matches `admin-password-reset.spec.ts` and intentionally
ignores `process-lifecycle.spec.ts`, which is a Vitest lifecycle test rather
than a browser test. The default `npm run e2e` command cannot discover either
file because its test directory is explicitly limited to `e2e/leave/`.

## Runtime dependencies

The suite requires the process-local Admin Password Reset inputs, synthetic
fixture state, `TEST_DB_USERNAME`, `TEST_DB_PASSWORD`, `JWT_SECRET`,
`PGPASSFILE`, and the exact approved database URL
`jdbc:postgresql://localhost:5432/cms_leave_test`. The setup invokes the
dedicated backend fixture script, starts the existing guarded Leave browser
backend on port `18080`, verifies the backend identity, and records an owned
process group. Teardown stops that process group before fixture cleanup.

The frontend uses Angular's `browser-test` configuration at
`http://localhost:14200`. The suite performs real authentication and mutates
synthetic password-reset fixture state; no credentials or tokens belong in
tracked files or documentation.

This document records configuration only. It does not claim that credentials,
fixtures, backend readiness, database identity, or browser execution have been
verified.
