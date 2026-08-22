/* gpa.js - محرك منظومة حاسبات المعدل الشامل لمنصة حيز */
(function () {
  // ===== بيانات المرحلة المتوسطة =====
  const MIDDLE_SUBJECTS = {
    "1": { // أول متوسط
      "1": [
        { name: "القرآن الكريم والدراسات الإسلامية", weight: 5 },
        { name: "اللغة العربية", weight: 5 },
        { name: "الدراسات الاجتماعية", weight: 3 },
        { name: "الرياضيات", weight: 6 },
        { name: "العلوم", weight: 4 },
        { name: "اللغة الإنجليزية", weight: 4 },
        { name: "المهارات الرقمية", weight: 2 },
        { name: "التربية الفنية", weight: 2 },
        { name: "التربية البدنية", weight: 2 },
        { name: "المهارات الحياتية والأسرية", weight: 1 },
        { name: "السلوك", weight: 1 },
        { name: "المواظبة", weight: 5 },
        { name: "النشاط", weight: 1 }
      ],
      "2": [
        { name: "القرآن الكريم والدراسات الإسلامية", weight: 5 },
        { name: "اللغة العربية", weight: 5 },
        { name: "الدراسات الاجتماعية", weight: 3 },
        { name: "الرياضيات", weight: 6 },
        { name: "العلوم", weight: 4 },
        { name: "اللغة الإنجليزية", weight: 4 },
        { name: "المهارات الرقمية", weight: 2 },
        { name: "التربية الفنية", weight: 2 },
        { name: "التربية البدنية", weight: 2 },
        { name: "المهارات الحياتية والأسرية", weight: 1 },
        { name: "السلوك", weight: 1 },
        { name: "المواظبة", weight: 5 },
        { name: "النشاط", weight: 1 }
      ]
    },
    "2": { // ثاني متوسط
      "1": [
        { name: "القرآن الكريم والدراسات الإسلامية", weight: 5 },
        { name: "اللغة العربية", weight: 5 },
        { name: "الدراسات الاجتماعية", weight: 3 },
        { name: "الرياضيات", weight: 6 },
        { name: "العلوم", weight: 4 },
        { name: "اللغة الإنجليزية", weight: 4 },
        { name: "المهارات الرقمية", weight: 2 },
        { name: "التربية الفنية", weight: 2 },
        { name: "التربية البدنية", weight: 2 },
        { name: "المهارات الحياتية والأسرية", weight: 1 },
        { name: "السلوك", weight: 1 },
        { name: "المواظبة", weight: 5 },
        { name: "النشاط", weight: 1 }
      ],
      "2": [
        { name: "القرآن الكريم والدراسات الإسلامية", weight: 5 },
        { name: "اللغة العربية", weight: 5 },
        { name: "الدراسات الاجتماعية", weight: 3 },
        { name: "الرياضيات", weight: 6 },
        { name: "العلوم", weight: 4 },
        { name: "اللغة الإنجليزية", weight: 4 },
        { name: "المهارات الرقمية", weight: 2 },
        { name: "التربية الفنية", weight: 2 },
        { name: "التربية البدنية", weight: 2 },
        { name: "المهارات الحياتية والأسرية", weight: 1 },
        { name: "السلوك", weight: 1 },
        { name: "المواظبة", weight: 5 },
        { name: "النشاط", weight: 1 }
      ]
    },
    "3": { // ثالث متوسط
      "1": [
        { name: "القرآن الكريم والدراسات الإسلامية", weight: 5 },
        { name: "اللغة العربية", weight: 4 },
        { name: "الدراسات الاجتماعية", weight: 2 },
        { name: "الرياضيات", weight: 6 },
        { name: "العلوم", weight: 4 },
        { name: "اللغة الإنجليزية", weight: 4 },
        { name: "المهارات الرقمية", weight: 2 },
        { name: "التربية الفنية", weight: 2 },
        { name: "التربية البدنية", weight: 2 },
        { name: "المهارات الحياتية والأسرية", weight: 1 },
        { name: "التفكير الناقد", weight: 2 },
        { name: "السلوك", weight: 1 },
        { name: "المواظبة", weight: 5 },
        { name: "النشاط", weight: 1 }
      ],
      "2": [
        { name: "القرآن الكريم والدراسات الإسلامية", weight: 5 },
        { name: "اللغة العربية", weight: 4 },
        { name: "الدراسات الاجتماعية", weight: 2 },
        { name: "الرياضيات", weight: 6 },
        { name: "العلوم", weight: 4 },
        { name: "اللغة الإنجليزية", weight: 4 },
        { name: "المهارات الرقمية", weight: 2 },
        { name: "التربية الفنية", weight: 2 },
        { name: "التربية البدنية", weight: 2 },
        { name: "المهارات الحياتية والأسرية", weight: 1 },
        { name: "التفكير الناقد", weight: 2 },
        { name: "السلوك", weight: 1 },
        { name: "المواظبة", weight: 5 },
        { name: "النشاط", weight: 1 }
      ]
    }
  };

  // ===== بيانات المرحلة الثانوية =====
  const SECONDARY_SUBJECTS = {
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

  // تهيئة المحرك بالاعتماد على الصفحة أو المكون النشط
  function initEngine() {
    const calcCard = document.querySelector(".card[data-calc-page]");
    if (!calcCard) return;

    const pageType = calcCard.getAttribute('data-calc-page'); // first-intermediate, second-secondary, cumulative, weighted ...

    if (pageType === "cumulative") {
      initCumulativePage();
    } else if (pageType === "weighted") {
      initWeightedPage();
    } else {
      initSubjectPage(calcCard);
    }
  }

  // ===== تشغيل صفحة المواد التخصصية =====
  function initSubjectPage(card) {
    const stage = card.dataset.stage; // middle | secondary
    const defaultYear = card.dataset.year || "1";

    const termSelect = document.getElementById("term-select");
    const trackSelect = document.getElementById("track-select");
    const subjectsContainer = document.getElementById("subjects-container");
    const calculateBtn = document.getElementById("calculate-btn");
    const resetBtn = document.getElementById("reset-gpa-btn");
    const resultBox = document.getElementById("gpa-result");
    const scoreEl = document.getElementById("gpa-score");

    function getSubjects() {
      const term = termSelect ? termSelect.value : "1";

      if (stage === "middle") {
        return (MIDDLE_SUBJECTS[defaultYear] && MIDDLE_SUBJECTS[defaultYear][term]) || [];
      }

      // secondary
      if (defaultYear === "1") {
        return (SECONDARY_SUBJECTS["1"] && SECONDARY_SUBJECTS["1"][term]) || [];
      }

      const track = trackSelect ? trackSelect.value : "general";
      return (SECONDARY_SUBJECTS[defaultYear] &&
              SECONDARY_SUBJECTS[defaultYear][track] &&
              SECONDARY_SUBJECTS[defaultYear][track][term]) || [];
    }

    function renderSubjects() {
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
      const subjectsMeta = getSubjects();
      const list = [];
      inputs.forEach((input, i) => {
        const meta = subjectsMeta[i] || {};
        const weight = parseFloat(input.dataset.weight);
        const val = parseFloat(input.value);
        list.push({
          name: meta.name || ("مادة " + (i + 1)),
          weight: weight,
          grade: !isNaN(val) && val >= 0 && val <= 100 ? val : null,
          realGrade: val
        });
      });

      const filled = list.filter((s) => s.grade !== null).length;
      if (!filled) {
        alert("أدخل درجة واحدة على الأقل");
        return;
      }

      let gpa = null;
      if (typeof hayyizComputeWeightedGpa === "function") {
        gpa = hayyizComputeWeightedGpa(list.filter((s) => s.grade !== null));
      } else {
        let totalWeighted = 0, totalWeight = 0;
        list.forEach((s) => {
          if (s.grade !== null && !isNaN(s.weight)) {
            totalWeighted += s.grade * s.weight;
            totalWeight += s.weight;
          }
        });
        gpa = totalWeight ? totalWeighted / totalWeight : null;
      }

      if (gpa === null) {
        alert("أدخل درجة واحدة على الأقل");
        return;
      }

      // حفظ snapshot بالبيانات الحقيقية
      const snapshot = {
        stage: stage,
        year: defaultYear,
        term: termSelect ? termSelect.value : "1",
        track: trackSelect ? trackSelect.value : null,
        subjects: list.filter((s) => s.grade !== null),
        gpa: gpa
      };
      if (typeof hayyizSaveGpaSnapshot === "function") {
        hayyizSaveGpaSnapshot(snapshot);
      }

      scoreEl.textContent = gpa.toFixed(2);
      resultBox.classList.remove("hidden");
      ensureShareButtons(resultBox, gpa.toFixed(2), "المعدل الموزون");
      renderGoalAndWhatIf(list, gpa, card);
    }

    function resetAll() {
      subjectsContainer.querySelectorAll(".grade-input").forEach((i) => (i.value = ""));
      resultBox.classList.add("hidden");
      scoreEl.textContent = "0.00";
      removeShareButtons(resultBox);
      const panel = document.getElementById("hayyiz-gpa-planning");
      if (panel) panel.style.display = "none";
    }

    if (termSelect) termSelect.addEventListener("change", renderSubjects);
    if (trackSelect) trackSelect.addEventListener("change", renderSubjects);
    if (calculateBtn) calculateBtn.addEventListener("click", calculate);
    if (resetBtn) resetBtn.addEventListener("click", resetAll);

    renderSubjects();
  }

  // ===== تشغيل صفحة التراكمي =====
  function initCumulativePage() {
    const cumY1 = document.getElementById("cum-y1");
    const cumY2 = document.getElementById("cum-y2");
    const cumY3 = document.getElementById("cum-y3");
    const cumProgress = document.getElementById("cum-progress");
    const cumResult = document.getElementById("cum-result");
    const cumScore = document.getElementById("cum-score");
    const cumCalculateBtn = document.getElementById("cum-calculate-btn");
    const cumResetBtn = document.getElementById("cum-reset-btn");

    function updateCumProgress() {
      let filled = 0;
      [cumY1, cumY2, cumY3].forEach((inp) => {
        if (!inp) return;
        const v = parseFloat(inp.value);
        if (!isNaN(v) && v >= 0 && v <= 100) filled++;
      });
      if (cumProgress) {
        cumProgress.textContent = filled + " من 3 صفوف" + (filled === 3 ? " — 100%" : "");
      }
    }

    function calculateCumulative() {
      const y1 = parseFloat(cumY1.value);
      const y2 = parseFloat(cumY2.value);
      const y3 = parseFloat(cumY3.value);

      let filled = 0;
      [y1, y2, y3].forEach((v) => {
        if (!isNaN(v) && v >= 0 && v <= 100) filled++;
      });

      if (filled < 3) {
        alert("يرجى إدخال معدلات السنوات الثلاث (أول وثاني وثالث ثانوي)");
        return;
      }

      if ([y1, y2, y3].some((v) => isNaN(v) || v < 0 || v > 100)) {
        alert("تأكد أن جميع المعدلات بين 0 و 100");
        return;
      }

      const cumulative = y1 * 0.20 + y2 * 0.40 + y3 * 0.40;
      cumScore.textContent = cumulative.toFixed(2);
      cumResult.classList.remove("hidden");
      ensureShareButtons(cumResult, cumulative.toFixed(2), "المعدل التراكمي");
    }

    function resetCumulative() {
      if (cumY1) cumY1.value = "";
      if (cumY2) cumY2.value = "";
      if (cumY3) cumY3.value = "";
      if (cumResult) cumResult.classList.add("hidden");
      if (cumScore) cumScore.textContent = "0.00";
      removeShareButtons(cumResult);
      updateCumProgress();
    }

    if (cumCalculateBtn) cumCalculateBtn.addEventListener("click", calculateCumulative);
    if (cumResetBtn) cumResetBtn.addEventListener("click", resetCumulative);
    [cumY1, cumY2, cumY3].forEach((inp) => {
      if (inp) inp.addEventListener("input", updateCumProgress);
    });

    updateCumProgress();
  }

  // ===== تشغيل صفحة النسبة الموزونة =====
  function initWeightedPage() {
    const weightedRowsEl = document.getElementById("weighted-rows");
    const weightedAddBtn = document.getElementById("weighted-add-btn");
    const weightedRemainingEl = document.getElementById("weighted-remaining");
    const weightedLeftEl = document.getElementById("weighted-left");
    const weightedResult = document.getElementById("weighted-result");
    const weightedScore = document.getElementById("weighted-score");
    const weightedCalculateBtn = document.getElementById("weighted-calculate-btn");
    const weightedResetBtn = document.getElementById("weighted-reset-btn");

    let weightedItems = [
      { id: 1, name: "الثانوية العامة", percent: 40, score: "" },
      { id: 2, name: "القدرات العامة", percent: 30, score: "" },
      { id: 3, name: "الاختبار التحصيلي", percent: 30, score: "" }
    ];
    let nextWeightedId = 4;

    function totalWeightedPercent() {
      return weightedItems.reduce((sum, item) => sum + (parseFloat(item.percent) || 0), 0);
    }

    function updateWeightedRemaining() {
      if (!weightedRemainingEl || !weightedLeftEl) return;
      const total = totalWeightedPercent();
      const left = Math.max(0, 100 - total);
      weightedLeftEl.textContent = left.toFixed(0) + "%";
      weightedRemainingEl.classList.remove("warn", "ok");
      if (total > 100) {
        weightedRemainingEl.classList.add("warn");
        weightedRemainingEl.innerHTML = "تجاوزت 100% — مجموع النسب حالياً <strong>" + total.toFixed(0) + "%</strong>";
      } else if (total === 100) {
        weightedRemainingEl.classList.add("ok");
        weightedRemainingEl.innerHTML = "ممتاز — مجموع النسب <strong>100%</strong>";
      } else {
        weightedRemainingEl.innerHTML = "لا يمكن تجاوز 100% — النسبة المتبقية <strong id=\"weighted-left\">" + left.toFixed(0) + "%</strong>";
      }
    }

    function renderWeightedRows() {
      if (!weightedRowsEl) return;
      weightedRowsEl.innerHTML = weightedItems.map((item) => `
        <div class="weighted-row" data-id="${item.id}">
          <input type="text" class="w-name" value="${item.name}" placeholder="اسم الاختبار">
          <div class="pct-wrap">
            <input type="number" class="w-percent" min="0" max="100" step="1" value="${item.percent}" placeholder="0">
            <span>%</span>
          </div>
          <div class="score-wrap">
            <input type="number" class="w-score" min="0" max="100" step="0.01" value="${item.score}" placeholder="الدرجة">
            <span>/100</span>
          </div>
          <button type="button" class="remove-btn" title="حذف" data-id="${item.id}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `).join("");

      weightedRowsEl.querySelectorAll(".w-name").forEach((inp) => {
        inp.addEventListener("input", (e) => {
          const id = parseInt(e.target.closest(".weighted-row").dataset.id, 10);
          const item = weightedItems.find((x) => x.id === id);
          if (item) item.name = e.target.value;
        });
      });
      weightedRowsEl.querySelectorAll(".w-percent").forEach((inp) => {
        inp.addEventListener("input", (e) => {
          const id = parseInt(e.target.closest(".weighted-row").dataset.id, 10);
          const item = weightedItems.find((x) => x.id === id);
          if (item) item.percent = parseFloat(e.target.value) || 0;
          updateWeightedRemaining();
        });
      });
      weightedRowsEl.querySelectorAll(".w-score").forEach((inp) => {
        inp.addEventListener("input", (e) => {
          const id = parseInt(e.target.closest(".weighted-row").dataset.id, 10);
          const item = weightedItems.find((x) => x.id === id);
          if (item) item.score = e.target.value;
        });
      });
      weightedRowsEl.querySelectorAll(".remove-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = parseInt(btn.dataset.id, 10);
          if (weightedItems.length <= 1) {
            alert("يجب الإبقاء على اختبار واحد على الأقل");
            return;
          }
          weightedItems = weightedItems.filter((x) => x.id !== id);
          renderWeightedRows();
        });
      });

      updateWeightedRemaining();
    }

    function addWeightedItem() {
      weightedItems.push({
        id: nextWeightedId++,
        name: "اختبار جديد",
        percent: 0,
        score: ""
      });
      renderWeightedRows();
    }

    function calculateWeighted() {
      const totalPct = totalWeightedPercent();
      if (totalPct > 100) {
        alert("مجموع النسب يتجاوز 100%. عدّل النسب أولاً.");
        return;
      }
      if (totalPct === 0) {
        alert("أدخل نسباً صحيحة أولاً");
        return;
      }

      let sum = 0, filled = 0;
      weightedItems.forEach((item) => {
        const score = parseFloat(item.score);
        const pct = parseFloat(item.percent) || 0;
        if (!isNaN(score) && score >= 0 && score <= 100 && pct > 0) {
          sum += score * (pct / 100);
          filled++;
        }
      });

      if (filled === 0) {
        alert("أدخل درجة واحدة على الأقل");
        return;
      }

      weightedScore.textContent = sum.toFixed(2);
      weightedResult.classList.remove("hidden");
      ensureShareButtons(weightedResult, sum.toFixed(2), "النسبة الموزونة");
    }

    function resetWeightedScores() {
      weightedItems.forEach((item) => { item.score = ""; });
      weightedResult.classList.add("hidden");
      weightedScore.textContent = "0.00";
      removeShareButtons(weightedResult);
      renderWeightedRows();
    }

    if (weightedAddBtn) weightedAddBtn.addEventListener("click", addWeightedItem);
    if (weightedCalculateBtn) weightedCalculateBtn.addEventListener("click", calculateWeighted);
    if (weightedResetBtn) weightedResetBtn.addEventListener("click", resetWeightedScores);

    renderWeightedRows();
  }

  // ===== المحرك العكسي للهدف الأكاديمي وتحليل التأثير =====
  function hayyizCalculateMaxPossibleGpa(list) {
    if (!Array.isArray(list) || !list.length) return null;
    const valid = list.filter((s) => s.grade !== null && s.grade !== undefined && !isNaN(s.grade));
    if (!valid.length) return null;
    const maxList = valid.map((s) => ({ grade: 100, weight: s.weight }));
    return hayyizComputeWeightedGpa(maxList);
  }

  function hayyizCalculateSubjectImpacts(list) {
    if (!Array.isArray(list) || !list.length) return [];
    const valid = list.filter((s) => s.grade !== null && s.grade !== undefined && !isNaN(s.grade));
    if (!valid.length) return [];

    const baselineGpa = hayyizComputeWeightedGpa(valid);
    if (baselineGpa === null) return [];

    const impacts = valid.map((s, originalIndex) => {
      const grade = parseFloat(s.grade);
      const weight = parseFloat(s.weight);
      const headroom = Math.max(0, 100 - grade);

      let marginalImpact = 0;
      if (headroom > 0) {
        const testGradePlus1 = Math.min(100, grade + 1);
        const evalPlus1List = valid.map((item, idx) => ({
          grade: idx === originalIndex ? testGradePlus1 : item.grade,
          weight: item.weight
        }));
        const gpaPlus1 = hayyizComputeWeightedGpa(evalPlus1List);
        const deltaGrade = testGradePlus1 - grade;
        marginalImpact = deltaGrade > 0 && gpaPlus1 !== null ? (gpaPlus1 - baselineGpa) / deltaGrade : 0;
      }

      let maxGpaGain = 0;
      if (headroom > 0) {
        const evalMaxList = valid.map((item, idx) => ({
          grade: idx === originalIndex ? 100 : item.grade,
          weight: item.weight
        }));
        const gpaMax = hayyizComputeWeightedGpa(evalMaxList);
        maxGpaGain = gpaMax !== null ? Math.max(0, gpaMax - baselineGpa) : 0;
      }

      let priority = "منخفضة";
      if (headroom > 0) {
        if (maxGpaGain >= 1.2) priority = "عالية جدًا";
        else if (maxGpaGain >= 0.6) priority = "عالية";
        else if (maxGpaGain >= 0.2) priority = "متوسطة";
        else priority = "منخفضة";
      }

      return {
        index: originalIndex,
        name: s.name,
        grade: grade,
        weight: weight,
        headroom: headroom,
        marginalImpact: marginalImpact,
        maxGpaGain: maxGpaGain,
        priority: priority
      };
    });

    impacts.sort((a, b) => {
      if (Math.abs(b.maxGpaGain - a.maxGpaGain) > 1e-6) {
        return b.maxGpaGain - a.maxGpaGain;
      }
      return b.marginalImpact - a.marginalImpact;
    });

    return impacts;
  }

  function hayyizAnalyzeAcademicTarget(list, targetGpa) {
    if (!Array.isArray(list) || !list.length || targetGpa === null || targetGpa === undefined || isNaN(targetGpa)) {
      return null;
    }
    const valid = list.filter((s) => s.grade !== null && s.grade !== undefined && !isNaN(s.grade));
    if (!valid.length) return null;

    const currentGpa = hayyizComputeWeightedGpa(valid);
    if (currentGpa === null) return null;

    const maxPossibleGpa = hayyizCalculateMaxPossibleGpa(valid);
    const totalWeight = valid.reduce((sum, s) => sum + (parseFloat(s.weight) || 0), 0);
    const currentWeightedSum = valid.reduce((sum, s) => sum + s.grade * s.weight, 0);
    const targetWeightedSum = targetGpa * totalWeight;
    const neededIncrease = targetWeightedSum - currentWeightedSum;

    if (targetGpa <= currentGpa + 0.00001) {
      return {
        status: "achieved",
        currentGpa: currentGpa,
        targetGpa: targetGpa,
        maxPossibleGpa: maxPossibleGpa,
        gapToTarget: 0,
        isPossible: true,
        recommendedGrades: valid.map((s) => ({
          name: s.name,
          currentGrade: s.grade,
          requiredGrade: s.grade,
          weight: s.weight,
          impactPriority: "منخفضة"
        })),
        verifiedGpa: currentGpa
      };
    }

    if (targetGpa > maxPossibleGpa + 0.00001 || targetGpa > 100) {
      return {
        status: "impossible",
        currentGpa: currentGpa,
        targetGpa: targetGpa,
        maxPossibleGpa: maxPossibleGpa,
        gapToMax: maxPossibleGpa - currentGpa,
        isPossible: false,
        recommendedGrades: [],
        verifiedGpa: null
      };
    }

    const totalHeadroomWeighted = valid.reduce((sum, s) => sum + (100 - s.grade) * s.weight, 0);
    const ratio = totalHeadroomWeighted > 0 ? neededIncrease / totalHeadroomWeighted : 0;

    const rawRecommended = valid.map((s) => {
      const headroom = 100 - s.grade;
      const reqExact = headroom > 0 ? s.grade + ratio * headroom : s.grade;
      return Math.min(100, Math.max(s.grade, reqExact));
    });

    const roundedRecommended = rawRecommended.map((req, i) => {
      if (req >= 100) return 100;
      const current = valid[i].grade;
      let rounded = Math.ceil(req * 100) / 100;
      if (rounded < current) rounded = current;
      if (rounded > 100) rounded = 100;
      return rounded;
    });

    const evalList = valid.map((s, i) => ({ grade: roundedRecommended[i], weight: s.weight }));
    let verifiedGpa = hayyizComputeWeightedGpa(evalList);

    if (verifiedGpa < targetGpa - 1e-5) {
      const sortedIndices = valid
        .map((s, i) => ({ i, weight: s.weight, headroom: 100 - roundedRecommended[i] }))
        .filter((x) => x.headroom > 1e-4)
        .sort((a, b) => b.weight - a.weight);

      for (let item of sortedIndices) {
        while (verifiedGpa < targetGpa - 1e-5 && roundedRecommended[item.i] < 100) {
          roundedRecommended[item.i] = Math.min(100, Math.round((roundedRecommended[item.i] + 0.01) * 100) / 100);
          evalList[item.i].grade = roundedRecommended[item.i];
          verifiedGpa = hayyizComputeWeightedGpa(evalList);
        }
        if (verifiedGpa >= targetGpa - 1e-5) break;
      }
    }

    const subjectImpacts = hayyizCalculateSubjectImpacts(valid);
    const impactMap = {};
    subjectImpacts.forEach((imp) => {
      impactMap[imp.index] = imp;
    });

    const recommendedGrades = valid.map((s, i) => {
      const imp = impactMap[i] || {};
      return {
        name: s.name,
        currentGrade: s.grade,
        requiredGrade: roundedRecommended[i],
        weight: s.weight,
        impactPriority: imp.priority || "متوسطة"
      };
    });

    return {
      status: "reachable",
      currentGpa: currentGpa,
      targetGpa: targetGpa,
      maxPossibleGpa: maxPossibleGpa,
      gapToTarget: targetGpa - currentGpa,
      isPossible: true,
      recommendedGrades: recommendedGrades,
      verifiedGpa: verifiedGpa
    };
  }

  // تصدير الدوال للمحيط العام للاستخدام والاختبار
  if (typeof window !== "undefined") {
    window.hayyizCalculateMaxPossibleGpa = hayyizCalculateMaxPossibleGpa;
    window.hayyizCalculateSubjectImpacts = hayyizCalculateSubjectImpacts;
    window.hayyizAnalyzeAcademicTarget = hayyizAnalyzeAcademicTarget;
  }

  // ===== الهدف الأكاديمي و سيناريو "ماذا لو؟" =====
  let whatIfActive = false;

  function ensurePlanningPanel(parentCard) {
    let panel = document.getElementById("hayyiz-gpa-planning");
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "hayyiz-gpa-planning";
    panel.className = "gpa-planning";
    panel.style.cssText = "margin-top:1.5rem;";
    parentCard.appendChild(panel);
    return panel;
  }

  function renderGoalAndWhatIf(list, realGpa, parentCard) {
    const panel = ensurePlanningPanel(parentCard);
    panel.replaceChildren();
    panel.style.display = "block";

    // --- بطاقة الهدف الأكاديمي ---
    const goalCard = document.createElement("div");
    goalCard.className = "card";
    goalCard.style.cssText = "margin:0 0 1rem; padding:1.1rem 1.25rem; box-shadow:var(--shadow);";

    const goalHead = document.createElement("div");
    goalHead.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.75rem;";
    const goalTitle = document.createElement("h3");
    goalTitle.style.cssText = "font-size:1.05rem; margin:0;";
    goalTitle.innerHTML = '<i class="fa-solid fa-bullseye" aria-hidden="true"></i> هدفك الأكاديمي';
    goalHead.appendChild(goalTitle);
    goalCard.appendChild(goalHead);

    const existingGoal = typeof hayyizGetAcademicGoal === "function" ? hayyizGetAcademicGoal() : null;
    const targetVal = existingGoal && typeof existingGoal.target === "number" ? existingGoal.target : "";

    const goalForm = document.createElement("div");
    goalForm.className = "todo-options";
    goalForm.style.marginBottom = "0.75rem";
    goalForm.innerHTML =
      '<div class="option-field"><label>معدلك الحالي</label>' +
      '<input type="text" id="goal-current-display" readonly value="' + realGpa.toFixed(2) + '%"></div>' +
      '<div class="option-field"><label>معدلك المستهدف</label>' +
      '<input type="number" id="goal-target-input" min="0" max="100" step="0.01" placeholder="مثال: 95" value="' +
      (targetVal !== "" ? targetVal : "") + '"></div>';
    goalCard.appendChild(goalForm);

    const gapEl = document.createElement("p");
    gapEl.id = "goal-gap-text";
    gapEl.style.cssText = "margin:0.35rem 0 0.75rem; color:var(--text-muted); font-size:0.95rem;";
    goalCard.appendChild(gapEl);

    const progressWrap = document.createElement("div");
    progressWrap.className = "timer-progress";
    progressWrap.style.cssText = "height:10px; margin-bottom:0.85rem;";
    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressBar.id = "goal-progress-bar";
    progressBar.style.width = "0%";
    progressWrap.appendChild(progressBar);
    goalCard.appendChild(progressWrap);

    const saveGoalBtn = document.createElement("button");
    saveGoalBtn.type = "button";
    saveGoalBtn.className = "btn btn-primary btn-sm";
    saveGoalBtn.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> حفظ الهدف';
    saveGoalBtn.addEventListener("click", () => {
      const t = parseFloat(document.getElementById("goal-target-input").value);
      if (isNaN(t) || t < 0 || t > 100) {
        alert("أدخل هدفاً بين 0 و 100");
        return;
      }
      if (typeof hayyizSaveAcademicGoal === "function") {
        hayyizSaveAcademicGoal({ target: t, updatedAt: Date.now() });
      }
      updateGoalGapUI(realGpa, t);
      alert("تم حفظ هدفك الدراسي بنجاح");
    });
    goalCard.appendChild(saveGoalBtn);
    panel.appendChild(goalCard);

    updateGoalGapUI(realGpa, targetVal !== "" ? targetVal : null);

    // --- بطاقة "ماذا أحتاج للوصول إلى هدفي؟" ---
    const needCard = document.createElement("div");
    needCard.className = "card";
    needCard.id = "hayyiz-what-need-card";
    needCard.style.cssText = "margin:0 0 1rem; padding:1.1rem 1.25rem; box-shadow:var(--shadow);";

    const needTitle = document.createElement("h3");
    needTitle.style.cssText = "font-size:1.05rem; margin:0 0 0.5rem;";
    needTitle.innerHTML = '<i class="fa-solid fa-compass-drafting" aria-hidden="true"></i> ماذا أحتاج للوصول إلى هدفي؟';
    needCard.appendChild(needTitle);

    const needBody = document.createElement("div");
    needBody.id = "whatneed-body";
    needBody.style.cssText = "margin-top:0.75rem;";
    needCard.appendChild(needBody);

    panel.appendChild(needCard);

    // --- سيناريو "ماذا لو؟" ---
    const whatCard = document.createElement("div");
    whatCard.className = "card";
    whatCard.id = "hayyiz-whatif-card";
    whatCard.style.cssText = "margin:0; padding:1.1rem 1.25rem; box-shadow:var(--shadow);";

    const whatTitle = document.createElement("h3");
    whatTitle.style.cssText = "font-size:1.05rem; margin:0 0 0.5rem;";
    whatTitle.innerHTML = '<i class="fa-solid fa-flask" aria-hidden="true"></i> سيناريو ماذا لو؟';
    whatCard.appendChild(whatTitle);

    const whatDesc = document.createElement("p");
    whatDesc.style.cssText = "color:var(--text-muted); font-size:0.92rem; margin:0 0 0.85rem;";
    whatDesc.textContent = "جرب درجات مستهدفة مفترضة وشاهد تأثيرها المباشر على المعدل.";
    whatCard.appendChild(whatDesc);

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "btn btn-outline";
    toggleBtn.id = "whatif-toggle-btn";
    toggleBtn.innerHTML = whatIfActive
      ? '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i> إخفاء السيناريو'
      : '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> فتح سيناريو ماذا لو؟';
    whatCard.appendChild(toggleBtn);

    const calcNeededInsteadBtn = document.createElement("button");
    calcNeededInsteadBtn.type = "button";
    calcNeededInsteadBtn.className = "btn btn-secondary btn-sm";
    calcNeededInsteadBtn.style.cssText = "margin-right:0.5rem;";
    calcNeededInsteadBtn.innerHTML = '<i class="fa-solid fa-calculator" aria-hidden="true"></i> احسب لي الدرجات المطلوبة بدلًا من التجربة يدويًا';
    calcNeededInsteadBtn.addEventListener("click", () => {
      needCard.scrollIntoView({ behavior: "smooth" });
      const targetInput = document.getElementById("goal-target-input");
      if (targetInput) targetInput.focus();
    });
    whatCard.appendChild(calcNeededInsteadBtn);

    const whatBody = document.createElement("div");
    whatBody.id = "whatif-body";
    whatBody.style.display = whatIfActive ? "block" : "none";
    whatBody.style.marginTop = "1rem";
    whatCard.appendChild(whatBody);

    toggleBtn.addEventListener("click", () => {
      whatIfActive = !whatIfActive;
      whatBody.style.display = whatIfActive ? "block" : "none";
      toggleBtn.innerHTML = whatIfActive
        ? '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i> إخفاء السيناريو'
        : '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> فتح سيناريو ماذا لو؟';
      if (whatIfActive) renderWhatIfBody(whatBody, list, realGpa);
    });

    if (whatIfActive) renderWhatIfBody(whatBody, list, realGpa);

    panel.appendChild(whatCard);

    // تحديث تفاصيل "ماذا أحتاج؟"
    refreshWhatNeedUI(list, realGpa, targetVal !== "" ? targetVal : null);

    // ربط إدخال الهدف بتحديث النتائج تفاعليًا
    const targetInputEl = document.getElementById("goal-target-input");
    if (targetInputEl) {
      targetInputEl.addEventListener("input", () => {
        const val = parseFloat(targetInputEl.value);
        const t = !isNaN(val) && val >= 0 && val <= 100 ? val : null;
        updateGoalGapUI(realGpa, t);
        refreshWhatNeedUI(list, realGpa, t);
      });
    }
  }

  function refreshWhatNeedUI(list, realGpa, targetGpa) {
    const container = document.getElementById("whatneed-body");
    if (!container) return;
    container.replaceChildren();

    if (targetGpa === null || targetGpa === undefined || isNaN(targetGpa)) {
      const promptText = document.createElement("p");
      promptText.style.cssText = "color:var(--text-muted); font-size:0.95rem; margin:0 0 0.75rem;";
      promptText.textContent = "يرجى تحديد وملاحظة هدفك الأكاديمي أولاً لحساب الدرجات المطلوبة.";
      container.appendChild(promptText);
      renderSubjectImpactsSection(container, list);
      return;
    }

    const calcBtnWrap = document.createElement("div");
    calcBtnWrap.style.marginBottom = "0.75rem";
    const calcBtn = document.createElement("button");
    calcBtn.type = "button";
    calcBtn.className = "btn btn-primary btn-sm";
    calcBtn.innerHTML = '<i class="fa-solid fa-calculator" aria-hidden="true"></i> احسب المطلوب';
    calcBtn.addEventListener("click", () => {
      renderTargetAnalysisDetails(container, list, realGpa, targetGpa);
    });
    calcBtnWrap.appendChild(calcBtn);
    container.appendChild(calcBtnWrap);

    renderTargetAnalysisDetails(container, list, realGpa, targetGpa);
  }

  function renderTargetAnalysisDetails(container, list, realGpa, targetGpa) {
    // إزالة التفاصيل القديمة مع الإبقاء على زر الحساب إن وجد
    const oldDetails = container.querySelector(".whatneed-details");
    if (oldDetails) oldDetails.remove();

    const details = document.createElement("div");
    details.className = "whatneed-details";
    details.style.cssText = "margin-top:0.75rem;";

    const introText = document.createElement("p");
    introText.style.cssText = "color:var(--text-muted); font-size:0.93rem; margin:0 0 0.85rem;";
    introText.textContent = `بناءً على درجاتك الحالية وهدفك ${targetGpa.toFixed(2)}، نحسب الدرجات المطلوبة في المواد التي يمكنك تحسينها:`;
    details.appendChild(introText);

    const result = hayyizAnalyzeAcademicTarget(list, targetGpa);

    if (!result) {
      container.appendChild(details);
      return;
    }

    if (result.status === "achieved") {
      const msg = document.createElement("div");
      msg.className = "dash-alert ok";
      msg.style.cssText = "background:color-mix(in srgb, var(--success) 12%, var(--bg)); color:var(--text); padding:0.85rem; border-radius:10px; margin-bottom:1rem;";
      msg.innerHTML = `<strong><i class="fa-solid fa-circle-check" style="color:var(--success);"></i> الهدف محقق بالفعل!</strong><br>معدلك الحالي (${realGpa.toFixed(2)}%) يتجاوز أو يساوي هدفك (${targetGpa.toFixed(2)}%).`;
      details.appendChild(msg);
    } else if (result.status === "impossible") {
      const msg = document.createElement("div");
      msg.className = "dash-alert warn";
      msg.style.cssText = "background:color-mix(in srgb, var(--danger) 12%, var(--bg)); color:var(--text); padding:0.85rem; border-radius:10px; margin-bottom:1rem;";
      msg.innerHTML =
        `<strong><i class="fa-solid fa-triangle-exclamation" style="color:var(--danger);"></i> الهدف غير ممكن بالدرجات الحالية</strong><br>` +
        `هدفك: <strong>${targetGpa.toFixed(2)}%</strong> | أقصى معدل ممكن: <strong>${result.maxPossibleGpa.toFixed(2)}%</strong><br>` +
        `الفرق: <strong>${result.gapToMax.toFixed(2)} نقطة</strong><br>` +
        `<span style="font-size:0.88rem; color:var(--text-muted);">للوصول إلى ${result.maxPossibleGpa.toFixed(2)}% تحتاج الحصول على 100 في جميع المواد القابلة للتحسين.</span>`;
      details.appendChild(msg);
    } else if (result.status === "reachable") {
      const headerBox = document.createElement("div");
      headerBox.style.cssText = "background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:0.85rem 1rem; margin-bottom:1rem;";
      headerBox.innerHTML =
        `<div style="font-weight:700; font-size:1rem; color:var(--primary); margin-bottom:0.2rem;">للوصول إلى ${targetGpa.toFixed(2)}%</div>` +
        `<div style="font-size:0.88rem; color:var(--text-muted);">الزيادة المطلوبة في المعدل: +${result.gapToTarget.toFixed(2)} نقطة | النتيجة المحققة حسابيًا: <strong>${result.verifiedGpa.toFixed(2)}%</strong></div>`;
      details.appendChild(headerBox);

      // جدول الدرجات المطلوبة (Responsive)
      const tableWrap = document.createElement("div");
      tableWrap.style.cssText = "overflow-x:auto; margin-bottom:1rem;";

      const table = document.createElement("table");
      table.style.cssText = "width:100%; border-collapse:collapse; font-size:0.92rem; text-align:right;";
      table.innerHTML = `
        <thead>
          <tr style="border-bottom:2px solid var(--border); background:var(--bg);">
            <th style="padding:8px 10px;">المادة</th>
            <th style="padding:8px 10px; text-align:center;">الدرجة الحالية</th>
            <th style="padding:8px 10px; text-align:center;">الدرجة المطلوبة</th>
            <th style="padding:8px 10px; text-align:center;">الوزن</th>
            <th style="padding:8px 10px; text-align:center;">التأثير</th>
          </tr>
        </thead>
        <tbody>
          ${result.recommendedGrades.map((rg) => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:8px 10px; font-weight:600;">${rg.name}</td>
              <td style="padding:8px 10px; text-align:center;">${rg.currentGrade.toFixed(2)}</td>
              <td style="padding:8px 10px; text-align:center; font-weight:700; color:var(--primary);">${rg.requiredGrade.toFixed(2)}</td>
              <td style="padding:8px 10px; text-align:center;">${rg.weight}</td>
              <td style="padding:8px 10px; text-align:center;">
                <span style="font-size:0.8rem; padding:2px 8px; border-radius:12px; background:var(--bg); border:1px solid var(--border);">${rg.impactPriority}</span>
              </td>
            </tr>
          `).join("")}
        </tbody>
      `;
      tableWrap.appendChild(table);
      details.appendChild(tableWrap);

      // زر نقل الخطة إلى ماذا لو
      const tryPlanBtn = document.createElement("button");
      tryPlanBtn.type = "button";
      tryPlanBtn.className = "btn btn-primary btn-sm";
      tryPlanBtn.style.cssText = "margin-bottom:1rem;";
      tryPlanBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> جرّب هذه الخطة في ماذا لو؟';
      tryPlanBtn.addEventListener("click", () => {
        whatIfActive = true;
        const whatBody = document.getElementById("whatif-body");
        const toggleBtn = document.getElementById("whatif-toggle-btn");
        if (whatBody) whatBody.style.display = "block";
        if (toggleBtn) {
          toggleBtn.innerHTML = '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i> إخفاء السيناريو';
        }
        renderWhatIfBody(whatBody, list, realGpa);

        // تعبئة المدخلات بالأرقام المقترحة
        const inputs = document.querySelectorAll("#whatif-body .whatif-input");
        inputs.forEach((inp) => {
          const idx = parseInt(inp.dataset.index, 10);
          const validItem = list.filter((s) => s.grade !== null && s.grade !== undefined && !isNaN(s.grade))[idx];
          if (validItem) {
            const rec = result.recommendedGrades.find((r) => r.name === validItem.name);
            if (rec) {
              inp.value = rec.requiredGrade.toFixed(2);
            }
          }
        });
        refreshWhatIf(list, realGpa);
        const whatCard = document.getElementById("hayyiz-whatif-card");
        if (whatCard) whatCard.scrollIntoView({ behavior: "smooth" });
      });
      details.appendChild(tryPlanBtn);
    }

    renderSubjectImpactsSection(details, list);
    container.appendChild(details);
  }

  function renderSubjectImpactsSection(container, list) {
    const valid = list.filter((s) => s.grade !== null && s.grade !== undefined && !isNaN(s.grade));
    if (!valid.length) return;

    const impacts = hayyizCalculateSubjectImpacts(valid);
    if (!impacts.length) return;

    const wrap = document.createElement("div");
    wrap.style.cssText = "margin-top:1.25rem; border-top:1px dashed var(--border); padding-top:1rem;";

    const title = document.createElement("h4");
    title.style.cssText = "font-size:0.98rem; margin:0 0 0.5rem; color:var(--text);";
    title.innerHTML = '<i class="fa-solid fa-fire" style="color:var(--warning);" aria-hidden="true"></i> أين أركز جهدي؟ (أكثر المواد تأثيرًا على معدلك)';
    wrap.appendChild(title);

    const desc = document.createElement("p");
    desc.style.cssText = "color:var(--text-muted); font-size:0.88rem; margin:0 0 0.75rem;";
    desc.textContent = "بناءً على أوزان موادك الحالية وفرصة تحسين كل مادة، هذه المواد تمنحك أكبر فرصة لرفع معدلك الحقيقي:";
    wrap.appendChild(desc);

    const listEl = document.createElement("div");
    listEl.style.cssText = "display:flex; flex-direction:column; gap:0.5rem;";

    impacts.forEach((imp, rank) => {
      const item = document.createElement("div");
      item.style.cssText = "background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:0.65rem 0.85rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;";

      const left = document.createElement("div");
      left.style.cssText = "display:flex; align-items:center; gap:0.6rem;";

      const rankBadge = document.createElement("span");
      rankBadge.style.cssText = "width:24px; height:24px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:700;";
      rankBadge.textContent = String(rank + 1);

      const subInfo = document.createElement("div");
      subInfo.innerHTML =
        `<strong style="font-size:0.92rem; color:var(--text);">${imp.name}</strong> ` +
        `<span style="font-size:0.8rem; color:var(--text-muted);">(الدرجة: ${imp.grade.toFixed(2)} / 100 · الوزن: ${imp.weight})</span>`;

      left.appendChild(rankBadge);
      left.appendChild(subInfo);

      const right = document.createElement("div");
      right.style.cssText = "font-size:0.85rem; display:flex; align-items:center; gap:0.6rem;";

      const gainText = document.createElement("span");
      gainText.style.cssText = "color:var(--primary); font-weight:700;";
      gainText.textContent = `أقصى تأثير محتمل: +${imp.maxGpaGain.toFixed(2)}`;

      const priTag = document.createElement("span");
      priTag.style.cssText = "padding:2px 8px; border-radius:12px; font-size:0.78rem; font-weight:600; border:1px solid var(--border); background:var(--bg-card);";
      if (imp.priority === "عالية جدًا" || imp.priority === "عالية") {
        priTag.style.color = "var(--primary)";
        priTag.style.borderColor = "var(--primary)";
      }
      priTag.textContent = `الأولوية: ${imp.priority}`;

      right.appendChild(gainText);
      right.appendChild(priTag);

      item.appendChild(left);
      item.appendChild(right);
      listEl.appendChild(item);
    });

    wrap.appendChild(listEl);
    container.appendChild(wrap);
  }

  function updateGoalGapUI(current, target) {
    const gapEl = document.getElementById("goal-gap-text");
    const bar = document.getElementById("goal-progress-bar");
    if (!gapEl) return;
    if (target === null || target === undefined || isNaN(target)) {
      gapEl.textContent = "حدّد معدلاً مستهدفاً لترى المسافة المتبقية.";
      if (bar) bar.style.width = "0%";
      return;
    }
    const gap = target - current;
    if (gap > 0.009) {
      gapEl.textContent = "متبقي " + gap.toFixed(1) + " نقطة مئوية للوصول إلى هدفك.";
    } else if (gap < -0.009) {
      gapEl.textContent = "أنت تتجاوز هدفك بـ " + Math.abs(gap).toFixed(1) + " نقطة مئوية.";
    } else {
      gapEl.textContent = "حققت هدفك تماماً!";
    }
    if (bar) {
      const pct = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
      bar.style.width = pct.toFixed(1) + "%";
      bar.style.background = gap <= 0 ? "var(--success)" : "var(--primary)";
    }
  }

  function renderWhatIfBody(container, realList, realGpa) {
    container.replaceChildren();

    const rows = document.createElement("div");
    rows.className = "subjects-list";

    realList.forEach((s, i) => {
      if (s.realGrade === null || s.realGrade === undefined || isNaN(s.realGrade)) return;
      const row = document.createElement("div");
      row.className = "subject-row";
      const label = document.createElement("label");
      label.textContent = s.name + " ";
      const tag = document.createElement("span");
      tag.className = "weight-tag";
      tag.textContent = "وزن " + s.weight;
      label.appendChild(tag);
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "100";
      input.step = "0.01";
      input.className = "grade-input whatif-input";
      input.dataset.index = String(i);
      input.value = String(s.realGrade);
      input.placeholder = "درجة افتراضية";
      row.appendChild(label);
      row.appendChild(input);
      rows.appendChild(row);
    });
    container.appendChild(rows);

    const summary = document.createElement("div");
    summary.className = "gpa-result";
    summary.style.marginTop = "1rem";
    summary.id = "whatif-summary";
    container.appendChild(summary);

    const impactBox = document.createElement("div");
    impactBox.id = "whatif-impact";
    impactBox.style.cssText = "margin-top:0.75rem; color:var(--text-muted); font-size:0.92rem;";
    container.appendChild(impactBox);

    container.querySelectorAll(".whatif-input").forEach((inp) => {
      inp.addEventListener("input", () => refreshWhatIf(realList, realGpa));
    });

    refreshWhatIf(realList, realGpa);
  }

  function refreshWhatIf(realList, realGpa) {
    const inputs = document.querySelectorAll("#whatif-body .whatif-input");
    const hypo = realList.map((s) => ({ name: s.name, weight: s.weight, grade: s.realGrade }));
    inputs.forEach((inp) => {
      const idx = parseInt(inp.dataset.index, 10);
      const v = parseFloat(inp.value);
      if (!isNaN(v) && v >= 0 && v <= 100 && hypo[idx]) {
        hypo[idx].grade = v;
      }
    });

    let hypoGpa = null;
    if (typeof hayyizComputeWeightedGpa === "function") {
      hypoGpa = hayyizComputeWeightedGpa(hypo.map((s) => ({ grade: s.grade, weight: s.weight })));
    }
    const summary = document.getElementById("whatif-summary");
    if (!summary || hypoGpa === null) return;

    const delta = hypoGpa - realGpa;
    const deltaText = (delta >= 0 ? "+" : "") + delta.toFixed(2);

    summary.innerHTML =
      '<div style="display:flex; flex-wrap:wrap; gap:1rem; justify-content:center; text-align:center;">' +
      '<div><div class="gpa-score" style="font-size:1.6rem;">' + realGpa.toFixed(2) + '</div>' +
      '<div class="gpa-label">المعدل الحالي</div></div>' +
      '<div><div class="gpa-score" style="font-size:1.6rem; color:var(--primary);">' + hypoGpa.toFixed(2) + '</div>' +
      '<div class="gpa-label">معدل «ماذا لو؟»</div></div>' +
      '<div><div class="gpa-score" style="font-size:1.6rem;">' + deltaText + '</div>' +
      '<div class="gpa-label">التغيير</div></div>' +
      '</div>';
  }

  // ===== مشاركة النتائج =====
  function removeShareButtons(container) {
    const old = container.querySelector(".share-result-wrap");
    if (old) old.remove();
  }

  function ensureShareButtons(container, scoreValue, label) {
    removeShareButtons(container);

    const wrap = document.createElement("div");
    wrap.className = "share-result-wrap";
    wrap.style.cssText = "margin-top:1.25rem; display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap;";

    const pageUrl = window.location.href;
    const text = `حسبت ${label} في منصة حيز وكانت النتيجة ${scoreValue} 🎯\n\nجرب حاسبة المعدل من هنا: ${pageUrl}`;

    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "btn btn-primary";
    shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes" aria-hidden="true"></i> شارك نتيجتك';
    shareBtn.addEventListener("click", () => {
      if (navigator.share) {
        navigator.share({
          title: label + " — حيز",
          text: text,
          url: pageUrl
        }).catch(() => copyShareText(text));
      } else {
        copyShareText(text);
      }
    });

    wrap.appendChild(shareBtn);
    container.appendChild(wrap);
  }

  function copyShareText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert("تم نسخ النص! يمكنك مشاركته الآن.");
      }).catch(() => prompt("انسخ النص التالي:", text));
    } else {
      prompt("انسخ النص التالي:", text);
    }
  }

  // التشغيل التدريجي بعد تجهيز DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEngine);
  } else {
    initEngine();
  }
})();
