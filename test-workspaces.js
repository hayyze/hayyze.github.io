const fs = require('fs');

console.log('=== RUNNING HAYYIZ WORKSPACES & SYNCHRONIZED TASKS TEST SUITE ===\n');

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

// Simulated In-Memory Database & RLS Engine for Unit & Integration Validation
class SupabaseDbMock {
    constructor() {
        this.users = {};
        this.workspaces = [];
        this.workspace_members = [];
        this.tasks = [];
        this.task_members = [];
        this.task_progress = [];
        this.focus_sessions = [];
        this.listeners = [];
    }

    addUser(id, email) {
        this.users[id] = { id, email };
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

    addWorkspaceMember(currentUser, workspaceId, targetUserId, role = 'member') {
        // RLS Check: Owner or Creator
        const isOwner = this.workspace_members.some(wm => wm.workspace_id === workspaceId && wm.user_id === currentUser.id && wm.role === 'owner');
        if (!isOwner) throw new Error('42501: RLS policy violation: Only owners can add members');

        const member = { workspace_id: workspaceId, user_id: targetUserId, role };
        this.workspace_members.push(member);
        this.notifyRealtime('workspace_members', 'INSERT', member);
        return member;
    }

    removeWorkspaceMember(currentUser, workspaceId, targetUserId) {
        const isOwnerOrSelf = currentUser.id === targetUserId || this.workspace_members.some(wm => wm.workspace_id === workspaceId && wm.user_id === currentUser.id && wm.role === 'owner');
        if (!isOwnerOrSelf) throw new Error('42501: RLS policy violation: Only owners or self can remove member');

        this.workspace_members = this.workspace_members.filter(wm => !(wm.workspace_id === workspaceId && wm.user_id === targetUserId));
        this.notifyRealtime('workspace_members', 'DELETE', { workspace_id: workspaceId, user_id: targetUserId });
    }

    // Tasks
    createTask(currentUser, { title, description, scope, completion_mode, workspace_id, recipientUserIds = [] }) {
        if (!currentUser) throw new Error('42501: Unauthorized');
        const taskId = 'task_' + Math.random().toString(36).substring(2, 9);

        // RLS Check if workspace task
        if (workspace_id) {
            const isWsMember = this.workspace_members.some(wm => wm.workspace_id === workspace_id && wm.user_id === currentUser.id);
            if (!isWsMember) throw new Error('42501: RLS policy violation: Not a workspace member');
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

        // Add creator
        this.task_members.push({ task_id: taskId, user_id: currentUser.id, role: 'creator' });

        // Add recipients if scope == specific_users
        if (scope === 'specific_users') {
            recipientUserIds.forEach(uId => {
                if (uId !== currentUser.id) {
                    this.task_members.push({ task_id: taskId, user_id: uId, role: 'assignee' });
                }
            });
        }

        this.notifyRealtime('tasks', 'INSERT', task);
        return task;
    }

    // Query tasks visible to current user (RLS Policy Enforcement)
    getVisibleTasks(currentUser) {
        if (!currentUser) return [];

        return this.tasks.filter(t => {
            // 1. Creator
            if (t.creator_id === currentUser.id) return true;

            // 2. Direct task member
            const isTaskMember = this.task_members.some(tm => tm.task_id === t.id && tm.user_id === currentUser.id);
            if (isTaskMember) return true;

            // 3. Workspace member if scope == workspace
            if (t.scope === 'workspace' && t.workspace_id) {
                const isWsMember = this.workspace_members.some(wm => wm.workspace_id === t.workspace_id && wm.user_id === currentUser.id);
                if (isWsMember) return true;
            }

            return false;
        });
    }

    // Toggle completion (Independent vs Collaborative)
    toggleTaskProgress(currentUser, taskId, completed) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');

        // Check read/write permission
        const visibleTasks = this.getVisibleTasks(currentUser);
        if (!visibleTasks.some(t => t.id === taskId)) {
            throw new Error('42501: RLS policy violation: Cannot edit task not permitted to user');
        }

        // Upsert progress
        let prog = this.task_progress.find(p => p.task_id === taskId && p.user_id === currentUser.id);
        if (prog) {
            prog.completed = completed;
            prog.updated_at = new Date().toISOString();
        } else {
            prog = { task_id: taskId, user_id: currentUser.id, completed, updated_at: new Date().toISOString() };
            this.task_progress.push(prog);
        }

        if (task.completion_mode === 'collaborative') {
            task.completed = completed;
        }

        this.notifyRealtime('task_progress', 'UPDATE', prog);
        return prog;
    }

    // Edit task (Title / Desc)
    updateTask(currentUser, taskId, patch) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');

        const isAuthorized = task.creator_id === currentUser.id || this.task_members.some(tm => tm.task_id === taskId && tm.user_id === currentUser.id);
        if (!isAuthorized) throw new Error('42501: RLS policy violation: Cannot modify task');

        Object.assign(task, patch);
        this.notifyRealtime('tasks', 'UPDATE', task);
        return task;
    }

