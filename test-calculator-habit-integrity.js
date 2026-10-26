const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// The pages run their production event handlers against a small DOM/storage fixture.
class Element {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.parentNode = null;
        this.dataset = {};
        this.style = {};
        this.attributes = {};
        this.listeners = {};
        this.className = '';
        this.value = '';
        this.disabled = false;
        this.classList = {
            contains: name => this.className.split(/\s+/).includes(name),
            add: (...names) => { this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(names))].join(' '); },
            remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); }
        };
    }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text || ''; }
    set innerHTML(value) { this._html = String(value); this.children = []; }
    get innerHTML() { return this._html || ''; }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    replaceChildren(...children) { this.children = []; children.forEach(child => this.appendChild(child)); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    async fire(name, extra = {}) {
        for (const callback of this.listeners[name] || []) await callback({ target: this, preventDefault() {}, ...extra });
    }
    matches(selector) {
        if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
        return this.tagName.toLowerCase() === selector;
    }
    closest(selector) { let node = this; while (node) { if (node.matches(selector)) return node; node = node.parentNode; } return null; }
    querySelectorAll(selector) {
        const nodes = [];
        for (const child of this.children) {
            if (child.matches(selector)) nodes.push(child);
            nodes.push(...child.querySelectorAll(selector));
        }
        return nodes;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function page(ids = [], saved = {}, now = '2026-10-23T12:00:00Z') {
    let clock = now;
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [clock])); }
        static now() { return new Date(clock).getTime(); }
    }
    const nodes = Object.fromEntries(ids.map(id => [id, new Element()]));
    const callbacks = [];
    const alerts = [];
    const storage = Object.fromEntries(Object.entries(saved).map(([key, value]) => [key, String(value)]));
    const document = {
        readyState: 'loading',
        documentElement: new Element('html'),
        body: new Element('body'),
        getElementById: id => nodes[id] || null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: tag => new Element(tag),
        createTextNode: text => { const element = new Element('#text'); element.textContent = text; return element; },
        addEventListener(name, callback) { if (name === 'DOMContentLoaded') callbacks.push(callback); }
    };
    const context = vm.createContext({ console, Date: Clock, document, navigator: {},
        location: { href: 'https://hayyze.pages.dev/weighted', search: '' },
        localStorage: { getItem: key => storage[key] ?? null, setItem: (key, value) => { storage[key] = String(value); }, removeItem: key => { delete storage[key]; } },
        alert: message => alerts.push(message)
    });
    context.window = context;
    return {
        context, nodes, alerts, storage,
        clock(value) { clock = value; },
        load(file) { vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file }); },
        start() { callbacks.splice(0).forEach(callback => callback()); }
    };
}

function weightedPage() {
    const fixture = page(['weighted-rows', 'weighted-add-btn', 'weighted-remaining', 'weighted-left', 'weighted-result', 'weighted-score', 'weighted-calculate-btn', 'weighted-reset-btn']);
    const card = new Element(); card.setAttribute('data-calc-page', 'weighted');
    fixture.context.document.querySelector = selector => selector === '.card[data-calc-page]' ? card : null;
    fixture.load('gpa.js'); fixture.start();
    fixture.scores = () => fixture.nodes['weighted-rows'].querySelectorAll('.w-score');
    fixture.weights = () => fixture.nodes['weighted-rows'].querySelectorAll('.w-percent');
    fixture.input = async (element, value) => { element.value = value; await element.fire('input'); };
    fixture.calculate = () => fixture.nodes['weighted-calculate-btn'].fire('click');
    return fixture;
}

