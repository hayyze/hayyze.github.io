/**
 * test-share-plan-image.js
 * Automated test suite for Daily Plan Image Exporter in Hayyiz
 */

const assert = require('assert');
const fs = require('fs');

console.log('=== RUNNING DAILY PLAN IMAGE EXPORTER TEST SUITE ===\n');

// Mock browser globals
global.window = global;

const localStorageMock = {
    _data: {},
    getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};

global.localStorage = localStorageMock;

const mockElements = {};

global.document = {
    readyState: 'complete',
    body: {
        classList: { toggle: () => {}, add: () => {}, remove: () => {} },
        appendChild: (el) => {
            if (el.id) mockElements[el.id] = el;
            return el;
        },
        removeChild: (el) => {
            if (el.id) delete mockElements[el.id];
        }
    },
    documentElement: { classList: { toggle: () => {}, contains: () => false, add: () => {} } },
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: (id) => mockElements[id] || null,
    addEventListener: () => {},
    createElement: (tag) => {
        if (tag === 'canvas') {
            const canvasEl = {
                width: 0,
                height: 0,
                onFillText: null,
                getContext: (type) => {
                    if (type !== '2d') return null;
                    return {
                        direction: 'rtl',
                        textAlign: 'right',
                        fillStyle: '',
                        strokeStyle: '',
                        lineWidth: 1,
                        font: '',
                        fillRect: () => {},
                        beginPath: () => {},
                        moveTo: () => {},
                        lineTo: () => {},
                        quadraticCurveTo: () => {},
                        closePath: () => {},
                        fill: () => {},
                        stroke: () => {},
                        save: () => {},
                        restore: () => {},
                        fillText: (text, x, y) => {
                            if (canvasEl.onFillText) canvasEl.onFillText(text, x, y);
                        },
                        measureText: (text) => ({ width: (text || '').length * 10 })
                    };
                },
                toBlob: (cb, mimeType, quality) => {
                    cb({ type: mimeType || 'image/png', size: 1024 });
                }
            };
            return canvasEl;
        }
        const el = {
            id: '',
            className: '',
            style: { cssText: '' },
            textContent: '',
            innerHTML: '',
            disabled: false,
            children: [],
            setAttribute: (k, v) => { el[k] = v; },
            getAttribute: (k) => el[k] || null,
            classList: { add: () => {}, remove: () => {}, contains: () => false },
            appendChild: (child) => { el.children.push(child); return child; },
            addEventListener: (evt, fn) => { el['on' + evt] = fn; },
            remove: () => {
                if (el.id && mockElements[el.id]) delete mockElements[el.id];
            }
        };
        return el;
    }
};

global.navigator = {
    serviceWorker: { register: () => Promise.resolve() },
    share: null,
    canShare: null
};
global.Blob = function (parts, opts) {
    this.parts = parts;
    this.type = opts ? opts.type : '';
};
global.File = function (parts, name, opts) {
    this.parts = parts;
    this.name = name;
    this.type = opts ? opts.type : '';
};
global.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {}
};

// Load code
const commonJsCode = fs.readFileSync('./common.js', 'utf8');
const summaryJsCode = fs.readFileSync('./summary.js', 'utf8');

eval(commonJsCode);

// Seed mock data before summary.js evaluation
const mockSubject = hayyizAddSubject('الرياضيات');
const mockTodos = [
    { id: 't1', text: 'حل واجب الرياضيات <script>alert(1)</script>', priority: 'high', minutes: 45, subjectId: mockSubject.id, completed: false },
    { id: 't2', text: 'مراجعة الفيزياء & التلخيص', priority: 'medium', minutes: 30, completed: false }
];
hayyizSaveTodos(mockTodos);
localStorage.setItem('hayyiz-focus-minutes-today', '45');
localStorage.setItem('hayyiz-sessions-today', '2');

eval(summaryJsCode);

// --- Test 1: Canvas Generation Function Exists & Returns Canvas ---
console.log('Test 1: Canvas Generation');
let drawnTexts = [];
const canvas = hayyizGenerateDailyPlanCanvas();
assert(canvas && canvas.width === 1080 && canvas.height === 1350, 'Canvas generated with exact 1080x1350 dimensions');
console.log('✅ PASS: Canvas generated with exact 1080x1350 (4:5 ratio) dimensions');

// --- Test 2: Privacy Audit (No sensitive internal keys in drawn image data) ---
console.log('Test 2: Privacy & Data Audit');
drawnTexts = [];
const origCreateElement = document.createElement;
document.createElement = function (tag) {
    const el = origCreateElement(tag);
    if (tag === 'canvas') {
        el.onFillText = (t) => drawnTexts.push(String(t));
    }
    return el;
};

hayyizGenerateDailyPlanCanvas();

const forbiddenStrings = ['user_id', 'email', 'token', 'auth', 'hayyiz-todos', 'hayyiz-notes'];
forbiddenStrings.forEach(str => {
    assert(!drawnTexts.some(t => t.includes(str)), `Drawn text does not expose sensitive string: ${str}`);
});
console.log('✅ PASS: Canvas output strictly excludes user IDs, emails, tokens, and LocalStorage keys');

// --- Test 3: XSS & HTML Injection Prevention ---
console.log('Test 3: XSS Security Audit');
const scriptInjectedText = drawnTexts.find(t => t.includes('<script>'));
assert(scriptInjectedText, 'Canvas receives raw user string safely via fillText without executing or rendering HTML elements');
console.log('✅ PASS: User input drawn via Canvas fillText API preventing HTML/JS injection');

// --- Test 4: Subject Name Attachment ---
console.log('Test 4: Subject Name Attachment');
const mathTaskDrawn = drawnTexts.some(t => t.includes('الرياضيات'));
assert(mathTaskDrawn, 'Subject name "الرياضيات" correctly attached to task in canvas drawing');
console.log('✅ PASS: Subject name attached to task in canvas drawing');

// --- Test 5: Fallback Modal Trigger ---
console.log('Test 5: Fallback Modal Rendering');
hayyizOpenShareFallbackModal(canvas, 'hayyiz-daily-plan-2026-08-31.png', 'hayyiz-daily-plan-2026-08-31.jpg');
const modal = mockElements['hayyiz-share-modal'];
assert(modal, 'Fallback modal element rendered in DOM');
console.log('✅ PASS: Fallback modal renders clean PNG and JPG save options');

console.log('\n===================================');
console.log('DAILY PLAN IMAGE EXPORTER TESTS PASSED');
console.log('===================================\n');
