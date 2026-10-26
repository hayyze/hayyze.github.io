const fs=require('node:fs'),assert=require('node:assert/strict');
const helper={exports:{}};
new Function('require','module',fs.readFileSync('test-sync-timer-integrity.js','utf8').split('let failures = 0;')[0]+'\nmodule.exports={browser,entry};')(require,helper);
const {browser,entry}=helper.exports;
(async()=>{
 for(const suffix of ['hayyiz-focus-sessions-log','hayyiz-workspace-focus-outbox','hayyiz-pomodoro-state']){
 const b=browser();const end=b.clock.now-1000;
 b.context.hayyizSaveFocusState({mode:'focus',status:'running',sessionId:'retry',totalDuration:1500,endTime:end,startedAt:new Date(end-1500000).toISOString(),context:{type:'free',title:'focus',workspaceTaskId:'task',workspaceId:'workspace'}});
 b.storage.deviceId();const before=Object.fromEntries(b.native.data),set=b.native.setItem.bind(b.native);let fail=true;
 b.native.setItem=(k,v)=>{if(fail&&k.endsWith(':'+suffix)){fail=false;throw Error('quota');}set(k,v)};
 assert.equal(b.context.hayyizReconcilePomodoroState(),null);
 assert.deepEqual(Object.fromEntries(b.native.data),before);
 b.context.hayyizReconcilePomodoroState();b.context.hayyizReconcilePomodoroState();
 assert.equal(b.storage.getItem('hayyiz-focus-minutes-today'),'25');assert.equal(b.context.hayyizGetFocusSessions().length,1);
 assert(JSON.parse(b.storage.getItem('hayyiz-workspace-focus-outbox')).retry);
 }
 const b=browser({sync:true});b.storage.setItem('hayyiz-workspace-focus-outbox',JSON.stringify({bad:entry('bad'),good:entry('good')}));
 b.server.rpcHandlers.set('record_focus_session',p=>p.p_client_session_id==='bad'?{error:{code:'42501'}}:{data:{success:true}});
 assert.equal(await b.context.hayyizFlushWorkspaceFocusSessions(),false);
 assert.deepEqual(Object.keys(JSON.parse(b.storage.getItem('hayyiz-workspace-focus-outbox'))),['bad']);
 assert.equal(b.storage.logicalKey('hayyiz-account:'+b.storage.accountId+':hayyiz-todos'),'hayyiz-todos');
 assert.equal(b.storage.logicalKey('hayyiz-account:other:hayyiz-todos'),undefined);
 console.log('PASS completion rollback/retry, rejected queue isolation and scoped events');
})().catch(e=>{console.error(e);process.exitCode=1});
