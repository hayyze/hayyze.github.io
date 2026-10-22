const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const now = new Date('2026-10-22T12:00:00Z');
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [now.getTime()])); } static now() { return now.getTime(); } }
const context = vm.createContext({ console, Date: FixedDate, setTimeout, clearTimeout, URLSearchParams,
    document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; } },
    localStorage: { data: {}, getItem(key) { return this.data[key] ?? null; }, setItem(key, value) { this.data[key] = String(value); }, removeItem(key) { delete this.data[key]; }, clear() { this.data = {}; } },
    navigator: {}, location: { search: '', href: '' }
});
context.window = context;
vm.runInContext(fs.readFileSync('common.js', 'utf8'), context);
const c = context, storage = c.localStorage;
const today = c.getTodayLocal();
function offset(days) { const d = new FixedDate(today + 'T12:00:00'); d.setDate(d.getDate() + days); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); }
function reset() { storage.clear(); }
function task(id, eventId, minutes) { return { id, text: id, eventId, minutes, priority: 'high', completed: false }; }
function verifySharedBudget(plans, max) {
    const days = {};
    Object.values(plans).forEach(plan => plan.schedule.forEach(day => { days[day.date] = (days[day.date] || 0) + day.plannedMinutes; }));
    Object.values(days).forEach(minutes => assert(minutes <= max, 'Combined plans must respect one shared capacity'));
}
assert.equal(c.hayyizParseMinutes('١٢٠'), 120);
assert.equal(c.hayyizParseMinutes('۴۵'), 45);
for (const input of ['-1', '12abc', '1.5', '', Infinity, 1441]) assert.equal(c.hayyizParseMinutes(input), null);
assert.equal(c.hayyizValidDate('2026-02-30'), false);
assert.equal(c.hayyizValidDate('2028-02-29'), true);
reset();
c.hayyizSaveTodos([task('a','exam-a',240), task('b','exam-b',240)]);
c.hayyizComputeMultiDayPlan({ targetId:'exam-b', targetDate:offset(3), dailyCapacityMinutes:120 });
c.hayyizComputeMultiDayPlan({ targetId:'exam-a', targetDate:offset(3), dailyCapacityMinutes:120 });
let plans = c.hayyizGetMultiDayPlans(); verifySharedBudget(plans, 120);
assert.equal(plans['exam-b'].isCapacityExceeded, true);
assert.equal(plans['exam-b'].totalUnallocatedMinutes, 240);
assert.equal(plans['exam-a'].schedule[0].plannedMinutes, 120);
const scheduleBefore = JSON.stringify(plans['exam-a'].schedule);
c.hayyizReevaluateMultiDayPlan();
assert.equal(JSON.stringify(c.hayyizGetMultiDayPlan('exam-a').schedule), scheduleBefore, 'Rebuild is deterministic');
assert.equal(c.hayyizGetTodos().length, 2, 'Scheduling never clones tasks');
reset();
const weekday = new FixedDate(today+'T12:00:00').getDay();
c.hayyizSavePlanningPreferences({ week:{[weekday]:240}, studyStart:'16:00', studyEnd:'22:00', commitments:[
    {id:'one',name:'One',days:[weekday],start:'17:00',end:'18:00'},
    {id:'two',name:'Two',days:[weekday],start:'17:30',end:'19:00'},
    {id:'school',name:'School',days:[weekday],start:'06:00',end:'13:00'}
] });
assert.equal(c.hayyizGetDayCapacity(today).commitmentMinutes,120, 'Overlapping commitments are counted once, school outside study window excluded');
assert.equal(c.hayyizGetDayCapacity(today).remainingMinutes,120);
storage.setItem('hayyiz-focus-history', JSON.stringify({[today]:25}));
assert.equal(c.hayyizGetDayCapacity(today).remainingMinutes,95);
assert.equal(c.hayyizSetTodayRemainingMinutes('١٠'),true);
assert.equal(c.hayyizGetDayCapacity(today).remainingMinutes,10,'Changing available time does not deduct already completed focus twice');
assert.equal(c.hayyizSetTodayRemainingMinutes(0),true);
assert.equal(c.hayyizGetDayCapacity(today).remainingMinutes,0);
reset();
storage.setItem('hayyiz-pref-daily-capacity','0');
c.hayyizSaveTodos([task('a','exam-a',60)]);
const zero = c.hayyizComputeMultiDayPlan({targetId:'exam-a',targetDate:offset(3),dailyCapacityMinutes:0});
assert.equal(zero.totalPlannedMinutes,0); assert.equal(zero.totalUnallocatedMinutes,60);
assert.equal(c.hayyizGenerateDailyPlan().budget.plannedMinutes,0);
reset();
storage.setItem('hayyiz-pref-daily-capacity','45');
c.hayyizSaveTodos([task('a',null,30), task('b',null,60)]);
let daily = c.hayyizComputeStudentDecisionState();
assert.equal(daily.dailyBudget.plannedMinutes,45);
assert.equal(daily.deferredItems.reduce((sum,item)=>sum+item.deferredMinutes,0),45);
assert.equal(daily.dailyPlan.reduce((sum,item)=>sum+(item.plannedMinutes||0),0),45);
assert.equal(c.hayyizTaskRemainingMinutes({minutes:25,focusDone:25,completed:false},25),25,'Finished estimate does not auto-complete real work');
reset();
const sub = c.hayyizAddSubject('رياضيات');
c.hayyizSaveTodos([{id:'one',text:'real task',subjectId:sub.id,minutes:60}]);
c.hayyizComputeMultiDayPlan({targetId:'exam-a',subjectId:sub.id,targetDate:offset(3)});
c.hayyizComputeMultiDayPlan({targetId:'exam-b',subjectId:sub.id,targetDate:offset(4)});
plans = c.hayyizGetMultiDayPlans();
assert.equal(Object.values(plans).reduce((sum,p)=>sum+p.totalPlannedMinutes,0),60,'One task matching two subject plans is scheduled only once');
reset();
let adopted = c.hayyizAdoptStudyPlan({targetDate:offset(5),dailyCapacityMinutes:60,subjects:[{name:'فيزياء',minutes:120}]});
assert(adopted); let adoptedTask = c.hayyizGetTodos()[0];
c.hayyizUpdateTask(adoptedTask.id,{focusDone:25});
c.hayyizAdoptStudyPlan({targetId:adopted.targetId,targetDate:offset(5),dailyCapacityMinutes:60,subjects:[{name:'فيزياء',minutes:120}]});
assert.equal(c.hayyizGetTodos().length,1); assert.equal(c.hayyizGetTodos()[0].focusDone,25);
assert.equal(c.hayyizGetExams().length,1);
assert.equal(c.hayyizGetMultiDayPlan(adopted.targetId).includeSubjectTasks,false);
c.hayyizReevaluateMultiDayPlan(); assert.equal(c.hayyizGetMultiDayPlan(adopted.targetId).includeSubjectTasks,false);
assert.equal(c.hayyizExtendTaskEstimate(adoptedTask.id,25),true); assert.equal(c.hayyizGetTaskById(adoptedTask.id).minutes,145);
assert.equal(c.hayyizSaveDayReview('arbitrary private text'),false); assert.equal(c.hayyizSaveDayReview('difficulty'),true);
const metrics=[]; c.gtag=(...args)=>metrics.push(args);
c.hayyizTrackPlanningEvent('focus_started'); assert.equal(metrics.length,0,'Metrics are opt-in');
storage.setItem('hayyiz-planning-metrics','enabled'); c.hayyizTrackPlanningEvent('secret task title'); assert.equal(metrics.length,0);
c.hayyizTrackPlanningEvent('focus_started'); assert.equal(metrics.length,1); assert.equal(metrics[0].length,3);
assert.equal(c.hayyizSanitizeValue('hayyiz-planning-preferences','{"week":{"1":60}}'),'{"week":{"1":60}}');
c.hayyizLaunchPomodoro({id:'event',name:'Exam review',date:today,type:'exam'}, null, 10);
assert(c.location.href.endsWith('&sessionMinutes=10'),'Exam review sessions respect the same short daily allocation as task sessions');
const compact = c.hayyizGetPlanSyncData(c.hayyizGetMultiDayPlans());
assert.equal(Object.values(compact)[0].schedule,undefined,'Cloud plan payload contains configuration only, not derived schedules');

