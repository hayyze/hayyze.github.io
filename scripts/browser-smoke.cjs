/* Run with Playwright installed in the test environment; no browser dependency is shipped to students. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = process.cwd();
const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404).end(); return; }
        const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png' };
        res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'}); res.end(data);
    });
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ headless:true,
        executablePath: process.env.HAYYIZ_BROWSER_EXECUTABLE || undefined,
        args: ['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--disable-dev-shm-usage']
    });
    try {
        const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
        await context.addInitScript(() => { window.global = window; });
        await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
        let page = await context.newPage();
        page.setDefaultTimeout(10000);
        page.on('dialog', async dialog => { await dialog.accept(); });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(base, {waitUntil:'load'});
        await page.locator('#student-quick-setup').waitFor();
        await page.locator('#setup-subject').fill('الرياضيات');
        await page.locator('#setup-task').fill('حل تمارين الجبر');
        await page.locator('#setup-minutes').fill('٤٥');
        await page.getByRole('button',{name:'ابنِ خطتي الأولى',exact:true}).click();
        assert.equal(await page.evaluate(()=>hayyizGetTodos().length),1);
        assert.equal(await page.locator('#student-quick-setup').count(),0);
        await page.locator('#planning-today-minutes').fill('١٠');
        await page.getByRole('button',{name:'تغيّر وقتي · حدّث الخطة',exact:true}).click();
        assert.equal(await page.evaluate(()=>hayyizGetDayCapacity(getTodayLocal()).remainingMinutes),10);
        await page.screenshot({path:process.env.HAYYIZ_SCREENSHOT_DIR ? path.join(process.env.HAYYIZ_SCREENSHOT_DIR,'hayyiz-mobile.png') : '/tmp/hayyiz-mobile.png',fullPage:true});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),'Mobile has no horizontal overflow');
        await page.locator('.dash-now-card button.btn-primary').click();
        await page.waitForURL('**/pomodoro.html?**');
        await page.waitForLoadState('load');
        await page.waitForFunction(()=>document.getElementById('timer-display')?.textContent === '10:00',{},{timeout:5000});
        assert.equal(await page.locator('#timer-display').textContent(),'10:00');
        assert.equal(await page.evaluate(()=>localStorage.getItem('hayyiz-pref-work')),null,'Session budget does not change saved timer preferences');
        await page.locator('#timer-start-btn').click();
        await page.reload();
        assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('hayyiz-pomodoro-state')).status === 'running'));
        // Expire the actual persisted session; reconciliation must log it exactly once.
        await page.evaluate(()=>{setState({endTime:Date.now()-1000,status:'running'});const state=JSON.parse(localStorage.getItem('hayyiz-pomodoro-state'));state.endTime=Date.now()-1000;state.status='running';localStorage.setItem('hayyiz-pomodoro-state',JSON.stringify(state));});
        const expiredURL = page.url();
        await page.close();
        page = await context.newPage();
        page.setDefaultTimeout(10000);
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        await page.goto(expiredURL);
        const more=page.getByRole('button',{name:'أحتاج وقتًا إضافيًا · أضف 25 دقيقة للتقدير',exact:true});
        await more.waitFor(); await more.click();
        assert.equal(await page.evaluate(()=>hayyizGetTodos()[0].minutes),35);
        assert.equal(await page.evaluate(()=>hayyizGetTodos()[0].completed),false);
        assert.equal(await page.evaluate(()=>Number(localStorage.getItem('hayyiz-focus-minutes-today'))),10);
        await page.getByRole('button',{name:'المهمة مكتملة',exact:true}).click();
        assert.equal(await page.evaluate(()=>hayyizGetTodos()[0].completed),true);
        await page.goto(base+'/study-planner.html');
        assert.equal(await page.locator('.sp-subj-name').first().inputValue(),'الرياضيات');
        await page.locator('#sp-add-subject-btn').click();
        await page.locator('.sp-subj-name').nth(1).fill('الرياضيات');
        const previewMinutes = await page.evaluate(()=>hayyizParseJSON('hayyiz-planner-draft',{}).subjects.reduce((sum,s)=>sum+Math.round(s.allocatedHours*60),0));
        await page.getByRole('button',{name:'اعتمد الخطة في مهامي',exact:true}).click();
        await page.locator('#sp-adopt-status a').waitFor();
        assert.match(await page.locator('#sp-adopt-status').textContent(),/جُمعت دقائق المواد المكررة/);
        assert.equal(await page.evaluate(()=>{
            const id=hayyizParseJSON('hayyiz-planner-draft',{}).targetId;
            const tasks=hayyizGetTodos().filter(t=>t.eventId===id);
            return tasks.length===1 ? tasks[0].minutes : -1;
        }),previewMinutes,'Duplicate rows preserve their entire preview allocation in one canonical task');
        const count=await page.evaluate(()=>hayyizGetTodos().length);
        await page.getByRole('button',{name:'اعتمد الخطة في مهامي',exact:true}).click();
        assert.equal(await page.evaluate(()=>hayyizGetTodos().length),count);
        await page.reload();
        assert.equal(await page.locator('.sp-subj-name').first().inputValue(),'الرياضيات');
        // Real DOM regression: switching from a saved exam to a new target must not overwrite it.
        const savedExam = await page.evaluate(() => {
            const d = new Date(); d.setDate(d.getDate() + 7);
            const date = [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
            const exam = {id:'physics-final',name:'اختبار الفيزياء النهائي',date,type:'exam',created:100};
            const exams = hayyizGetExams(); exams.push(exam); hayyizSaveJSON('hayyiz-student-exams',exams); return exam;
        });
        await page.reload();
        await page.locator('#sp-exam-select').selectOption('physics-final');
        await page.locator('#sp-adopt-plan').click();
        await page.locator('#sp-exam-select').selectOption('');
        await page.locator('#sp-adopt-plan').click();
        assert.deepEqual(await page.evaluate(()=>hayyizGetExams().find(e=>e.id==='physics-final')),savedExam);
        const adoptedBefore = await page.evaluate(()=>{
            const id=hayyizParseJSON('hayyiz-planner-draft',{}).targetId;
            return hayyizGetTodos().find(t=>t.eventId===id);
        });
        assert.notEqual(adoptedBefore.eventId,'physics-final');
        await page.evaluate(()=>{
            const input=document.getElementById('sp-daily-hours'); input.value='4.5'; input.dispatchEvent(new Event('input',{bubbles:true}));
        });
        await page.locator('#sp-adopt-plan').click();
        assert.notEqual(await page.evaluate(id=>hayyizGetTaskById(id).minutes,adoptedBefore.id),adoptedBefore.minutes,'Changed hours update the adopted estimate');
        await page.evaluate(id=>hayyizUpdateTask(id,{minutes:9999,focusDone:25}),adoptedBefore.id);
        await page.locator('#sp-adopt-plan').click();
        assert.equal(await page.evaluate(id=>hayyizGetTaskById(id).minutes,adoptedBefore.id),9999);
        assert.equal(await page.evaluate(id=>hayyizGetTaskById(id).focusDone,adoptedBefore.id),25);
        assert.match(await page.locator('#sp-adopt-status').textContent(),/احتُفظ بالتعديلات اليدوية/);
        for (const width of [320,390]) {
            await page.setViewportSize({width,height:844});
            assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),'Planner controls fit '+width+'px mobile');
        }
        await page.screenshot({path:'/tmp/hayyiz-planner-mobile.png',fullPage:true});
        const examCount = await page.evaluate(()=>hayyizGetExams().length);
        await page.locator('#sp-new-plan').click();
        assert.equal(await page.evaluate(()=>hayyizGetExams().length),examCount,'Starting a new draft does not save it prematurely');
        await page.locator('#sp-adopt-plan').click();
        assert.equal(await page.evaluate(()=>hayyizGetExams().length),examCount+1);
        const targetAfterNew = await page.evaluate(()=>hayyizParseJSON('hayyiz-planner-draft',{}).targetId);
        assert.notEqual(targetAfterNew,adoptedBefore.eventId);
        await page.reload(); await page.locator('#sp-adopt-plan').click();
        assert.equal(await page.evaluate(()=>hayyizGetExams().length),examCount+1,'Reload preserves the new target identity');
        await page.goto(base);
        await page.locator('.planning-settings summary').first().click();
        await page.locator('#planning-week-0').fill('٦٠');
        await page.getByRole('button',{name:'حفظ الأسبوع وإعادة التوزيع',exact:true}).click();
        assert.equal(await page.evaluate(()=>hayyizGetPlanningPreferences().week[0]),60);
        await page.locator('.planning-settings summary').first().click();
        await page.locator('#planning-commitment-name').fill('درس خصوصي');
        await page.locator('.planning-days input').first().check();
        await page.getByRole('button',{name:'إضافة الالتزام',exact:true}).click();
        assert.equal(await page.evaluate(()=>hayyizGetPlanningPreferences().commitments.length),1);
        await page.getByText('مراجعة يومي وتجهيز الغد',{exact:true}).click();
        await page.locator('#planning-review-reason').selectOption('difficulty');
        await page.getByRole('button',{name:'حفظ مراجعة اليوم',exact:true}).click();
        assert.equal(await page.evaluate(()=>hayyizParseJSON('hayyiz-day-reviews',{})[getTodayLocal()].reason),'difficulty');
        await page.getByRole('button',{name:'تبديل الوضع الليلي',exact:true}).click();
        assert(await page.evaluate(()=>document.documentElement.classList.contains('theme-dark')));
        assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),'Expanded mobile controls fit viewport');
        await page.setViewportSize({width:1440,height:1000});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),'Desktop controls fit viewport');
        await page.screenshot({path:process.env.HAYYIZ_SCREENSHOT_DIR ? path.join(process.env.HAYYIZ_SCREENSHOT_DIR,'hayyiz-desktop.png') : '/tmp/hayyiz-desktop.png',fullPage:true});
        assert.deepEqual(errors,[], 'No uncaught application errors');
        console.log('Browser smoke PASSED: first plan, Arabic time, 10-minute session, reload/expiry, estimate extension, completion, planner adoption/reload, duplicate aggregation, standalone task deadlines, exam identity, estimate reconciliation, manual edits, new-plan action, week, commitment, review, dark mode, mobile and desktop.');
        await context.close();
        const standalone = await browser.newContext({serviceWorkers:'block'});
        await standalone.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
        const taskPage = await standalone.newPage();
        taskPage.on('pageerror',error=>errors.push(error.message));
        await taskPage.goto(base+'/todo.html');
        await taskPage.evaluate(()=>{
            localStorage.setItem('hayyiz-pref-daily-capacity','120');
            hayyizSaveTodos([{id:'flex',text:'عمل مرن',minutes:145,focusDone:25,priority:'high'}]);
        });
        await taskPage.reload();
        await taskPage.locator('#todo-input').fill('واجب اليوم');
        await taskPage.locator('#toggle-more-options').click();
        await taskPage.locator('#todo-priority').selectOption('low');
        const dueValue=await taskPage.evaluate(()=>getTodayLocal()+'T18:30');
        await taskPage.locator('#todo-date').fill(dueValue);
        await taskPage.locator('#todo-minutes').fill('60');
        await taskPage.locator('#todo-form button[type=submit]').click();
        await taskPage.getByRole('button',{name:'ليس الآن',exact:true}).click();
        await taskPage.getByRole('button',{name:'تعديل مهمة واجب اليوم',exact:true}).click();
        assert.equal(await taskPage.locator('#modal-input-date').getAttribute('type'),'datetime-local');
        await taskPage.locator('#modal-input-title').fill('واجب اليوم بعد التعديل');
        await taskPage.locator('#modal-task-form button[type=submit]').click();
        assert.equal(await taskPage.evaluate(()=>hayyizGetTodos().find(t=>t.text==='واجب اليوم بعد التعديل').date),dueValue);
        await taskPage.goto(base);
        assert.equal(await taskPage.evaluate(()=>hayyizComputeStudentDecisionState().dailyPlan.find(i=>i.task?.text==='واجب اليوم بعد التعديل')?.plannedMinutes),60);
        assert.match(await taskPage.locator('.dash-plan-list').textContent(),/واجب اليوم بعد التعديل/);
        const adopted=await taskPage.evaluate(()=>{
            const d=new Date(); d.setDate(d.getDate()+7);
            const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
            const p=hayyizAdoptStudyPlan({targetDate:date,subjects:[{name:'مادة للاختبار',minutes:1800}]});
            const task=hayyizGetTodos().find(t=>t.eventId===p.targetId); return {id:task.id,targetId:p.targetId,date,text:task.text};
        });
        await taskPage.goto(base+'/todo.html');
        await taskPage.getByRole('button',{name:'تعديل مهمة '+adopted.text,exact:true}).click();
        assert.equal(await taskPage.locator('#modal-input-date').inputValue(),adopted.date);
        assert.equal(await taskPage.locator('#modal-input-date').getAttribute('type'),'date');
        await taskPage.locator('#modal-input-title').fill('تغيير العنوان فقط');
        await taskPage.locator('#modal-task-form button[type=submit]').click();
        assert(await taskPage.locator('#task-details-modal').evaluate(el=>el.classList.contains('hidden')),'A multi-day estimate can be saved through the real editor');
        assert.equal(await taskPage.evaluate(id=>hayyizGetTaskById(id).date,adopted.id),adopted.date);
        const reconciled=await taskPage.evaluate(({targetId,date,id})=>{
            const plan=hayyizAdoptStudyPlan({targetId,targetDate:date,subjects:[{name:'مادة للاختبار',minutes:2100}]});
            return {task:hayyizGetTaskById(id),protectedFields:plan.adoption.protectedFields};
        },adopted);
        assert.equal(reconciled.task.minutes,2100); assert.equal(reconciled.task.text,'تغيير العنوان فقط'); assert.deepEqual(reconciled.protectedFields,[]);
        await taskPage.reload();
        await taskPage.getByRole('button',{name:'تعديل مهمة تغيير العنوان فقط',exact:true}).click();
        await taskPage.locator('#modal-input-minutes').fill('2200');
        await taskPage.locator('#modal-input-date').fill(dueValue.slice(0,10));
        await taskPage.locator('#modal-task-form button[type=submit]').click();
        const protectedTask=await taskPage.evaluate(({targetId,date,id})=>{
            hayyizAdoptStudyPlan({targetId,targetDate:date,subjects:[{name:'مادة للاختبار',minutes:2300}]});
            return hayyizGetTaskById(id);
        },adopted);
        assert.equal(protectedTask.minutes,2200); assert.equal(protectedTask.date,dueValue.slice(0,10));
        // A fresh device may have preferences without the legacy capacity key.
        await taskPage.evaluate(()=>{
            localStorage.removeItem('hayyiz-pref-daily-capacity');
            hayyizSaveJSON('hayyiz-planning-preferences',{defaultMinutes:60,week:{},updatedAt:Date.now()});
        });
        await taskPage.goto(base+'/calculator.html');
        await taskPage.locator('.btn-multi-plan[data-id="'+adopted.targetId+'"]').click();
        assert.equal(await taskPage.locator('#multi-plan-capacity-input').inputValue(),'60');
        await taskPage.locator('#reevaluate-multi-plan-btn').click();
        assert.equal(await taskPage.evaluate(()=>hayyizDefaultCapacity()),60);
        await taskPage.locator('#multi-plan-capacity-input').selectOption('custom');
        await taskPage.locator('#multi-plan-capacity-custom').fill('0');
        await taskPage.locator('#reevaluate-multi-plan-btn').click();
        assert.equal(await taskPage.evaluate(()=>hayyizDefaultCapacity()),0,'Zero capacity stays zero through recalculation');
        await taskPage.locator('#multi-plan-capacity-custom').fill('-1');
        await taskPage.locator('#multi-plan-capacity-custom').dispatchEvent('change');
        assert.equal(await taskPage.evaluate(()=>hayyizDefaultCapacity()),0,'Invalid capacity never becomes a fallback budget');
        assert.equal(await taskPage.locator('#multi-plan-capacity-custom').evaluate(el=>el.checkValidity()),false);
        await taskPage.evaluate(()=>hayyizSavePlanningPreferences({defaultMinutes:75,week:{},updatedAt:Date.now()}));
        assert.equal(await taskPage.locator('#multi-plan-capacity-custom').inputValue(),'75','An open calendar refreshes after preference changes');
        assert.equal(await taskPage.locator('#multi-plan-capacity-custom').evaluate(el=>el.checkValidity()),true);
        await taskPage.locator('#reevaluate-multi-plan-btn').click();
        assert.equal(await taskPage.evaluate(()=>hayyizDefaultCapacity()),75);
        assert.deepEqual(errors,[],'No uncaught application errors in task/calendar integration');
        console.log('Task/calendar integration PASSED: real datetime input, title-only edits, long estimates, re-adoption, manual edits, restored and zero capacity.');
        await standalone.close();
        // Automatic recommendations must follow the same daily allocation across all three tools.
        const recommendations = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
        await recommendations.addInitScript(()=>{window.global=window;});
        await recommendations.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
        await recommendations.route(base+'/__test_blank',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Test transition</title>'}));
        const recommendationErrors=[];
        let recPage=await recommendations.newPage();
        const watchRecommendations = p=>{p.setDefaultTimeout(10000);p.on('pageerror',e=>recommendationErrors.push(e.message));p.on('dialog',d=>d.accept());};
        watchRecommendations(recPage);
        await recPage.goto(base);
        await recPage.evaluate(()=>{
            localStorage.clear();
            const d=new Date();d.setDate(d.getDate()+5);
            const later=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
            localStorage.setItem('hayyiz-pref-daily-capacity','10');
            hayyizSaveTodos([
                {id:'rec-urgent',text:'واجب اليوم',date:getTodayLocal(),minutes:30,priority:'medium',completed:false},
                {id:'rec-later',text:'مراجعة مؤجلة',date:later,minutes:120,focusDone:30,priority:'high',completed:false}
            ]);
        });
        await recPage.goto(base);
        assert.equal(await recPage.locator('.dash-now-title').textContent(),'واجب اليوم');
        await recPage.goto(base+'/todo.html');
        assert.equal(await recPage.locator('.todo-hero-title').textContent(),'واجب اليوم');
        assert.match(await recPage.locator('.todo-hero-meta').textContent(),/ضمن خطة اليوم 10 دقيقة/);
        await recPage.locator('#hero-action-btn').click();
        await recPage.waitForURL('**/pomodoro.html?**');await recPage.waitForLoadState('load');
        assert.equal(await recPage.locator('#timer-display').textContent(),'10:00');
        assert.equal(await recPage.evaluate(()=>localStorage.getItem('hayyiz-pref-work')),null);
        await recPage.locator('#timer-start-btn').click();
        const completedURL=recPage.url();
        // Leave the timer before expiring storage so its tick cannot consume the completion modal.
        await recPage.goto(base+'/__test_blank');
        await recPage.evaluate(()=>{
            const value=JSON.parse(localStorage.getItem('hayyiz-pomodoro-state'));
            value.endTime=Date.now()-1000;localStorage.setItem('hayyiz-pomodoro-state',JSON.stringify(value));
        });
        await recPage.goto(completedURL);
        await recPage.locator('.session-end-overlay').waitFor();
        assert.equal(await recPage.getByRole('button',{name:/المهمة التالية:/}).count(),0,'No automatic next task after the daily budget is spent');
        await recPage.goto(base+'/todo.html');
        assert.match(await recPage.locator('.todo-hero-card').textContent(),/مهامك محفوظة خارج وقت اليوم المتاح/);
        assert.equal(await recPage.locator('#hero-action-btn').count(),0);
        assert.equal(await recPage.evaluate(()=>hayyizGetTodos().filter(t=>!t.completed).length),2);
        // A stale card must recheck the budget even if storage changes without a UI notification.
        await recPage.evaluate(()=>{
            localStorage.removeItem('hayyiz-focus-history');
            localStorage.removeItem('hayyiz-pomodoro-state');
            localStorage.removeItem('hayyiz-focus-minutes-today');
            hayyizSetTodayRemainingMinutes(10);
        });
        await recPage.locator('#hero-action-btn').waitFor();
        await recPage.evaluate(()=>{
            const prefs=hayyizGetPlanningPreferences();prefs.overrides[getTodayLocal()].minutes=0;
            localStorage.setItem('hayyiz-planning-preferences',JSON.stringify(prefs));
        });
        await recPage.locator('#hero-action-btn').click();
        assert.equal(new URL(recPage.url()).pathname,'/todo.html');
        assert.equal(await recPage.locator('#hero-action-btn').count(),0);
        // Recovered completion: only seven daily minutes remain for the next planned task.
        await recPage.evaluate(()=>{
            localStorage.clear();localStorage.setItem('hayyiz-pref-daily-capacity','10');
            hayyizSaveTodos([
                {id:'rec-done',text:'مهمة منجزة',minutes:3,focusDone:3,completed:true},
                {id:'rec-next',text:'الواجب التالي',date:getTodayLocal(),minutes:30,priority:'medium',completed:false},
                {id:'rec-deferred',text:'عمل غير مؤرخ',minutes:120,focusDone:30,priority:'high',completed:false}
            ]);
            hayyizSaveJSON('hayyiz-focus-history',{[getTodayLocal()]:3});
            hayyizSaveFocusState({mode:'focus',status:'idle',remainingSeconds:0,totalDuration:180,endTime:null,
                context:{type:'task',id:'rec-done',title:'مهمة منجزة'},pendingNextMode:'break',
                pendingCompletionModal:{workMinJustDone:3,isLongBreak:false,breakMin:5}});
        });
        await recPage.goto(base+'/pomodoro.html');
        await recPage.getByRole('button',{name:'المهمة التالية: الواجب التالي',exact:true}).click();
        await recPage.waitForURL('**/pomodoro.html?**');await recPage.waitForLoadState('load');
        assert.equal(await recPage.locator('#timer-display').textContent(),'07:00');
        assert.equal(await recPage.evaluate(()=>hayyizGetFocusState().context.id),'rec-next');
        // A running or paused saved session remains resumable even when the daily budget is zero.
        for(const status of ['running','paused']) {
            const end=await recPage.evaluate(status=>{
                hayyizSetTodayRemainingMinutes(0);
                const end=status==='running'?Date.now()+300000:null;
                hayyizSaveFocusState({mode:'focus',status,remainingSeconds:300,totalDuration:1500,endTime:end,
                    context:{type:'task',id:'rec-next',title:'الواجب التالي'}});
                return end;
            },status);
            await recPage.goto(base+'/todo.html');
            assert.match(await recPage.locator('#hero-action-btn').textContent(),/متابعة الجلسة المحفوظة/);
            await recPage.locator('#hero-action-btn').click();
            await recPage.waitForURL(base+'/pomodoro.html');await recPage.waitForLoadState('load');
            const resumed=await recPage.evaluate(()=>hayyizGetFocusState());
            assert.equal(resumed.status,status);assert.equal(resumed.context.id,'rec-next');
            assert.equal(resumed.totalDuration,1500);assert.equal(resumed.endTime,end);
        }
        assert.deepEqual(recommendationErrors,[]);
        console.log('Shared recommendations PASSED: dashboard/Todo agreement, budgeted launch, stale/zero budget, next task, preserved running/paused sessions.');
        await recommendations.close();
        // Intercept the SDK request: exercise loading and queue delivery without sending test data to Google.
        const privacy = await browser.newContext({serviceWorkers:'block'});
        await privacy.addInitScript(()=>localStorage.setItem('hayyiz-planning-metrics','enabled'));
        const sdkRequests=[], analyticsRequests=[];
        await privacy.route('**/*', async route=>{
            const request=route.request(), url=new URL(request.url());
            if(url.origin===base) return route.continue();
            if(url.hostname==='www.googletagmanager.com' && url.pathname==='/gtag/js') {
                sdkRequests.push({url:request.url(),referrer:request.headers().referer});
                return route.fulfill({status:200,contentType:'application/javascript',body:'window.__privacySdkLoaded = true;'});
            }
            if(url.hostname.includes('google-analytics.com')) analyticsRequests.push(request.url());
            return route.abort();
        });
        const privacyPage=await privacy.newPage(); privacyPage.setDefaultTimeout(10000);
        const privacyErrors=[];privacyPage.on('pageerror',e=>privacyErrors.push(e.message));
        for(const path of ['/pomodoro.html?task=PRIVATE_TITLE&taskId=PRIVATE_ID&sessionMinutes=10',
            '/notes.html?title=PRIVATE_TITLE&task=PRIVATE_TITLE', '/index.html#access_token=PRIVATE_TOKEN', '/index.html?code=PRIVATE_TOKEN']) {
            await privacyPage.goto(base+path);
            await privacyPage.evaluate(()=>hayyizTrackPlanningEvent('focus_started'));
            assert.equal(sdkRequests.length,0,'No analytics SDK request on sensitive URLs');
            assert.equal(await privacyPage.locator('script[src*="googletagmanager.com/gtag"]').count(),0);
            const names=await privacyPage.evaluate(()=>JSON.parse(localStorage.getItem('hayyiz-planning-pending-events')||'[]'));
            assert(names.length>0); assert(names.every(name=>name==='focus_started'));
            assert(!JSON.stringify(names).includes('PRIVATE'));
        }
        // The same-origin referrer contains the previous token-bearing URL; only its origin may reach analytics.
        await Promise.all([privacyPage.waitForURL(base+'/index.html'), privacyPage.locator('a[href="index.html"]').first().click()]);
        await privacyPage.waitForLoadState('load');
        assert((await privacyPage.evaluate(()=>document.referrer)).includes('PRIVATE_TOKEN'),'Exercise a real sensitive same-origin referrer');
        await privacyPage.waitForFunction(()=>window.__privacySdkLoaded===true);
        assert.equal(sdkRequests.length,1);assert.equal(sdkRequests[0].referrer,undefined);
        const payload=await privacyPage.evaluate(()=>{
            document.title='PRIVATE_TITLE';
            window.gtag('event','planning_focus_completed',{task:'PRIVATE_TITLE',page_location:'PRIVATE_TOKEN',user_id:'PRIVATE_ID'});
            return JSON.stringify(window.dataLayer);
        });
        assert(!payload.includes('PRIVATE'),'No private URL, referrer, dynamic title, ID or caller field enters the SDK queue');
        const pageViews=await privacyPage.evaluate(()=>window.dataLayer.filter(args=>args[0]==='event'&&args[1]==='page_view').length);
        assert.equal(pageViews,1);
        assert.equal(await privacyPage.evaluate(()=>localStorage.getItem('hayyiz-planning-pending-events')),null,'Buffered names flush on a clean page after SDK load');
        assert.deepEqual(analyticsRequests,[]);assert.deepEqual(privacyErrors,[]);
        await privacy.close();
        console.log('Analytics browser privacy PASSED: no SDK on sensitive URLs, origin-only referrer, guarded payloads, delayed flushing and one page view (intercepted SDK, no Google collection).');
        // Warm app shell, then verify offline navigation in a fresh service-worker-enabled context.
        const offline = await browser.newContext();
        await offline.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
        const offPage=await offline.newPage(); await offPage.goto(base);
        await offPage.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
        await offPage.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.active);
        await offline.setOffline(true);
        await offPage.goto(base+'/study-planner.html');
        await offPage.locator('#sp-adopt-plan').waitFor();
        assert.equal(await offPage.locator('#sp-exam-select').count(),1);
        await offPage.goto(base+'/index.html');
        assert.equal(await offPage.evaluate(()=>typeof window.hayyizSendPlanningEvent),'function','The shared analytics guard is cached offline');
        console.log('Offline app shell PASSED: study planner loads without a previous visit and analytics guard is cached.');
        await offline.close();
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