    // Log focus session
    logFocusSession(currentUser, taskId, workspaceId, durationSeconds) {
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

    // Compute stats
    getFocusStats(currentUser) {
        const userSessions = this.focus_sessions.filter(s => s.user_id === currentUser.id);
        const totalDurationSecs = userSessions.reduce((acc, s) => acc + s.duration_seconds, 0);
        const workspaceDurationSecs = userSessions.filter(s => s.workspace_id).reduce((acc, s) => acc + s.duration_seconds, 0);

        return {
            totalMinutes: Math.round(totalDurationSecs / 60),
            workspaceMinutes: Math.round(workspaceDurationSecs / 60)
        };
    }

    subscribeRealtime(callback) {
        this.listeners.push(callback);
    }

    notifyRealtime(table, event, payload) {
        this.listeners.forEach(cb => cb({ table, event, payload }));
    }
}

// EXECUTE 15 SCENARIOS
const db = new SupabaseDbMock();

const user1 = { id: 'u101', email: 'user1@hayyiz.com' };
const user2 = { id: 'u102', email: 'user2@hayyiz.com' };
const user3 = { id: 'u103', email: 'user3@hayyiz.com' };

db.addUser(user1.id, user1.email);
db.addUser(user2.id, user2.email);
db.addUser(user3.id, user3.email);

// Scenario 1: User 1 creates personal task
{
    const personalTask = db.createTask(user1, { title: 'مهمة شخصية 1', scope: 'me', completion_mode: 'independent' });
    const user1Tasks = db.getVisibleTasks(user1);
    const user2Tasks = db.getVisibleTasks(user2);
    assert(personalTask && personalTask.id && user1Tasks.length === 1, 'Scenario 1: User creates personal task visible to creator');
    assert(user2Tasks.length === 0, 'Scenario 1: Personal task is strictly hidden from user 2');
}

// Scenario 2 & 3: User 1 creates task shared with User 2
let sharedTask1 = null;
{
    sharedTask1 = db.createTask(user1, {
        title: 'حل 30 سؤالاً',
        scope: 'specific_users',
        completion_mode: 'independent',
        recipientUserIds: [user2.id]
    });
    const user2Tasks = db.getVisibleTasks(user2);
    assert(sharedTask1 && user2Tasks.some(t => t.id === sharedTask1.id), 'Scenario 2 & 3: Task shared with User 2 appears in User 2 task list');
}

// Scenario 4 & 5: User 2 completes independent shared task -> User 1 status unchanged
{
    db.toggleTaskProgress(user2, sharedTask1.id, true);
    const user2Prog = db.task_progress.find(p => p.task_id === sharedTask1.id && p.user_id === user2.id);
    const user1Prog = db.task_progress.find(p => p.task_id === sharedTask1.id && p.user_id === user1.id);

    assert(user2Prog && user2Prog.completed === true, 'Scenario 4: User 2 marks shared task as completed');
    assert(user1Prog === undefined || user1Prog.completed === false, 'Scenario 5: User 1 completion status remains unchanged (independent mode)');
}

// Scenario 6: User 1 completes task
{
    db.toggleTaskProgress(user1, sharedTask1.id, true);
    const user1Prog = db.task_progress.find(p => p.task_id === sharedTask1.id && p.user_id === user1.id);
    assert(user1Prog && user1Prog.completed === true, 'Scenario 6: User 1 completes task independently');
}

// Scenario 7: Collaborative task progress handling
{
    const collabTask = db.createTask(user1, {
        title: 'إنهاء مشروع العلوم',
        scope: 'specific_users',
        completion_mode: 'collaborative',
        recipientUserIds: [user2.id]
    });

    db.toggleTaskProgress(user1, collabTask.id, true);
    const fetchedTask = db.tasks.find(t => t.id === collabTask.id);
    assert(fetchedTask && fetchedTask.completed === true, 'Scenario 7: Collaborative task updates overall task progress for group');
}

// Scenario 8: Adding a member to a workspace
let workspace1 = null;
{
    workspace1 = db.createWorkspace(user1, 'مذاكرة القدرات', 'مساحة مشتركة');
    db.addWorkspaceMember(user1, workspace1.id, user2.id, 'member');
    const isMember = db.workspace_members.some(wm => wm.workspace_id === workspace1.id && wm.user_id === user2.id);
    assert(isMember, 'Scenario 8: Owner successfully adds User 2 to workspace');
}

// Scenario 9: Removing a member from workspace
{
    db.addWorkspaceMember(user1, workspace1.id, user3.id, 'member');
    db.removeWorkspaceMember(user1, workspace1.id, user3.id);
    const isMember = db.workspace_members.some(wm => wm.workspace_id === workspace1.id && wm.user_id === user3.id);
    assert(!isMember, 'Scenario 9: Workspace owner removes member cleanly');
}

// Scenario 10: Unauthorized user attempts to read unpermitted task -> Rejected
{
    const privateTask = db.createTask(user1, { title: 'سرية جداً', scope: 'me' });
    const user3Tasks = db.getVisibleTasks(user3);
    assert(!user3Tasks.some(t => t.id === privateTask.id), 'Scenario 10: Unauthorized user cannot view private task');
}

// Scenario 11: Unauthorized user attempts to edit task -> Rejected
{
    const taskBy1 = db.createTask(user1, { title: 'مهمة 1', scope: 'me' });
    let errorCaught = false;
    try {
        db.updateTask(user3, taskBy1.id, { title: 'تعديل اختراق' });
    } catch (e) {
        errorCaught = true;
    }
    assert(errorCaught, 'Scenario 11: Unauthorized edit attempt is strictly rejected by RLS');
}

// Scenario 12 & 13: Pomodoro linked to task & duration logging
{
    const task = db.createTask(user1, { title: 'دراسة الفيزياء', scope: 'me' });
    const session = db.logFocusSession(user1, task.id, null, 25 * 60);
    assert(session && session.task_id === task.id && session.duration_seconds === 1500, 'Scenario 12 & 13: Focus session is correctly linked to task with 1500s duration');
}

// Scenario 14: Focus statistics display correct aggregated times
{
    const stats = db.getFocusStats(user1);
    assert(stats && stats.totalMinutes === 25, 'Scenario 14: Focus statistics display accurate total minutes (25m)');
}

// Scenario 15: Realtime sync without page reload
{
    let realtimeReceived = false;
    db.subscribeRealtime((event) => {
        if (event.table === 'tasks' && event.event === 'INSERT') {
            realtimeReceived = true;
        }
    });

    db.createTask(user1, { title: 'اختبار ريل تايم', scope: 'me' });
    assert(realtimeReceived, 'Scenario 15: Realtime channel receives live task updates without page reload');
}

console.log(`\n===================================`);
console.log(`WORKSPACES TEST SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) process.exit(1);
