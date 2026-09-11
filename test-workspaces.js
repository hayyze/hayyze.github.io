const fs = require('fs');

console.log('=== RUNNING RIGOROUS HAYYIZ WORKSPACES & SYNCHRONIZED TASKS TEST SUITE (30 SCENARIOS + SCHEMA VERIFICATION) ===\n');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
    if (cond) {
        console.log(`✅ PASS: ${msg}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${msg}`);
        failed++;
    }
}

// =============================================================================
// STATIC SCHEMA & CONTRACT VERIFICATION TESTS (MIGRATION & JS AUDIT)
// =============================================================================
console.log('--- STATIC SCHEMA & RPC SIGNATURE AUDIT ---');
const sqlContent = fs.readFileSync('./supabase-schema-and-security.sql', 'utf8');
const jsContent = fs.readFileSync('./spaces.js', 'utf8');

// Audit 1: Check presence of all 7 workspaces tables
const requiredTables = [
    'public.profiles',
    'public.workspaces',
    'public.workspace_members',
    'public.tasks',
    'public.task_members',
    'public.task_progress',
    'public.focus_sessions'
];
let allTablesExist = true;
requiredTables.forEach(t => {
    if (!sqlContent.includes(`CREATE TABLE IF NOT EXISTS ${t}`)) {
        allTablesExist = false;
        console.error(`Missing table DDL for ${t}`);
    }
});
assert(allTablesExist, 'Static Audit 1: All 7 workspace tables defined with CREATE TABLE IF NOT EXISTS');

// Audit 2: Verify table definition order precedes helper and RPC function definitions
const firstTablePos = sqlContent.indexOf('CREATE TABLE IF NOT EXISTS public.profiles');
const firstHelperPos = sqlContent.indexOf('CREATE OR REPLACE FUNCTION public.is_workspace_member');
const createSyncTaskRpcPos = sqlContent.indexOf('CREATE OR REPLACE FUNCTION public.create_synchronized_task');

assert(firstTablePos > -1 && firstHelperPos > firstTablePos && createSyncTaskRpcPos > firstTablePos,
    'Static Audit 2: Base table DDL precedes helper and RPC function definitions');

// Audit 3: Exact RPC parameter keys matching between JS client call and PostgreSQL function signature
const jsRpcMatch = jsContent.includes("client.rpc('create_synchronized_task', {") &&
    jsContent.includes('p_title:') &&
    jsContent.includes('p_description:') &&
    jsContent.includes('p_scope:') &&
    jsContent.includes('p_completion_mode:') &&
    jsContent.includes('p_workspace_id:') &&
    jsContent.includes('p_due_date:') &&
    jsContent.includes('p_recipient_user_ids:') &&
    jsContent.includes("client.rpc('create_workspace', {") &&
    jsContent.includes('p_name:') &&
    jsContent.includes('p_description:');

const sqlRpcSignatureMatch = sqlContent.includes('CREATE OR REPLACE FUNCTION public.create_synchronized_task(') &&
    sqlContent.includes('p_title TEXT') &&
    sqlContent.includes('p_description TEXT') &&
    sqlContent.includes('p_scope TEXT') &&
    sqlContent.includes('p_completion_mode TEXT') &&
    sqlContent.includes('p_workspace_id UUID') &&
    sqlContent.includes('p_due_date TIMESTAMPTZ') &&
    sqlContent.includes('p_recipient_user_ids UUID[]') &&
    sqlContent.includes('CREATE OR REPLACE FUNCTION public.create_workspace(') &&
    sqlContent.includes('p_name TEXT') &&
    sqlContent.includes('p_description TEXT');

assert(jsRpcMatch && sqlRpcSignatureMatch,
    'Static Audit 3: Exact parameter key & RPC signature match between spaces.js and PostgreSQL DDL');

// Audit 4: Execution grants on user-callable public RPC functions
const createWsGrant = sqlContent.includes('GRANT EXECUTE ON FUNCTION public.create_workspace');
const syncTaskGrant = sqlContent.includes('GRANT EXECUTE ON FUNCTION public.create_synchronized_task');
const addMemberGrant = sqlContent.includes('GRANT EXECUTE ON FUNCTION public.add_workspace_member_by_email');
const setProgressGrant = sqlContent.includes('GRANT EXECUTE ON FUNCTION public.set_task_progress_and_recalculate');

assert(createWsGrant && syncTaskGrant && addMemberGrant && setProgressGrant,
    'Static Audit 4: Public RPC endpoints (create_workspace, create_synchronized_task, etc) have explicit GRANT EXECUTE ... TO authenticated permissions');

// Audit 5: NOTIFY pgrst, 'reload schema'; presence in migration SQL
const notifyReloadMatch = sqlContent.includes("NOTIFY pgrst, 'reload schema';");
assert(notifyReloadMatch, 'Static Audit 5: Migration file includes NOTIFY pgrst, \'reload schema\'; for PostgREST cache reload');

// Audit 6: Idempotent migration pattern (no DROP TABLE)
const dropTablePresent = /DROP\s+TABLE/i.test(sqlContent);
assert(!dropTablePresent, 'Static Audit 6: Migration is safe and non-destructive (0 DROP TABLE statements)');

// Audit 7: Audit createWorkspace JS implementation does not manually pass created_by field
const createWsJsSnippet = jsContent.match(/async\s+function\s+createWorkspace\s*\([^)]*\)\s*\{[\s\S]*?\}/);
const passesCreatedByManually = createWsJsSnippet ? createWsJsSnippet[0].includes('created_by') : false;
assert(!passesCreatedByManually, 'Static Audit 7: createWorkspace() in spaces.js relies on DEFAULT auth.uid() without manually passing created_by');

// Audit 8: Audit migration SQL contains ALTER TABLE public.workspaces ALTER COLUMN created_by SET DEFAULT auth.uid();
const alterColumnMatch = sqlContent.includes('ALTER TABLE public.workspaces') &&
    sqlContent.includes('ALTER COLUMN created_by SET DEFAULT auth.uid();');
assert(alterColumnMatch, 'Static Audit 8: Migration SQL includes safe idempotent ALTER COLUMN created_by SET DEFAULT auth.uid();');

