# Student day planning

The existing task, subject, calendar, focus log and Pomodoro systems remain canonical. Plans contain task references and allocations, never cloned tasks.

## Behavior

- Exam/goal work and dated standalone tasks share one date-based capacity ledger, including when there are no active exam plans. The 366-day horizon is independent of exam creation, so adding an unrelated empty plan does not change task allocation. Each task uses the earlier of its own deadline and its plan’s last ordinary workday. Earlier effective deadlines win before priority; target date/ID and task creation/ID provide deterministic ties. This prevents urgent homework or a task inside a later exam from being starved by flexible exam review. A subject task matching multiple plans is owned by only one plan. Explicit event/goal links remain authoritative.
- Weekly budgets, today's remaining-time override and overlapping recurring commitments use the same capacity calculation. Reservations only deduct their overlap with the configured study period. Overnight study periods are not supported; the form explains that start/end must be within one day.
- A day with zero capacity stays at zero. Today subtracts completed focus, and changing remaining time accounts for previously completed focus without deducting it twice.
- Today’s view consumes those same task allocations, including homework outside exam plans; undated tasks fill unused capacity. Tasks with no feasible allocation remain deferred rather than re-entering the free-time queue. Unallocated work remains visible; deadlines are not silently changed. Exhausting an estimate does not mark a task complete.
- The quick setup captures a real subject/task and available time. A task without an explicit estimate gets a suggested session, rather than an invented total estimate.
- The standalone study planner restores its draft, reads existing subjects/exams, and explicitly adopts its results into the existing tasks. Duplicate rows with the same trimmed, length-limited subject name are combined before writes: their minutes are summed and the strongest priority is kept. The adoption status explains the aggregation. Oversized sums are rejected before creating an exam or task. Re-adopting the same target/subject updates generated minutes, deadline and priority only while each field still matches its previous generated value. Task text, completion and focus progress are preserved. Edited fields and older tasks without a baseline are retained and reported in the adoption status; omitted subjects are retained and reported too. Selected saved exams retain their identity, name and date. Switching the exam clears the adopted target; “بدء خطة جديدة بهذه المدخلات” starts a distinct draft without saving it until adoption. Its preview is an initial estimate; the adopted plan includes shared capacity and may expose a deficit.
- A budgeted launch caps that focus session without editing saved Pomodoro preferences. Existing running/paused sessions retain their persisted state. Session completion offers estimate extension, explicit task completion, notes and breaks.

## Storage and sync

Existing keys and task IDs are retained. Planner-created exam records carry `plannerSource: true`; generated task fields carry a `plannerDefaults` baseline. Legacy new-plan drafts establish ownership only when their stored target, empty exam selection and existing generic exam/plan agree. Legacy task values without a baseline are protected rather than guessed. New backup-compatible keys are:

- `hayyiz-planning-preferences`: weekly/default capacity, date overrides, study period, recurring commitments and modification timestamp.
- `hayyiz-day-reviews`: bounded daily reviews using a fixed reason list.
- `hayyiz-planner-draft`: local study planner inputs/adopted target.

`hayyiz-pref-daily-capacity` is now included in backups. Default capacity also travels with planning preferences so a new device uses the same budget.

The existing `sync_items` table is reused; no database/schema/RLS changes are needed. Plans sync compact configurations, not derived daily schedules. Local past schedule entries survive a configuration merge. The plan/review maps merge independent entries by their modification timestamps. Planning preferences use the existing last-write-wins single-item behavior. Both preference saves and capacity changes request the shared serial sync drain instead of issuing independent upserts, preventing an older request from overwriting a newer preference on this device. Failed uploads do not advance the sync cursor. A sync call waits for serial follow-up rounds whenever the local adapter data changes during a successful round, so a save during an in-flight upload is drained before the shared promise resolves. Failure stops the drain and keeps local data for an explicit retry, avoiding an offline retry loop. Offline writes remain local for retry on reconnect/sign-in.

Optional planning usage events are disabled by default, honor DNT/GPC, and contain only allowlisted action names. The standalone page queues up to 50 allowlisted names locally until a page with the existing analytics loader is opened. Turning the option off clears this queue. No task titles, IDs, notes or email addresses are included. Existing page analytics behavior is unchanged.

## Validation

- `node scripts/run-tests.cjs`: all root `test-*.js` suites, including failure detection for older suites that only print a failure count.
- `node scripts/browser-smoke.cjs`: requires Playwright and its Chromium in the test environment. Exercises setup, Arabic minutes, short focus session, reload/expiry reconciliation, estimate extension, explicit completion, planner adoption/reload, changing from a saved exam to a new plan, generated estimate updates, manual-edit protection, explicit new-plan identity, duplicate-subject minute preservation, task deadlines without an exam plan, planner layout at 320/390px, weekly capacity, commitments, review, dark mode, mobile/desktop overflow and cold offline planner navigation.
- `test-planning-review-regressions.js` reproduces all five review findings, plus legacy-draft compatibility, competing task deadlines across exams, zero-capacity deferral, deadline allocation without exams, duplicate aggregation/re-adoption, and serialized preference saves. The three additional cases failed before their respective fixes. The original five cases failed on the reviewed PR head before the fixes.
- GitHub Actions runs syntax checks, regression/security suites and the browser workflow. Browser tooling installs under the runner's temporary directory; it adds no runtime dependency to the website.

Cross-device sync is covered using the real sync engine with an isolated fake transport. Live authenticated cross-device checks and physical Safari/iPad checks remain release checks; local tests do not establish those outcomes.
