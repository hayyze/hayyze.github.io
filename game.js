document.addEventListener('DOMContentLoaded', async () => {
    let dictionary = null;
    try {
        const res = await fetch('words.json');
        dictionary = await res.json();
    } catch (e) {
        alert('تعذر تحميل ملف words.json');
    }

    const letters = 'أبتثجحخدذرزسشصضطظعغفقكلمنهوي';
    let currentLetter = '';
    let gameEndTime = null;
    let gameTimerInterval = null;
    let highScore = parseInt(localStorage.getItem('hayyiz-highscore') || '0');

    const currentLetterEl = document.getElementById('current-letter');
    const startGameBtn = document.getElementById('start-game-btn');
    const gameForm = document.getElementById('game-form');
    const gameTimerDisplay = document.getElementById('game-timer-display');
    const gameResultBox = document.getElementById('game-result-box');
    const highScoreEl = document.getElementById('high-score');

    highScoreEl.textContent = highScore;

    function normalize(str) {
        return str.trim().replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/أ|إ|آ/g, 'ا');
    }

    function isValidWord(category, letter, word) {
        if (!dictionary?.[category]?.[letter]) return false;
        return dictionary[category][letter].some(item => normalize(item) === normalize(word));
    }

    function updateGameTimer() {
        if (!gameEndTime) return;
        const remaining = Math.max(0, Math.round((gameEndTime - Date.now()) / 1000));
        gameTimerDisplay.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> الوقت: ${remaining}ث`;
        if (remaining <= 0) {
            clearInterval(gameTimerInterval);
            submitGame();
        }
    }

    startGameBtn.addEventListener('click', () => {
        if (!dictionary) return alert('القاموس غير موجود');
        const available = letters.split('').filter(l =>
            dictionary.human[l] || dictionary.animal[l] || dictionary.plant[l] || dictionary.thing[l] || dictionary.country[l]
        );
        currentLetter = available[Math.floor(Math.random() * available.length)];
        currentLetterEl.textContent = currentLetter;
        gameForm.classList.remove('hidden');
        gameResultBox.classList.add('hidden');
        startGameBtn.classList.add('hidden');
        gameEndTime = Date.now() + 60000;
        clearInterval(gameTimerInterval);
        gameTimerInterval = setInterval(updateGameTimer, 200);
        updateGameTimer();
        ['g-human','g-animal','g-plant','g-thing','g-country'].forEach(id => document.getElementById(id).value = '');
    });

    gameForm.addEventListener('submit', e => {
        e.preventDefault();
        submitGame();
    });

    function submitGame() {
        clearInterval(gameTimerInterval);
        gameEndTime = null;

        const answers = {
            human: document.getElementById('g-human').value.trim(),
            animal: document.getElementById('g-animal').value.trim(),
            plant: document.getElementById('g-plant').value.trim(),
            thing: document.getElementById('g-thing').value.trim(),
            country: document.getElementById('g-country').value.trim()
        };

        let score = 0;
        let details = [];
        const cats = [
            {key:'human', label:'إنسان'},
            {key:'animal', label:'حيوان'},
            {key:'plant', label:'نبات'},
            {key:'thing', label:'جماد'},
            {key:'country', label:'بلاد'}
        ];

        cats.forEach(cat => {
            const word = answers[cat.key];
            if (!word) {
                details.push(`<div style="margin-bottom:10px;font-size:0.95rem"><strong>${cat.label}:</strong> <span style="color:#94a3b8">— لم تُدخل إجابة</span></div>`);
                return;
            }
            if (isValidWord(cat.key, currentLetter, word)) {
                score += 20;
                details.push(`<div style="margin-bottom:10px;font-size:0.95rem"><strong>${cat.label}:</strong> <span style="color:#059669;font-weight:700">${word}</span> <span style="color:#059669">✓ صح</span></div>`);
            } else {
                details.push(`<div style="margin-bottom:10px;font-size:0.95rem"><strong>${cat.label}:</strong> <span style="color:#dc2626;font-weight:700">${word}</span> <span style="color:#dc2626">✗ غير موجود بالقاموس</span></div>`);
            }
        });

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('hayyiz-highscore', highScore);
            highScoreEl.textContent = highScore;
        }

        gameResultBox.innerHTML = `
            <div style="font-size:1.5rem;margin-bottom:20px;font-weight:800;text-align:center">نتيجتك: ${score} / 100</div>
            <div style="text-align:right">${details.join('')}</div>
            <p style="margin-top:20px;color:#64748b;text-align:center">الحرف المطلوب كان: <strong>${currentLetter}</strong></p>
        `;
        gameResultBox.classList.remove('hidden');
        gameForm.classList.add('hidden');
        startGameBtn.classList.remove('hidden');
        startGameBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> جولة جديدة';
    }
});