// Actual sync engine with isolated device storage and a fake transport.
let remote = [], uploadError = false;
c.supabaseClient = { auth:{ async getUser(){return {data:{user:{id:'student'}}};}}, from(){
    const query={ select(){return this;}, eq(col,val){if(col==='tool')this.tool=val;return this;}, gt(){return this;},
        then(resolve){resolve({data:JSON.parse(JSON.stringify(remote.filter(row=>row.tool===this.tool))),error:null});},
        async upsert(payload){if(uploadError)return {error:{message:'test storage failure'}};
            for(const row of Array.isArray(payload)?payload:[payload]) { const i=remote.findIndex(r=>r.tool===row.tool&&r.item_id===row.item_id); if(i<0)remote.push(row);else remote[i]=row; }
            return {data:null,error:null}; }
    };return query;
}};
vm.runInContext(fs.readFileSync('sync.js','utf8'),c);
(async()=>{
    await c.hayyizSyncAllUserData();
    assert.equal(remote.filter(row => row.tool === 'multi-day-plans').length,1);
    storage.clear();
    await c.hayyizSyncAllUserData();
    assert(c.hayyizGetMultiDayPlans()[adopted.targetId], 'Device B restores the adopted plan');
    assert.equal(c.hayyizGetTodos().length,1,'Device B restores the canonical tasks before rebuilding the plan');
    assert.equal(c.hayyizDefaultCapacity(),60,'The default capacity is restored before schedules are rebuilt');
    assert(c.hayyizGetMultiDayPlan(adopted.targetId).schedule.length > 0,'Device B rebuilds a usable schedule from compact configuration');
    // Separate plans edited offline must survive map merging.
    const map = c.hayyizGetMultiDayPlans(); map.offline={targetId:'offline',targetDate:offset(6),targetName:'Offline',updatedAt:FixedDate.now()+1000};
    storage.setItem('hayyiz-multi-day-plans',JSON.stringify(map));
    await c.hayyizSyncTool('multi-day-plans');
    const planRow = remote.find(row => row.tool === 'multi-day-plans');
    assert(planRow.data.offline); assert(planRow.data[adopted.targetId]);
    storage.setItem('hayyiz-planning-preferences',JSON.stringify({week:{1:35},updatedAt:FixedDate.now()+2000}));
    const previousCursor = storage.getItem('hayyiz-sync-last-time-planning-preferences');
    uploadError=true;
    await c.hayyizSyncTool('planning-preferences');
    assert.equal(storage.getItem('hayyiz-sync-last-time-planning-preferences'),previousCursor,'Failed upload must not advance the sync cursor');
    uploadError=false;
    await c.hayyizSyncTool('planning-preferences');
    storage.clear();
    await c.hayyizSyncTool('planning-preferences');
    assert.equal(c.hayyizGetPlanningPreferences().week[1],35,'Offline preferences retry and restore on another device');
    console.log('Unified planning: shared capacity, zero time, Arabic numbers, overlaps, deferred work, adoption, privacy, cross-device restoration and retry PASSED');
})().catch(error=>{console.error(error);process.exitCode=1;});