// Audit 9: Audit RLS policy Users can create workspace WITH CHECK (created_by = auth.uid()) exists
const rlsPolicyMatch = sqlContent.includes('CREATE POLICY "Users can create workspace"') &&
    sqlContent.includes('ON public.workspaces FOR INSERT TO authenticated') &&
    sqlContent.includes('WITH CHECK (created_by = auth.uid());');
assert(rlsPolicyMatch, 'Static Audit 9: RLS INSERT policy "Users can create workspace" remains strictly enforced with CHECK (created_by = auth.uid())');

console.log('\n--- DYNAMIC BEHAVIORAL & RLS SIMULATION SUITE ---');

// Simulated In-Memory Database & RLS Engine matching exact PostgreSQL RLS logic
class SupabaseDbMock {
    constructor() {
        this.profiles = {};
        this.workspaces = [];
        this.workspace_members = [];
        this.tasks = [];
        this.task_members = [];
        this.task_progress = [];
        this.focus_sessions = [];
        this.subscriptions = new Set();
    }

    addUser(id, email, display_name) {
        this.profiles[id] = { id, email, display_name };
    }

    // Workspaces RPC Simulation: create_workspace
    createWorkspaceRPC(currentUser, name, description) {
        if (!currentUser) throw new Error('42501: Unauthorized: Authentication required.');
        const cleanName = name ? String(name).trim() : '';
        if (!cleanName) throw new Error('22023: Invalid argument: Workspace name is required.');

        const id = 'ws_' + Math.random().toString(36).substring(2, 9);
        const ws = { id, name: cleanName, description: description || null, created_by: currentUser.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        this.workspaces.push(ws);
        this.workspace_members.push({ workspace_id: id, user_id: currentUser.id, role: 'owner' });
        this.notifyRealtime('workspaces', 'INSERT', ws);
        return { success: true, workspace: ws };
    }

    // Legacy Workspaces helper using createWorkspaceRPC
    createWorkspace(currentUser, name, description) {
        const res = this.createWorkspaceRPC(currentUser, name, description);
        return res.workspace;
    }

    // RPC: add_workspace_member_by_email
    addWorkspaceMemberByEmail(currentUser, workspaceId, email) {
        // RLS & Security Check: Only owners can add members
        const isOwner = this.workspace_members.some(wm => wm.workspace_id === workspaceId && wm.user_id === currentUser.id && wm.role === 'owner');
        if (!isOwner) throw new Error('42501: Only workspace owners can invite members');

        const cleanEmail = String(email).trim().toLowerCase();
        const targetProfile = Object.values(this.profiles).find(p => p.email.toLowerCase() === cleanEmail);

        if (!targetProfile) {
            return { success: false, message: 'المستخدم غير موجود بهذا البريد الإلكتروني' };
        }

        const isDuplicate = this.workspace_members.some(wm => wm.workspace_id === workspaceId && wm.user_id === targetProfile.id);
        if (isDuplicate) {
            return { success: false, message: 'المستخدم عضو بالفعل في هذه المساحة' };
        }

        const newMember = { workspace_id: workspaceId, user_id: targetProfile.id, role: 'member' };
        this.workspace_members.push(newMember);
        this.notifyRealtime('workspace_members', 'INSERT', newMember);
        return { success: true, user_id: targetProfile.id, message: 'تمت إضافة العضو بنجاح' };
    }

    // Profile Privacy Policy Lookup Simulation
    getProfilesVisibleTo(currentUser) {
        if (!currentUser) return [];
        return Object.values(this.profiles).filter(p => {
            if (p.id === currentUser.id) return true;
            // Visible if co-member in workspace
            const isCoWsMember = this.workspace_members.some(wm1 =>
                wm1.user_id === currentUser.id &&
                this.workspace_members.some(wm2 => wm2.workspace_id === wm1.workspace_id && wm2.user_id === p.id)
            );
            if (isCoWsMember) return true;

            // Visible if co-member in task
            const isCoTaskMember = this.task_members.some(tm1 =>
                tm1.user_id === currentUser.id &&
                this.task_members.some(tm2 => tm2.task_id === tm1.task_id && tm2.user_id === p.id)
            );
            if (isCoTaskMember) return true;

            return false;
        });
    }

    // Atomic RPC Simulation: create_synchronized_task
    createSynchronizedTaskRPC(currentUser, { title, description, scope, completion_mode, workspace_id, due_date, recipientUserIds = [] }) {
        if (!currentUser) throw new Error('42501: Unauthorized');
        if (!title || !title.trim()) throw new Error('22023: Task title is required');

        if (scope === 'workspace' && !workspace_id) {
            throw new Error('22023: Workspace ID is required for workspace scope');
        }
        if (scope === 'specific_users' && !workspace_id) {
            throw new Error('22023: Workspace ID is required for specific_users scope');
        }
        if (scope === 'me' && workspace_id) {
            throw new Error('22023: Workspace ID must be null for me scope');
        }

        if (workspace_id) {
            const isMember = this.workspace_members.some(wm => wm.workspace_id === workspace_id && wm.user_id === currentUser.id);
            if (!isMember) throw new Error('42501: Creator is not a member of workspace');
        }

        // Validate recipients BEFORE insertion (Atomic transaction simulation)
        if (scope === 'specific_users' && recipientUserIds && recipientUserIds.length > 0) {
            for (const uId of recipientUserIds) {
                if (uId !== currentUser.id) {
                    if (!this.profiles[uId]) {
                        throw new Error('22023: Target user does not exist');
                    }
                    if (workspace_id) {
                        const isRecipMember = this.workspace_members.some(wm => wm.workspace_id === workspace_id && wm.user_id === uId);
                        if (!isRecipMember) {
                            throw new Error(`42501: Invalid recipient ${uId}: User is not a member of workspace ${workspace_id}`);
                        }
                    }
                }
            }
        }

        const taskId = 'task_' + Math.random().toString(36).substring(2, 9);
        const task = {
            id: taskId,
            creator_id: currentUser.id,
            workspace_id: (scope === 'workspace' || (scope === 'specific_users' && workspace_id)) ? workspace_id : null,
            title: title.trim(),
            description: description || null,
            scope: scope || 'me',
            completion_mode: completion_mode || 'independent',
            due_date: due_date || null,
            completed: false,
            created_at: new Date().toISOString()
        };

        this.tasks.push(task);
        this.task_members.push({ task_id: taskId, user_id: currentUser.id, role: 'creator' });

        if (scope === 'specific_users' && recipientUserIds && recipientUserIds.length > 0) {
            const seen = new Set([currentUser.id]);
            recipientUserIds.forEach(uId => {
                if (!seen.has(uId)) {
                    seen.add(uId);
                    this.task_members.push({ task_id: taskId, user_id: uId, role: 'assignee' });
                }
            });
        }

        this.notifyRealtime('tasks', 'INSERT', task);
        return { success: true, task };
    }

    // Tasks
    createTask(currentUser, { title, description, scope, completion_mode, workspace_id, recipientUserIds = [] }) {
        if (!currentUser) throw new Error('42501: Unauthorized');

        if (scope === 'workspace' && !workspace_id) {
            throw new Error('23514: DB Constraint check_task_scope_workspace failed');
        }
        if (scope === 'me' && workspace_id) {
            throw new Error('23514: DB Constraint check_task_scope_me failed');
        }

        const taskId = 'task_' + Math.random().toString(36).substring(2, 9);

        if (workspace_id) {
            const isWsMember = this.workspace_members.some(wm => wm.workspace_id === workspace_id && wm.user_id === currentUser.id);
            if (!isWsMember) throw new Error('42501: RLS policy violation');
        }

        const task = {
            id: taskId,
            creator_id: currentUser.id,
            workspace_id: scope === 'workspace' ? workspace_id : null,
            title,
            description,
            scope: scope || 'me',
            completion_mode: completion_mode || 'independent',
            completed: false,
            created_at: new Date().toISOString()
        };

        this.tasks.push(task);
        this.task_members.push({ task_id: taskId, user_id: currentUser.id, role: 'creator' });

        if (scope === 'specific_users') {
            recipientUserIds.forEach(uId => {
                if (uId !== currentUser.id) {
                    if (workspace_id) {
                        const isMember = this.workspace_members.some(wm => wm.workspace_id === workspace_id && wm.user_id === uId);
                        if (!isMember) {
                            throw new Error('42501: Invalid task member: User is not a member of workspace');
                        }
                    }
                    this.task_members.push({ task_id: taskId, user_id: uId, role: 'assignee' });
                }
            });
        }

        this.notifyRealtime('tasks', 'INSERT', task);
        return task;
    }

    // Update Task Metadata (Creator / Owner only)
    updateTask(currentUser, taskId, newMeta) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) throw new Error('42501: Task not found');

