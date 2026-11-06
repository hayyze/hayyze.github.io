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
        const subjects = safeParse('hayyiz-subjects', []);
        const exams = safeParse('hayyiz-exams', []);
        const goals = safeParse('hayyiz-goals', []);
        const academicGoal = safeParse('hayyiz-academic-goal', null);
        const tasks = Array.isArray(todos) ? todos.slice(0, 30).map(task => ({
            title: shortText(task && (task.title || task.text || task.name), 100),
            dueDate: shortText(task && (task.date || task.dueDate || task.deadline), 20),
            priority: shortText(task && task.priority, 20),
            completed: Boolean(task && (task.completed || task.done)),
            subject: shortText(task && (task.subjectName || task.subject), 50)
        })).filter(task => task.title) : [];
        const subjectList = Array.isArray(subjects) ? subjects.slice(0, 20).map(subject => ({
            name: shortText(subject && (subject.name || subject.title), 60)
        })).filter(subject => subject.name) : [];
        const examList = Array.isArray(exams) ? exams.slice(0, 20).map(exam => ({
            name: shortText(exam && (exam.name || exam.title || exam.subject), 80),
            date: shortText(exam && (exam.date || exam.examDate), 20)
        })).filter(exam => exam.name || exam.date) : [];
        const goalList = Array.isArray(goals) ? goals.slice(0, 10).map(goal => ({
            title: shortText(goal && (goal.title || goal.name || goal.text), 100),
            dueDate: shortText(goal && (goal.date || goal.dueDate), 20)
        })).filter(goal => goal.title) : [];
        const target = academicGoal && typeof academicGoal === 'object' ? {
            target: academicGoal.target ?? academicGoal.targetGpa ?? academicGoal.goal ?? null,
            current: academicGoal.current ?? academicGoal.currentGpa ?? null
        } : null;
        return { tasks, subjects: subjectList, exams: examList, goals: goalList, academicGoal: target };
    }

    function normalizeAssistantIntent(value) {
        return String(value || '')
            .normalize('NFKD')
            .replace(/[\\u064B-\\u065F\\u0670]/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/[؟?!.,،؛:]/g, ' ')
            .replace(/\\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function inferCalendarProposal(message, previousHistory) {
        const text = normalizeAssistantIntent(message);
        const createIntent = /(انشئ|اضف|سجل|احجز|حدد|اعمل|حط)/.test(text) &&
            /(موعد|حدث|تذكير|اختبار)/.test(text);
        if (!createIntent) return null;

        const weekdays = [
            { names: ['الاحد', 'الاحد القادم', 'sunday'], day: 0 },
            { names: ['الاثنين', 'الاثنين القادم', 'monday'], day: 1 },
            { names: ['الثلاثاء', 'الثلاثاء القادم', 'tuesday'], day: 2 },
            { names: ['الاربعاء', 'الاربعاء القادم', 'wednesday'], day: 3 },
            { names: ['الخميس', 'الخميس القادم', 'thursday'], day: 4 },
            { names: ['الجمعه', 'الجمعه القادم', 'friday'], day: 5 },
            { names: ['السبت', 'السبت القادم', 'saturday'], day: 6 }
        ];
        const dayMatch = weekdays.find(item => item.names.some(name => text.includes(name)));
        if (!dayMatch) return null;

        const date = new Date();
        date.setHours(12, 0, 0, 0);
        const daysAhead = (dayMatch.day - date.getDay() + 7) % 7 || 7;
        date.setDate(date.getDate() + daysAhead);
        const dateValue = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');

        const priorText = (previousHistory || [])
            .filter(item => item && item.role === 'user')
            .map(item => item.content)
            .join(' ');
        const combinedText = normalizeAssistantIntent(priorText + ' ' + message);
        const isExam = /(اختبار|امتحان)/.test(combinedText);
        const topic = /قوانين نيوتن|قانون نيوتن|نيوتن/.test(combinedText) ? 'قوانين نيوتن' : '';
        const name = isExam
            ? (topic ? 'اختبار ' + topic : 'اختبار دراسي')
            : 'موعد دراسي';

        return {
            id: (isExam ? 'ex_' : 'ev_') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name,
            type: isExam ? 'exam' : 'personal',
            date: dateValue,
            time: '',
            subjectId: null,
            updated: Date.now()
        };
    }

    function showCalendarProposal(eventData) {
        const dateParts = eventData.date.split('-').map(Number);
        const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 12);
        const dateLabel = localDate.toLocaleDateString('ar-SA', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const summary = 'أقترح إضافة الموعد التالي إلى تقويم الطالب:\n' +
            'الاسم: ' + eventData.name + '\n' +
            'التاريخ: ' + dateLabel + '\n' +
            'الوقت: غير محدد.\n' +
            'لم يُحفظ الموعد بعد؛ أضفه فقط بعد تأكيدك.';
        history.push({ role: 'assistant', content: summary });
        history = history.slice(-30);
        saveHistory();
        const messageNode = addMessage('assistant', summary);

        const actions = document.createElement('div');
        actions.className = 'assistant-proposal-actions';
        const confirmButton = document.createElement('button');
        confirmButton.type = 'button';
        confirmButton.className = 'btn btn-primary';
        confirmButton.textContent = 'تأكيد وإضافة الموعد';
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'btn btn-secondary';
        cancelButton.textContent = 'ليس الآن';

        confirmButton.addEventListener('click', async () => {
            confirmButton.disabled = true;
            cancelButton.disabled = true;
            confirmButton.textContent = 'جارٍ الحفظ...';
            try {
                const storageKey = eventData.type === 'exam' ? 'hayyiz-student-exams' : 'hayyiz-custom-events';
                const raw = hayyizStorage.getItem(storageKey);
                const saved = raw ? JSON.parse(raw) : [];
                const list = Array.isArray(saved) ? saved : [];
                const duplicate = list.find(item => item && item.name === eventData.name && item.date === eventData.date);
                if (!duplicate) {
                    list.push(eventData);
                    hayyizStorage.setItem(storageKey, JSON.stringify(list));
                    if (typeof hayyizUploadItem === 'function') {
                        const toolName = eventData.type === 'exam' ? 'student-exams' : 'custom-events';
                        await hayyizUploadItem(toolName, eventData.id, eventData);
                    }
                }
                const confirmation = duplicate
                    ? 'الموعد موجود بالفعل في تقويم الطالب: ' + eventData.name + ' — ' + dateLabel + '.'
                    : 'تمت إضافة الموعد إلى تقويم الطالب على هذا الجهاز: ' + eventData.name + ' — ' + dateLabel + '.';
                history.push({ role: 'assistant', content: confirmation });
                history = history.slice(-30);
                saveHistory();
                addMessage('assistant', confirmation);
                actions.remove();
                $('assistant-provider-status').textContent = 'تقويم الطالب';
                setStatus('');
            } catch (error) {
                confirmButton.disabled = false;
                cancelButton.disabled = false;
                confirmButton.textContent = 'إعادة المحاولة';
                setStatus('تعذر حفظ الموعد. لم أؤكد إضافته؛ حاول مرة أخرى.', true);
            }
        });

        cancelButton.addEventListener('click', () => {
            actions.remove();
            setStatus('لم تتم إضافة الموعد.');
        });

        actions.append(confirmButton, cancelButton);
        messageNode.appendChild(actions);
        $('assistant-provider-status').textContent = 'موعد بانتظار تأكيدك';
        setStatus('راجع اسم الموعد وتاريخه قبل إضافته.');
    }

    async function getSession() {
        if (typeof ensureSupabaseLoaded !== 'function') throw new Error('تعذر تحميل خدمة تسجيل الدخول.');
        const client = await ensureSupabaseLoaded();
        const result = await client.auth.getSession();
        if (result.error) throw result.error;
        return { client, session: result.data && result.data.session };
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

        const proposal = inferCalendarProposal(message, history.slice(0, -1));
        if (proposal) {
            showCalendarProposal(proposal);
            sending = false;
            sendButton.disabled = false;
            input.focus();
            return;
        }

        try {
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
                capability: 'توضيح حدود المساعد'
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