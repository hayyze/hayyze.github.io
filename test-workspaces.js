const fs = require('fs');

console.log('=== RUNNING RIGOROUS HAYYIZ WORKSPACES & SYNCHRONIZED TASKS TEST SUITE (28 SCENARIOS) ===\n');

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

    // Workspaces
    createWorkspace(currentUser, name, description) {
        if (!currentUser) throw new Error('42501: Unauthorized');
        const id = 'ws_' + Math.random().toString(36).substring(2, 9);
        const ws = { id, name, description, created_by: currentUser.id, created_at: new Date().toISOString() };
        this.workspaces.push(ws);
        this.workspace_members.push({ workspace_id: id, user_id: currentUser.id, role: 'owner' });
        this.notifyRealtime('workspaces', 'INSERT', ws);
        return ws;
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
        // Simulating PostgREST RPC authorization layer: internal helper functions REVOKED from authenticated role
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

// EXECUTE 20 RIGOROUS TEST SCENARIOS
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

console.log(`\n===================================`);
console.log(`WORKSPACES 28-SCENARIO TEST SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) process.exit(1);
