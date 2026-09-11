/*
 * Runtime reconciliation for the workspaces UI.
 * Keeps the existing spaces module intact while covering cross-user membership
 * changes that require a fresh workspace/task snapshot.
 */
(function () {
    'use strict';

    let channel = null;
    let reloadTimer = null;

    function scheduleReload(reason) {
        if (reloadTimer) return;
        reloadTimer = setTimeout(function () {
            reloadTimer = null;
            // A full reload is intentional here: the main spaces module keeps
            // its data caches private, so this safely refreshes the complete
            // workspace/task/member snapshot without duplicating internal state.
            console.info('[Hayyiz Workspaces] refreshing after realtime change:', reason);
            window.location.reload();
        }, 250);
    }

    async function start() {
        if (!window.supabaseClient || !window.supabaseClient.auth) return;

        const { data } = await window.supabaseClient.auth.getSession();
        if (!data || !data.session) return;

        if (channel) {
            window.supabaseClient.removeChannel(channel);
            channel = null;
        }

        const currentUserId = data.session.user.id;

        channel = window.supabaseClient
            .channel('hayyiz-workspaces-runtime-reconciliation')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workspace_members' }, function (payload) {
                if (payload.new && payload.new.user_id === currentUserId) {
                    scheduleReload('membership-added');
                }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'workspace_members' }, function (payload) {
                if (payload.old && payload.old.user_id === currentUserId) {
                    scheduleReload('membership-removed');
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workspaces' }, function (payload) {
                if (payload.new && payload.new.created_by === currentUserId) {
                    scheduleReload('workspace-created');
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workspaces' }, function (payload) {
                scheduleReload('workspace-updated');
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'workspaces' }, function (payload) {
                scheduleReload('workspace-deleted');
            })
            .subscribe(function (status) {
                if (status !== 'SUBSCRIBED') {
                    console.warn('[Hayyiz Workspaces] realtime reconciliation status:', status);
                }
            });

        window.addEventListener('beforeunload', function () {
            if (channel && window.supabaseClient) {
                window.supabaseClient.removeChannel(channel);
                channel = null;
            }
        }, { once: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
