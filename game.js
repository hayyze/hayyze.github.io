document.addEventListener('DOMContentLoaded', async () => {
    let dictionary = null;

    try {
        const res = await fetch('words.json');

        if (!res.ok) {
            throw new Error('Failed to load dictionary');
        }

        dictionary = await res.json();
    } catch (e) {
        alert('تعذر تحميل ملف words.json');
    }

    const letters = 'أبتثجحخدذرزسشصضطظعغفقكلمنهوي';

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

        /*
         * لا توجد بيانات من المستخدم هنا،
         * لذلك يمكن إنشاء العناصر مباشرة بدل innerHTML.
         */
        gameTimerDisplay.textContent =
            `الوقت: ${remaining}ث`;

        const icon =
            document.createElement('i');

        icon.className =
            'fa-solid fa-hourglass-half';

        icon.setAttribute(
            'aria-hidden',
            'true'
        );

        gameTimerDisplay.prepend(icon);

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


        /*
         * ننشئ النتيجة باستخدام DOM APIs
         * بدل دمج إجابات المستخدم داخل HTML.
         */
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


        /*
         * تفريغ النتيجة القديمة.
         */
        gameResultBox.replaceChildren();


        /*
         * عنوان النتيجة.
         */
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


        /*
         * تفاصيل الإجابات.
         */
        gameResultBox.appendChild(
            resultDetails
        );


        /*
         * الحرف المطلوب.
         *
         * currentLetter يأتي من قائمة ثابتة
         * وليس من إدخال المستخدم، ومع ذلك
         * نستخدم textContent أيضًا.
         */
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


        gameResultBox.classList.remove(
            'hidden'
        );

        gameForm.classList.add(
            'hidden'
        );

        startGameBtn.classList.remove(
            'hidden'
        );


        /*
         * إنشاء محتوى زر الجولة الجديدة
         * باستخدام DOM بدل innerHTML.
         */
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
});
