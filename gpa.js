/* gpa.js - حاسبة المعدل مع دعم المسارات */
(function () {
  const SUBJECTS = {
    // ===== أول ثانوي (مشتركة) =====
    "1": {
      "1": [
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
      "2": [
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

    // ===== ثاني ثانوي =====
    "2": {
      general: {
        "1": [
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
        "2": [
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
      cs: {
        "1": [
          { name: "التوحيد", weight: 3 },
          { name: "اللغة الإنجليزية", weight: 5 },
          { name: "الرياضيات", weight: 5 },
          { name: "الكيمياء", weight: 5 },
          { name: "الفيزياء", weight: 5 },
          { name: "الأحياء", weight: 4 },
          { name: "علم البيانات", weight: 3 },
          { name: "الهندسة", weight: 3 },
          { name: "إنترنت الأشياء", weight: 3 },
          { name: "اللياقة والثقافة الصحية", weight: 4 },
          { name: "الكفايات اللغوية", weight: 3 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ],
        "2": [
          { name: "التوحيد", weight: 3 },
          { name: "اللغة الإنجليزية", weight: 5 },
          { name: "الرياضيات", weight: 5 },
          { name: "الكيمياء", weight: 5 },
          { name: "الفيزياء", weight: 5 },
          { name: "الأحياء", weight: 4 },
          { name: "علم البيانات", weight: 3 },
          { name: "الهندسة", weight: 3 },
          { name: "إنترنت الأشياء", weight: 3 },
          { name: "اللياقة والثقافة الصحية", weight: 4 },
          { name: "الكفايات اللغوية", weight: 3 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ]
      },
      health: {
        "1": [
          { name: "التوحيد", weight: 3 },
          { name: "اللغة الإنجليزية", weight: 5 },
          { name: "الرياضيات", weight: 5 },
          { name: "الكيمياء", weight: 5 },
          { name: "الفيزياء", weight: 5 },
          { name: "الأحياء", weight: 4 },
          { name: "اللياقة والثقافة الصحية", weight: 4 },
          { name: "الكفايات اللغوية", weight: 3 },
          { name: "التقنية الرقمية", weight: 3 },
          { name: "مبادئ العلوم الصحية", weight: 4 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ],
        "2": [
          { name: "التوحيد", weight: 3 },
          { name: "اللغة الإنجليزية", weight: 5 },
          { name: "الرياضيات", weight: 5 },
          { name: "الكيمياء", weight: 5 },
          { name: "الفيزياء", weight: 5 },
          { name: "الأحياء", weight: 4 },
          { name: "اللياقة والثقافة الصحية", weight: 4 },
          { name: "الكفايات اللغوية", weight: 3 },
          { name: "التقنية الرقمية", weight: 3 },
          { name: "مبادئ العلوم الصحية", weight: 4 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ]
      },
      business: {
        "1": [
          { name: "التوحيد", weight: 3 },
          { name: "اللغة الإنجليزية", weight: 5 },
          { name: "الكفايات اللغوية", weight: 3 },
          { name: "مقدمة في الأعمال", weight: 4 },
          { name: "الإدارة المالية", weight: 4 },
          { name: "اللياقة والثقافة الصحية", weight: 4 },
          { name: "التاريخ", weight: 5 },
          { name: "التقنية الرقمية", weight: 3 },
          { name: "مبادئ الإدارة", weight: 4 },
          { name: "الفنون", weight: 3 },
          { name: "صناعة القرار في الأعمال", weight: 3 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ],
        "2": [
          { name: "التوحيد", weight: 3 },
          { name: "اللغة الإنجليزية", weight: 5 },
          { name: "الكفايات اللغوية", weight: 3 },
          { name: "مقدمة في الأعمال", weight: 4 },
          { name: "الإدارة المالية", weight: 4 },
          { name: "اللياقة والثقافة الصحية", weight: 4 },
          { name: "التاريخ", weight: 5 },
          { name: "التقنية الرقمية", weight: 3 },
          { name: "مبادئ الإدارة", weight: 4 },
          { name: "الفنون", weight: 3 },
          { name: "صناعة القرار في الأعمال", weight: 3 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ]
      },
      sharia: {
        "1": [
          { name: "التوحيد", weight: 3 },
          { name: "القرآن الكريم", weight: 4 },
          { name: "الكفايات اللغوية", weight: 3 },
          { name: "التقنية الرقمية", weight: 3 },
          { name: "اللياقة والثقافة الصحية", weight: 4 },
          { name: "اللغة الإنجليزية", weight: 5 },
          { name: "التاريخ", weight: 5 },
          { name: "الحديث", weight: 3 },
          { name: "علوم القرآن", weight: 3 },
          { name: "التفسير", weight: 3 },
          { name: "الفنون", weight: 3 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ],
        "2": [
          { name: "التوحيد", weight: 3 },
          { name: "القرآن الكريم", weight: 4 },
          { name: "الكفايات اللغوية", weight: 3 },
          { name: "التقنية الرقمية", weight: 3 },
          { name: "اللياقة والثقافة الصحية", weight: 4 },
          { name: "اللغة الإنجليزية", weight: 5 },
          { name: "التاريخ", weight: 5 },
          { name: "الحديث", weight: 3 },
          { name: "علوم القرآن", weight: 3 },
          { name: "التفسير", weight: 3 },
          { name: "الفنون", weight: 3 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ]
      }
    },


    "3": {
      general: {
        "1": [
          { name: "الرياضيات", weight: 4 },
          { name: "اللغة الإنجليزية", weight: 4 },
          { name: "الكيمياء", weight: 3 },
          { name: "الفيزياء", weight: 5 },
          { name: "علوم الأرض والفضاء", weight: 3 },
          { name: "التقنية الرقمية", weight: 2 },
          { name: "التربية الصحية والبدنية", weight: 3 },
          { name: "البحث ومصادر المعلومات", weight: 2 },
          { name: "المجال الاختياري", weight: 5 },
          { name: "النشاط", weight: 1 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ],
        "2": [
          { name: "الرياضيات", weight: 4 },
          { name: "اللغة الإنجليزية", weight: 4 },
          { name: "الفيزياء", weight: 5 },
          { name: "علوم الأرض والفضاء", weight: 3 },
          { name: "الفقه", weight: 2 },
          { name: "الدراسات الأدبية", weight: 2 },
          { name: "الدراسات النفسية والاجتماعية", weight: 2 },
          { name: "المواطنة الرقمية", weight: 2 },
          { name: "الجغرافيا", weight: 2 },
          { name: "المهارات الحياتية", weight: 2 },
          { name: "المجال الاختياري", weight: 2 },
          { name: "النشاط", weight: 2 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ]
      },
      cs: {
        "1": [
          { name: "الرياضيات", weight: 4 },
          { name: "اللغة الإنجليزية", weight: 4 },
          { name: "الكيمياء", weight: 3 },
          { name: "الفيزياء", weight: 5 },
          { name: "علوم الأرض والفضاء", weight: 3 },
          { name: "الدراسات الأدبية", weight: 2 },
          { name: "الذكاء الاصطناعي", weight: 2 },
          { name: "الأمن السيبراني", weight: 2 },
          { name: "التصميم الهندسي", weight: 3 },
          { name: "البحث ومصادر المعلومات", weight: 2 },
          { name: "النشاط", weight: 2 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ],
        "2": [
          { name: "الرياضيات", weight: 4 },
          { name: "اللغة الإنجليزية", weight: 4 },
          { name: "الفيزياء", weight: 5 },
          { name: "علوم الأرض والفضاء", weight: 3 },
          { name: "الفقه", weight: 2 },
          { name: "الذكاء الاصطناعي", weight: 3 },
          { name: "هندسة البرمجيات", weight: 3 },
          { name: "المهارات الحياتية", weight: 2 },
          { name: "التربية الصحية والبدنية", weight: 3 },
          { name: "مشروع التخرج", weight: 2 },
          { name: "النشاط", weight: 1 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ]
      },
      health: {
        "1": [
          { name: "الرياضيات", weight: 4 },
          { name: "اللغة الإنجليزية", weight: 4 },
          { name: "الكيمياء", weight: 3 },
          { name: "الفيزياء", weight: 5 },
          { name: "علوم الأرض والفضاء", weight: 3 },
          { name: "الدراسات الأدبية", weight: 2 },
          { name: "الرعاية الصحية", weight: 3 },
          { name: "أنظمة جسم الإنسان", weight: 3 },
          { name: "الإحصاء", weight: 2 },
          { name: "البحث ومصادر المعلومات", weight: 2 },
          { name: "النشاط", weight: 1 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ],
        "2": [
          { name: "الرياضيات", weight: 4 },
          { name: "اللغة الإنجليزية", weight: 4 },
          { name: "الفيزياء", weight: 5 },
          { name: "علوم الأرض والفضاء", weight: 3 },
          { name: "الفقه", weight: 2 },
          { name: "الرعاية الصحية", weight: 3 },
          { name: "أنظمة جسم الإنسان", weight: 2 },
          { name: "المهارات الحياتية", weight: 2 },
          { name: "التربية الصحية والبدنية", weight: 3 },
          { name: "مشروع التخرج", weight: 2 },
          { name: "النشاط", weight: 2 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ]
      },
      business: {
        "1": [
          { name: "اللغة الإنجليزية", weight: 4 },
          { name: "الفقه", weight: 2 },
          { name: "الدراسات الأدبية", weight: 2 },
          { name: "مبادئ الإدارة", weight: 3 },
          { name: "إدارة الفعاليات", weight: 4 },
          { name: "تخطيط الحملات التسويقية", weight: 3 },
          { name: "مبادئ القانون", weight: 3 },
          { name: "الإحصاء", weight: 2 },
          { name: "الجغرافيا", weight: 2 },
          { name: "التربية الصحية والبدنية", weight: 3 },
          { name: "البحث ومصادر المعلومات", weight: 2 },
          { name: "النشاط", weight: 2 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ],
        "2": [
          { name: "اللغة الإنجليزية", weight: 4 },
          { name: "الدراسات النفسية والاجتماعية", weight: 2 },
          { name: "الدراسات البلاغية والنقدية", weight: 3 },
          { name: "إدارة الفعاليات", weight: 3 },
          { name: "تخطيط الحملات التسويقية", weight: 4 },
          { name: "السكرتارية والإدارة المكتبية", weight: 3 },
          { name: "مبادئ القانون", weight: 4 },
          { name: "تطبيقات في القانون", weight: 2 },
          { name: "المواطنة الرقمية", weight: 2 },
          { name: "المهارات الحياتية", weight: 2 },
          { name: "مشروع التخرج", weight: 2 },
          { name: "النشاط", weight: 1 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ]
      },
      sharia: {
        "1": [
          { name: "القرآن الكريم", weight: 5 },
          { name: "اللغة الإنجليزية", weight: 4 },
          { name: "التفسير", weight: 2 },
          { name: "الفقه 1", weight: 2 },
          { name: "مصطلح الحديث", weight: 2 },
          { name: "الدراسات الأدبية", weight: 2 },
          { name: "مبادئ القانون", weight: 3 },
          { name: "المواطنة الرقمية", weight: 2 },
          { name: "الجغرافيا", weight: 2 },
          { name: "المهارات الحياتية", weight: 2 },
          { name: "التربية الصحية والبدنية", weight: 3 },
          { name: "البحث ومصادر المعلومات", weight: 2 },
          { name: "النشاط", weight: 1 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ],
        "2": [
          { name: "القرآن الكريم", weight: 5 },
          { name: "اللغة الإنجليزية", weight: 4 },
          { name: "الفقه 2", weight: 4 },
          { name: "أصول الفقه", weight: 2 },
          { name: "الفرائض", weight: 2 },
          { name: "الدراسات النفسية والاجتماعية", weight: 2 },
          { name: "الدراسات البلاغية والنقدية", weight: 3 },
          { name: "مبادئ القانون", weight: 4 },
          { name: "تطبيقات في القانون", weight: 2 },
          { name: "مشروع التخرج", weight: 2 },
          { name: "النشاط", weight: 2 },
          { name: "السلوك", weight: 1 },
          { name: "المواظبة", weight: 5 }
        ]
      }
    }
  };

  const yearSelect = document.getElementById("year-select");
  const termSelect = document.getElementById("term-select");
  const trackSelect = document.getElementById("track-select");
  const trackField = document.getElementById("track-field");
  const subjectsContainer = document.getElementById("subjects-container");
  const calculateBtn = document.getElementById("calculate-btn");
  const resetBtn = document.getElementById("reset-gpa-btn");
  const resultBox = document.getElementById("gpa-result");
  const scoreEl = document.getElementById("gpa-score");

  function needsTrack(year) {
    return year === "2" || year === "3";
  }

  function getSubjects() {
    const year = yearSelect.value;
    const term = termSelect.value;

    if (year === "1") {
      return SUBJECTS["1"][term] || [];
    }

    const track = trackSelect.value;
    return (SUBJECTS[year] && SUBJECTS[year][track] && SUBJECTS[year][track][term]) || [];
  }

  function renderSubjects() {
    const year = yearSelect.value;

    if (needsTrack(year)) {
      trackField.style.display = "";
    } else {
      trackField.style.display = "none";
    }

    const subjects = getSubjects();
    if (!subjects.length) {
      subjectsContainer.innerHTML = '<p class="section-desc">لا توجد مواد لهذا الاختيار حاليًا.</p>';
      resultBox.classList.add("hidden");
      return;
    }

    subjectsContainer.innerHTML = subjects.map((s, i) => `
      <div class="subject-row">
        <label for="grade-${i}">${s.name} <span class="weight-tag">وزن ${s.weight}</span></label>
        <input type="number" id="grade-${i}" class="grade-input" min="0" max="100" step="0.01" placeholder="الدرجة من 100" data-weight="${s.weight}">
      </div>
    `).join("");

    resultBox.classList.add("hidden");
  }

  function calculate() {
    const inputs = subjectsContainer.querySelectorAll(".grade-input");
    if (!inputs.length) return;

    let totalWeighted = 0;
    let totalWeight = 0;
    let filled = 0;

    inputs.forEach((input) => {
      const val = parseFloat(input.value);
      const weight = parseFloat(input.dataset.weight);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        totalWeighted += val * weight;
        totalWeight += weight;
        filled++;
      }
    });

    if (filled === 0) {
      alert("أدخل درجة واحدة على الأقل");
      return;
    }

    const gpa = totalWeight ? totalWeighted / totalWeight : 0;
    scoreEl.textContent = gpa.toFixed(2);
    resultBox.classList.remove("hidden");
  }

  function resetAll() {
    subjectsContainer.querySelectorAll(".grade-input").forEach((i) => (i.value = ""));
    resultBox.classList.add("hidden");
    scoreEl.textContent = "0.00";
  }

  yearSelect.addEventListener("change", renderSubjects);
  termSelect.addEventListener("change", renderSubjects);
  trackSelect.addEventListener("change", renderSubjects);
  calculateBtn.addEventListener("click", calculate);
  resetBtn.addEventListener("click", resetAll);

  renderSubjects();
})();
