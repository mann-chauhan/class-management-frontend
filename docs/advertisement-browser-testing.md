# Advertisement browser testing (isolated, local only)

This project is intentionally separate from the Leave Playwright project. It
uses `playwright.advertisement.config.ts` and `e2e/advertisement/`; it does not
load the Leave global setup, read Leave manifests, create fixtures, or run
cleanup.

## Fixed endpoints

- Frontend: `http://localhost:14200`, served with Angular's `browser-test`
  configuration.
- Backend: `http://localhost:18080`, started separately with the reviewed,
  isolated backend launcher.
- API: `http://localhost:18080/api/v1` only.
- Database: the backend must independently prove it is using the approved
  isolated database `cms_leave_test` on PostgreSQL port `5432` and loopback.

The Advertisement Playwright global setup checks the backend identity endpoint
and inspects the served frontend module graph for the fixed API base URL. It
rejects `DB_URL`, `DATABASE_URL`, and `SPRING_DATASOURCE_URL` in the test
process. It does not start the backend, run migrations, create accounts, or
clean up database rows.

The backend must use the dedicated `advertisement-browser-test` profile. It
reuses the fixed datasource guard, keeps Hibernate in `validate` mode, disables
Flyway at startup, and requires `ADVERTISEMENT_BROWSER_TEST_MEDIA_DIRECTORY`.
That directory must be isolated, pre-created, and different from production or
default media storage.

## Required process-local inputs

Set these in the local test process without committing a secrets file or
printing the password:

```text
ADVERTISEMENT_E2E_TEST_MODE=integration
ADVERTISEMENT_E2E_ADMIN_EMAIL=<authorized synthetic Admin email>
ADVERTISEMENT_E2E_TEACHER_EMAIL=<authorized synthetic Teacher email>
ADVERTISEMENT_E2E_STUDENT_EMAIL=<authorized synthetic Student email>
ADVERTISEMENT_E2E_TEST_PASSWORD=<authorized disposable password>
ADVERTISEMENT_E2E_FIXTURE_MARKER=<operator-provided fixture marker>
```

The backend process additionally requires `TEST_DB_USERNAME`,
`TEST_DB_PASSWORD`, and `ADVERTISEMENT_BROWSER_TEST_MEDIA_DIRECTORY`. Do not
commit or print these values.

The password is consumed only in memory by the test process. The Admin input
is required so the environment contract covers the authorized management
account, although the current dashboard scenarios use Teacher and Student
accounts. The tests do not guess credentials and do not support mock JWTs.

## Fixture contract

The backend must be provisioned separately by an approved mechanism before a
run. This repository currently contains Leave-only fixture scripts and no
Advertisement fixture creator, so this phase intentionally does not invent or
execute one.

The approved environment must provide, in the Admin's tenant:

- active synthetic Admin, Teacher, and Student accounts;
- enabled Teacher and Student Advertisement sections;
- published advertisements with authenticated PNG/JPEG media;
- at least one horizontal and one vertical advertisement for layout checks;
- at least two published advertisements for rotation, refresh, and fallback
  checks;
- media for at least one advertisement whose protected retrieval succeeds.

Fixtures must be synthetic, tenant-scoped, and separately reconciled by the
environment owner. Each run must have a unique run identifier and a manifest
under the existing test-planning directory containing created tenant/user IDs,
advertisement IDs, media IDs, and exact storage keys. Cleanup must verify the
manifest, tenant, and ownership before deletion and refuse deletion when
ownership cannot be proven. The test suite does not create, update, delete,
publish, archive, upload, or clean Advertisement records. Login/logout creates
and revokes only the test authentication sessions through the real authentication
API; that write must be included in the runtime authorization review.

## Run after independent approval

Start the isolated backend first with the `advertisement-browser-test` profile,
using its guarded launcher, the reviewed `cms_leave_test` datasource, and the
isolated media-directory variable. Confirm port `14200` is unused before allowing
Playwright to start the frontend. Then run with the process-local variables
above:

The reviewed backend launcher must select the profile explicitly, for example:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=advertisement-browser-test
```

This command is documentation only and was not executed during Phase 2.

```bash
npm run e2e:advertisement
```

The config runs Chromium at desktop and iPhone 13 viewport sizes with one
worker. It fails during global setup if the isolated backend identity or served
frontend API target is wrong. No Leave variables are required.

## Coverage boundary

The tests cover dashboard placement, deferred loading, horizontal/vertical
presentation, image containment, overlay opacity isolation, automatic rotation,
successful and failed refreshes, active-ad fallback, and replacement-media Blob
URL revocation. They also cover the dashboard Pause/Resume and Close controls,
responsive control placement, and touch swipe direction versus vertical and
short gestures. Refresh/fallback/media replacement cases intercept the first
post-load refresh request and preserve the feed envelope. These interactions
use narrow
Playwright response interception and are reported as frontend-behavior checks;
they are not evidence that a backend Advertisement was deleted.

Permanent deletion, upload mutation, cross-tenant authorization, database
cleanup, and migration verification remain separate backend/integration work
and are not claimed by this suite.

## Fixture tooling boundary

The backend repository contains `tools/advertisement_fixture_manifest.py` for
offline manifest initialization and validation. It is not run automatically,
does not connect to PostgreSQL or the application, and does not create fixture
records or media. It requires `ADVERTISEMENT_BROWSER_TEST_MEDIA_DIRECTORY` and
refuses the default `advertisement-media` path.

The manifest is written atomically under
`.local-test-plans/advertisement/` and contains only run identity, exact record
placeholders, database-target metadata, media-root metadata, progress, and
reconciliation state. It must never contain passwords, tokens, or secrets.

Manifest creation is exclusive. State updates require the previous
`updatedAt` value and use a per-run lock plus an atomic replacement. The tool
rejects symlinked manifest roots, parent components, manifest files, and media
roots. The approved media root must already exist below the isolated backend
test media parent; the tool never creates it.

The cleanup preflight intentionally refuses deletion until a later approved
application-backed integration verifies every manifest ID, tenant relationship,
media ownership, and exact storage key. No broad deletion by title, email, or
marker is supported.

Runtime execution of this tooling remains unverified and was not performed in
this phase.

Filesystem race protection is bounded by the host operating system and the
local filesystem; the tool performs checks immediately before operations but
does not claim protection against a privileged external process replacing paths
concurrently. Manifest validation remains structural validation, not database
ownership or deletion authorization.
