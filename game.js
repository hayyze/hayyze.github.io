document.addEventListener('DOMContentLoaded', async () => {
    let dictionary = null;

    try {
    const res = await fetch('./words.json', {
        cache: 'no-store'
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }

    dictionary = await res.json();
} catch (e) {
    console.error('Dictionary loading error:', e);
    alert('تعذر تحميل ملف words.json');
    return;
}

    const letters = 'أبتثجحخدذرزسشصضطظعغفقكلمنهـوي';

    let currentLetter = '';
    let gameEndTime = null;
    let gameTimerInterval = null;

    let highScore = parseInt(
        localStorage.getItem('hayyiz-highscore') || '0',
        10
    );

    const currentLetterEl =
        document.getElementById('current-letter');

    const startGameBtn =
        document.getElementById('start-game-btn');

    const gameForm =
        document.getElementById('game-form');

    const gameTimerDisplay =
        document.getElementById('game-timer-display');

    const gameResultBox =
        document.getElementById('game-result-box');

    const highScoreEl =
        document.getElementById('high-score');

    highScoreEl.textContent = highScore;


    function normalize(str) {
        return str
            .trim()
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/أ|إ|آ/g, 'ا');
    }


    function isValidWord(category, letter, word) {
        if (!dictionary?.[category]?.[letter]) {
            return false;
        }

        return dictionary[category][letter].some(
            item => normalize(item) === normalize(word)
        );
    }


    function updateGameTimer() {
        if (!gameEndTime) {
            return;
        }

        const remaining = Math.max(
            0,
            Math.round(
                (gameEndTime - Date.now()) / 1000
            )
        );

        gameTimerDisplay.replaceChildren();

        const icon = document.createElement('i');

        icon.className =
            'fa-solid fa-hourglass-half';

        icon.setAttribute(
            'aria-hidden',
            'true'
        );

        gameTimerDisplay.appendChild(icon);

        gameTimerDisplay.appendChild(
            document.createTextNode(
                ` الوقت: ${remaining}ث`
            )
        );

        if (remaining <= 0) {
            clearInterval(gameTimerInterval);
            gameTimerInterval = null;
            submitGame();
        }
    }


    startGameBtn.addEventListener('click', () => {
        if (!dictionary) {
            alert('القاموس غير موجود');
            return;
        }

        const available = letters
            .split('')
            .filter(letter =>
                dictionary.human?.[letter] ||
                dictionary.animal?.[letter] ||
                dictionary.plant?.[letter] ||
                dictionary.thing?.[letter] ||
                dictionary.country?.[letter]
            );

        if (available.length === 0) {
            alert('لا توجد حروف متاحة للعبة');
            return;
        }

        currentLetter =
            available[
                Math.floor(
                    Math.random() * available.length
                )
            ];

        currentLetterEl.textContent =
            currentLetter;

        gameForm.classList.remove('hidden');
        gameResultBox.classList.add('hidden');

        startGameBtn.classList.add('hidden');

        gameEndTime =
            Date.now() + 60000;

        clearInterval(gameTimerInterval);

        gameTimerInterval =
            setInterval(
                updateGameTimer,
                200
            );

        updateGameTimer();

        [
            'g-human',
            'g-animal',
            'g-plant',
            'g-thing',
            'g-country'
        ].forEach(id => {
            const input =
                document.getElementById(id);

            if (input) {
                input.value = '';
            }
        });
    });


    gameForm.addEventListener('submit', e => {
        e.preventDefault();
        submitGame();
    });


    function createDetailRow(
        label,
        word,
        status
    ) {
        const div =
            document.createElement('div');

        div.style.marginBottom = '10px';
        div.style.fontSize = '0.95rem';

        const strong =
            document.createElement('strong');

        strong.textContent =
            `${label}:`;

        div.appendChild(strong);

        if (!word) {
            const span =
                document.createElement('span');

            span.style.color = '#94a3b8';

            span.textContent =
                ' — لم تُدخل إجابة';

            div.appendChild(span);

            return div;
        }

        const answer =
            document.createElement('span');

        answer.textContent =
            ` ${word}`;

        answer.style.fontWeight = '700';

        const result =
            document.createElement('span');

        result.textContent =
            status === 'valid'
                ? ' ✓ صح'
                : ' ✗ غير موجود بالقاموس';

        if (status === 'valid') {
            answer.style.color = '#059669';
            result.style.color = '#059669';
        } else {
            answer.style.color = '#dc2626';
            result.style.color = '#dc2626';
        }

        div.appendChild(answer);
        div.appendChild(result);

        return div;
    }


    function submitGame() {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;

        gameEndTime = null;

        const humanInput =
            document.getElementById('g-human');

        const animalInput =
            document.getElementById('g-animal');

        const plantInput =
            document.getElementById('g-plant');

        const thingInput =
            document.getElementById('g-thing');

        const countryInput =
            document.getElementById('g-country');


        const answers = {
            human: humanInput
                ? humanInput.value.trim()
                : '',

            animal: animalInput
                ? animalInput.value.trim()
                : '',

            plant: plantInput
                ? plantInput.value.trim()
                : '',

            thing: thingInput
                ? thingInput.value.trim()
                : '',

            country: countryInput
                ? countryInput.value.trim()
                : ''
        };


        let score = 0;

        const cats = [
            {
                key: 'human',
                label: 'إنسان'
            },
            {
                key: 'animal',
                label: 'حيوان'
            },
            {
                key: 'plant',
                label: 'نبات'
            },
            {
                key: 'thing',
                label: 'جماد'
            },
            {
                key: 'country',
                label: 'بلاد'
            }
        ];


        const resultDetails =
            document.createElement('div');

        resultDetails.style.textAlign = 'right';


        cats.forEach(cat => {
            const word =
                answers[cat.key];

            if (!word) {
                resultDetails.appendChild(
                    createDetailRow(
                        cat.label,
                        '',
                        'empty'
                    )
                );

                return;
            }

            const valid =
                isValidWord(
                    cat.key,
                    currentLetter,
                    word
                );

            if (valid) {
                score += 20;
            }

            resultDetails.appendChild(
                createDetailRow(
                    cat.label,
                    word,
                    valid ? 'valid' : 'invalid'
                )
            );
        });


        if (score > highScore) {
            highScore = score;

            localStorage.setItem(
                'hayyiz-highscore',
                String(highScore)
            );

            highScoreEl.textContent =
                highScore;
        }


        gameResultBox.replaceChildren();


        const scoreTitle =
            document.createElement('div');

        scoreTitle.style.fontSize = '1.5rem';
        scoreTitle.style.marginBottom = '20px';
        scoreTitle.style.fontWeight = '800';
        scoreTitle.style.textAlign = 'center';

        scoreTitle.textContent =
            `نتيجتك: ${score} / 100`;

        gameResultBox.appendChild(
            scoreTitle
        );


        gameResultBox.appendChild(
            resultDetails
        );


        const letterInfo =
            document.createElement('p');

        letterInfo.style.marginTop = '20px';
        letterInfo.style.color = '#64748b';
        letterInfo.style.textAlign = 'center';

        letterInfo.textContent =
            'الحرف المطلوب كان: ';

        const letterStrong =
            document.createElement('strong');

        letterStrong.textContent =
            currentLetter;

        letterInfo.appendChild(
            letterStrong
        );

        gameResultBox.appendChild(
            letterInfo
        );

        // زر مشاركة النتيجة
        const shareWrap = document.createElement('div');
        shareWrap.style.cssText = 'margin-top:1.5rem; display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap;';

        const shareBtn = document.createElement('button');
        shareBtn.type = 'button';
        shareBtn.className = 'btn btn-primary';
        shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes" aria-hidden="true"></i> شارك نتيجتك';
        shareBtn.addEventListener('click', () => {
            const text = `لعبت جماد حيوان نبات في حيز وسجلت ${score}/100 🔥\nالحرف كان: ${currentLetter}\n\nجربها أنت كمان: https://just-c.github.io/adawati/game.html`;
            if (navigator.share) {
                navigator.share({
                    title: 'نتيجتي في لعبة الحروف — حيز',
                    text: text,
                    url: 'https://just-c.github.io/adawati/game.html'
                }).catch(() => copyShareText(text));
            } else {
                copyShareText(text);
            }
        });

        const twitterBtn = document.createElement('a');
        twitterBtn.className = 'btn btn-outline';
        twitterBtn.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`لعبت جماد حيوان نبات في حيز وسجلت ${score}/100 🔥\nالحرف كان: ${currentLetter}\n\nجربها أنت كمان:`)}&url=${encodeURIComponent('https://just-c.github.io/adawati/game.html')}`;
        twitterBtn.target = '_blank';
        twitterBtn.rel = 'noopener noreferrer';
        twitterBtn.innerHTML = '<i class="fa-brands fa-x-twitter" aria-hidden="true"></i> تويتر / إكس';

        shareWrap.appendChild(shareBtn);
        shareWrap.appendChild(twitterBtn);
        gameResultBox.appendChild(shareWrap);

        gameResultBox.classList.remove(
            'hidden'
        );

        gameForm.classList.add(
            'hidden'
        );

        startGameBtn.classList.remove(
            'hidden'
        );


        startGameBtn.replaceChildren();

        const rotateIcon =
            document.createElement('i');

        rotateIcon.className =
            'fa-solid fa-rotate-right';

        rotateIcon.setAttribute(
            'aria-hidden',
            'true'
        );

        startGameBtn.appendChild(
            rotateIcon
        );

        startGameBtn.appendChild(
            document.createTextNode(
                ' جولة جديدة'
            )
        );
    }

    function copyShareText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                alert('تم نسخ النص! الصقه في تويتر أو واتساب أو أي مكان');
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            alert('تم نسخ النص! الصقه في تويتر أو واتساب أو أي مكان');
        } catch (e) {
            prompt('انسخ النص التالي:', text);
        }
        document.body.removeChild(ta);
    }
});