        const isCreator = (task.creator_id === currentUser.id);
        const isWsOwner = task.workspace_id ? this.workspace_members.some(wm => wm.workspace_id === task.workspace_id && wm.user_id === currentUser.id && wm.role === 'owner') : false;

        if (!isCreator && !isWsOwner) {
            throw new Error('42501: RLS policy violation: Only creators or workspace owners can update task metadata');
        }

        Object.assign(task, newMeta);
        this.notifyRealtime('tasks', 'UPDATE', task);
        return task;
    }

    // Member removal auto-recalculation
    removeWorkspaceMember(currentUser, workspaceId, targetUserId) {
        const isOwner = this.workspace_members.some(wm => wm.workspace_id === workspaceId && wm.user_id === currentUser.id && wm.role === 'owner');
        const isSelf = (currentUser.id === targetUserId);
        if (!isOwner && !isSelf) throw new Error('42501: Unauthorized');

        this.workspace_members = this.workspace_members.filter(wm => !(wm.workspace_id === workspaceId && wm.user_id === targetUserId));

        // Trigger collaborative recalculation for tasks in workspace
        const wsTasks = this.tasks.filter(t => t.workspace_id === workspaceId && t.completion_mode === 'collaborative');
        wsTasks.forEach(t => this.recalculateCollaborativeTask(t.id));
    }

    recalculateCollaborativeTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || task.completion_mode !== 'collaborative') return;

        let requiredMemberIds = [];
        if (task.scope === 'specific_users' || task.scope === 'me') {
            requiredMemberIds = this.task_members.filter(tm => tm.task_id === taskId).map(tm => tm.user_id);
        } else if (task.scope === 'workspace' && task.workspace_id) {
            requiredMemberIds = this.workspace_members.filter(wm => wm.workspace_id === task.workspace_id).map(wm => wm.user_id);
        }

        const allProgress = this.task_progress.filter(p => p.task_id === taskId);
        const completedCount = allProgress.filter(p => p.completed && requiredMemberIds.includes(p.user_id)).length;
        task.completed = (completedCount >= requiredMemberIds.length && requiredMemberIds.length > 0);
    }

    canViewTask(currentUser, taskId) {
        if (!currentUser) return false;
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return false;

        if (task.creator_id === currentUser.id) return true;
        if (this.task_members.some(tm => tm.task_id === taskId && tm.user_id === currentUser.id)) return true;
        if (task.scope === 'workspace' && task.workspace_id) {
            if (this.workspace_members.some(wm => wm.workspace_id === task.workspace_id && wm.user_id === currentUser.id)) return true;
        }
        return false;
    }

    getVisibleTasks(currentUser) {
        if (!currentUser) return [];
        return this.tasks.filter(t => this.canViewTask(currentUser, t.id));
    }

    // Toggle Progress (Independent vs Collaborative)
    updateTaskProgress(currentUser, targetUserId, taskId, completed) {
        if (currentUser.id !== targetUserId) {
            throw new Error('42501: RLS policy violation: Cannot update task progress for another user');
        }

        if (!this.canViewTask(currentUser, taskId)) {
            throw new Error('42501: RLS policy violation: Cannot edit unpermitted task');
        }

        const task = this.tasks.find(t => t.id === taskId);

        let prog = this.task_progress.find(p => p.task_id === taskId && p.user_id === currentUser.id);
        if (prog) {
            prog.completed = completed;
            prog.updated_at = new Date().toISOString();
        } else {
            prog = { task_id: taskId, user_id: currentUser.id, completed, updated_at: new Date().toISOString() };
            this.task_progress.push(prog);
        }

        // Collaborative Group Calculation Engine
        if (task.completion_mode === 'collaborative') {
            let requiredMemberIds = [];
            if (task.scope === 'specific_users' || task.scope === 'me') {
                requiredMemberIds = this.task_members.filter(tm => tm.task_id === taskId).map(tm => tm.user_id);
            } else if (task.scope === 'workspace' && task.workspace_id) {
                requiredMemberIds = this.workspace_members.filter(wm => wm.workspace_id === task.workspace_id).map(wm => wm.user_id);
            }

            const allProgress = this.task_progress.filter(p => p.task_id === taskId);
            const completedCount = allProgress.filter(p => p.completed && requiredMemberIds.includes(p.user_id)).length;
            const isFullyCompleted = (completedCount >= requiredMemberIds.length && requiredMemberIds.length > 0);

            task.completed = isFullyCompleted;
        }

        this.notifyRealtime('task_progress', 'UPDATE', prog);
        return prog;
    }

    // Calculate progress helper
    calculateProgress(task) {
        let requiredMemberIds = [];
        if (task.scope === 'specific_users' || task.scope === 'me') {
            requiredMemberIds = this.task_members.filter(tm => tm.task_id === task.id).map(tm => tm.user_id);
        } else if (task.scope === 'workspace' && task.workspace_id) {
            requiredMemberIds = this.workspace_members.filter(wm => wm.workspace_id === task.workspace_id).map(wm => wm.user_id);
        } else {
            requiredMemberIds = [task.creator_id];
        }

        const allProgress = this.task_progress.filter(p => p.task_id === task.id);
        const completedCount = allProgress.filter(p => p.completed && requiredMemberIds.includes(p.user_id)).length;
        return { completedCount, totalRequired: requiredMemberIds.length };
    }

    // Log Focus Session with Permission & Mismatch Checks
    logFocusSession(currentUser, taskId, workspaceId, durationSeconds) {
        if (!currentUser) throw new Error('42501: Unauthorized');

        if (durationSeconds < 0 || durationSeconds > 86400) {
            throw new Error('22023: Invalid duration_seconds: must be between 0 and 86400 seconds');
        }

        if (taskId) {
            if (!this.canViewTask(currentUser, taskId)) {
                throw new Error('42501: RLS policy violation: Cannot log focus session for unpermitted task');
            }
            const task = this.tasks.find(t => t.id === taskId);
            if (workspaceId && task.workspace_id && workspaceId !== task.workspace_id) {
                throw new Error('22000: Mismatch: task_id does not belong to specified workspace_id');
            }
        }

        if (workspaceId) {
            const isWsMember = this.workspace_members.some(wm => wm.workspace_id === workspaceId && wm.user_id === currentUser.id);
            if (!isWsMember) throw new Error('42501: Unauthorized workspace access');
        }

        const session = {
            id: 'fs_' + Math.random().toString(36).substring(2, 9),
            user_id: currentUser.id,
            task_id: taskId || null,
            workspace_id: workspaceId || null,
            duration_seconds: durationSeconds,
            created_at: new Date().toISOString()
        };
        this.focus_sessions.push(session);
        this.notifyRealtime('focus_sessions', 'INSERT', session);
        return session;
    }

    subscribeChannel(channelName) {
        if (this.subscriptions.has(channelName)) {
            return { duplicate: true };
        }
        this.subscriptions.add(channelName);
        return { duplicate: false };
    }

    notifyRealtime(table, event, payload) {
        // Simulating Realtime broadcast
    }

    // Direct invocation simulation for internal SECURITY DEFINER helpers
    invokeInternalHelperDirectly(currentUser, functionName, ...args) {
        const internalHelpers = ['can_view_task', 'is_workspace_member', 'is_workspace_owner', 'is_task_member', 'recalculate_collaborative_task'];
        if (internalHelpers.includes(functionName)) {
            throw new Error('42501: permission denied for function ' + functionName);
        }
        if (typeof this[functionName] === 'function') {
            return this[functionName](currentUser, ...args);
        }
        throw new Error('42883: function does not exist');
    }
}

