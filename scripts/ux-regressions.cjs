const assert = require('node:assert/strict');
const fs = require('node:fs');

// Valid, self-contained one-page PDF; all bytes stay in this isolated browser.
function localPdf() {
    const stream = 'BT /F1 12 Tf 20 180 Td (Local PDF test) Tj ET';
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 240] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
    ];
    let text = '%PDF-1.4\n', offsets = [0];
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(text)); text += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(text);
    text += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(text);
}

module.exports = async function verifyUx(browser, base) {
    const context = await browser.newContext({ viewport: { width: 1060, height: 900 }, serviceWorkers: 'block' });
    const errors = [], cloudRequests = [];
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname.endsWith('.supabase.co')) cloudRequests.push(route.request().url());
        return url.origin === base ? route.continue() : route.abort();
    });
    async function page(path) {
        const result = await context.newPage(); result.setDefaultTimeout(10000);
        result.on('pageerror', error => errors.push(error.message));
        result.on('dialog', dialog => dialog.accept());
        await result.goto(base + path);
        return result;
    }
    async function textMode(p) {
        if (await p.locator('#choose-text-notes').isVisible()) await p.locator('#choose-text-notes').click();
    }
    async function save(p, title, content) {
        await textMode(p);
        await p.locator('#note-title').fill(title); await p.locator('#note-content').fill(content);
        await p.locator('#note-submit-btn').click();
        await p.waitForFunction(() => document.getElementById('note-content').value === '');
    }
    function card(p, title) { return p.locator('.note-card').filter({ has: p.getByRole('heading', { name: title, exact: true }) }); }
    try {
        const a = await page('/notes.html');
        const subject = await a.evaluate(() => hayyizAddSubject('الرياضيات'));
        await a.reload(); await textMode(a);
        const b = await page('/notes.html'); await textMode(b);
        await a.locator('#notes-extra-details summary').click();
        await a.locator('#note-subject-select').selectOption(subject.id);
        assert.equal(await a.locator('#note-subject-select option').filter({ hasText: /^رياضيات$/ }).count(), 0, 'A legacy subject alias cannot duplicate the existing material');
        await save(a, 'ملاحظة أ', 'من التبويب الأول');
        await save(b, 'ملاحظة ب', 'من التبويب الثاني');
        await Promise.all([save(a, 'حفظ متزامن أ', 'نص متزامن أ'), save(b, 'حفظ متزامن ب', 'نص متزامن ب')]);
        const saved = await a.evaluate(() => JSON.parse(hayyizStorage.getItem('hayyiz-notes')));
        assert.equal(saved.length, 4, 'Sequential and simultaneous tab writes preserve every new note');
        const original = saved.find(note => note.title === 'ملاحظة أ');
        assert.equal(original.subjectId, subject.id);

        await card(a, 'ملاحظة أ').getByRole('button', { name: 'تعديل', exact: true }).click();
        await a.locator('#note-content').fill('تعديل قديم لم يُحفظ');
        await card(b, 'ملاحظة أ').getByRole('button', { name: 'تعديل', exact: true }).click();
        await b.locator('#note-content').fill('تعديل أحدث محفوظ');
        await b.locator('#note-submit-btn').click();
        await b.waitForFunction(() => document.getElementById('note-content').value === '');
        await a.locator('#note-submit-btn').click();
        await a.locator('#note-save-copy-btn').waitFor({ state: 'visible' });
        assert.equal(await a.locator('#note-content').inputValue(), 'تعديل قديم لم يُحفظ');
        assert.equal(await a.evaluate(id => JSON.parse(hayyizStorage.getItem('hayyiz-notes')).find(note => note.id === id).content, original.id), 'تعديل أحدث محفوظ');
        await a.locator('#note-save-copy-btn').click();
        await a.waitForFunction(() => document.getElementById('note-content').value === '');
        assert.equal(await a.evaluate(() => JSON.parse(hayyizStorage.getItem('hayyiz-notes')).length), 5);

        await card(b, 'ملاحظة ب').getByRole('button', { name: 'تعديل', exact: true }).click();
        await b.locator('#note-content').fill('مسودة تعديل قابلة للاسترجاع');
        await b.reload();
        await b.waitForFunction(() => document.getElementById('note-content').value === 'مسودة تعديل قابلة للاسترجاع');
        assert.equal(await b.locator('#note-submit-btn').textContent(), 'تحديث الملاحظة');
        await b.locator('#note-submit-btn').click();
        await b.waitForFunction(() => document.getElementById('note-content').value === '');

        await a.locator('#note-title').fill('ملاحظة عند امتلاء التخزين');
        await a.locator('#note-content').fill('يجب الاحتفاظ بهذا النص');
        await a.evaluate(() => {
            window.__notesSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key, value) {
                if (key === 'hayyiz-notes' || key.endsWith(':hayyiz-notes')) throw new DOMException('Full', 'QuotaExceededError');
                return window.__notesSetItem.call(this, key, value);
            };
        });
        await a.locator('#note-submit-btn').click();
        await a.waitForFunction(() => document.getElementById('note-save-status').textContent.includes('تعذر الحفظ'));
        assert.equal(await a.locator('#note-content').inputValue(), 'يجب الاحتفاظ بهذا النص');
        assert.equal(await a.evaluate(() => JSON.parse(hayyizStorage.getItem('hayyiz-notes')).length), 5);
        await a.evaluate(() => { Storage.prototype.setItem = window.__notesSetItem; });
        await a.locator('#note-submit-btn').click();
        await a.waitForFunction(() => document.getElementById('note-content').value === '');

        // window.open copies sessionStorage, just like a duplicated tab.
        await a.locator('#note-title').fill('مسودة التبويب الأصلي');
        await a.locator('#note-content').fill('مسودة أ مستقلة');
        await a.evaluate(() => sessionStorage.setItem('clone-proof', 'copied'));
        const clonedPage = context.waitForEvent('page');
        await a.evaluate(() => window.open('/notes.html', '_blank'));
        const clone = await clonedPage;
        await clone.waitForLoadState('load');
        assert.equal(await clone.evaluate(() => sessionStorage.getItem('clone-proof')), 'copied');
        await textMode(clone);
        assert.equal(await clone.locator('#note-content').inputValue(), '', 'A cloned tab cannot recover an active editor draft');
        await clone.locator('#note-title').fill('مسودة التبويب المنسوخ');
        await clone.locator('#note-content').fill('مسودة ب مستقلة');
        await a.locator('#note-submit-btn').click();
        await a.waitForFunction(() => document.getElementById('note-content').value === '');
        await clone.reload();
        await clone.waitForFunction(() => document.getElementById('note-content').value === 'مسودة ب مستقلة');
        await clone.locator('#note-submit-btn').click();
        await clone.waitForFunction(() => document.getElementById('note-content').value === '');
        await clone.reload(); await textMode(clone);
        assert.equal(await clone.locator('#note-content').inputValue(), '', 'Saved recovery drafts do not resurrect');
        await clone.close();

        await a.evaluate(() => {
            const notes = JSON.parse(hayyizStorage.getItem('hayyiz-notes'));
            notes.push({ id: 'legacy-no-subject-id', title: 'ملاحظة قديمة', content: 'النص القديم', subject: 'مادة قديمة مستقلة', tags: [], created: Date.now() });
            hayyizStorage.setItem('hayyiz-notes', JSON.stringify(notes));
        });
        await a.reload(); await textMode(a);
        await card(a, 'ملاحظة قديمة').getByRole('button', { name: 'تعديل', exact: true }).click();
        await a.locator('#note-content').fill('النص الجديد دون تعارض وهمي');
        await a.locator('#note-submit-btn').click();
        await a.waitForFunction(() => document.getElementById('note-content').value === '');
        assert.equal(await a.evaluate(() => JSON.parse(hayyizStorage.getItem('hayyiz-notes')).find(n => n.id === 'legacy-no-subject-id').content), 'النص الجديد دون تعارض وهمي');

        const linked = await page('/subject.html?id=' + encodeURIComponent(subject.id));
        await linked.locator('#subject-notes-container a').filter({ hasText: 'عرض' }).first().click();
        await linked.locator('#note-view-modal').waitFor({ state: 'visible' });
        assert.equal(await linked.locator('#view-note-title').textContent(), 'ملاحظة أ');
        await linked.locator('#close-view-modal').click();
        await linked.reload();
        await linked.locator('#note-view-modal').waitFor({ state: 'visible' });
        console.log('UX notes PASSED: cross-tab writes, conflict copy, edit-draft recovery, quota retention and material deep links.');

        const plan = await page('/study-planner.html');
        const target = await plan.evaluate(() => { const day = new Date(); day.setDate(day.getDate() + 2); return [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')].join('-'); });
        await plan.locator('#sp-exam-date').fill(target);
        await plan.locator('#sp-generate-plan-btn').click();
        assert.equal(await plan.locator('#sp-metric-focus').textContent(), '4 ساعة و30 دقيقة');
        assert.equal(await plan.locator('#sp-metric-review').textContent(), '1 ساعة و30 دقيقة');
        const days = await plan.locator('.sp-phase-days').allTextContents();
        assert.equal(days.reduce((sum, value) => sum + parseFloat(value), 0), 2, 'The phases fit inside the available two days');
        for (let i = 0; i < 6; i++) await plan.locator('#sp-add-subject-btn').click();
        assert.equal(await plan.evaluate(() => hayyizParseJSON('hayyiz-planner-draft', {}).subjects.reduce((sum, row) => sum + Math.round(row.allocatedHours * 60), 0)), 270, 'Minute allocations preserve the whole budget without rounding inflation');
        await plan.setViewportSize({ width: 390, height: 844 });
        assert(await plan.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Shared planner navigation fits mobile');
        await plan.locator('#menu-toggle').click();
        await plan.locator('.nav-dropdown-toggle').first().click();
        await plan.locator('a.dropdown-item[href="study-planner.html"]').waitFor({ state: 'visible' });

        const calendar = await page('/calculator.html');
        const exam = await calendar.evaluate(id => {
            const date = getTodayLocal();
            const exam = { id: 'ux-exam', name: 'اختبار مرتبط بالمادة', type: 'exam', subjectId: id, date, updated: Date.now() };
            hayyizSaveJSON('hayyiz-student-exams', [exam]); return exam;
        }, subject.id);
        await calendar.reload(); await calendar.locator('.btn-convert-todo').click();
        const task = await calendar.evaluate(id => hayyizGetTodos().find(todo => todo.eventId === id), exam.id);
        assert.equal(task.subjectId, subject.id); assert.equal(task.taskType, 'review');
        await calendar.locator('.btn-start-pomo').click();
        await calendar.waitForURL('**/pomodoro.html?**');
        assert.equal(await calendar.evaluate(() => JSON.parse(hayyizStorage.getItem('hayyiz-current-event')).id), exam.id);
        assert.equal(await calendar.evaluate(() => JSON.parse(hayyizStorage.getItem('hayyiz-current-event')).subjectId), subject.id);
        console.log('UX planning PASSED: exact hours/minutes/phases, mobile navigation and calendar task/focus context.');

        const drawing = await page('/draw.html');
        const pdf = localPdf();
        await drawing.locator('#pdfFileInput').setInputFiles({ name: 'local-test.pdf', mimeType: 'application/pdf', buffer: pdf });
        await drawing.waitForFunction(() => JSON.parse((window.hayyizStorage || localStorage).getItem('hayyiz-free-spaces-v1') || '{"spaces":[]}').spaces.some(space => space.metadata?.pdf?.fileName === 'local-test.pdf'));
        await drawing.evaluate(() => {
            window.__drawingSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key, value) {
                if (key.endsWith('hayyiz-free-spaces-v1')) throw new DOMException('Full', 'QuotaExceededError');
                return window.__drawingSetItem.call(this, key, value);
            };
        });
        await drawing.locator('#btnText').click();
        await drawing.locator('#drawCanvas').click({ position: { x: 300, y: 200 } });
        await drawing.locator('#textInput').fill('نص الرسم غير المحفوظ');
        await drawing.locator('#textInput').press('Enter');
        await drawing.locator('#draw-save-status').waitFor({ state: 'visible' });
        const [download] = await Promise.all([drawing.waitForEvent('download'), drawing.locator('#btnExportUnsaved').click()]);
        const archive = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
        const snapshot = JSON.parse(archive.keys['hayyiz-free-spaces-v1']);
        assert(snapshot.spaces.some(space => space.pages.some(p => p.texts.some(text => text.text === 'نص الرسم غير المحفوظ'))), 'Emergency export includes unsaved memory contents');
        assert.equal(archive.pdfFiles.length, 1); assert(Buffer.from(archive.pdfFiles[0].data, 'base64').equals(pdf));
        assert.deepEqual(cloudRequests, [], 'PDF import and local backups do not call Supabase');
        await drawing.evaluate(() => { Storage.prototype.setItem = window.__drawingSetItem; });
        await drawing.locator('#btnRetryDrawingSave').click();
        await drawing.locator('#draw-save-status').waitFor({ state: 'hidden' });
        assert.deepEqual(errors, []);
        console.log('UX drawing PASSED: valid PDF import, visible quota failure, complete emergency local backup and zero Supabase file requests.');
    } finally { await context.close(); }
};
