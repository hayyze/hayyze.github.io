document.addEventListener('DOMContentLoaded', () => {
    const subjectsData = {
        1: {
            1: [
                { name: "القرآن الكريم وتفسيره", weight: 4 },
                { name: "الرياضيات", weight: 5 },
                { name: "اللغة الإنجليزية", weight: 5 },
                { name: "التقنية الرقمية", weight: 3 },
                { name: "الأحياء", weight: 3 },
                { name: "الكيمياء", weight: 3 },
                { name: "الكفايات اللغوية", weight: 4 },
                { name: "التفكير الناقد", weight: 3 },
                { name: "التربية الصحية والبدنية", weight: 2 },
                { name: "السلوك", weight: 1 },
                { name: "المواظبة", weight: 5 }
            ],
            2: [
                { name: "الرياضيات", weight: 5 },
                { name: "اللغة الإنجليزية", weight: 5 },
                { name: "التقنية الرقمية", weight: 3 },
                { name: "الفيزياء", weight: 3 },
                { name: "علم البيئة", weight: 2 },
                { name: "الكفايات اللغوية", weight: 3 },
                { name: "الحديث", weight: 2 },
                { name: "المعرفة المالية", weight: 2 },
                { name: "الدراسات الاجتماعية", weight: 3 },
                { name: "التربية المهنية", weight: 2 },
                { name: "التربية الصحية والبدنية", weight: 2 },
                { name: "السلوك", weight: 1 },
                { name: "المواظبة", weight: 5 }
            ]
        },
        2: {
            1: [
                { name: "الرياضيات", weight: 5 },
                { name: "اللغة الإنجليزية", weight: 5 },
                { name: "الكيمياء", weight: 5 },
                { name: "الأحياء", weight: 4 },
                { name: "الفيزياء", weight: 4 },
                { name: "الكفايات اللغوية", weight: 4 },
                { name: "التاريخ", weight: 3 },
                { name: "النشاط", weight: 2 },
                { name: "السلوك", weight: 1 },
                { name: "المواظبة", weight: 5 }
            ],
            2: [
                { name: "الرياضيات", weight: 5 },
                { name: "اللغة الإنجليزية", weight: 5 },
                { name: "الكيمياء", weight: 5 },
                { name: "الأحياء", weight: 4 },
                { name: "التوحيد", weight: 2 },
                { name: "التقنية الرقمية", weight: 4 },
                { name: "الفنون", weight: 2 },
                { name: "اللياقة والثقافة الصحية", weight: 3 },
                { name: "النشاط", weight: 2 },
                { name: "السلوك", weight: 1 },
                { name: "المواظبة", weight: 5 }
            ]
        },
        3: { 1: [], 2: [] }
    };

    const yearSelect = document.getElementById('year-select');
    const termSelect = document.getElementById('term-select');
    const subjectsContainer = document.getElementById('subjects-container');
    const calculateBtn = document.getElementById('calculate-btn');
    const resetBtn = document.getElementById('reset-gpa-btn');
    const resultBox = document.getElementById('gpa-result');
    const scoreEl = document.getElementById('gpa-score');

    function renderSubjects() {
        const year = yearSelect.value;
        const term = termSelect.value;
        const subjects = subjectsData[year][term];
        subjectsContainer.innerHTML = '';

        if (year === '3') {
            subjectsContainer.innerHTML = `
                <div style="text-align:center;padding:40px;">
                    <i class="fa-solid fa-clock" style="font-size:3rem;color:var(--text-muted);margin-bottom:16px;"></i>
                    <h3>ثالث ثانوي</h3>
                    <p style="color:var(--text-muted)">سيتم إضافة الأوزان قريباً</p>
                </div>`;
            resultBox.classList.add('hidden');
            return;
        }

        subjects.forEach(subject => {
            const div = document.createElement('div');
            div.className = 'subject-row';
            div.innerHTML = `
                <div class="subject-info">
                    <span class="subject-name">${subject.name}</span>
                    <span class="subject-weight">الوزن: ${subject.weight}</span>
                </div>
                <input type="number" class="subject-score" data-weight="${subject.weight}" min="0" max="100" step="0.01" placeholder="من 100">
            `;
            subjectsContainer.appendChild(div);
        });
    }

    function calculateGPA() {
        const inputs = document.querySelectorAll('.subject-score');
        let totalWeighted = 0, totalWeights = 0, hasError = false;

        inputs.forEach(input => {
            const score = parseFloat(input.value);
            const weight = parseFloat(input.dataset.weight);
            if (isNaN(score) || score < 0 || score > 100) {
                input.style.borderColor = '#ef4444';
                hasError = true;
            } else {
                input.style.borderColor = '';
                totalWeighted += score * weight;
                totalWeights += weight;
            }
        });

        if (hasError || totalWeights === 0) {
            alert('تأكد من إدخال درجات صحيحة (0 - 100)');
            return;
        }

        const gpa = totalWeighted / totalWeights;
        scoreEl.textContent = gpa.toFixed(2);
        resultBox.classList.remove('hidden');
    }

    yearSelect.addEventListener('change', renderSubjects);
    termSelect.addEventListener('change', renderSubjects);
    calculateBtn.addEventListener('click', calculateGPA);
    resetBtn.addEventListener('click', () => {
        document.querySelectorAll('.subject-score').forEach(i => i.value = '');
        resultBox.classList.add('hidden');
    });

    renderSubjects();
});