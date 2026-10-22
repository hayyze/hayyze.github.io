const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const analytics = fs.readFileSync('analytics.js','utf8');
const common = fs.readFileSync('common.js','utf8');
function device(href='https://hayyze.pages.dev/pomodoro.html', options={}) {
    const scripts=[], timers=[], listeners={};
    const c=vm.createContext({console,Date,URL,URLSearchParams,Event,
        setTimeout(fn){timers.push(fn);},clearTimeout(){},
        navigator:{doNotTrack:options.dnt||'0',globalPrivacyControl:!!options.gpc},
        location:new URL(href),
        document:{title:'عنوان الصفحة الثابت',referrer:options.referrer||'https://hayyze.pages.dev/notes.html?title=PRIVATE&taskId=PRIVATE_ID#PRIVATE',readyState:'complete',
            head:{appendChild(script){scripts.push(script);}},createElement(){return {};},addEventListener(){},getElementById(){return null;},querySelectorAll(){return [];}},
        localStorage:{data:{},getItem(k){return this.data[k]??null;},setItem(k,v){this.data[k]=String(v);},removeItem(k){delete this.data[k];}}
    });
    c.window=c;c.addEventListener=(name,fn)=>listeners[name]=fn;
    if(options.optIn)c.localStorage.setItem('hayyiz-planning-metrics','enabled');
    if(options.legacy)c.gtag=options.legacy;
    if(options.analytics!==false)vm.runInContext(analytics,c);
    vm.runInContext(common,c);
    return {c,scripts,load(){timers.splice(0).forEach(fn=>fn());},ready(){scripts.forEach(script=>script.onload?.());}};
}
const events=c=>(c.dataLayer||[]).filter(args=>args[0]==='event');
const pending=c=>JSON.parse(c.localStorage.getItem('hayyiz-planning-pending-events')||'[]');
const sensitive=[
    'pomodoro.html?task=PRIVATE&taskId=PRIVATE_ID&sessionMinutes=10',
    'notes.html?title=PRIVATE&task=PRIVATE',
    'todo.html?taskId=PRIVATE_ID',
    'index.html?code=PRIVATE',
    'index.html?q=PRIVATE',
    'index.html?utm_source=PRIVATE',
    'index.html#access_token=PRIVATE',
    'index.html#daily-summary',
    'PRIVATE.html'
];
for(const path of sensitive) {
    const d=device('https://hayyze.pages.dev/'+path,{optIn:true}); d.load();
    d.c.hayyizTrackPlanningEvent('focus_started');
    assert.equal(d.scripts.length,0,'SDK must not load on '+path);
    assert.equal(events(d.c).length,0);
    assert.deepEqual(pending(d.c),['focus_started'],'Keep only the allowlisted action, never its source URL');
    assert.equal(d.c.location.href,'https://hayyze.pages.dev/'+path,'Do not alter task, navigation or OAuth parameters');
    // Removing parameters later must not unexpectedly start analytics in the sensitive document.
    d.c.location=new URL(d.c.location.origin+d.c.location.pathname);
    d.load();assert.equal(d.c.hayyizSendPlanningEvent('focus_started'),false);
}
let legacyCalls=0;
const legacy=device('https://hayyze.pages.dev/pomodoro.html?task=PRIVATE',{optIn:true,analytics:false,legacy(){legacyCalls++;}});
legacy.c.hayyizTrackPlanningEvent('focus_started'); assert.equal(legacyCalls,0,'Never use a legacy unsanitized gtag');
assert.deepEqual(pending(legacy.c),['focus_started']);
for(const prefs of [{dnt:'1'},{gpc:true}]) {
    const d=device(undefined,{...prefs,optIn:true});d.load();d.c.hayyizTrackPlanningEvent('focus_started');
    assert.equal(d.scripts.length,0);assert.equal(events(d.c).length,0);assert.deepEqual(pending(d.c),[]);
}
const d=device(undefined,{optIn:true});
d.c.hayyizTrackPlanningEvent('focus_started'); assert.deepEqual(pending(d.c),['focus_started']);
d.load();assert.equal(d.scripts.length,1);assert.equal(d.scripts[0].referrerPolicy,'no-referrer');
assert(d.scripts[0].src.startsWith('https://www.googletagmanager.com/gtag/js?id='));
const config=d.c.dataLayer.find(args=>args[0]==='config')[2];
assert.equal(config.send_page_view,false,'Only one explicit page view per document');
assert.equal(config.page_location,'https://hayyze.pages.dev/pomodoro.html');
assert.equal(config.page_referrer,'https://hayyze.pages.dev/');
assert.equal(events(d.c).filter(e=>e[1]==='page_view').length,1);
assert.deepEqual(pending(d.c),['focus_started'],'Do not discard queued actions before the SDK loads');
d.ready();assert.deepEqual(pending(d.c),[]);
assert.equal(events(d.c).filter(e=>e[1]==='planning_focus_started').length,1);
d.c.document.title='PRIVATE';
d.c.gtag('event','planning_focus_completed',{page_location:'PRIVATE',page_referrer:'PRIVATE',task:'PRIVATE',user_id:'PRIVATE_ID'});
d.c.gtag('config','other-stream',{page_location:'PRIVATE'});
d.c.gtag('event','arbitrary_private_event',{text:'PRIVATE'});
assert.equal(events(d.c).at(-1)[1],'planning_focus_completed');
assert.equal(events(d.c).at(-1)[2].page_title,'عنوان الصفحة الثابت');
assert(!JSON.stringify(d.c.dataLayer).includes('PRIVATE'),'Page context and arbitrary fields must not expose private content');
d.c.localStorage.setItem('hayyiz-planning-metrics','disabled');
const count=events(d.c).length;d.c.hayyizTrackPlanningEvent('focus_started');d.c.gtag('event','planning_focus_started');assert.equal(events(d.c).length,count);
vm.runInContext(analytics,d.c);d.load();assert.equal(d.scripts.length,1,'Duplicate imports never duplicate SDKs or page views');
const failed=device(undefined,{optIn:true});failed.load();failed.c.hayyizTrackPlanningEvent('focus_started');
failed.c.hayyizFlushPlanningEvents();assert.deepEqual(pending(failed.c),['focus_started'],'An unavailable SDK keeps names for a later safe visit');
failed.c.localStorage.setItem('hayyiz-planning-pending-events',JSON.stringify(['PRIVATE',{title:'PRIVATE'},'focus_completed']));
failed.ready();assert.deepEqual(pending(failed.c),[]);assert(!JSON.stringify(failed.c.dataLayer).includes('PRIVATE'));
const bounded=device('https://hayyze.pages.dev/pomodoro.html?task=PRIVATE',{optIn:true});
for(let i=0;i<75;i++)bounded.c.hayyizTrackPlanningEvent('focus_started');assert.equal(pending(bounded.c).length,50);
const delayed=device('https://hayyze.pages.dev/index.html',{optIn:true});delayed.c.location=new URL('https://hayyze.pages.dev/pomodoro.html?task=PRIVATE');delayed.load();assert.equal(delayed.scripts.length,0,'Recheck privacy immediately before loading');
const credential=device('https://PRIVATE:PRIVATE@hayyze.pages.dev/pomodoro.html',{optIn:true});credential.load();assert.equal(credential.scripts.length,0);
let imports=0;
for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html'))) {
    const html=fs.readFileSync(file,'utf8');
    assert(!/<script[^>]*src=["']https:\/\/www\.googletagmanager\.com\/gtag\//.test(html),file+' has an unguarded SDK');
    assert(!/gtag\(['"]config['"]/.test(html),file+' bypasses the shared initialization');
    const count=(html.match(/<script src="analytics\.js"><\/script>/g)||[]).length;
    assert(count<=1,file+' duplicates the analytics loader');
    if(count){imports++;assert(analytics.includes('/'+file),file+' must be explicitly allowlisted');}
}
assert.equal(imports,42);assert(fs.readFileSync('sw.js','utf8').includes("'./analytics.js'"),'Privacy guard is available offline');
console.log('Analytics privacy PASSED: 42 guarded pages, sensitive URLs/OAuth, referrers, titles, consent, DNT/GPC, buffering, SDK failure and no duplicate page views.');
