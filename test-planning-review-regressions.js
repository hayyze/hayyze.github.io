const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-22T12:00:00Z'])); } static now() { return new Date('2026-10-22T12:00:00Z').getTime(); } }
function device() {
    const c = vm.createContext({ console, Date: FixedDate, setTimeout, clearTimeout, URLSearchParams,
        document:{addEventListener(){},getElementById(){return null;},querySelectorAll(){return [];}}, navigator:{}, location:{search:'',href:''},
        localStorage:{data:{},getItem(k){return this.data[k]??null;},setItem(k,v){this.data[k]=String(v);},removeItem(k){delete this.data[k];},clear(){this.data={};}} });
    c.window=c; vm.runInContext(fs.readFileSync('common.js','utf8'),c); return c;
}
const today='2026-10-22', later='2026-10-25';
const failures=[];
async function check(name, run) { try { await run(); console.log('PASS '+name); } catch(e) { failures.push(name); console.error('FAIL '+name+': '+e.message); } }
(async()=>{
await check('New planner target cannot overwrite a real exam',()=>{
    const c=device(); const exam={id:'physics',name:'Physics final',date:later,created:100};
    c.hayyizSaveJSON('hayyiz-student-exams',[exam]);
    c.hayyizAdoptStudyPlan({examId:'physics',targetDate:later,subjects:[{name:'Physics',minutes:60}]});
    const p=c.hayyizAdoptStudyPlan({targetId:'physics',examId:'',targetDate:'2026-10-28',subjects:[{name:'Math',minutes:60}]});
    assert.notEqual(p.targetId,'physics'); assert.equal(c.hayyizGetExams().find(e=>e.id==='physics').name,exam.name);
    assert.equal(c.hayyizGetExams().find(e=>e.id==='physics').date,exam.date);
    assert.equal(c.hayyizAdoptStudyPlan({examId:'missing',targetDate:later,subjects:[{name:'Math',minutes:60}]}),null);
});
await check('Unlinked homework due today shares capacity with exam review',()=>{
    const c=device(); c.hayyizSaveTodos([{id:'review',text:'Review',eventId:'exam',minutes:120},{id:'homework',text:'Homework',date:today,minutes:60,priority:'high'}]);
    const p=c.hayyizComputeMultiDayPlan({targetId:'exam',targetDate:later,dailyCapacityMinutes:120});
    const daily=c.hayyizComputeStudentDecisionState().dailyPlan;
    assert.equal(daily.find(i=>i.task?.id==='homework')?.plannedMinutes,60);
    assert.equal(p.schedule[0].plannedMinutes,60); assert.equal(p.schedule[1].plannedMinutes,60);
    assert.equal(p.totalUnallocatedMinutes,0);
});
await check('Earlier task deadline wins over flexible high priority work',()=>{
    const c=device(); c.hayyizSaveTodos([{id:'late',text:'Flexible',eventId:'exam',minutes:120,priority:'high'},{id:'due',text:'Due today',eventId:'exam',date:today,minutes:60,priority:'low'}]);
    const p=c.hayyizComputeMultiDayPlan({targetId:'exam',targetDate:later,dailyCapacityMinutes:120});
    assert.equal(p.totalUnallocatedMinutes,0); assert.equal(p.schedule[0].tasks.find(t=>t.taskId==='due')?.remainingMinutes,60);
    // A task in a later exam may still have an earlier personal deadline.
    c.hayyizSaveTodos([{id:'first',text:'First exam',eventId:'a',minutes:120},{id:'second',text:'Earlier homework',eventId:'b',date:today,minutes:60}]);
    c.hayyizComputeMultiDayPlan({targetId:'a',targetDate:later,dailyCapacityMinutes:120});
    c.hayyizComputeMultiDayPlan({targetId:'b',targetDate:'2026-10-26'});
    assert.equal(c.hayyizGetMultiDayPlan('b').schedule[0].plannedMinutes,60);
    assert.equal(c.hayyizGetMultiDayPlan('a').totalUnallocatedMinutes,0);
});
await check('Re-adoption reconciles generated fields and preserves student edits and progress',()=>{
    const c=device(); let p=c.hayyizAdoptStudyPlan({targetDate:later,subjects:[{name:'Math',minutes:240,priority:'low'}]});
    let t=c.hayyizGetTodos()[0]; c.hayyizUpdateTask(t.id,{focusDone:25});
    p=c.hayyizAdoptStudyPlan({targetId:p.targetId,targetDate:'2026-10-28',subjects:[{name:'Math',minutes:360,priority:'high'}]});
    t=c.hayyizGetTaskById(t.id); assert.equal(t.minutes,360); assert.equal(t.date,'2026-10-28'); assert.equal(t.priority,'high'); assert.equal(t.focusDone,25);
    c.hayyizUpdateTask(t.id,{minutes:400,text:'My own review',completed:true});
    p=c.hayyizAdoptStudyPlan({targetId:p.targetId,targetDate:'2026-10-29',subjects:[{name:'Math',minutes:180,priority:'medium'}]});
    t=c.hayyizGetTaskById(t.id); assert.equal(t.minutes,400); assert.equal(t.text,'My own review'); assert.equal(t.completed,true); assert.equal(t.focusDone,25);
    assert(p.adoption.protectedFields.some(f=>f.taskId===t.id&&f.field==='minutes'));
    assert.equal(c.hayyizGetTodos().length,1); assert.equal(c.hayyizGetExams().length,1);
});
await check('Legacy drafts keep their IDs and edits without claiming ownership of other exams',()=>{
    const c=device(); const task={id:'legacy-task',text:'Edited review',eventId:'legacy',subjectId:'math',minutes:400,date:later,plannerSource:true,focusDone:50};
    c.hayyizSaveJSON('hayyiz-subjects',[{id:'math',name:'Math'}]);
    c.hayyizSaveJSON('hayyiz-student-exams',[{id:'legacy',name:'خطة مراجعة قبل الاختبار',date:later,created:100}]);
    c.hayyizSaveJSON('hayyiz-planner-draft',{targetId:'legacy',examId:''});
    c.hayyizSaveTodos([task]); c.hayyizComputeMultiDayPlan({targetId:'legacy',targetDate:later});
    const p=c.hayyizAdoptStudyPlan({targetId:'legacy',targetDate:'2026-10-28',subjects:[{name:'Math',minutes:360}]});
    assert.equal(p.targetId,'legacy'); assert.equal(c.hayyizGetTodos().length,1);
    assert.equal(c.hayyizGetTaskById('legacy-task').minutes,400); assert.equal(c.hayyizGetTaskById('legacy-task').focusDone,50);
    assert(p.adoption.protectedFields.length); assert.equal(c.hayyizGetExams()[0].created,100);
});
await check('Zero capacity and impossible deadlines do not re-enter the free-time queue',()=>{
    const c=device(); c.hayyizSaveTodos([{id:'due',text:'Due',eventId:'exam',date:today,minutes:60}]);
    c.hayyizComputeMultiDayPlan({targetId:'exam',targetDate:later,dailyCapacityMinutes:0});
    const state=c.hayyizComputeStudentDecisionState();
    assert.equal(state.dailyBudget.plannedMinutes,0); assert.equal(c.hayyizGetMultiDayPlan('exam').totalUnallocatedMinutes,60);
    assert(state.deferredItems.some(i=>i.task?.id==='due'));
});
await check('Overdue linked work is actionable today without changing its deadline',()=>{
    const c=device(); c.hayyizSaveTodos([{id:'overdue',text:'Overdue',eventId:'exam',date:'2026-10-21',minutes:60}]);
    const p=c.hayyizComputeMultiDayPlan({targetId:'exam',targetDate:later,dailyCapacityMinutes:120});
    assert.equal(p.schedule[0].plannedMinutes,60); assert.equal(c.hayyizGetTaskById('overdue').date,'2026-10-21');
    assert.equal(c.hayyizComputeStudentDecisionState().dailyPlan.find(i=>i.task?.id==='overdue')?.plannedMinutes,60);
});
await check('Omitted subjects stay canonical and are reported instead of being deleted',()=>{
    const c=device(); let p=c.hayyizAdoptStudyPlan({targetDate:later,subjects:[{name:'Math',minutes:60},{name:'Physics',minutes:90}]});
    const original=c.hayyizGetTodos();
    p=c.hayyizAdoptStudyPlan({targetId:p.targetId,targetDate:later,subjects:[{name:'Math',minutes:120}]});
    assert.equal(c.hayyizGetTodos().length,2); assert.equal(p.adoption.retainedTaskIds[0],original[1].id);
    assert.equal(c.hayyizGetTaskById(original[1].id).minutes,90);
});
await check('Saving during an upload drains the latest plan map before resolving',async()=>{
    const c=device(); let remote=[],uploads=0,release,started;
    const uploadStarted=new Promise(r=>started=r);
    c.supabaseClient={auth:{async getUser(){return {data:{user:{id:'student'}}};}},from(){return {
        select(){return this;},eq(k,v){if(k==='tool')this.tool=v;return this;},gt(){return this;},
        then(resolve){resolve({data:JSON.parse(JSON.stringify(remote.filter(r=>r.tool===this.tool))),error:null});},
        async upsert(payload){ const rows=JSON.parse(JSON.stringify(Array.isArray(payload)?payload:[payload])); uploads++;
            if(uploads===1){started(); await new Promise(r=>release=r);} remote=rows; return {error:null}; }
    };}};
    vm.runInContext(fs.readFileSync('sync.js','utf8'),c);
    c.hayyizSaveMultiDayPlans({a:{targetId:'a',targetDate:later,updatedAt:FixedDate.now()}});
    await uploadStarted;
    const map=c.hayyizGetMultiDayPlans(); map.b={targetId:'b',targetDate:later,updatedAt:FixedDate.now()+1}; c.hayyizSaveMultiDayPlans(map);
    release(); await c.hayyizSyncTool('multi-day-plans');
    assert(remote[0].data.a); assert(remote[0].data.b); assert.equal(uploads,2);
});
await check('An upload failure stops draining, preserves edits and retries explicitly',async()=>{
    const c=device(); let uploads=0, release, started, fail=true, remote=[];
    const uploadStarted=new Promise(r=>started=r);
    c.supabaseClient={auth:{async getUser(){return {data:{user:{id:'student'}}};}},from(){return {
        select(){return this;},eq(){return this;},gt(){return this;},then(resolve){resolve({data:remote,error:null});},
        async upsert(payload){uploads++; if(uploads===1){started(); await new Promise(r=>release=r);}
            if(fail)return {error:{message:'offline'}}; remote=[JSON.parse(JSON.stringify(payload))]; return {error:null};}
    };}};
    vm.runInContext(fs.readFileSync('sync.js','utf8'),c);
    c.hayyizSaveMultiDayPlans({a:{targetId:'a',targetDate:later,updatedAt:FixedDate.now()}});
    await uploadStarted;
    const map=c.hayyizGetMultiDayPlans(); map.b={targetId:'b',targetDate:later,updatedAt:FixedDate.now()+1}; c.hayyizSaveMultiDayPlans(map);
    release(); await c.hayyizSyncTool('multi-day-plans');
    assert.equal(uploads,1); assert(c.hayyizGetMultiDayPlans().b);
    assert.equal(c.localStorage.getItem('hayyiz-sync-last-time-multi-day-plans'),null);
    fail=false; await c.hayyizSyncTool('multi-day-plans');
    assert(remote[0].data.a); assert(remote[0].data.b); assert.equal(uploads,2);
});
if(failures.length) process.exitCode=1;
})();
