const fs=require('node:fs'),assert=require('node:assert/strict');
const helper={exports:{}};
new Function('require','module',fs.readFileSync('test-sync-timer-integrity.js','utf8').split('let failures = 0;')[0]+'\nmodule.exports={browser,entry};')(require,helper);
const {browser,entry}=helper.exports;
(async()=>{
 for(const suffix of ['hayyiz-focus-sessions-log','hayyiz-workspace-focus-outbox','hayyiz-pomodoro-state']){
 const b=browser();const end=b.clock.now-1000;
 b.context.hayyizSaveFocusState({mode:'focus',status:'running',sessionId:'retry',totalDuration:1500,endTime:end,startedAt:new Date(end-1500000).toISOString(),context:{type:'free',title:'focus',workspaceTaskId:'task',workspaceId:'workspace'}});
 let effects=0;b.context.hayyizSyncTool=()=>{effects++};b.context.hayyizUploadItem=()=>{effects++};b.context.hayyizFlushWorkspaceFocusSessions=()=>{effects++};
 b.storage.deviceId();const before=Object.fromEntries(b.native.data),set=b.native.setItem.bind(b.native);let fail=true;
 b.native.setItem=(k,v)=>{if(fail&&k.endsWith(':'+suffix)){fail=false;throw Error('quota');}set(k,v)};
 assert.equal(b.context.hayyizReconcilePomodoroState(),null);
 assert.deepEqual(Object.fromEntries(b.native.data),before);assert.equal(effects,0,'Rolled-back completion cannot upload');
 b.context.hayyizReconcilePomodoroState();b.context.hayyizReconcilePomodoroState();
 assert.equal(b.storage.getItem('hayyiz-focus-minutes-today'),'25');assert.equal(b.context.hayyizGetFocusSessions().length,1);
 assert(JSON.parse(b.storage.getItem('hayyiz-workspace-focus-outbox')).retry);assert(effects>0,'Committed completion sends its deferred effects');
 }
 const timer=browser({timer:true});
 await timer.click('timer-start-btn');timer.storage.deviceId();
 const nativeSet=timer.native.setItem.bind(timer.native);let failLog=true;
 timer.native.setItem=(k,v)=>{if(failLog&&k.endsWith(':hayyiz-focus-sessions-log')){failLog=false;throw Error('quota');}nativeSet(k,v)};
 timer.completeTimer();
 assert.equal(timer.state().status,'running','Failed completion retains retryable timer state');
 assert.equal(timer.context.hayyizGetFocusSessions().length,0);
 timer.completeTimer(timer.clock.now+5000);
 assert.equal(timer.context.hayyizGetFocusSessions().length,1);
 assert.equal(timer.storage.getItem('hayyiz-focus-minutes-today'),'25');
 const b=browser({sync:true});b.storage.setItem('hayyiz-workspace-focus-outbox',JSON.stringify({bad:entry('bad'),good:entry('good')}));
 b.server.rpcHandlers.set('record_focus_session',p=>p.p_client_session_id==='bad'?{error:{code:'42501'}}:{data:{success:true}});
 assert.equal(await b.context.hayyizFlushWorkspaceFocusSessions(),false);
 assert.deepEqual(Object.keys(JSON.parse(b.storage.getItem('hayyiz-workspace-focus-outbox'))),['bad']);
 assert.equal(b.storage.logicalKey('hayyiz-account:'+b.storage.accountId+':hayyiz-todos'),'hayyiz-todos');
 assert.equal(b.storage.logicalKey('hayyiz-account:other:hayyiz-todos'),undefined);
 // Restoring an old cumulative snapshot must start a new writer, even
 // offline before the older device's cloud maximum is downloaded.
 for (const keepLocal of [true, false]) {
 const r=browser(),c=r.context,st=r.storage,day='2026-10-23';
 c.hayyizRecordFocusMinutes(day,25);
 const old={ 'hayyiz-focus-history':st.getItem('hayyiz-focus-history'), 'hayyiz-focus-history-state':st.getItem('hayyiz-focus-history-state') };
 c.hayyizRecordFocusMinutes(day,25);
 const remote=c.hayyizReadFocusHistoryPayload();
 if(!keepLocal){st.removeItem('hayyiz-focus-history');st.removeItem('hayyiz-focus-history-state');}
 const restored=c.hayyizPrepareRestoredKeys(old);
 Object.entries(restored).forEach(([k,v])=>st.setItem(k,v));
 c.hayyizRecordFocusMinutes(day,25);
 const merged=c.hayyizMergeFocusHistoryPayload(c.hayyizReadFocusHistoryPayload(),remote);
 assert.equal(merged[day],75,'A post-restore session survives the cloud maximum merge');
 assert.equal(c.hayyizMergeFocusHistoryPayload(merged,remote)[day],75,'Repeated sync is idempotent');
 }
 console.log('PASS completion rollback/retry, rejected queue isolation and scoped events');
})().catch(e=>{console.error(e);process.exitCode=1});