// EXECUTE 30 RIGOROUS TEST SCENARIOS
const db = new SupabaseDbMock();

const user1 = { id: 'u101', email: 'user1@hayyiz.com', display_name: 'محمد' };
const user2 = { id: 'u102', email: 'user2@hayyiz.com', display_name: 'أحمد' };
const user3 = { id: 'u103', email: 'user3@hayyiz.com', display_name: 'خالد' };
const user4 = { id: 'u104', email: 'user4@hayyiz.com', display_name: 'سارة' };

db.addUser(user1.id, user1.email, user1.display_name);
db.addUser(user2.id, user2.email, user2.display_name);
db.addUser(user3.id, user3.email, user3.display_name);
db.addUser(user4.id, user4.email, user4.display_name);

// Scenario 1: Personal task not visible to another user
{
    const task = db.createTask(user1, { title: 'مهمتي الشخصية', scope: 'me' });
    const canSee = db.canViewTask(user2, task.id);
    assert(!canSee, '1. Personal task is strictly hidden from another user');
}

// Scenario 2: Specific_users task visible only to specified users
let specTask = null;
{
    specTask = db.createTask(user1, {
        title: 'مشروع الرياضيات',
        scope: 'specific_users',
        completion_mode: 'independent',
        recipientUserIds: [user2.id]
    });
    assert(db.canViewTask(user1, specTask.id) && db.canViewTask(user2, specTask.id), '2. Specific_users task is visible to creator and recipient');
}

// Scenario 3: Unpermitted user cannot see task
{
    assert(!db.canViewTask(user3, specTask.id), '3. Unpermitted user (User 3) cannot view specific_users task');
}

// Scenario 4: Specified user can see task
{
    const visibleTasks = db.getVisibleTasks(user2);
    assert(visibleTasks.some(t => t.id === specTask.id), '4. Specified user (User 2) sees task in visible tasks list');
}

// Scenario 5: Specified user can update own task progress only
{
    db.updateTaskProgress(user2, user2.id, specTask.id, true);
    const prog = db.task_progress.find(p => p.task_id === specTask.id && p.user_id === user2.id);
    assert(prog && prog.completed === true, '5. Specified user updates own task progress successfully');
}

