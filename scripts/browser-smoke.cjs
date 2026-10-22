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
        await taskPage.goto(base);
        await taskPage.evaluate(()=>{
            localStorage.setItem('hayyiz-pref-daily-capacity','120');
            hayyizSaveTodos([{id:'flex',text:'عمل مرن',minutes:145,focusDone:25,priority:'high'},
                {id:'due',text:'واجب اليوم',minutes:60,date:getTodayLocal(),priority:'low'}]);
            hayyizNotifyPlanningChanged();
        });
        assert.equal(await taskPage.evaluate(()=>hayyizComputeStudentDecisionState().dailyPlan.find(i=>i.task?.id==='due')?.plannedMinutes),60);
        assert.match(await taskPage.locator('.dash-plan-list').textContent(),/واجب اليوم/);
        assert.deepEqual(errors,[],'No uncaught application errors in standalone task planning');
        await standalone.close();
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
        console.log('Offline app shell PASSED: study planner loads without a previous visit.');
        await offline.close();
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
