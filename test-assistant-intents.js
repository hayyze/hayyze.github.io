const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const apiSource = fs.readFileSync('functions/api/assistant.js', 'utf8');
const clientSource = fs.readFileSync('assistant.js', 'utf8');

function extractFunction(source, name) {
    const asyncSignature = 'async function ' + name + '(';
    const regularSignature = 'function ' + name + '(';
    let start = source.indexOf(asyncSignature);
    const signature = start !== -1 ? asyncSignature : regularSignature;
    if (start === -1) start = source.indexOf(regularSignature);
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
    const sandbox = Object.assign({ Math, Date, String, Array, RegExp, Set, Map }, globals);
    const declarations = names.map(name => extractFunction(source, name)).join('\n');
    const expose = '\nthis.testApi = {' + names.join(',') + '};';
    vm.runInNewContext(declarations + expose, sandbox);
    return sandbox.testApi;
}

class FixedDate extends Date {
    constructor(...args) {
        if (args.length) super(...args);
        else super(2026, 10, 6, 12, 0, 0, 0);
    }
    static now() {
        return new Date(2026, 10, 6, 12, 0, 0, 0).getTime();
    }
}

const client = loadFunctions(clientSource, [
    'normalizeAssistantIntent',
    'normalizeAssistantDigits',
    'getRequestedDate',
    'getRequestedTime',
    'extractActionTitle',
    'inferActionProposal'
], { Date: FixedDate });

const api = loadFunctions(apiSource, [
    'readRequestBodyBounded',
    'normalizeArabicIntent',
    'normalizeContext',
    'getDeterministicReply',
    'getGeminiFailureCode',
    'extractCloudflareText',
    'getCloudflareFailureCode'
], { TextDecoder, Uint8Array });

// The production limiter must use the atomic, authenticated Supabase RPC.
assert.ok(apiSource.includes('/rest/v1/rpc/consume_ai_quota'));
assert.ok(apiSource.includes("'Authorization': 'Bearer ' + user.token"));
assert.ok(!apiSource.includes('AI_RATE_LIMIT'));
assert.ok(apiSource.includes('@cf/google/gemma-4-26b-a4b-it'));
assert.ok(apiSource.includes('result.choices'));
// Workers AI Gemma may return OpenAI-compatible choices, not only response/output.
assert.equal(api.extractCloudflareText({
    choices: [{ message: { role: 'assistant', content: 'الإجابة من Gemma' } }]
}), 'الإجابة من Gemma');
assert.equal(api.extractCloudflareText({
    choices: [{ message: { role: 'assistant', content: [{ type: 'text', text: 'نص ' }, { type: 'text', text: 'مركب' }] } }]
}), 'نص مركب');
assert.equal(api.extractCloudflareText({ response: ' استجابة مباشرة ' }), 'استجابة مباشرة');
assert.equal(api.extractCloudflareText({ choices: [] }), '');
assert.equal(api.getCloudflareFailureCode(new Error('CLOUDFLARE_AI_NOT_CONFIGURED')), 'ai_not_configured');
assert.equal(api.getCloudflareFailureCode({ status: 429, message: 'Too many requests' }), 'free_quota_exceeded');
assert.equal(api.getCloudflareFailureCode({ status: 403, message: 'Workers Paid required' }), 'plan_restriction');
assert.equal(api.getCloudflareFailureCode(new Error('CLOUDFLARE_EMPTY_RESPONSE')), 'empty_response');
assert.ok(!apiSource.includes('@cf/meta/llama-3.1-8b-instruct-fp8'));
assert.ok(apiSource.includes("env.GEMINI_ALLOW_EXTERNAL_PROVIDER === 'true'"));
assert.ok(apiSource.includes("chat_template_kwargs: { enable_thinking: false }"));

// Gemini failure statuses are reduced to safe, actionable diagnostic codes.
assert.equal(api.getGeminiFailureCode(400, 'INVALID_ARGUMENT', ''), 'invalid_request');
assert.equal(api.getGeminiFailureCode(400, '', 'API key not valid. Please pass a valid API key.'), 'invalid_api_key');
assert.equal(api.getGeminiFailureCode(401, '', ''), 'unauthorized');
assert.equal(api.getGeminiFailureCode(403, 'PERMISSION_DENIED', ''), 'forbidden');
assert.equal(api.getGeminiFailureCode(404, 'NOT_FOUND', ''), 'model_not_found');
assert.equal(api.getGeminiFailureCode(429, 'RESOURCE_EXHAUSTED', ''), 'rate_limited');
assert.equal(api.getGeminiFailureCode(503, '', ''), 'upstream_unavailable');
assert.equal(api.getGeminiFailureCode(0, '', ''), 'provider_error');