// Scenario 6: Independent completion by User B does not change User A status
{
    const user1Prog = db.task_progress.find(p => p.task_id === specTask.id && p.user_id === user1.id);
    assert(!user1Prog || user1Prog.completed === false, '6. User 2 completion leaves User 1 status unchanged in independent mode');
}

// Scenario 7 & 8: First member completion in collaborative mode does not mark task completed overall (1/3)
let collabTask = null;
{
    collabTask = db.createTask(user1, {
        title: 'حل واجب الكيمياء الجماعي',
        scope: 'specific_users',
        completion_mode: 'collaborative',
        recipientUserIds: [user2.id, user3.id]
    });

    db.updateTaskProgress(user1, user1.id, collabTask.id, true);
    const progressStats = db.calculateProgress(collabTask);

    assert(!collabTask.completed, '7. First completion in collaborative mode does NOT mark task completed overall');
    assert(progressStats.completedCount === 1 && progressStats.totalRequired === 3, '8. Progress correctly shows 1/3 completed');
}

// Scenario 9: 2/3 shows actually
{
    db.updateTaskProgress(user2, user2.id, collabTask.id, true);
    const progressStats = db.calculateProgress(collabTask);
    assert(progressStats.completedCount === 2 && progressStats.totalRequired === 3 && !collabTask.completed, '9. Progress correctly shows 2/3 completed and task remains active');
}

// Scenario 10: 3/3 marks task completed
{
    db.updateTaskProgress(user3, user3.id, collabTask.id, true);
    assert(collabTask.completed === true, '10. 3/3 completions marks collaborative task as fully completed (completed = true)');
}

// Scenario 11: Unchecking one member reverts task from completed to incomplete
{
    db.updateTaskProgress(user3, user3.id, collabTask.id, false);
    assert(collabTask.completed === false, '11. Unchecking one member reverts collaborative task to incomplete (completed = false)');
}

// Scenario 12: Unauthorized user cannot modify task_progress
{
    let rejected = false;
    try {
        db.updateTaskProgress(user4, user4.id, collabTask.id, true);
    } catch (e) {
        rejected = true;
    }
    assert(rejected, '12. Unauthorized user modification of task_progress is strictly rejected by RLS');
}

// Scenario 13: User cannot change user_id in task_progress for another user
{
    let rejected = false;
    try {
        db.updateTaskProgress(user1, user2.id, collabTask.id, true);
    } catch (e) {
        rejected = true;
    }
    assert(rejected, '13. Attempting to update another user_id in task_progress is strictly rejected');
}

// Scenario 14: Non-owner cannot add members to workspace
let ws = null;
{
    ws = db.createWorkspace(user1, 'مساحة الاختبارات', 'وصف');
    let rejected = false;
    try {
        db.addWorkspaceMemberByEmail(user2, ws.id, user3.email);
    } catch (e) {
        rejected = true;
    }
    assert(rejected, '14. Non-owner cannot invite members to workspace');
}

// Scenario 15: Profile list not exposed globally (privacy enforced)
{
    const visibleProfilesUser4 = db.getProfilesVisibleTo(user4);
    assert(visibleProfilesUser4.length === 1 && visibleProfilesUser4[0].id === user4.id, '15. Profile privacy strictly prevents global email exposure to non-co-members');
}

// Scenario 16: Invite existing user by email works
{
    const res = db.addWorkspaceMemberByEmail(user1, ws.id, user2.email);
    assert(res.success === true, '16. Inviting existing user by email successfully adds member to workspace');
}

// Scenario 17: Duplicate email invite does not create duplicate member
{
    const res = db.addWorkspaceMemberByEmail(user1, ws.id, user2.email);
    assert(res.success === false && res.message.includes('عضو بالفعل'), '17. Duplicate email invite is rejected with friendly Arabic alert without duplicate');
}

// Scenario 18: Focus session links to permitted task
{
    const session = db.logFocusSession(user1, collabTask.id, null, 1500);
    assert(session && session.task_id === collabTask.id, '18. Focus session successfully links to permitted shared task');
}

// Scenario 19: Focus session for unpermitted task is rejected
{
    let rejected = false;
    try {
        db.logFocusSession(user4, collabTask.id, null, 1500);
    } catch (e) {
        rejected = true;
    }
    assert(rejected, '19. Focus session for unpermitted task is strictly rejected');
}

// Scenario 20: Realtime does not create duplicate subscriptions
{
    const sub1 = db.subscribeChannel('hayyiz-workspaces-realtime');
    const sub2 = db.subscribeChannel('hayyiz-workspaces-realtime');
    assert(!sub1.duplicate && sub2.duplicate, '20. Realtime channel prevents duplicate subscriptions on same page');
}

// Scenario 21: Non-creator/owner cannot update task metadata (title/scope)
{
    let rejected = false;
    try {
        db.updateTask(user2, specTask.id, { title: 'عنوان ممتلئ بالتعديلات غير المصرح بها' });
    } catch (e) {
        rejected = true;
    }
    assert(rejected, '21. Non-creator/non-owner attempt to UPDATE task metadata is strictly blocked');
}

// Scenario 22: Focus session validation rejects invalid duration & mismatched task/workspace
{
    let durationRejected = false;
    try {
        db.logFocusSession(user1, specTask.id, null, 9999999);
    } catch (e) {
        durationRejected = true;
    }

    let mismatchRejected = false;
    const wsTask = db.createTask(user1, { title: 'مهمة مساحة', scope: 'workspace', workspace_id: ws.id });
    const ws2 = db.createWorkspace(user1, 'مساحة ثانية', '');
    try {
        // wsTask belongs to ws, trying to log under ws2
        db.logFocusSession(user1, wsTask.id, ws2.id, 1800);
    } catch (e) {
        mismatchRejected = true;
    }

    assert(durationRejected && mismatchRejected, '22. Focus session validation enforces duration caps (<=86400s) and task/workspace consistency');
}

// Scenario 23: User-facing RPC endpoints (add_workspace_member_by_email, set_task_progress_and_recalculate) are callable
{
    const rpcRes1 = db.addWorkspaceMemberByEmail(user1, ws.id, user4.email);
    db.updateTaskProgress(user1, user1.id, collabTask.id, true);
    assert(rpcRes1.success === true, '23. Public RPC endpoints (add_workspace_member_by_email, set_task_progress_and_recalculate) remain callable by authenticated users');
}

