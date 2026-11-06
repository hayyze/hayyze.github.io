(function () {
    'use strict';

    const CHAT_KEY = 'hayyiz-ai-chat-v1';
    const MAX_HISTORY = 10;
    const $ = (id) => document.getElementById(id);
    const app = $('assistant-app');
    const authRequired = $('assistant-auth-required');
    const messagesEl = $('assistant-messages');
    const form = $('assistant-form');
    const input = $('assistant-input');
    const sendButton = $('assistant-send');
    const statusEl = $('assistant-status');
    const countEl = $('assistant-char-count');
    let sending = false;
    let history = [];

    function readHistory() {
        try {
            const value = JSON.parse(hayyizStorage.getItem(CHAT_KEY) || '[]');
            return Array.isArray(value) ? value.filter(item =>
                item && ['user', 'assistant'].includes(item.role) &&
                typeof item.content === 'string' && item.content.length <= 2000
            ).slice(-30) : [];
        } catch (_) { return []; }
    }

    function saveHistory() {
        try { hayyizStorage.setItem(CHAT_KEY, JSON.stringify(history.slice(-30))); }
        catch (_) { setStatus('تعذر حفظ سجل المحادثة محليًا.'); }
    }

    function setStatus(message, error) {
        statusEl.textContent = message || '';
        statusEl.classList.toggle('error', Boolean(error));
    }

    function addMessage(role, content) {
        const welcome = messagesEl.querySelector('.assistant-welcome');
        if (welcome) welcome.remove();
        const item = document.createElement('div');
        item.className = 'assistant-message ' + role;
        const label = document.createElement('span');
        label.className = 'assistant-message-label';
        label.textContent = role === 'user' ? 'أنت' : 'مساعد حيز';
        const body = document.createElement('div');
        body.textContent = content;
        item.append(label, body);
        messagesEl.appendChild(item);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return item;
    }

    function renderHistory() {
        messagesEl.replaceChildren();
        if (!history.length) {
            const welcome = document.createElement('div');
            welcome.className = 'assistant-welcome';
            const icon = document.createElement('span');
            icon.className = 'assistant-welcome-icon';
            const glyph = document.createElement('i');
            glyph.className = 'fa-solid fa-lightbulb';
            glyph.setAttribute('aria-hidden', 'true');
            icon.appendChild(glyph);
            const heading = document.createElement('h2');
            heading.textContent = 'ما الذي تريد إنجازه؟';
            const description = document.createElement('p');
            description.textContent = 'يمكنني مساعدتك في تحديد الخطوة الدراسية التالية وبناء خطة قابلة للتنفيذ.';
            welcome.append(icon, heading, description);
            messagesEl.appendChild(welcome);
            return;
        }
        history.forEach(item => addMessage(item.role, item.content));
    }

    function safeParse(key, fallback) {
        try {
            const raw = hayyizStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (_) { return fallback; }
    }

    function shortText(value, max) {
        return typeof value === 'string' ? value.trim().slice(0, max) : '';
    }

    function buildStudyContext() {
        const todos = safeParse('hayyiz-todos', []);
        const subjects = typeof hayyizGetSubjects === 'function'
            ? hayyizGetSubjects()
            : safeParse('hayyiz-subjects', []);
        const exams = typeof hayyizGetExams === 'function'
            ? hayyizGetExams()
            : [].concat(safeParse('hayyiz-student-exams', []), safeParse('hayyiz-exams', []));
        const goals = typeof hayyizGetGoals === 'function'
            ? hayyizGetGoals()
            : safeParse('hayyiz-goals', []);
        const academicGoal = safeParse('hayyiz-academic-goal', null);
        const subjectNames = new Map((Array.isArray(subjects) ? subjects : [])
            .filter(subject => subject && subject.id && subject.name)
            .map(subject => [subject.id, shortText(subject.name, 60)]));

        const tasks = Array.isArray(todos) ? todos.slice(0, 25).map(task => ({
            id: shortText(task && task.id, 100),
            title: shortText(task && (task.text || task.title || task.name), 120),
            dueDate: shortText(task && (task.date || task.dueDate || task.deadline), 32),
            priority: shortText(task && task.priority, 20) || 'medium',
            completed: Boolean(task && (task.completed || task.done)),
            subject: shortText(task && (task.subjectName || task.subject || subjectNames.get(task.subjectId)), 60),
            focusDone: Math.max(0, Number(task && task.focusDone) || 0),
            minutes: Math.max(0, Number(task && task.minutes) || 0)
        })).filter(task => task.title) : [];

        const subjectList = Array.isArray(subjects) ? subjects.slice(0, 15).map(subject => ({
            id: shortText(subject && subject.id, 100),
            name: shortText(subject && (subject.name || subject.title), 60)
        })).filter(subject => subject.name) : [];

        const examList = Array.isArray(exams) ? exams.slice(0, 15).map(exam => ({
            id: shortText(exam && exam.id, 100),
            name: shortText(exam && (exam.name || exam.title || exam.subject), 100),
            date: shortText(exam && (exam.date || exam.examDate), 32),
            done: Boolean(exam && exam.done)
        })).filter(exam => exam.name || exam.date) : [];

        const goalList = Array.isArray(goals) ? goals.slice(0, 10).map(goal => ({
            title: shortText(goal && (goal.title || goal.name || goal.text), 100),
            dueDate: shortText(goal && (goal.date || goal.dueDate), 32)
        })).filter(goal => goal.title) : [];

        let ranked = [];
        let today = typeof getTodayLocal === 'function' ? getTodayLocal() : '';
        let focusMinutesToday = Number(safeParse('hayyiz-focus-minutes-today', 0)) || 0;
        let workMin = Number(safeParse('hayyiz-pref-work', 25)) || 25;
        try {
            if (typeof hayyizComputeStudentDecisionState === 'function') {
                const state = hayyizComputeStudentDecisionState();
                today = state.today || today;
                focusMinutesToday = Number(state.focusMinutesToday) || 0;
                workMin = Number(state.workMin) || workMin;
                ranked = Array.isArray(state.rankedTasks) ? state.rankedTasks : [];
            }
        } catch (_) {
            ranked = [];
        }

        const toRankedItem = row => {
            const task = row && row.task;
            if (!task || !task.id || !task.text || task.completed) return null;
            return {
                id: shortText(task.id, 100),
                title: shortText(task.text, 120),
                dueDate: shortText(task.date, 32),
                priority: shortText(task.priority, 20) || 'medium',
                subject: shortText(task.subjectName || task.subject || subjectNames.get(task.subjectId), 60),
                inProgress: (Number(task.focusDone) || 0) > 0,
                reasons: Array.isArray(row.reasons) ? row.reasons.slice(0, 3).map(reason => shortText(reason, 120)) : []
            };
        };

        const rankedItems = ranked.map(toRankedItem).filter(Boolean);
        const rankedIds = new Set(rankedItems.map(item => item.id));
        const otherTasks = rankedItems.slice(3).concat(
            tasks.filter(task => !task.completed && !rankedIds.has(task.id))
        ).slice(0, 20);

        const target = academicGoal && typeof academicGoal === 'object' ? {
            target: academicGoal.target ?? academicGoal.targetGpa ?? academicGoal.goal ?? null,
            current: academicGoal.current ?? academicGoal.currentGpa ?? null
        } : null;

        return {
            today,
            tasks,
            subjects: subjectList,
            exams: examList,
            goals: goalList,
            academicGoal: target,
            priorityTasks: rankedItems.slice(0, 5),
            otherTasks,
            focusMinutesToday,
            workMin
        };
    }

    function normalizeAssistantIntent(value) {
        return String(value || '')
            .normalize('NFKD')
            .replace(/[\u064B-\u065F\u0670]/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/[؟?!.,،؛:]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function normalizeAssistantDigits(value) {
        const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
        return String(value || '').replace(/[٠-٩]/g, digit => String(arabicDigits.indexOf(digit)));
    }

    function getRequestedDate(value) {
        const text = normalizeAssistantIntent(normalizeAssistantDigits(value));
        let match = text.match(/(?:^|\D)(20\d{2})\s*(?:شهر|[-/])\s*(\d{1,2})\s*(?:يوم|[-/])\s*(\d{1,2})(?:\D|$)/);
        if (match) {
            const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
            const date = new Date(year, month - 1, day, 12);
            if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
            return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
        }

        const weekdays = [
            { names: ['الاحد', 'sunday'], day: 0 },
            { names: ['الاثنين', 'monday'], day: 1 },
            { names: ['الثلاثاء', 'tuesday'], day: 2 },
            { names: ['الاربعاء', 'wednesday'], day: 3 },
            { names: ['الخميس', 'thursday'], day: 4 },
            { names: ['الجمعه', 'friday'], day: 5 },
            { names: ['السبت', 'saturday'], day: 6 }
        ];
        const dayMatch = weekdays.find(item => item.names.some(name => text.includes(name)));
        if (!dayMatch) return null;

        const date = new Date();
        date.setHours(12, 0, 0, 0);
        const daysAhead = (dayMatch.day - date.getDay() + 7) % 7 || 7;
        date.setDate(date.getDate() + daysAhead);
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');
    }

    function getRequestedTime(value) {
        const text = normalizeAssistantIntent(normalizeAssistantDigits(value));
        let match = text.match(/(?:الساعه\s*)?(\d{1,2})[:٫.](\d{2})/);
        if (!match) match = text.match(/(?:الساعه\s*)?(\d{1,2})\s*و\s*(\d{1,2})\s*دقيقه/);

        let hour = null, minute = 0;
        if (match) {
            hour = Number(match[1]);
            minute = Number(match[2]);
        } else {
            const words = {
                واحد: 1, واحده: 1, احد: 1, احدى: 1,
                اثنين: 2, اثنتين: 2,
                ثلاث: 3, ثلاثه: 3,
                اربع: 4, اربعه: 4,
                خمس: 5, خمسه: 5,
                ست: 6, سته: 6,
                سبع: 7, سبعه: 7,
                ثمان: 8, ثمانيه: 8,
                تسع: 9, تسعه: 9,
                عشر: 10, عشره: 10,
                احدعشر: 11, احدعشره: 11,
                اثناعشر: 12, اثناعشره: 12
            };
            const wordPattern = Object.keys(words).sort((a, b) => b.length - a.length).join('|');
            const wordMatch = text.match(new RegExp('الساعه\\s*(' + wordPattern + ')(?:\\s*و\\s*(\\d{1,2})\\s*دقيقه)?'));
            if (!wordMatch) return null;
            hour = words[wordMatch[1]];
            minute = wordMatch[2] ? Number(wordMatch[2]) : 0;
        }

        if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
        return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
    }

    function extractActionTitle(value) {
        const raw = String(value || '');
        const quoted = raw.match(/["“«]([^"”»]+)["”»]/);
        if (quoted && quoted[1].trim()) return quoted[1].trim().slice(0, 120);

        const named = raw.match(/(?:باسم|اسمها|اسمه|اسم|بعنوان)\s*[:：]?\s*(.+?)(?=\s*(?:و?موعدها|و?تاريخها|بتاريخ|في\s+يوم|يوم|الساعة|ساعه|وقتها|وقت(?:ها)?|موعد)\b|[،,؛;]|$)/i);
        if (named && named[1].trim()) {
            return named[1].trim().replace(/[.!؟?،,؛;]+$/g, '').slice(0, 120);
        }
        return '';
    }

    function inferActionProposal(message, previousHistory) {
        const currentText = normalizeAssistantIntent(message);
        const actionVerb = /(انشئ|انشي|انشاء|اضف|اضافه|اضيف|تضيف|ضيف|سجل|تسجل|احجز|حدد|اعمل|حط|تسوي|سوي|تنشئ|create|add|schedule)/.test(currentText);
        const hasTaskWord = /(مهمه|مهام|task)/.test(currentText);
        const hasCalendarWord = /(موعد|حدث|تذكير|تقويم الطالب|في التقويم|بالتقويم|appointment|event)/.test(currentText);
        const hasExamWord = /(اختبار|امتحان)/.test(currentText);

        if (!actionVerb || (!hasTaskWord && !hasCalendarWord && !hasExamWord)) return null;

        const isTaskInCalendar = hasTaskWord && /(تقويم الطالب|في التقويم|بالتقويم)/.test(currentText);
        const kind = hasTaskWord && !isTaskInCalendar ? 'todo' : 'calendar';
        const title = extractActionTitle(message);
        const dateInMessage = getRequestedDate(message);
        const timeInMessage = getRequestedTime(message);
        const lastPriorUser = (previousHistory || []).filter(item => item && item.role === 'user').slice(-1)[0];
        const priorText = lastPriorUser ? lastPriorUser.content : '';
        const priorIsRelated = /(اختبار|امتحان|مهمه|موعد|حدث|تذكير)/.test(normalizeAssistantIntent(priorText));
        const date = dateInMessage || (priorIsRelated ? getRequestedDate(priorText) : null);
        const time = timeInMessage || (priorIsRelated ? getRequestedTime(priorText) : null);
        const mentionsTime = /(الساعه|دقيقه|[:٫.])/.test(currentText) ||
            (priorIsRelated && /(الساعه|دقيقه|[:٫.])/.test(normalizeAssistantIntent(priorText)));

        if (mentionsTime && !time) {
            return {
                needsClarification: true,
                reply: 'لم أتمكن من فهم الوقت بدقة. اكتبه بصيغة 09:22 أو «الساعة تسعة و22 دقيقة».'
            };
        }

        if (!title) {
            return {
                needsClarification: true,
                reply: kind === 'todo' ? 'ما اسم المهمة التي تريد إضافتها؟' : 'ما اسم الموعد أو الحدث الذي تريد إضافته إلى التقويم؟'
            };
        }
        if (!date) {
            return {
                needsClarification: true,
                reply: 'ما التاريخ الذي تريد تحديده؟ اذكر يومًا واضحًا أو تاريخًا مثل 2026-12-01.'
            };
        }

        const now = Date.now();
        if (kind === 'todo') {
            return {
                kind,
                data: {
                    id: 'ai_task_' + now.toString(36) + Math.random().toString(36).slice(2, 6),
                    text: title,
                    taskType: 'general',
                    priority: 'medium',
                    date: time ? date + 'T' + time : date,
                    minutes: null,
                    subjectId: null,
                    goalId: null,
                    completed: false,
                    status: 'todo',
                    created: now,
                    updated: now,
                    focusDone: 0,
                    sessionsDone: 0
                }
            };
        }

        const explicitTaskCalendar = isTaskInCalendar;
        const isExam = hasExamWord && !explicitTaskCalendar;
        return {
            kind: 'calendar',
            data: {
                id: (isExam ? 'ex_' : 'ev_') + now.toString(36) + Math.random().toString(36).slice(2, 6),
                name: title,
                type: explicitTaskCalendar ? 'assignment' : (isExam ? 'exam' : 'personal'),
                date,
                time: time || '',
                subjectId: null,
                updated: now
            }
        };
    }

    function addLocalAssistantReply(reply, providerLabel) {
        history.push({ role: 'assistant', content: reply });
        history = history.slice(-30);
        saveHistory();
        addMessage('assistant', reply);
        $('assistant-provider-status').textContent = providerLabel || 'مساعد حيز';
        setStatus('');
    }

    function showActionProposal(proposal) {
        const data = proposal.data;
        const date = data.date.includes('T') ? data.date.slice(0, 10) : data.date;
        const time = proposal.kind === 'todo'
            ? (data.date.includes('T') ? data.date.slice(11, 16) : '')
            : (data.time || '');
        const parts = date.split('-').map(Number);
        const localDate = new Date(parts[0], parts[1] - 1, parts[2], 12);
        const dateLabel = localDate.toLocaleDateString('ar-SA', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', calendar: 'gregory'
        });
        const isTodo = proposal.kind === 'todo';
        const label = isTodo ? 'المهمة' : 'موعد التقويم';
        const summary = 'أقترح إضافة ' + label + ' التالي:' + '\n' +
            'الاسم: ' + (isTodo ? data.text : data.name) + '\n' +
            'التاريخ: ' + dateLabel + '\n' +
            'الوقت: ' + (time || 'غير محدد') + '\n' +
            'لم يُحفظ شيء بعد. راجع التفاصيل ثم أكّد الإضافة.';
        const messageNode = addMessage('assistant', summary);

        const actions = document.createElement('div');
        actions.className = 'assistant-proposal-actions';
        const confirmButton = document.createElement('button');
        confirmButton.type = 'button';
        confirmButton.className = 'btn btn-primary';
        confirmButton.textContent = isTodo ? 'تأكيد وإضافة المهمة' : 'تأكيد وإضافة الموعد';
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'btn btn-secondary';
        cancelButton.textContent = 'ليس الآن';

        confirmButton.addEventListener('click', async () => {
            confirmButton.disabled = true;
            cancelButton.disabled = true;
            confirmButton.textContent = 'جارٍ الحفظ...';
            try {
                if (isTodo) {
                    const saved = hayyizStorage.getItem('hayyiz-todos');
                    const list = saved ? JSON.parse(saved) : [];
                    const todos = Array.isArray(list) ? list : [];
                    const duplicate = todos.find(item => item && item.text === data.text && item.date === data.date && !item.completed);
                    if (!duplicate) {
                        const nextTodos = [data].concat(todos);
                        if (typeof hayyizSaveTodos === 'function') hayyizSaveTodos(nextTodos);
                        else hayyizStorage.setItem('hayyiz-todos', JSON.stringify(nextTodos));
                        if (typeof hayyizUploadItem === 'function') await hayyizUploadItem('todos', data.id, data);
                        if (typeof hayyizReevaluateMultiDayPlan === 'function') {
                            try { hayyizReevaluateMultiDayPlan(); } catch (_) {}
                        }
                    }
                    const confirmation = duplicate
                        ? 'المهمة موجودة بالفعل في قائمة مهامك: ' + data.text + ' — ' + dateLabel + '.'
                        : 'تمت إضافة المهمة إلى قائمة مهام حيز على هذا الجهاز: ' + data.text + ' — ' + dateLabel + '.';
                    addLocalAssistantReply(confirmation, 'قائمة المهام');
                } else {
                    const storageKey = data.type === 'exam' ? 'hayyiz-student-exams' : 'hayyiz-custom-events';
                    const saved = hayyizStorage.getItem(storageKey);
                    const list = saved ? JSON.parse(saved) : [];
                    const events = Array.isArray(list) ? list : [];
                    const duplicate = events.find(item => item && item.name === data.name && item.date === data.date && (item.time || '') === data.time);
                    if (!duplicate) {
                        events.push(data);
                        hayyizStorage.setItem(storageKey, JSON.stringify(events));
                        if (typeof hayyizUploadItem === 'function') {
                            await hayyizUploadItem(data.type === 'exam' ? 'student-exams' : 'custom-events', data.id, data);
                        }
                    }
                    const confirmation = duplicate
                        ? 'الموعد موجود بالفعل في تقويم الطالب: ' + data.name + ' — ' + dateLabel + '.'
                        : 'تمت إضافة الموعد إلى تقويم الطالب على هذا الجهاز: ' + data.name + ' — ' + dateLabel + '.';
                    addLocalAssistantReply(confirmation, 'تقويم الطالب');
                }
                actions.remove();
                if (typeof window.dispatchEvent === 'function' && typeof Event === 'function') {
                    window.dispatchEvent(new Event('hayyiz:planning-changed'));
                }
                setStatus('');
            } catch (error) {
                confirmButton.disabled = false;
                cancelButton.disabled = false;
                confirmButton.textContent = 'إعادة المحاولة';
                setStatus('تعذر حفظ العنصر. لم أؤكد إضافته؛ حاول مرة أخرى.', true);
            }
        });

        cancelButton.addEventListener('click', () => {
            actions.remove();
            setStatus('لم تتم الإضافة.');
        });

        actions.append(confirmButton, cancelButton);
        messageNode.appendChild(actions);
        $('assistant-provider-status').textContent = isTodo ? 'مهمة بانتظار تأكيدك' : 'موعد بانتظار تأكيدك';
        setStatus('راجع الاسم والتاريخ والوقت قبل الإضافة.');
    }

    async function getSession() {
        if (typeof ensureSupabaseLoaded !== 'function') throw new Error('تعذر تحميل خدمة تسجيل الدخول.');
        const client = await ensureSupabaseLoaded();
        const result = await client.auth.getSession();
        if (result.error) throw result.error;
        return { client, session: result.data && result.data.session };
    }

        function isAccountNameQuestion(message) {
        const text = normalizeAssistantIntent(message);
        return /(هل تعرف اسمي|تعرف اسمي|ما اسمي|وش اسمي|ايش اسمي|تذكر اسمي)/.test(text);
    }

    async function getAccountNameReply() {
        const sessionData = await getSession();
        if (!sessionData.session) return 'لا أستطيع قراءة بيانات الحساب لأن جلسة الدخول غير متاحة.';
        const result = await sessionData.client.auth.getUser();
        if (result.error || !result.data || !result.data.user) {
            return 'تعذر التحقق من بيانات ملفك الشخصي الآن.';
        }

        const metadata = result.data.user.user_metadata || {};
        const fullName = [metadata.full_name, metadata.name, metadata.display_name, metadata.preferred_name]
            .find(value => typeof value === 'string' && value.trim());
        const firstName = typeof metadata.first_name === 'string' ? metadata.first_name.trim() : '';
        const lastName = typeof metadata.last_name === 'string' ? metadata.last_name.trim() : '';
        const name = fullName || [firstName, lastName].filter(Boolean).join(' ');

        return name
            ? 'الاسم الظاهر في ملف حسابك هو: ' + name + '.'
            : 'لا يظهر لي اسم محفوظ في ملف حسابك على حيز. أستطيع الوصول إلى حالة تسجيل الدخول وبيانات الدراسة التي تختار مشاركتها، لكن لا أستنتج اسمك من عنوان البريد الإلكتروني.';
    }

async function sendMessage(message) {
        if (sending) return;
        sending = true;
        sendButton.disabled = true;
        setStatus('يفكر المساعد...');
        const userMessage = { role: 'user', content: message };
        history.push(userMessage);
        addMessage('user', message);
        saveHistory();
        input.value = '';
        countEl.textContent = '0 / 2000';

        const proposal = inferActionProposal(message, history.slice(0, -1));
        if (proposal) {
            if (proposal.needsClarification) {
                addLocalAssistantReply(proposal.reply, 'توضيح مطلوب');
            } else {
                showActionProposal(proposal);
            }
            sending = false;
            sendButton.disabled = false;
            input.focus();
            return;
        }

        try {
            if (isAccountNameQuestion(message)) {
                addLocalAssistantReply(await getAccountNameReply(), 'بيانات الحساب');
                return;
            }
            const { session } = await getSession();
            if (!session || !session.access_token) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجددًا.');
            const includeContext = $('assistant-share-context').checked;
            const payload = {
                message,
                history: history.slice(0, -1).slice(-(MAX_HISTORY - 1)).map(item => ({ role: item.role, content: item.content.slice(0, 1000) })),
                context: includeContext ? buildStudyContext() : null
            };
            const response = await fetch('/api/assistant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + session.access_token
                },
                body: JSON.stringify(payload),
                cache: 'no-store',
                credentials: 'same-origin'
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 401) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجددًا.');
                if (response.status === 429) throw new Error(result.error || 'وصلت إلى حد الاستخدام المؤقت. انتظر قليلًا ثم حاول.');
                throw new Error(result.error || 'تعذر الحصول على إجابة الآن. حاول لاحقًا.');
            }
            if (typeof result.reply !== 'string' || !result.reply.trim()) throw new Error('وصل رد غير صالح من المساعد.');
            history.push({ role: 'assistant', content: result.reply.trim().slice(0, 8000) });
            history = history.slice(-30);
            saveHistory();
            addMessage('assistant', result.reply.trim());
            const providerLabels = {
                gemini: 'Gemini',
                cloudflare: 'Cloudflare AI',
                knowledge: 'إجابة معرفية مباشرة',
                capability: 'توضيح حدود المساعد',
                greeting: 'ترحيب',
                'study-plan': 'خطة مذاكرة',
                priorities: 'أولويات من بيانات حيز',
                'data-required': 'مشاركة البيانات مطلوبة'
            };
            $('assistant-provider-status').textContent = providerLabels[result.provider] || 'مساعد حيز';
            setStatus('');
        } catch (error) {
            setStatus(error && error.message ? error.message : 'حدث خطأ غير متوقع.', true);
        } finally {
            sending = false;
            sendButton.disabled = false;
            input.focus();
        }
    }

    async function initialize() {
        history = readHistory();
        renderHistory();
        try {
            const { session } = await getSession();
            if (!session) {
                authRequired.hidden = false;
                $('assistant-login').addEventListener('click', () => {
                    const button = document.getElementById('nav-auth-btn');
                    if (button) button.click();
                });
                return;
            }
            app.hidden = false;
        } catch (_) {
            authRequired.hidden = false;
            $('assistant-login').addEventListener('click', () => {
                const button = document.getElementById('nav-auth-btn');
                if (button) button.click();
            });
            return;
        }

        input.addEventListener('input', () => { countEl.textContent = input.value.length + ' / 2000'; });
        form.addEventListener('submit', event => {
            event.preventDefault();
            const message = input.value.trim();
            if (!message || message.length > 2000) return;
            sendMessage(message);
        });
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                form.requestSubmit();
            }
        });
        document.querySelectorAll('[data-prompt]').forEach(button => {
            button.addEventListener('click', () => {
                input.value = button.getAttribute('data-prompt') || '';
                countEl.textContent = input.value.length + ' / 2000';
                input.focus();
            });
        });
        $('assistant-clear').addEventListener('click', () => {
            if (!window.confirm('هل تريد مسح سجل هذه المحادثة من هذا الجهاز؟')) return;
            history = [];
            hayyizStorage.removeItem(CHAT_KEY);
            renderHistory();
            setStatus('مُسح سجل المحادثة من هذا الجهاز.');
        });
    }

    document.addEventListener('DOMContentLoaded', initialize);
})();