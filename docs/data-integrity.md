# Account and data integrity

Hayyiz retains its static Arabic RTL pages, existing logical storage keys and task,
subject, planning and Pomodoro models. No additional runtime dependency is required.

## Accounts and existing devices

`account-storage.js` runs before application scripts. Each document binds once to
the user ID in the saved Supabase session. Personal logical keys map to that
account's local area; sync cursors, deletions, active timers, pending focus writes
and the drawing PDF database follow the same boundary. Theme and game high score
remain device preferences. An auth change reloads the document; old async work
cannot write into the next account. This is account separation within the app,
not protection against malicious JavaScript running on the same origin.

Data saved by older versions has no trustworthy local owner. It remains in the
original guest area, including its original PDF database. Signing in does not
silently assign or upload it. A signed-in user can choose **إضافة بيانات هذا الجهاز
إلى حسابي** from the account panel or About page. The explicit copy retains the
guest original, merges records by stable ID and update time, respects current
deletions, preserves account settings on conflict, and excludes the old timer,
workspace assignments and pending workspace writes. Repeating the copy does not
duplicate identified records. A missing PDF is reported and its annotations are
restored without attaching an unrelated local PDF.

## Focus history and workspace sessions

`hayyiz-focus-history` remains a flat local day-to-minutes map for existing pages.
`hayyiz-focus-history-state` stores a shared legacy baseline and monotonic counters
for each device and day. Cloud `focus-history/history` includes both representations
with `__hayyiz_focus_v2`. Merging takes the maximum of the same counter, adds
independent device contributions, and preserves different dates. Flat legacy
increments beside old metadata contribute only their missing residual. Daily and
lifetime counters refresh from this merged state, including on a new device.

The database performs the same merge while holding the sync row lock, preventing
simultaneous device uploads from replacing each other's contributions. The item
still follows the existing 100 KiB server quota; a quota error retains local data
for retry. Arbitrary legacy flat totals cannot identify the original device or
recover already lost sessions. An old backup cannot decrement merged cloud focus
counters; this history is cumulative.

Completed sessions use their persisted end date, even after reopening the app on
another day. Pause/resume preserves the session ID. The actual interval completion
path records once, maintains the four-session cycle and consumes a planned short
session without changing the saved manual duration.

Workspace sessions enter `hayyiz-workspace-focus-outbox` before upload.
`record_focus_session` validates the authenticated account, task access, workspace,
times and duration. A unique `(user_id, client_session_id)` makes retries safe after
a lost response. Entries remain queued until acknowledgement; auth changes cannot
acknowledge another account's queue. The queue is intentionally excluded from
portable backups. Workspace task completion across Todo, Subject and Pomodoro
waits for the shared progress RPC before committing the local completed state.

## Backups and restoration

About exports version 3 JSON with personal data, drawing geometry and embedded PDF
bytes. Versions 1 and 2 remain readable. Limits are 25 MiB per PDF, 100 MiB of PDF
bytes per backup, 8 MiB of local structured values, and 192 MiB for the JSON file.
Validation rejects malformed structures, forbidden identity/privilege fields and
prototype keys. Drawing stroke `points` are geometry and are preserved by their
dedicated validator. Missing PDF references are reported before proceeding.

Restoration replaces the included local values and stages new sync timestamps
together. Other cloud-only records and entries in merged planning maps can return
when the account synchronizes; restoring a backup does not erase an entire cloud
account. It marks removed locally known
collection IDs as deletions, clears affected cursors, and retains the original
focus log timestamp while setting its edit time. Normal quota, IndexedDB request
and transaction failures roll back local values and PDF writes. LocalStorage and
IndexedDB cannot form one crash-safe transaction across abrupt browser shutdown;
keep the exported file until restoration is verified. The drawing/PDF backup is
portable; it does not add cloud synchronization for drawing files.

## Database changes and verification

The targeted SQL patch adds indexes, private RLS helpers, immutable sharing
identities, confirmed-auth-email invitations, idempotent focus writes and sync
ordering/merge guards. Public helper aliases remain non-executable to clients;
the private helpers receive only the grants needed by RLS and must remain outside
the exposed PostgREST schemas. Profile email is read-only display data for allowed
co-members, preserving cached-client compatibility; it never authorizes invitations.
Removing a workspace member removes directed assignments and access, including
access they once held as task creator. Deleting a task/workspace preserves session
history for its owner without broadening the deleted task's sharing scope.

`supabase-schema-and-security.sql` is the complete fresh-install/reapply reference.
Use the targeted migration for an existing project; do not run the test bootstrap
against a live project. CI bootstraps disposable PostgreSQL 17 Auth roles, runs the
schema, executes `scripts/test-database-security.sql` with real roles/RLS and rolled
back fixtures, then reapplies the schema and repeats the checks.

Run all local JavaScript regressions with `node scripts/run-tests.cjs`. The browser
job runs real Chromium workflows for task planning, timer recovery, keyboard
completion, account caches, PDF backup restoration, mobile layout and offline
query/extensionless routes including Pages-style redirects. It blocks external
requests and does not use real student credentials or data.