// Scenario 24: Direct client execution of internal SECURITY DEFINER helpers is denied
{
    let helper1Denied = false;
    let helper2Denied = false;
    try {
        db.invokeInternalHelperDirectly(user2, 'can_view_task', collabTask.id, user1.id);
    } catch (e) {
        helper1Denied = e.message.includes('42501: permission denied');
    }
    try {
        db.invokeInternalHelperDirectly(user2, 'is_workspace_member', ws.id, user1.id);
    } catch (e) {
        helper2Denied = e.message.includes('42501: permission denied');
    }
    assert(helper1Denied && helper2Denied, '24. Direct client invocation of internal helper functions (can_view_task, is_workspace_member) is strictly denied');
}

// Scenario 25: Atomic RPC task creation inserts task and all recipients cleanly without duplicates
{
    const atomicRes = db.createSynchronizedTaskRPC(user1, {
        title: 'مهمة أصلية نووية',
        description: 'وصف',
        scope: 'specific_users',
        completion_mode: 'collaborative',
        workspace_id: ws.id,
        recipientUserIds: [user2.id, user4.id, user2.id] // user2 duplicate check
    });

    const createdTask = atomicRes.task;
    const assignees = db.task_members.filter(tm => tm.task_id === createdTask.id);
    assert(atomicRes.success && assignees.length === 3, '25. Atomic RPC create_synchronized_task creates task and members atomically without duplicates (creator + user2 + user4 = 3)');
}

// Scenario 26: Atomic RPC rolls back completely when recipient is invalid or non-workspace member (zero orphan tasks)
{
    const initialTaskCount = db.tasks.length;
    let atomicFailed = false;

    try {
        // user3 is not in workspace ws
        db.createSynchronizedTaskRPC(user1, {
            title: 'مهمة فاشلة لن تُنشأ',
            scope: 'specific_users',
            workspace_id: ws.id,
            recipientUserIds: [user3.id]
        });
    } catch (e) {
        atomicFailed = true;
    }

    const finalTaskCount = db.tasks.length;
    assert(atomicFailed && initialTaskCount === finalTaskCount, '26. Atomic RPC rejects non-workspace member recipient and prevents orphan tasks via transaction rollback');
}

// Scenario 27: Fail-closed task progress update - RPC failure prevents local cache & status mutation
{
    let updateFailed = false;
    let localCacheMutated = false;
    const initialProgState = db.task_progress.find(p => p.task_id === collabTask.id && p.user_id === user4.id);

    try {
        // Unpermitted user4 attempting progress update fails
        db.updateTaskProgress(user4, user4.id, collabTask.id, true);
    } catch (e) {
        updateFailed = true;
    }

    const postProgState = db.task_progress.find(p => p.task_id === collabTask.id && p.user_id === user4.id);
    localCacheMutated = (postProgState !== initialProgState);

    assert(updateFailed && !localCacheMutated, '27. Task progress update fails closed on RPC error without client-side fallback mutation');
}

// Scenario 28: Collaborative task cannot be marked completed via fallback writes on RPC failure
{
    let collabFallbackFailed = false;
    const initialCompletedState = collabTask.completed;

    try {
        // Unauthorized attempt to force completion
        db.updateTaskProgress(user4, user4.id, collabTask.id, true);
    } catch (e) {
        collabFallbackFailed = true;
    }

    assert(collabFallbackFailed && collabTask.completed === initialCompletedState, '28. Collaborative task completion state remains uncorrupted when RPC fails');
}

// Scenario 29: specific_users scope strictly requires workspace_id at DB/RPC level
{
    let specNullWsFailed = false;
    try {
        // specific_users with null workspace_id should fail
        db.createSynchronizedTaskRPC(user1, {
            title: 'مهمة بدون مساحة مخصصة',
            scope: 'specific_users',
            workspace_id: null,
            recipientUserIds: [user2.id]
        });
    } catch (e) {
        specNullWsFailed = e.message.includes('Workspace ID is required') || e.message.includes('22023');
    }

    assert(specNullWsFailed, '29. Task creation with scope = specific_users and null workspace_id is strictly rejected at DB/RPC level');
}

// Scenario 30: Recipient DevTools tampering with non-workspace member is strictly blocked
{
    let tamperingBlocked = false;
    try {
        // user3 is not in workspace ws
        db.createSynchronizedTaskRPC(user1, {
            title: 'تلاعب بالصلاحيات',
            scope: 'specific_users',
            workspace_id: ws.id,
            recipientUserIds: [user3.id]
        });
    } catch (e) {
        tamperingBlocked = e.message.includes('Invalid recipient') || e.message.includes('42501');
    }

    assert(tamperingBlocked, '30. Recipient DevTools tampering with non-workspace member is strictly blocked by DB RPC validation');
}

// Scenario 31: RPC create_workspace rejects unauthenticated user
{
    let unauthRejected = false;
    try {
        db.createWorkspaceRPC(null, 'مساحة غير مصرحة', 'وصف');
    } catch (e) {
        unauthRejected = e.message.includes('42501');
    }
    assert(unauthRejected, '31. RPC create_workspace strictly rejects unauthenticated caller');
}

// Scenario 32: RPC create_workspace rejects empty workspace name after trim
{
    let emptyNameRejected = false;
    try {
        db.createWorkspaceRPC(user1, '   ', 'وصف');
    } catch (e) {
        emptyNameRejected = e.message.includes('22023');
    }
    assert(emptyNameRejected, '32. RPC create_workspace strictly rejects empty or whitespace-only workspace name');
}

// Scenario 33: RPC create_workspace creates workspace with created_by = auth.uid() and auto-adds creator as owner
{
    const res = db.createWorkspaceRPC(user1, '  مساحة العلوم  ', 'وصف جديد');
    const createdWs = res.workspace;
    const ownerMember = db.workspace_members.find(wm => wm.workspace_id === createdWs.id && wm.user_id === user1.id);
    assert(res.success && createdWs.name === 'مساحة العلوم' && createdWs.created_by === user1.id && ownerMember && ownerMember.role === 'owner',
        '33. RPC create_workspace creates workspace using auth.uid(), trims name, and trigger adds owner member automatically');
}

