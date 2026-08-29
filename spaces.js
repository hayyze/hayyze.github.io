/**
 * spaces.js — نظام المساحات والمهام المتزامنة التعاونية في منصة حيز (Hayyiz)
 * يتضمن المزامنة الفورية عبر Supabase Realtime، والتحكم بالمهام المستقلة والتعاونية وإحصائيات التركيز.
 */

(function (global) {
    'use strict';

    let currentUser = null;
    let activeWorkspaceId = 'all'; // 'all' or workspace UUID
    let currentTaskFilter = 'active'; // 'active' | 'completed'

    let workspacesCache = [];
    let workspaceMembersCache = {}; // workspace_id -> Array of members/profiles
    let tasksCache = [];
    let taskMembersCache = {}; // task_id -> Array of task_members/profiles
    let taskProgressCache = {}; // task_id -> Array of progress items
    let focusSessionsCache = [];

    let realtimeSubscription = null;

    // Helper: Safe DOM query selector
    function $(id) {
        return document.getElementById(id);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Central API Methods
     */
    async function getSupabase() {
        if (typeof ensureSupabaseLoaded === 'function') {
            return await ensureSupabaseLoaded();
        }
        return window.supabaseClient || null;
    }

    async function createWorkspace(name, description) {
        if (!currentUser) throw new Error('يرجى تسجيل الدخول أولاً');
        const client = await getSupabase();
        const { data, error } = await client.from('workspaces').insert({
            name,
            description,
            created_by: currentUser.id
        }).select().single();

        if (error) throw error;
        return data;
    }

    async function deleteWorkspace(workspaceId) {
        if (!currentUser) throw new Error('يرجى تسجيل الدخول أولاً');
        const client = await getSupabase();
        const { error } = await client.from('workspaces').delete().eq('id', workspaceId);
        if (error) throw error;
    }

    async function addWorkspaceMemberByEmail(workspaceId, email) {
        if (!currentUser) throw new Error('يرجى تسجيل الدخول أولاً');
        const client = await getSupabase();
        const { data, error } = await client.rpc('add_workspace_member_by_email', {
            p_workspace_id: workspaceId,
            p_email: email
        });

        if (error) throw error;
        return data;
    }

    async function removeWorkspaceMember(workspaceId, userId) {
        if (!currentUser) throw new Error('يرجى تسجيل الدخول أولاً');
        const client = await getSupabase();
        const { error } = await client.from('workspace_members')
            .delete()
            .eq('workspace_id', workspaceId)
            .eq('user_id', userId);

        if (error) throw error;
    }

    async function createWorkspaceTask({ title, description, scope, completion_mode, workspace_id, due_date, recipientUserIds = [] }) {
        if (!currentUser) throw new Error('يرجى تسجيل الدخول أولاً');
        if (scope === 'specific_users' && (!recipientUserIds || recipientUserIds.length === 0)) {
            throw new Error('يرجى اختيار مستلم واحد على الأقل للمهمة الموجهة');
        }

        const client = await getSupabase();
        const { data: newTask, error } = await client.from('tasks').insert({
            creator_id: currentUser.id,
            workspace_id: scope === 'workspace' ? workspace_id : null,
            title,
            description,
            scope,
            completion_mode,
            due_date: due_date ? new Date(due_date).toISOString() : null
        }).select().single();

        if (error) throw error;

        // Add additional task members if specific_users
        if (scope === 'specific_users' && recipientUserIds.length > 0) {
            const membersToInsert = recipientUserIds
                .filter(uId => uId !== currentUser.id)
                .map(uId => ({
                    task_id: newTask.id,
                    user_id: uId,
                    role: 'assignee'
                }));

            if (membersToInsert.length > 0) {
                const { error: memberError } = await client.from('task_members').insert(membersToInsert);
                if (memberError) console.error('Error inserting task members:', memberError);
            }
        }

        return newTask;
    }

    async function deleteTask(taskId) {
        if (!currentUser) throw new Error('يرجى تسجيل الدخول أولاً');
        const client = await getSupabase();
        const { error } = await client.from('tasks').delete().eq('id', taskId);
        if (error) throw error;
    }

    async function updateTaskProgress(taskId, completed) {
        if (!currentUser) throw new Error('يرجى تسجيل الدخول أولاً');
        const client = await getSupabase();
        const nowIso = new Date().toISOString();

        const task = tasksCache.find(t => t.id === taskId);
        if (!task) return;

        // 1. Update task_progress for caller
        const { error: progError } = await client.from('task_progress').upsert({
            task_id: taskId,
            user_id: currentUser.id,
            completed: completed,
            completed_at: completed ? nowIso : null,
            updated_at: nowIso
        });

        if (progError) throw progError;

        // 2. If collaborative mode, recalculate total group completion status
        if (task.completion_mode === 'collaborative') {
            const allProgress = taskProgressCache[taskId] || [];
            // Update local memory first to reflect caller change
            let callerProg = allProgress.find(p => p.user_id === currentUser.id);
            if (callerProg) {
                callerProg.completed = completed;
            } else {
                allProgress.push({ task_id: taskId, user_id: currentUser.id, completed });
            }

            const isAllCompleted = calculateCollaborativeTaskProgress(task, allProgress).isFullyCompleted;

            const { error: taskError } = await client.from('tasks').update({
                completed: isAllCompleted,
                completed_at: isAllCompleted ? nowIso : null,
                updated_at: nowIso
            }).eq('id', taskId);

            if (taskError) throw taskError;
        }
    }

    /**
     * Calculates Group Completion Progress for Collaborative Tasks
     */
    function calculateCollaborativeTaskProgress(task, progressList = []) {
        if (!task) return { totalRequired: 0, completedCount: 0, percentage: 0, isFullyCompleted: false };

        const members = taskMembersCache[task.id] || [];
        let totalRequired = 0;

        if (task.scope === 'specific_users' || task.scope === 'me') {
            totalRequired = Math.max(1, members.length);
        } else if (task.scope === 'workspace' && task.workspace_id) {
            const wsMembers = workspaceMembersCache[task.workspace_id] || [];
            totalRequired = Math.max(1, wsMembers.length);
        } else {
            totalRequired = 1;
        }

        const completedCount = progressList.filter(p => p.completed).length;
        const percentage = Math.min(100, Math.round((completedCount / totalRequired) * 100));
        const isFullyCompleted = (completedCount >= totalRequired);

        return { totalRequired, completedCount, percentage, isFullyCompleted };
    }

    /**
     * Initializer for Workspaces Module
     */
    async function initWorkspacesModule() {
        setupUIEvents();

        if (typeof hayyizGetUser === 'function') {
            currentUser = await hayyizGetUser();
        } else if (typeof window !== 'undefined' && window.supabaseClient && window.supabaseClient.auth) {
            const { data } = await window.supabaseClient.auth.getUser();
            currentUser = data ? data.user : null;
        }

        const guestBanner = $('workspace-guest-banner');
        if (!currentUser) {
            if (guestBanner) guestBanner.classList.remove('hidden');
            renderTasksList();
            return;
        } else {
            if (guestBanner) guestBanner.classList.add('hidden');
        }

        await loadAllWorkspaceData();
        setupRealtimeSubscriptions();
    }

    /**
     * Loads Workspaces, Tasks, Progress, Members and Focus Sessions
     */
    async function loadAllWorkspaceData() {
        try {
            const client = await getSupabase();
            if (!client || !currentUser) return;

            // 1. Fetch User Workspaces
            const { data: wsData, error: wsError } = await client
                .from('workspaces')
                .select('*')
                .order('created_at', { ascending: false });

            if (!wsError && wsData) {
                workspacesCache = wsData;
            }

            // 2. Fetch Workspace Members & Profiles
            if (workspacesCache.length > 0) {
                const wsIds = workspacesCache.map(w => w.id);
                const { data: wm = [] } = await client
                    .from('workspace_members')
                    .select('workspace_id, user_id, role, created_at, profiles(id, email, display_name)')
                    .in('workspace_id', wsIds);

                workspaceMembersCache = {};
                (wm || []).forEach(m => {
                    if (!workspaceMembersCache[m.workspace_id]) workspaceMembersCache[m.workspace_id] = [];
                    workspaceMembersCache[m.workspace_id].push({
                        user_id: m.user_id,
                        role: m.role,
                        email: m.profiles ? m.profiles.email : 'مستخدم',
                        display_name: m.profiles ? (m.profiles.display_name || m.profiles.email) : 'مستخدم'
                    });
                });
            }

            // 3. Fetch Permitted Tasks
            const { data: taskData, error: taskError } = await client
                .from('tasks')
                .select('*')
                .order('created_at', { ascending: false });

            if (!taskError && taskData) {
                tasksCache = taskData;
            }

            // 4. Fetch Task Members & Task Progress for loaded tasks
            if (tasksCache.length > 0) {
                const taskIds = tasksCache.map(t => t.id);

                const { data: tm = [] } = await client
                    .from('task_members')
                    .select('task_id, user_id, role, profiles(id, email, display_name)')
                    .in('task_id', taskIds);

                taskMembersCache = {};
                (tm || []).forEach(m => {
                    if (!taskMembersCache[m.task_id]) taskMembersCache[m.task_id] = [];
                    taskMembersCache[m.task_id].push({
                        user_id: m.user_id,
                        role: m.role,
                        email: m.profiles ? m.profiles.email : 'مستخدم',
                        display_name: m.profiles ? (m.profiles.display_name || m.profiles.email) : 'مستخدم'
                    });
                });

                const { data: tp = [] } = await client
                    .from('task_progress')
                    .select('*')
                    .in('task_id', taskIds);

                taskProgressCache = {};
                (tp || []).forEach(p => {
                    if (!taskProgressCache[p.task_id]) taskProgressCache[p.task_id] = [];
                    taskProgressCache[p.task_id].push(p);
                });
            }

            // 5. Optimized Focus Sessions Query: fetch recent 7 days only
            const startOfWeekIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: fsData } = await client
                .from('focus_sessions')
                .select('*')
                .gte('created_at', startOfWeekIso)
                .order('created_at', { ascending: false });

            if (fsData) {
                focusSessionsCache = fsData;
            }

            // Render updated UI
            renderWorkspaceTabs();
            renderActiveWorkspaceHeader();
            renderTasksList();
            renderFocusStats();

        } catch (e) {
            console.error('Error loading workspace data:', e);
        }
    }

    /**
     * Realtime Subscriptions with Granular Updates
     */
    function setupRealtimeSubscriptions() {
        if (!currentUser) return;

        getSupabase().then(client => {
            if (!client || realtimeSubscription) return;

            realtimeSubscription = client
                .channel('hayyiz-workspaces-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
                    handleRealtimeTaskChange(payload);
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'task_progress' }, (payload) => {
                    handleRealtimeProgressChange(payload);
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members' }, () => {
                    loadAllWorkspaceData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'focus_sessions' }, (payload) => {
                    if (payload.new) focusSessionsCache.unshift(payload.new);
                    renderFocusStats();
                })
                .subscribe();
        }).catch(() => {});
    }

    function handleRealtimeTaskChange(payload) {
        if (payload.eventType === 'INSERT' && payload.new) {
            tasksCache.unshift(payload.new);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
            const idx = tasksCache.findIndex(t => t.id === payload.new.id);
            if (idx >= 0) tasksCache[idx] = payload.new;
        } else if (payload.eventType === 'DELETE' && payload.old) {
            tasksCache = tasksCache.filter(t => t.id !== payload.old.id);
        }
        renderTasksList();
        renderActiveWorkspaceHeader();
    }

    function handleRealtimeProgressChange(payload) {
        if (payload.new) {
            const taskId = payload.new.task_id;
            if (!taskProgressCache[taskId]) taskProgressCache[taskId] = [];
            const idx = taskProgressCache[taskId].findIndex(p => p.user_id === payload.new.user_id);
            if (idx >= 0) taskProgressCache[taskId][idx] = payload.new;
            else taskProgressCache[taskId].push(payload.new);
        }
        renderTasksList();
        renderActiveWorkspaceHeader();
    }

    /**
     * Render Workspace Tabs Navigation
     */
    function renderWorkspaceTabs() {
        const container = $('workspace-tabs-container');
        if (!container) return;

        container.innerHTML = `
            <button type="button" class="btn btn-outline ${activeWorkspaceId === 'all' ? 'active' : ''}" data-workspace-id="all">
                <i class="fa-solid fa-layer-group"></i> كل المهام المتزامنة
            </button>
        `;

        workspacesCache.forEach(ws => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn btn-outline ${activeWorkspaceId === ws.id ? 'active' : ''}`;
            btn.dataset.workspaceId = ws.id;
            btn.innerHTML = `<i class="fa-solid fa-folder-closed"></i> ${escapeHtml(ws.name)}`;
            container.appendChild(btn);
        });

        container.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeWorkspaceId = btn.dataset.workspaceId;

                renderActiveWorkspaceHeader();
                renderTasksList();
            });
        });
    }

    /**
     * Render Active Workspace Detail Header
     */
    function renderActiveWorkspaceHeader() {
        const headerCard = $('active-workspace-header-card');
        if (!headerCard) return;

        if (activeWorkspaceId === 'all') {
            headerCard.classList.add('hidden');
            return;
        }

        const ws = workspacesCache.find(w => w.id === activeWorkspaceId);
        if (!ws) {
            headerCard.classList.add('hidden');
            return;
        }

        headerCard.classList.remove('hidden');
        $('active-ws-title').textContent = ws.name;
        $('active-ws-desc').textContent = ws.description || 'لا يوجد وصف للمساحة';

        const members = workspaceMembersCache[ws.id] || [];
        $('active-ws-members-count').textContent = members.length;

        // Group Focus Time in Workspace
        const wsSessions = focusSessionsCache.filter(s => s.workspace_id === ws.id);
        const totalSecs = wsSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
        const totalMins = Math.round(totalSecs / 60);
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        $('active-ws-total-focus').textContent = hours > 0 ? `${hours}س ${mins}د` : `${mins}د`;

        // Calculate progress across tasks in workspace
        const wsTasks = tasksCache.filter(t => t.workspace_id === ws.id);
        const completedCount = wsTasks.filter(t => isTaskCompletedForDisplay(t)).length;
        const pct = wsTasks.length > 0 ? Math.round((completedCount / wsTasks.length) * 100) : 0;

        $('active-ws-progress-text').textContent = `${pct}% (${completedCount}/${wsTasks.length} مهام)`;
        $('active-ws-progress-bar').style.width = `${pct}%`;
    }

    /**
     * Helper: Determines task completion status for user / group display
     */
    function isTaskCompletedForDisplay(task) {
        if (!task) return false;
        if (task.completion_mode === 'collaborative') {
            return calculateCollaborativeTaskProgress(task, taskProgressCache[task.id] || []).isFullyCompleted;
        } else {
            // Independent completion mode: Check caller's progress only
            const userProg = (taskProgressCache[task.id] || []).find(p => p.user_id === (currentUser ? currentUser.id : ''));
            return userProg ? Boolean(userProg.completed) : false;
        }
    }

    /**
     * Render Synchronized Tasks List
     */
    function renderTasksList() {
        const container = $('tasks-list-container');
        const emptyState = $('tasks-empty-state');
        if (!container) return;

        container.innerHTML = '';

        let filtered = tasksCache;
        if (activeWorkspaceId !== 'all') {
            filtered = filtered.filter(t => t.workspace_id === activeWorkspaceId);
        }

        if (currentTaskFilter === 'active') {
            filtered = filtered.filter(t => !isTaskCompletedForDisplay(t));
        } else {
            filtered = filtered.filter(t => isTaskCompletedForDisplay(t));
        }

        if (filtered.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        filtered.forEach(task => {
            const card = createTaskCardNode(task);
            container.appendChild(card);
        });
    }

    /**
     * Constructs Task Card DOM Node
     */
    function createTaskCardNode(task) {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText = 'padding: 1rem; border: 1px solid var(--border); background: var(--bg); display: flex; flex-direction: column; gap: 0.75rem;';

        const isCompleted = isTaskCompletedForDisplay(task);

        // Header (Scope / Mode / Actions)
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;';

        const scopeLabels = { me: 'شخصية', specific_users: 'مستخدمون محددون', workspace: 'مساحة كاملة' };
        const scopeBadge = `<span class="badge badge-personal">${scopeLabels[task.scope] || 'متزامنة'}</span>`;
        const modeBadge = `<span class="badge ${task.completion_mode === 'collaborative' ? 'badge-exam' : 'badge-completed'}">${task.completion_mode === 'collaborative' ? 'تعاونية (جماعية)' : 'مستقلة'}</span>`;

        header.innerHTML = `<div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">${scopeBadge} ${modeBadge}</div>`;

        // Action Buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'display: flex; gap: 0.4rem;';

        const pomoBtn = document.createElement('button');
        pomoBtn.className = 'btn btn-primary btn-sm';
        pomoBtn.type = 'button';
        pomoBtn.innerHTML = '<i class="fa-solid fa-play"></i> ابدأ Pomodoro';
        pomoBtn.addEventListener('click', () => {
            const url = `pomodoro.html?workspace_task_id=${encodeURIComponent(task.id)}${task.workspace_id ? '&workspace_id=' + encodeURIComponent(task.workspace_id) : ''}&task=${encodeURIComponent(task.title)}`;
            window.location.href = url;
        });
        actionsDiv.appendChild(pomoBtn);

        if (currentUser && task.creator_id === currentUser.id) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-outline btn-sm';
            deleteBtn.type = 'button';
            deleteBtn.style.color = 'var(--danger)';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteBtn.title = 'حذف المهمة';
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`هل أنت متأكد من حذف المهمة "${task.title}"؟`)) {
                    try {
                        await deleteTask(task.id);
                        tasksCache = tasksCache.filter(t => t.id !== task.id);
                        renderTasksList();
                    } catch (err) {
                        alert('حدث خطأ أثناء حذف المهمة: ' + (err.message || 'خطأ غير معروف'));
                    }
                }
            });
            actionsDiv.appendChild(deleteBtn);
        }

        header.appendChild(actionsDiv);
        card.appendChild(header);

        // Task Title & Description
        const body = document.createElement('div');
        const titleEl = document.createElement('h3');
        titleEl.style.cssText = 'margin: 0 0 0.3rem; font-size: 1.1rem; text-decoration: ' + (isCompleted ? 'line-through' : 'none');
        titleEl.textContent = task.title;
        body.appendChild(titleEl);

        if (task.description) {
            const descEl = document.createElement('p');
            descEl.style.cssText = 'margin: 0; color: var(--text-muted); font-size: 0.88rem;';
            descEl.textContent = task.description;
            body.appendChild(descEl);
        }
        card.appendChild(body);

        // Completion & Member Progress Breakdown Row
        const progressRow = document.createElement('div');
        progressRow.style.cssText = 'border-top: 1px dashed var(--border); padding-top: 0.6rem; display: flex; flex-direction: column; gap: 0.5rem;';

        const allProgress = taskProgressCache[task.id] || [];

        if (task.completion_mode === 'collaborative') {
            const { completedCount, totalRequired, percentage } = calculateCollaborativeTaskProgress(task, allProgress);

            progressRow.innerHTML = `
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                    <span><i class="fa-solid fa-users-gear"></i> التقدم الجماعي المشترك</span>
                    <strong>${completedCount} / ${totalRequired} أُنجزت</strong>
                </div>
                <div style="background: var(--surface); border-radius: 6px; height: 8px; overflow: hidden;">
                    <div style="background: var(--success); width: ${percentage}%; height: 100%;"></div>
                </div>
            `;
        }

        // Individual Statuses Breakdown (Combine workspace members if scope === 'workspace')
        let membersList = taskMembersCache[task.id] || [];
        if (task.scope === 'workspace' && task.workspace_id) {
            const wsMembers = workspaceMembersCache[task.workspace_id] || [];
            const memberMap = new Map();
            wsMembers.forEach(m => memberMap.set(m.user_id, m));
            membersList.forEach(m => memberMap.set(m.user_id, m));
            membersList = Array.from(memberMap.values());
        }

        const statusListEl = document.createElement('div');
        statusListEl.style.cssText = 'display: flex; gap: 0.8rem; flex-wrap: wrap; align-items: center; font-size: 0.85rem; margin-top: 0.2rem;';

        membersList.forEach(m => {
            const isMe = currentUser && m.user_id === currentUser.id;
            const userProg = allProgress.find(p => p.user_id === m.user_id);
            const userDone = userProg ? Boolean(userProg.completed) : false;

            const item = document.createElement('div');
            item.style.cssText = 'display: flex; align-items: center; gap: 0.3rem; background: var(--surface); padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid var(--border);';

            if (isMe) {
                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.checked = userDone;
                chk.addEventListener('change', async () => {
                    try {
                        await updateTaskProgress(task.id, chk.checked);
                        renderTasksList();
                    } catch (err) {
                        chk.checked = !chk.checked;
                        alert('حدث خطأ أثناء تحديث حالة المهمة: ' + (err.message || ''));
                    }
                });
                item.appendChild(chk);
                const label = document.createElement('span');
                label.style.fontWeight = 'bold';
                label.textContent = 'أنت (' + (userDone ? '✅' : '⬜') + ')';
                item.appendChild(label);
            } else {
                item.innerHTML = `<span>${userDone ? '✅' : '⬜'}</span> <span>${escapeHtml(m.display_name)}</span>`;
            }

            statusListEl.appendChild(item);
        });

        progressRow.appendChild(statusListEl);
        card.appendChild(progressRow);

        // Focus Time per Task
        const taskSessions = focusSessionsCache.filter(s => s.task_id === task.id);
        const taskSecs = taskSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
        if (taskSecs > 0) {
            const taskMins = Math.round(taskSecs / 60);
            const focusBadge = document.createElement('div');
            focusBadge.style.cssText = 'font-size: 0.82rem; color: var(--primary); font-weight: 600; display: flex; align-items: center; gap: 0.3rem;';
            focusBadge.innerHTML = `<i class="fa-solid fa-clock"></i> تم التركيز على المهمة: ${taskMins} دقيقة`;
            card.appendChild(focusBadge);
        }

        return card;
    }

    /**
     * Render Focus Statistics Dashboard
     */
    function renderFocusStats() {
        if (!currentUser) return;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();

        let todaySecs = 0;
        let weekSecs = 0;
        let workspaceSecs = 0;
        const taskFocusMap = {};

        focusSessionsCache.forEach(s => {
            if (s.user_id !== currentUser.id) return;
            const duration = s.duration_seconds || 0;
            const sessionTime = new Date(s.created_at || s.started_at).getTime();

            if (sessionTime >= startOfToday) todaySecs += duration;
            if (sessionTime >= startOfWeek) weekSecs += duration;
            if (s.workspace_id) workspaceSecs += duration;

            if (s.task_id) {
                taskFocusMap[s.task_id] = (taskFocusMap[s.task_id] || 0) + duration;
            }
        });

        $('stat-today-focus').textContent = `${Math.round(todaySecs / 60)}د`;
        $('stat-week-focus').textContent = `${Math.round(weekSecs / 60)}د`;
        $('stat-workspace-focus').textContent = `${Math.round(workspaceSecs / 60)}د`;

        let topTaskId = null;
        let maxSecs = 0;
        Object.entries(taskFocusMap).forEach(([tId, secs]) => {
            if (secs > maxSecs) {
                maxSecs = secs;
                topTaskId = tId;
            }
        });

        if (topTaskId) {
            const topTask = tasksCache.find(t => t.id === topTaskId);
            $('stat-top-task').textContent = topTask ? `${topTask.title} (${Math.round(maxSecs / 60)}د)` : '-';
        } else {
            $('stat-top-task').textContent = '-';
        }
    }

    /**
     * UI Event Handlers & Modals Wiring
     */
    function setupUIEvents() {
        const closeBtns = document.querySelectorAll('.close-modal');
        closeBtns.forEach(btn => btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        }));

        const btnCreateWs = $('btn-create-workspace');
        if (btnCreateWs) btnCreateWs.addEventListener('click', () => {
            if (!currentUser) {
                if (typeof hayyizOpenAuthModal === 'function') hayyizOpenAuthModal('login');
                return;
            }
            $('modal-create-workspace').classList.remove('hidden');
        });

        const btnCreateTask = $('btn-create-task');
        if (btnCreateTask) btnCreateTask.addEventListener('click', () => {
            if (!currentUser) {
                if (typeof hayyizOpenAuthModal === 'function') hayyizOpenAuthModal('login');
                return;
            }
            populateWorkspaceSelectorInModal();
            populateSpecificUsersList();
            $('modal-create-task').classList.remove('hidden');
        });

        // Add Member Button
        const btnAddMember = $('btn-add-member');
        if (btnAddMember) btnAddMember.addEventListener('click', () => {
            if (!currentUser) return;
            $('modal-add-member').classList.remove('hidden');
        });

        // Delete Workspace Button
        const btnDeleteWs = $('btn-delete-workspace');
        if (btnDeleteWs) btnDeleteWs.addEventListener('click', async () => {
            if (activeWorkspaceId === 'all') return;
            const ws = workspacesCache.find(w => w.id === activeWorkspaceId);
            if (!ws) return;

            if (confirm(`هل أنت متأكد من حذف المساحة "${ws.name}" بجميع مهامها؟`)) {
                try {
                    await deleteWorkspace(ws.id);
                    activeWorkspaceId = 'all';
                    await loadAllWorkspaceData();
                } catch (err) {
                    alert('حدث خطأ أثناء حذف المساحة: ' + (err.message || ''));
                }
            }
        });

        // Form Submit: Add Member by Email
        const formAddMember = $('form-add-member');
        if (formAddMember) {
            formAddMember.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = $('member-email-input').value.trim();
                if (!email || activeWorkspaceId === 'all') return;

                try {
                    const res = await addWorkspaceMemberByEmail(activeWorkspaceId, email);
                    if (res && res.success) {
                        alert('تمت إضافة العضو بنجاح!');
                        formAddMember.reset();
                        $('modal-add-member').classList.add('hidden');
                        await loadAllWorkspaceData();
                    } else {
                        alert(res.message || 'عذراً، لم نتمكن من إضافة العضو.');
                    }
                } catch (err) {
                    alert('حدث خطأ أثناء دعوة العضو: ' + (err.message || ''));
                }
            });
        }

        // Form Submit: Create Workspace
        const formCreateWs = $('form-create-workspace');
        if (formCreateWs) {
            formCreateWs.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = $('ws-name-input').value.trim();
                const desc = $('ws-desc-input').value.trim();
                if (!name) return;

                try {
                    await createWorkspace(name, desc);
                    formCreateWs.reset();
                    $('modal-create-workspace').classList.add('hidden');
                    await loadAllWorkspaceData();
                } catch (err) {
                    alert('حدث خطأ أثناء إنشاء المساحة: ' + (err.message || ''));
                }
            });
        }

        // Form Submit: Create Synchronized Task
        const formCreateTask = $('form-create-task');
        if (formCreateTask) {
            formCreateTask.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = $('task-title-input').value.trim();
                const description = $('task-desc-input').value.trim();
                const scope = $('task-scope-select').value;
                const workspace_id = $('task-workspace-select').value || null;
                const completion_mode = $('task-completion-mode-select').value;
                const due_date = $('task-due-date-input').value || null;

                // Extract recipient user IDs from checkboxes
                const recipientUserIds = [];
                const listEl = $('members-checkboxes-list');
                if (listEl) {
                    listEl.querySelectorAll('input[type="checkbox"]:checked').forEach(chk => {
                        recipientUserIds.push(chk.value);
                    });
                }

                if (!title) return;

                try {
                    await createWorkspaceTask({
                        title,
                        description,
                        scope,
                        completion_mode,
                        workspace_id,
                        due_date,
                        recipientUserIds
                    });

                    formCreateTask.reset();
                    $('modal-create-task').classList.add('hidden');
                    await loadAllWorkspaceData();
                } catch (err) {
                    alert('حدث خطأ أثناء إضافة المهمة: ' + (err.message || ''));
                }
            });
        }

        // Scope Selector Change Logic
        const scopeSelect = $('task-scope-select');
        if (scopeSelect) {
            scopeSelect.addEventListener('change', () => {
                const val = scopeSelect.value;
                const wsGroup = $('workspace-select-group');
                const usersGroup = $('specific-users-group');

                if (val === 'workspace') {
                    if (wsGroup) wsGroup.style.display = 'block';
                    if (usersGroup) usersGroup.classList.add('hidden');
                } else if (val === 'specific_users') {
                    if (wsGroup) wsGroup.style.display = 'none';
                    if (usersGroup) usersGroup.classList.remove('hidden');
                    populateSpecificUsersList();
                } else {
                    if (wsGroup) wsGroup.style.display = 'none';
                    if (usersGroup) usersGroup.classList.add('hidden');
                }
            });
        }

        // Task Filter Buttons
        const filterBtns = document.querySelectorAll('#task-filter-buttons .filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTaskFilter = btn.dataset.taskFilter;
                renderTasksList();
            });
        });
    }

    /**
     * Populates Specific Users Checkbox List for Task Creation
     */
    function populateSpecificUsersList() {
        const listEl = $('members-checkboxes-list');
        if (!listEl) return;

        listEl.innerHTML = '';

        let membersToDisplay = [];
        if (activeWorkspaceId !== 'all') {
            membersToDisplay = workspaceMembersCache[activeWorkspaceId] || [];
        } else {
            // Aggregate all members across workspaces
            const seen = new Set();
            Object.values(workspaceMembersCache).flat().forEach(m => {
                if (!seen.has(m.user_id)) {
                    seen.add(m.user_id);
                    membersToDisplay.push(m);
                }
            });
        }

        const otherMembers = membersToDisplay.filter(m => currentUser && m.user_id !== currentUser.id);

        if (otherMembers.length === 0) {
            listEl.innerHTML = '<span style="font-size:0.85rem; color: var(--text-muted);">لا يوجد أعضاء آخرون في المساحات الحالية. قم بدعوة أعضاء أولاً.</span>';
            return;
        }

        otherMembers.forEach(m => {
            const label = document.createElement('label');
            label.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; font-size: 0.88rem; cursor: pointer;';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = m.user_id;

            label.appendChild(chk);
            label.appendChild(document.createTextNode(m.display_name + ' (' + m.email + ')'));
            listEl.appendChild(label);
        });
    }

    /**
     * Fills Workspace Dropdown Selector in Task Creation Modal
     */
    function populateWorkspaceSelectorInModal() {
        const select = $('task-workspace-select');
        if (!select) return;

        select.innerHTML = '';
        workspacesCache.forEach(ws => {
            const opt = document.createElement('option');
            opt.value = ws.id;
            opt.textContent = ws.name;
            if (ws.id === activeWorkspaceId) opt.selected = true;
            select.appendChild(opt);
        });
    }

    // Auto Init on DOM Load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWorkspacesModule);
    } else {
        initWorkspacesModule();
    }

    // Export public interfaces
    global.initWorkspacesModule = initWorkspacesModule;
    global.calculateCollaborativeTaskProgress = calculateCollaborativeTaskProgress;

})(typeof window !== 'undefined' ? window : global);