async function run() {
    {
        const p = page();
        p.load('common.js');
        const cases = [
            [[2008, 0, 31], [2026, 2, 1], [18, 1, 1]],
            [[2026, 0, 31], [2026, 1, 28], [0, 1, 0]],
            [[2024, 0, 31], [2024, 1, 29], [0, 1, 0]],
            [[2008, 1, 29], [2026, 1, 28], [18, 0, 0]],
            [[2008, 1, 29], [2026, 1, 27], [17, 11, 29]],
            [[2000, 11, 31], [2026, 0, 1], [25, 0, 1]],
            [[2026, 9, 23], [2026, 9, 23], [0, 0, 0]]
        ];
        for (const [birth, end, expected] of cases) {
            const result = p.context.hayyizCalculateExactAge(new Date(...birth), new Date(...end));
            assert.deepEqual([result.years, result.months, result.days], expected);
        }
        const previousZone = process.env.TZ;
        try {
            process.env.TZ = 'America/New_York';
            const result = p.context.hayyizCalculateExactAge(new Date(2026, 1, 1), new Date(2026, 2, 31));
            assert.deepEqual([result.years, result.months, result.days], [0, 1, 30]);
        } finally {
            if (previousZone === undefined) delete process.env.TZ;
            else process.env.TZ = previousZone;
        }
        console.log('PASS calendar age clamps month-end/leap anniversaries and ignores DST clock changes');
    }
    {
        const p = page(['hero-age-val', 'hero-age-sub', 'hero-18-sub'], { 'hayyiz-birthdate': '2008-01-31' }, '2026-03-01T12:00:00Z');
        p.context.setInterval = () => 1; p.context.clearInterval = () => {};
        p.context.addEventListener = () => {};
        p.load('calculator.js'); p.start();
        assert.equal(p.nodes['hero-age-val'].textContent, '18 سنة و1 شهر');
        assert(p.nodes['hero-age-sub'].textContent.endsWith('(1 يوم)'));
        console.log('PASS calendar fallback UI also displays a valid nonnegative age without common.js');
    }
    {
        const p = weightedPage();
        for (const input of p.scores()) await p.input(input, '90');
        await p.calculate();
        assert.equal(p.nodes['weighted-score'].textContent, '90.00');
        assert(!p.nodes['weighted-result'].classList.contains('hidden'));
        assert(p.nodes['weighted-result'].querySelector('.share-result-wrap'));
        // Editing must invalidate the previous shareable result immediately.
        await p.input(p.scores()[0], '101');
        assert(p.nodes['weighted-result'].classList.contains('hidden'));
        assert.equal(p.nodes['weighted-result'].querySelector('.share-result-wrap'), null);
        await p.calculate();
        assert(p.alerts.at(-1).includes('درجة صحيحة'));
        assert.equal(p.nodes['weighted-score'].textContent, '0.00');
        console.log('PASS weighted valid inputs and invalid grade never publish a partial/stale result');
    }
    for (const grade of ['', '-1', 'Infinity', 'NaN', '90junk']) {
        const p = weightedPage();
        for (const input of p.scores()) await p.input(input, '90');
        await p.input(p.scores()[1], grade); await p.calculate();
        assert(p.nodes['weighted-result'].classList.contains('hidden'));
        assert.equal(p.alerts.length, 1);
    }
    console.log('PASS weighted missing/negative/nonfinite/malformed grades are rejected');
    for (const weight of ['', '-1', '101', 'Infinity', '30junk']) {
        const p = weightedPage();
        for (const input of p.scores()) await p.input(input, '90');
        await p.input(p.weights()[0], weight); await p.calculate();
        assert(p.nodes['weighted-result'].classList.contains('hidden'));
        assert.equal(p.alerts.length, 1);
    }
    console.log('PASS weighted invalid weights are rejected rather than coerced to zero');
    {
        const p = weightedPage();
        for (const input of p.scores()) await p.input(input, '90');
        await p.input(p.weights()[0], '30'); await p.calculate();
        assert(p.nodes['weighted-result'].classList.contains('hidden'));
        assert(p.alerts[0].includes('100%'));
        await p.input(p.weights()[0], '39.9');
        assert(p.nodes['weighted-remaining'].innerHTML.includes('0.1%'));
        await p.input(p.weights()[0], '100');
        await p.input(p.weights()[1], '0'); await p.input(p.weights()[2], '0');
        await p.input(p.scores()[0], '0'); await p.input(p.scores()[1], ''); await p.input(p.scores()[2], '');
        await p.calculate();
        assert.equal(p.nodes['weighted-score'].textContent, '0.00');
        assert(!p.nodes['weighted-result'].classList.contains('hidden'));
        console.log('PASS weighted requires 100% and distinguishes an actual zero grade from a missing grade');
    }
    {
        const p = weightedPage();
        for (const input of p.scores()) await p.input(input, '100');
        await p.input(p.weights()[0], '40.1'); await p.input(p.weights()[1], '29.9');
        await p.calculate();
        assert.equal(p.nodes['weighted-score'].textContent, '100.00');
        assert.equal(p.alerts.length, 0);
        await p.nodes['weighted-add-btn'].fire('click');
        assert(p.nodes['weighted-result'].classList.contains('hidden'));
        console.log('PASS weighted decimal weights and structural edits preserve validation');
    }
    function habitsPage(habit) {
        const p = page(['habit-form', 'habit-input', 'habits-list', 'habits-empty', 'total-habits', 'best-streak', 'today-completed', 'today-remaining', 'today-percent'], { 'hayyiz-habits': JSON.stringify([habit]) });
        p.load('habits.js'); p.start();
        p.check = async checked => {
            const check = p.nodes['habits-list'].querySelector('.habit-check');
            check.checked = checked;
            await p.nodes['habits-list'].fire('click', { target: check });
        };
        p.habit = () => JSON.parse(p.storage['hayyiz-habits'])[0];
        return p;
    }
    {
        let p = habitsPage({ id: 'h', name: 'قراءة', streak: 5, lastCompleted: '2026-10-22' });
        await p.check(true); assert.equal(p.habit().streak, 6);
        await p.check(false); assert.equal(p.habit().streak, 5); assert.equal(p.habit().lastCompleted, '2026-10-22');
        // Persisted undo metadata must survive page reload and cloud/backup round-trips.
        p = habitsPage(p.habit());
        await p.check(true); assert.equal(p.habit().streak, 6);
        await p.check(false); await p.check(true); assert.equal(p.habit().streak, 6);
        console.log('PASS habit undo/redo preserves yesterday and survives a reload');
    }
    {
        const p = habitsPage({ id: 'legacy', name: 'قراءة', streak: 6, lastCompleted: '2026-10-23' });
        await p.check(false); assert.equal(p.habit().streak, 5);
        await p.check(true); assert.equal(p.habit().streak, 6);
        console.log('PASS existing habits without new metadata retain their streak on undo/redo');
    }
    {
        const p = habitsPage({ id: 'gap', name: 'قراءة', streak: 5, lastCompleted: '2026-10-20' });
        await p.check(true); assert.equal(p.habit().streak, 1);
        await p.check(false); assert.equal(p.habit().streak, 5); assert.equal(p.habit().lastCompleted, '2026-10-20');
        await p.check(true); assert.equal(p.habit().streak, 1);
        p.clock('2026-10-25T12:00:00Z');
        await p.check(true); assert.equal(p.habit().streak, 1);
        console.log('PASS gaps reset streaks without corrupting the stored state before today');
    }
    {
        const p = page(['subject-tasks-container', 'count-open-tab', 'count-done-tab']);
        p.load('subject.js');
        let renders = 0, resolveUpdate;
        p.context.initSubjectPage = () => { renders++; };
        p.context.hayyizUpdateTask = () => new Promise(resolve => { resolveUpdate = resolve; });
        p.context.renderTasksSection({ id: 's' }, [{ id: 't', text: 'واجب', completed: false }], []);
        const button = p.nodes['subject-tasks-container'].querySelector('.subject-task-toggle');
        assert.equal(button.tagName, 'BUTTON'); assert.equal(button.type, 'button');
        assert.equal(button.getAttribute('aria-pressed'), 'false');
        assert(button.getAttribute('aria-label').includes('واجب'));
        assert.equal(button.children[0].getAttribute('aria-hidden'), 'true');
        const pending = button.fire('click');
        assert(button.disabled); assert.equal(renders, 0);
        resolveUpdate({ id: 't', completed: true }); await pending;
        assert.equal(renders, 1); assert(!button.disabled);
        console.log('PASS subject completion uses a keyboard-accessible button and waits for persistence');
        p.context.hayyizUpdateTask = async () => { throw new Error('network'); };
        await button.fire('click');
        assert.equal(renders, 1); assert(!button.disabled);
        const alerts = p.nodes['subject-tasks-container'].querySelectorAll('p').filter(node => node.getAttribute('role') === 'alert');
        assert.equal(alerts.length, 1);
        assert.equal(button.getAttribute('aria-pressed'), 'false');
        console.log('PASS failed subject completion keeps the old state and announces the failure');
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