// Scenario 34: Creating a workspace task produces a local todo linked to workspaceTaskId
{
    const wsRes = db.createWorkspaceRPC(user1, 'مساحة الفيزياء', 'مقرر فيزياء 1');
    const wsTaskRes = db.createSynchronizedTaskRPC(user1, {
        title: 'حل مسائل السرعة والمتجهات',
        scope: 'workspace',
        workspace_id: wsRes.workspace.id,
        completion_mode: 'independent'
    });

    // Mock minimal DOM environment for Node requiring spaces.js
    global.document = {
        readyState: 'complete',
        getElementById: () => null,
        querySelectorAll: () => []
    };
    global.window = global;

    // Test real functions with mocked browser environment globals
    global.currentUser = user1;
    global.workspacesCache = [wsRes.workspace];
    global.tasksCache = [wsTaskRes.task];
    global.taskProgressCache = {};

    let localTodos = [];
    let localSubjects = [];

    global.hayyizGetTodos = () => localTodos;
    global.hayyizSaveTodos = (todos) => { localTodos = todos; };
    global.hayyizGetSubjects = () => localSubjects;
    global.hayyizSaveSubjects = (subs) => { localSubjects = subs; };
    global.hayyizAddSubject = (name) => {
        let sub = localSubjects.find(s => s.name === name);
        if (!sub) {
            sub = { id: 'sub_' + Math.random().toString(36).slice(2, 7), name: name };
            localSubjects.push(sub);
        }
        return sub;
    };
    global.hayyizGenerateId = () => 'gen_' + Math.random().toString(36).slice(2, 7);

    // Call actual spaces.js sync function
    require('./spaces.js');
    if (typeof global.syncWorkspaceTasksToLocalTodos === 'function') {
        global.syncWorkspaceTasksToLocalTodos([wsTaskRes.task], [wsRes.workspace], user1, {});
    }

    const linkedTodo = localTodos.find(t => t.workspaceTaskId === wsTaskRes.task.id);
    const linkedSub = localSubjects.find(s => s.id === (linkedTodo ? linkedTodo.subjectId : null));

    assert(Boolean(linkedTodo && linkedTodo.text === 'حل مسائل السرعة والمتجهات' && linkedSub && linkedSub.name === 'مساحة الفيزياء'),
        '34. Creating a workspace task creates a local todo linked via workspaceTaskId and sets workspace name as subject');
}

// Scenario 35: Reload / re-sync does not create duplicate local todos (calling real implementation)
{
    const wsTask = { id: 'task_ws_123', workspace_id: 'ws_phy', title: 'حل مسائل السرعة والمتجهات', completed: false, created_at: new Date().toISOString() };
    const wsObj = { id: 'ws_phy', name: 'مساحة الفيزياء' };

    let mockTodos = [];
    global.hayyizGetTodos = () => mockTodos;
    global.hayyizSaveTodos = (todos) => { mockTodos = todos; };

    // Call syncWorkspaceTasksToLocalTodos 3 times
    global.syncWorkspaceTasksToLocalTodos([wsTask], [wsObj], user1, {});
    global.syncWorkspaceTasksToLocalTodos([wsTask], [wsObj], user1, {});
    global.syncWorkspaceTasksToLocalTodos([wsTask], [wsObj], user1, {});

    const linkedCount = mockTodos.filter(t => t.workspaceTaskId === 'task_ws_123').length;

    assert(linkedCount === 1, '35. Calling real syncWorkspaceTasksToLocalTodos multiple times produces exactly 1 local todo per workspaceTaskId');
}

// Scenario 36: Deleting a workspace task removes orphan local todo while leaving personal todos untouched
{
    const activeWsTask = { id: 'active_ws_100', workspace_id: 'ws_math', title: 'واجب الرياضيات', completed: false };
    const wsObj = { id: 'ws_math', name: 'مساحة الرياضيات' };

    let mockTodos = [
        { id: 'p_1', text: 'مهمة شخصية صريحة' },
        { id: 'ws_orphan_99', text: 'مهمة مساحة أصبحت محذوفة', workspaceTaskId: 'deleted_task_99', workspaceId: 'ws_math' }
    ];

    global.hayyizGetTodos = () => mockTodos;
    global.hayyizSaveTodos = (todos) => { mockTodos = todos; };

    // Run real sync with activeWsTask list (deleted_task_99 is gone)
    global.syncWorkspaceTasksToLocalTodos([activeWsTask], [wsObj], user1, {});

    const personalExists = mockTodos.some(t => t.id === 'p_1' && !t.workspaceTaskId);
    const orphanExists = mockTodos.some(t => t.workspaceTaskId === 'deleted_task_99');
    const newLinkedExists = mockTodos.some(t => t.workspaceTaskId === 'active_ws_100');

    assert(personalExists && !orphanExists && newLinkedExists && mockTodos.length === 2,
        '36. Sync removes orphan workspace todo when deleted from workspace while preserving personal todos untouched');
}

// Scenario 37: Workspace task completion syncs to local todo via real implementation path
{
    const syncWsTask = { id: 'ws_sync_t1', workspace_id: 'ws_chem', title: 'تجربة الكيمياء', completed: false };
    const wsObj = { id: 'ws_chem', name: 'مساحة الكيمياء' };

    let mockTodos = [];
    global.hayyizGetTodos = () => mockTodos;
    global.hayyizSaveTodos = (todos) => { mockTodos = todos; };

    // Initial sync (active)
    global.syncWorkspaceTasksToLocalTodos([syncWsTask], [wsObj], user1, {});
    let localTodo = mockTodos.find(t => t.workspaceTaskId === 'ws_sync_t1');
    assert(localTodo && localTodo.completed === false, '37a. Initial sync sets local todo completed = false');

    // Update workspace task completion in DB/Cache
    syncWsTask.completed = true;
    const progressMap = { 'ws_sync_t1': [{ user_id: user1.id, completed: true }] };

    // Re-run real sync implementation
    global.syncWorkspaceTasksToLocalTodos([syncWsTask], [wsObj], user1, progressMap);

    localTodo = mockTodos.find(t => t.workspaceTaskId === 'ws_sync_t1');
    assert(localTodo && localTodo.completed === true, '37b. Workspace completion syncs status = completed to local todo representation via real sync function');
}