// Deterministic Newton answer must separate the three laws from universal gravitation.
const newton = api.getDeterministicReply('وش قوانين نيوتن؟', [], null);
assert.equal(newton.provider, 'knowledge');
assert.match(newton.reply, /القصور الذاتي/);
assert.match(newton.reply, /F = ma/);
assert.match(newton.reply, /الفعل ورد الفعل/);
assert.match(newton.reply, /قانون الجذب العام/);
assert.equal(newton.reply.split('\n').length, 5, 'Newton answer has readable line breaks');

const application = api.getDeterministicReply('وين استخدموها العلماء؟', [
    { role: 'user', content: 'اخبرني ماهي قوانين نيوتن الثلاثة؟' }
], null);
assert.equal(application.provider, 'knowledge');
assert.match(application.reply, /السيارات/);
assert.match(application.reply, /الأقمار الصناعية/);

// Greeting behavior differs between a new chat and an existing conversation.
assert.match(api.getDeterministicReply('السلام عليكم', [], null).reply, /وعليكم السلام/);
assert.match(api.getDeterministicReply('السلام عليكم', [{ role: 'user', content: 'سؤال سابق' }], null).reply, /نكمل من حيث توقفنا/);

// A real study schedule is concise and honors the shared focus preference.
const schedule = api.getDeterministicReply('كيف أوزع وقت المذاكرة على جلسات تركيز واستراحات؟', [], { workMin: 40 });
assert.equal(schedule.provider, 'study-plan');
assert.match(schedule.reply, /40 دقيقة/);
assert.match(schedule.reply, /استراحة 5 دقائق/);

// Priority suggestions must come from the exact supplied ranked tasks.
const context = api.normalizeContext({
    tasks: [
        { id: 'a', title: 'مراجعة الفصل الثالث', priority: 'high', completed: false },
        { id: 'b', title: 'حل مسائل الحركة', priority: 'medium', completed: false },
        { id: 'c', title: 'تلخيص الدرس', priority: 'medium', completed: false },
        { id: 'd', title: 'واجب الفيزياء', priority: 'low', completed: false }
    ],
    priorityTasks: [
        { id: 'a', title: 'مراجعة الفصل الثالث', reasons: ['موعدها قريب'] },
        { id: 'b', title: 'حل مسائل الحركة', reasons: ['أولوية عالية'] },
        { id: 'c', title: 'تلخيص الدرس', reasons: ['مجدولة اليوم'] },
        { id: 'd', title: 'واجب الفيزياء', reasons: ['أولوية منخفضة'] }
    ],
    otherTasks: [{ id: 'd', title: 'واجب الفيزياء', completed: false }]
});
const priorities = api.getDeterministicReply('ساعدني في تحديد أهم ثلاث أولويات دراسية اليوم.', [], context);
assert.equal(priorities.provider, 'priorities');
assert.match(priorities.reply, /مراجعة الفصل الثالث/);
assert.match(priorities.reply, /حل مسائل الحركة/);
assert.match(priorities.reply, /تلخيص الدرس/);
assert.doesNotMatch(priorities.reply, /الرياضيات|الكيمياء/);

const why = api.getDeterministicReply('كيف حددتها؟', [{ role: 'assistant', content: priorities.reply }], context);
assert.match(why.reply, /موعدها قريب/);
const alternatives = api.getDeterministicReply('لماذا لم تختر مهام غيرها؟', [], context);
assert.match(alternatives.reply, /واجب الفيزياء/);

const noContext = api.getDeterministicReply('ما أولوياتي اليوم؟', [], null);
assert.equal(noContext.provider, 'data-required');
assert.match(noContext.reply, /لن أخترع/);

const mismatch = api.getDeterministicReply('بس ما فيه مهام بذا الاسم؟', [], context);
assert.match(mismatch.reply, /هذه أسماء المهام غير المكتملة/);
assert.match(mismatch.reply, /واجب الفيزياء/);

// Natural Arabic task creation and next-weekday calculation.
const todoProposal = client.inferActionProposal(
    'أنشئ مهمة يوم الاثنين القادم باسم اختبار الفيزياء.',
    []
);
assert.equal(todoProposal.kind, 'todo');
assert.equal(todoProposal.data.text, 'اختبار الفيزياء');
assert.equal(todoProposal.data.date, '2026-11-09');
assert.equal(todoProposal.data.completed, false);

// Calendar task with an explicit Gregorian date and an Arabic-word time.
const calendarProposal = client.inferActionProposal(
    'أنشئ مهمة في تقويم الطالب باسم "اختبار الذكاء الاصطناعي" وموعدها الساعة تسعة و22 دقيقة 2026 شهر 12 يوم 1',
    []
);
assert.equal(calendarProposal.kind, 'calendar');
assert.equal(calendarProposal.data.type, 'assignment');
assert.equal(calendarProposal.data.name, 'اختبار الذكاء الاصطناعي');
assert.equal(calendarProposal.data.date, '2026-12-01');
assert.equal(calendarProposal.data.time, '09:22');

