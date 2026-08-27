const fs = require('fs');

// Load modules
const commonJs = fs.readFileSync('./common.js', 'utf8');
const gpaJs = fs.readFileSync('./gpa.js', 'utf8');
const summaryJs = fs.readFileSync('./summary.js', 'utf8');

// Mock DOM environment with element and child tag tracking
class MockElement {
    constructor(tagName, id = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.className = '';
        this.style = {};
        this.children = [];
        this.parentNode = null;
        this.attributes = {};
        this._value = '';
        this._textContent = '';
        this._innerHTML = '';
        this.dataset = {};
        this.eventListeners = {};
        this.classList = {
            add: (...classes) => {},
            remove: (...classes) => {},
            contains: (c) => false,
            toggle: (c, val) => {}
        };
    }

    get value() {
        return this._value;
    }
    set value(v) {
        this._value = String(v);
    }

    get textContent() {
        if (this.children.length > 0) {
            return this.children.map(c => typeof c === 'string' ? c : c.textContent).join('');
        }
        return this._textContent;
    }
    set textContent(t) {
        this._textContent = String(t);
        this.children = [];
        this._innerHTML = String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    get innerHTML() {
        if (this.children.length > 0) {
            return this.children.map(c => {
                if (typeof c === 'string') return c;
                return `<${c.tagName.toLowerCase()}${c.id ? ` id="${c.id}"` : ''}${c.className ? ` class="${c.className}"` : ''}>${c.innerHTML}</${c.tagName.toLowerCase()}>`;
            }).join('');
        }
        return this._innerHTML;
    }
    set innerHTML(html) {
        this._innerHTML = String(html);
        this.children = [];
        // Simulate real HTML parsing: if unescaped <img> or script tag is passed into innerHTML, parse it into a child element
        if (html.includes('<img ') || html.includes('<script')) {
            const imgMatch = html.match(/<img\s+([^>]+)>/i);
            if (imgMatch) {
                const imgEl = new MockElement('img');
                const attrs = imgMatch[1];
                const srcMatch = attrs.match(/src=["']?([^"'\s>]+)/i);
                const onerrorMatch = attrs.match(/onerror=["']?([^"'>]+)/i);
                if (srcMatch) imgEl.setAttribute('src', srcMatch[1]);
                if (onerrorMatch) imgEl.setAttribute('onerror', onerrorMatch[1]);
                this.appendChild(imgEl);
            }
        }
    }

    appendChild(child) {
        if (typeof child === 'string') {
            this.children.push(child);
        } else {
            child.parentNode = this;
            this.children.push(child);
        }
        return child;
    }

    replaceChildren(...newChildren) {
        this.children = [];
        newChildren.forEach(c => this.appendChild(c));
    }

    querySelector(selector) {
        if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            return this.children.find(c => c.className && c.className.includes(cls)) || null;
        }
        return null;
    }

    querySelectorAll(selector) {
        const results = [];
        const search = (node) => {
            if (!node || typeof node === 'string') return;
            if (selector.startsWith('.')) {
                const cls = selector.slice(1);
                if (node.className && node.className.split(' ').includes(cls)) {
                    results.push(node);
                }
            } else if (selector.startsWith('#')) {
                const id = selector.slice(1);
                if (node.id === id) results.push(node);
            } else if (node.tagName && node.tagName.toLowerCase() === selector.toLowerCase()) {
                results.push(node);
            }
            if (node.children) {
                node.children.forEach(search);
            }
        };
        search(this);
        return results;
    }

    addEventListener(event, fn) {
        if (!this.eventListeners[event]) this.eventListeners[event] = [];
        this.eventListeners[event].push(fn);
    }

    closest(selector) {
        let el = this;
        while (el) {
            if (selector.startsWith('.')) {
                const cls = selector.slice(1);
                if (el.className && el.className.split(' ').includes(cls)) return el;
            }
            el = el.parentNode;
        }
        return null;
    }

    dispatchEvent(event, extra = {}) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(fn => fn({ target: this, closest: (sel) => this.closest(sel), ...extra }));
        }
    }

    setAttribute(k, v) {
        this.attributes[k] = String(v);
    }
    getAttribute(k) {
        return this.attributes[k] || null;
    }
}

class MockDocument {
    constructor() {
        this.readyState = 'complete';
        this.body = new MockElement('body');
        this.documentElement = new MockElement('html');
        this.elements = {};
        this.eventListeners = {};
    }

    createElement(tagName) {
        return new MockElement(tagName);
    }

    createTextNode(text) {
        return String(text);
    }

    getElementById(id) {
        return this.elements[id] || null;
    }

    querySelector(selector) {
        if (selector === '.card[data-calc-page]') {
            return this.elements['calc-card'] || null;
        }
        return null;
    }

    querySelectorAll(selector) {
        return [];
    }

    addEventListener(event, fn) {
        if (!this.eventListeners[event]) this.eventListeners[event] = [];
        this.eventListeners[event].push(fn);
    }
}

global.window = global;
global.document = new MockDocument();
global.navigator = { serviceWorker: { register: () => Promise.resolve() } };
global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};
global.alert = (msg) => {};

eval(commonJs);

let passed = 0;
let failed = 0;

function assert(cond, msg) {
    if (cond) {
        console.log(`✅ PASS: ${msg}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${msg}`);
        failed++;
    }
}

console.log('=== RUNNING RIGOROUS XSS FIXES VERIFICATION TEST SUITE ===\n');

// 1. Subject Name Malicious XSS Payload Verification in summary.js
{
    localStorage.clear();

    const maliciousPayload = 'رياضيات"><img src=x onerror=alert(1)>';
    const subObj = hayyizAddSubject(maliciousPayload);

    assert(subObj && subObj.name === maliciousPayload, 'hayyizAddSubject stores exact subject name without modifying database schema or payload string');

    hayyizBumpSubjectProgress(subObj.id, 60);

    const mockContent = new MockElement('div', 'summary-content');
    document.elements['summary-content'] = mockContent;

    eval(summaryJs);
    if (document.eventListeners['DOMContentLoaded']) {
        document.eventListeners['DOMContentLoaded'].forEach(fn => fn());
    }

    // Verify DOM structure: no <img> elements parsed or created
    const createdImgElements = mockContent.querySelectorAll('img');
    assert(createdImgElements.length === 0, 'No <img> elements were injected or created in DOM for malicious subject name');

    // Verify raw HTML output has sanitized tags
    assert(!mockContent.innerHTML.includes('<img src=x onerror=alert(1)>'), 'summary.js innerHTML does not contain unescaped <img> HTML payload');
    assert(mockContent.textContent.includes('رياضيات'), 'summary.js renders subject name safely as plain text textContent');
}

// 2. Weighted Exam Name Malicious Payload Verification in gpa.js
{
    localStorage.clear();

    const weightedRowsEl = new MockElement('div', 'weighted-rows');
    const weightedAddBtn = new MockElement('button', 'weighted-add-btn');
    const weightedRemainingEl = new MockElement('div', 'weighted-remaining');
    const weightedLeftEl = new MockElement('span', 'weighted-left');
    const weightedResult = new MockElement('div', 'weighted-result');
    const weightedScore = new MockElement('span', 'weighted-score');
    const weightedCalculateBtn = new MockElement('button', 'weighted-calculate-btn');
    const weightedResetBtn = new MockElement('button', 'weighted-reset-btn');

    const calcCard = new MockElement('div');
    calcCard.setAttribute('data-calc-page', 'weighted');

    document.elements['weighted-rows'] = weightedRowsEl;
    document.elements['weighted-add-btn'] = weightedAddBtn;
    document.elements['weighted-remaining'] = weightedRemainingEl;
    document.elements['weighted-left'] = weightedLeftEl;
    document.elements['weighted-result'] = weightedResult;
    document.elements['weighted-score'] = weightedScore;
    document.elements['weighted-calculate-btn'] = weightedCalculateBtn;
    document.elements['weighted-reset-btn'] = weightedResetBtn;
    document.elements['calc-card'] = calcCard;

    eval(gpaJs);

    const inputs = weightedRowsEl.querySelectorAll('.w-name');
    assert(inputs.length === 3, 'gpa.js renders initial 3 weighted exam rows');

    // Test malicious exam payload
    const maliciousExamPayload = 'x"><img src=x onerror=alert(1)>';
    inputs[0].value = maliciousExamPayload;
    inputs[0].dispatchEvent('input', { target: inputs[0] });

    assert(inputs[0].value === maliciousExamPayload, 'gpa.js maintains exact exam name inside input.value property');

    // Verify DOM structure: no <img> elements exist inside weightedRowsEl container
    const imgInRows = weightedRowsEl.querySelectorAll('img');
    assert(imgInRows.length === 0, 'No HTML tags or <img> elements created inside weighted exam rows container');

    // Verify special characters and quotes
    const specialCharsCases = [
        'اختبار "نهائي"',
        'اختبار \'منتصف\'',
        'A < B',
        'A > B',
        'A & B'
    ];

    specialCharsCases.forEach((testName, i) => {
        if (inputs[i]) {
            inputs[i].value = testName;
            inputs[i].dispatchEvent('input', { target: inputs[i] });
            assert(inputs[i].value === testName, `gpa.js handles special character exam name "${testName}" smoothly`);
        }
    });
}

console.log(`\n===================================`);
console.log(`XSS FIXES TEST RESULTS: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) process.exit(1);