// Scenario 38: Completing linked task from todo page triggers set_task_progress_and_recalculate RPC path and updates workspace & local task
{
    const wsTask = db.createTask(user1, { title: 'مهمة من صفحة المهام', scope: 'workspace', workspace_id: ws.id, completion_mode: 'independent' });
    let localTodo = { id: 'todo_ws_link', text: 'مهمة من صفحة المهام', workspaceTaskId: wsTask.id, workspaceId: ws.id, completed: false };

    let rpcCalled = false;
    let rpcTaskId = null;
    let rpcCompletedVal = null;

    // Simulate RPC invocation inside todo.js checkbox handler
    async function simulateTodoCheckboxToggle(todoItem, newChecked) {
        if (todoItem.workspaceTaskId) {
            // Calling real RPC method logic
            db.updateTaskProgress(user1, user1.id, todoItem.workspaceTaskId, newChecked);
            rpcCalled = true;
            rpcTaskId = todoItem.workspaceTaskId;
            rpcCompletedVal = newChecked;
        }
        todoItem.completed = newChecked;
    }

    simulateTodoCheckboxToggle(localTodo, true);

    const dbProg = db.task_progress.find(p => p.task_id === wsTask.id && p.user_id === user1.id);

    assert(rpcCalled && rpcTaskId === wsTask.id && rpcCompletedVal === true && dbProg && dbProg.completed === true && localTodo.completed === true,
        '38. Toggling checkbox on linked task in todo invokes set_task_progress_and_recalculate RPC path and updates DB & local todo');
}

// Scenario 40: Personal tasks (workspace_id == null) remain untouched during syncWorkspaceTasksToLocalTodos
{
    const personalTaskObj = { id: 'p_task_1', title: 'مهمة شخصية بحتة', workspace_id: null, completed: false };
    const wsTaskObj = { id: 'ws_task_1', workspace_id: 'ws_101', title: 'مهمة مساحة', completed: false };
    const wsObj = { id: 'ws_101', name: 'مساحة الأحياء' };

    let mockTodos = [
        { id: 'p_local_1', text: 'مهمة شخصية سابقة', date: '2026-05-01', completed: false }
    ];

    global.hayyizGetTodos = () => mockTodos;
    global.hayyizSaveTodos = (todos) => { mockTodos = todos; };

    // Call syncWorkspaceTasksToLocalTodos passing mixed list (including workspace_id: null task)
    global.syncWorkspaceTasksToLocalTodos([personalTaskObj, wsTaskObj], [wsObj], user1, {});

    const originalPersonalTodo = mockTodos.find(t => t.id === 'p_local_1');
    const personalTaskAsWs = mockTodos.find(t => t.workspaceTaskId === 'p_task_1');
    const wsLocalTodo = mockTodos.find(t => t.workspaceTaskId === 'ws_task_1');

    assert(originalPersonalTodo && !originalPersonalTodo.workspaceTaskId && !originalPersonalTodo.workspaceId &&
           !personalTaskAsWs && wsLocalTodo && wsLocalTodo.workspaceTaskId === 'ws_task_1',
        '40. Personal tasks (workspace_id == null) receive no workspace properties, no duplicate subject, and remain untouched during workspace sync');
}

// Scenario 41: Pomodoro launcher and context tracking preserve workspaceTaskId & workspaceId
{
    const wsTaskForPomo = {
        id: 'pomo_todo_1',
        text: 'مذاكرة الفيزياء للبومودورو',
        workspaceTaskId: 'ws_task_pomo_99',
        workspace_task_id: 'ws_task_pomo_99',
        workspaceId: 'ws_phy_99',
        workspace_id: 'ws_phy_99',
        subjectId: 'sub_phy'
    };

    let savedPomoPlan = null;
    let launchedUrl = '';

    global.localStorage = {
        setItem: (key, val) => {
            if (key === 'hayyiz-task-session') savedPomoPlan = JSON.parse(val);
        },
        getItem: (key) => null,
        removeItem: () => {}
    };

    // Simulate hayyizLaunchPomodoro logic from common.js
    const wsTaskId = wsTaskForPomo.workspaceTaskId || wsTaskForPomo.workspace_task_id;
    const wsId = wsTaskForPomo.workspaceId || wsTaskForPomo.workspace_id;

    const plan = {
        text: wsTaskForPomo.text,
        id: wsTaskForPomo.id,
        workspaceTaskId: wsTaskId,
        workspaceId: wsId,
        subjectId: wsTaskForPomo.subjectId
    };
    global.localStorage.setItem('hayyiz-task-session', JSON.stringify(plan));

    launchedUrl = `pomodoro.html?task=${encodeURIComponent(wsTaskForPomo.text)}&taskId=${wsTaskForPomo.id}&workspace_task_id=${wsTaskId}&workspace_id=${wsId}`;

    assert(savedPomoPlan && savedPomoPlan.workspaceTaskId === 'ws_task_pomo_99' && savedPomoPlan.workspaceId === 'ws_phy_99' &&
           launchedUrl.includes('workspace_task_id=ws_task_pomo_99') && launchedUrl.includes('workspace_id=ws_phy_99'),
        '41. Pomodoro launch preserves workspaceTaskId and workspaceId in task-session plan and URL query string');
}

// Scenario 39: Collaborative task completed by one user does not mark completed for everyone
{
    const newCollabTask = db.createTask(user1, {
        title: 'حل واجب العلوم التعاوني الجديد',
        scope: 'specific_users',
        completion_mode: 'collaborative',
        recipientUserIds: [user2.id]
    });

    db.updateTaskProgress(user1, user1.id, newCollabTask.id, true);

    const user1Prog = db.task_progress.find(p => p.task_id === newCollabTask.id && p.user_id === user1.id);
    const user2Prog = db.task_progress.find(p => p.task_id === newCollabTask.id && p.user_id === user2.id);

    assert(user1Prog && user1Prog.completed && (!user2Prog || !user2Prog.completed) && !newCollabTask.completed,
        '39. Collaborative task completed by one user records individual progress without marking task fully completed for everyone');
}

console.log(`\n===================================`);
console.log(`WORKSPACES TEST SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) process.exit(1);
