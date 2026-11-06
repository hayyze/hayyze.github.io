const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const apiSource = fs.readFileSync('functions/api/assistant.js', 'utf8');
const clientSource = fs.readFileSync('assistant.js', 'utf8');

function extractFunction(source, name) {
    const signature = 'function ' + name + '(';
    const start = source.indexOf(signature);
    assert.notEqual(start, -1, 'Missing function: ' + name);
    const open = source.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
        if (source[i] === '{') depth++;
        if (source[i] === '}') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error('Unclosed function: ' + name);
}

function loadFunctions(source, names, globals = {}) {
    const sandbox = Object.assign({ Math, Date, String, Array, RegExp }, globals);
    const declarations = names.map(name => extractFunction(source, name)).join('\n');
    const expose = '\nthis.testApi = {' + names.join(',') + '};';
    vm.runInNewContext(declarations + expose, sandbox);
    return sandbox.testApi;
}

const api = loadFunctions(apiSource, ['normalizeArabicIntent', 'getDeterministicReply']);
const client = loadFunctions(clientSource, ['normalizeAssistantIntent', 'inferCalendarProposal']);

const question = api.getDeterministicReply('وش قوانين نيوتن؟', []);
assert.equal(question.provider, 'knowledge');
assert.match(question.reply, /القصور الذاتي/);
assert.match(question.reply, /F = ma/);
assert.match(question.reply, /الفعل ورد الفعل/);
assert.match(question.reply, /قانون الجذب العام/);
assert.equal(question.reply.split('\n').length, 5, 'Newton answer uses readable separate lines');

const history = [
    { role: 'user', content: 'وش قوانين نيوتن؟' },
    { role: 'assistant', content: 'شرح قوانين نيوتن الثلاثة.' },
    { role: 'user', content: 'عندي اختبار الاثنين.' }
];
const request = 'انشئ موعد يوم الاثنين القادم.';
const actionGuard = api.getDeterministicReply(request, history);
assert.equal(actionGuard.provider, 'capability');
assert.match(actionGuard.reply, /لم أُنشئ الموعد/);

class FixedDate extends Date {
    constructor(...args) {
        if (args.length) super(...args);
        else super(2026, 10, 6, 12, 0, 0, 0);
    }
}
const fixedClient = loadFunctions(clientSource, ['normalizeAssistantIntent', 'inferCalendarProposal'], { Date: FixedDate });
const proposal = fixedClient.inferCalendarProposal(request, history);
assert.ok(proposal, 'Arabic create command + weekday produces a proposal');
assert.equal(proposal.date, '2026-11-09', 'Next Monday from Friday 6 Nov 2026 is Monday 9 Nov 2026');
assert.equal(proposal.name, 'اختبار قوانين نيوتن');
assert.equal(proposal.type, 'exam');
assert.equal(proposal.time, '', 'Missing time remains explicitly unset');

const addRequest = fixedClient.inferCalendarProposal('أضف موعد يوم الخميس القادم.', []);
assert.ok(addRequest);
assert.equal(addRequest.date, '2026-11-12');
assert.equal(addRequest.type, 'personal');
assert.equal(fixedClient.inferCalendarProposal('ما معنى موعد يوم الاثنين؟', history), null,
    'A question mentioning a weekday is not treated as an action');

console.log('PASS assistant factual grounding, Arabic intent normalization, date inference and confirmed-event proposal');