// Arabic numerals and numeric time formats are parsed accurately.
assert.equal(client.getRequestedDate('2026 شهر ١٢ يوم ١'), '2026-12-01');
assert.equal(client.getRequestedDate('2026-12-01'), '2026-12-01');
assert.equal(client.getRequestedTime('الساعة 9:22'), '09:22');
assert.equal(client.getRequestedTime('الساعة تسعة و22 دقيقة'), '09:22');

// Incomplete creation asks for the missing field instead of claiming success.
const missingDate = client.inferActionProposal('أنشئ مهمة باسم مراجعة الفيزياء', []);
assert.equal(missingDate.needsClarification, true);
assert.match(missingDate.reply, /ما التاريخ/);
const missingTitle = client.inferActionProposal('أنشئ موعد يوم الاثنين القادم', []);
assert.equal(missingTitle.needsClarification, true);
assert.match(missingTitle.reply, /ما اسم الموعد/);

// Ordinary questions that merely mention a weekday are not interpreted as commands.
assert.equal(client.inferActionProposal('ما معنى موعد يوم الاثنين؟', []), null);

console.log('PASS assistant knowledge, no-hallucination priorities, greeting, date/time parsing and confirmed task/calendar proposals');


(async () => {
    const streamRequest = (chunks, contentLength = null) => {
        let index = 0;
        let cancelled = false;
        return {
            cancelled: () => cancelled,
            headers: {
                get(name) {
                    return name.toLowerCase() === 'content-length' ? contentLength : null;
                }
            },
            body: {
                getReader() {
                    return {
                        async read() {
                            return index < chunks.length
                                ? { done: false, value: chunks[index++] }
                                : { done: true, value: undefined };
                        },
                        async cancel() { cancelled = true; },
                        releaseLock() {}
                    };
                }
            }
        };
    };

    const encoded = new TextEncoder().encode('طلب عربي آمن');
    const acceptedRequest = streamRequest([encoded.slice(0, 5), encoded.slice(5)]);
    const accepted = await api.readRequestBodyBounded(acceptedRequest, 24000);
    assert.equal(accepted.text, 'طلب عربي آمن');
    assert.equal(accepted.tooLarge, false);

    const oversizedRequest = streamRequest([
        new Uint8Array(15000),
        new Uint8Array(10000)
    ]);
    const oversized = await api.readRequestBodyBounded(oversizedRequest, 24000);
    assert.equal(oversized.tooLarge, true);
    assert.equal(oversizedRequest.cancelled(), true);

    const declaredOversized = await api.readRequestBodyBounded(
        streamRequest([], '25000'),
        24000
    );
    assert.equal(declaredOversized.tooLarge, true);

    // Preserve the previous 24,000 UTF-16-code-unit limit for Arabic content.
    const arabicAtBoundaryBytes = new TextEncoder().encode('ا'.repeat(24000));
    const arabicBoundary = await api.readRequestBodyBounded(
        streamRequest([arabicAtBoundaryBytes], String(arabicAtBoundaryBytes.byteLength)),
        72000
    );
    assert.equal(arabicBoundary.tooLarge, false);
    assert.equal(arabicBoundary.text.length, 24000);

    const arabicOverLimitBytes = new TextEncoder().encode('ا'.repeat(24001));
    const arabicOverLimit = await api.readRequestBodyBounded(
        streamRequest([arabicOverLimitBytes], String(arabicOverLimitBytes.byteLength)),
        72000
    );
    assert.equal(arabicOverLimit.tooLarge, true);

    // Three-byte UTF-8 code points must also stop at the streaming byte ceiling.
    const byteOverLimit = await api.readRequestBodyBounded(
        streamRequest([new TextEncoder().encode('\u0800'.repeat(24001))], '72003'),
        72000
    );
    assert.equal(byteOverLimit.tooLarge, true);

    // ASCII input keeps the former character ceiling; it is not widened to 72 KB.
    const asciiOverLimit = await api.readRequestBodyBounded(
        streamRequest([new TextEncoder().encode('a'.repeat(24001))], '24001'),
        72000
    );
    assert.equal(asciiOverLimit.tooLarge, true);

    const invalidUtf8 = await api.readRequestBodyBounded(
        streamRequest([new Uint8Array([0xC3, 0x28])]),
        24000
    );
    assert.equal(invalidUtf8.invalidText, true);
    console.log('PASS assistant request body streaming limit, cancellation and UTF-8 validation');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
