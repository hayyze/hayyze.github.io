/* gpa.js - حاسبة المعدل مع دعم المتوسطة والثانوية */
(function () {
  // ===== بيانات المرحلة المتوسطة =====
  const MIDDLE_SUBJECTS = {
    "1": { // أول متوسط - الفصل الأول والثاني متطابقان
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
    "2": { // ثاني متوسط - نفس أول متوسط
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

  // ===== بيانات المرحلة الثانوية (كما كانت) =====
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

  // ===== عناصر DOM =====
  const stageScreen = document.getElementById("stage-screen");
  const calculatorScreen = document.getElementById("calculator-screen");
  const cumulativeScreen = document.getElementById("cumulative-screen");
  const weightedScreen = document.getElementById("weighted-screen");
  const backToStageBtn = document.getElementById("back-to-stage");
  const backToStageCumBtn = document.getElementById("back-to-stage-cum");
  const backToStageWeightedBtn = document.getElementById("back-to-stage-weighted");

  const yearSelect = document.getElementById("year-select");
  const termSelect = document.getElementById("term-select");
  const trackSelect = document.getElementById("track-select");
  const trackField = document.getElementById("track-field");
  const subjectsContainer = document.getElementById("subjects-container");
  const calculateBtn = document.getElementById("calculate-btn");
  const resetBtn = document.getElementById("reset-gpa-btn");
  const resultBox = document.getElementById("gpa-result");
  const scoreEl = document.getElementById("gpa-score");

  // عناصر التراكمي
  const cumY1 = document.getElementById("cum-y1");
  const cumY2 = document.getElementById("cum-y2");
  const cumY3 = document.getElementById("cum-y3");
  const cumProgress = document.getElementById("cum-progress");
  const cumResult = document.getElementById("cum-result");
  const cumScore = document.getElementById("cum-score");
  const cumCalculateBtn = document.getElementById("cum-calculate-btn");
  const cumResetBtn = document.getElementById("cum-reset-btn");

  // عناصر النسبة الموزونة
  const weightedRowsEl = document.getElementById("weighted-rows");
  const weightedAddBtn = document.getElementById("weighted-add-btn");
  const weightedRemainingEl = document.getElementById("weighted-remaining");
  const weightedLeftEl = document.getElementById("weighted-left");
  const weightedResult = document.getElementById("weighted-result");
  const weightedScore = document.getElementById("weighted-score");
  const weightedCalculateBtn = document.getElementById("weighted-calculate-btn");
  const weightedResetBtn = document.getElementById("weighted-reset-btn");
  const linkToCumulative = document.getElementById("link-to-cumulative");

  let currentStage = null; // "middle" | "secondary" | "cumulative" | "weighted"

  // بيانات النسبة الموزونة الافتراضية
  let weightedItems = [
    { id: 1, name: "الثانوية العامة", percent: 40, score: "" },
    { id: 2, name: "القدرات", percent: 30, score: "" },
    { id: 3, name: "التحصيلي", percent: 30, score: "" }
  ];
  let nextWeightedId = 4;

  // ===== وظائف =====
  function hideAllScreens() {
    stageScreen.style.display = "none";
    calculatorScreen.style.display = "none";
    cumulativeScreen.style.display = "none";
    weightedScreen.style.display = "none";
  }

  function showStageScreen() {
    hideAllScreens();
    stageScreen.style.display = "";
    currentStage = null;
    resultBox.classList.add("hidden");
    scoreEl.textContent = "0.00";
    cumResult.classList.add("hidden");
    cumScore.textContent = "0.00";
    weightedResult.classList.add("hidden");
    weightedScore.textContent = "0.00";
  }

  function showCalculator(stage) {
    currentStage = stage;
    hideAllScreens();
    calculatorScreen.style.display = "";

    if (stage === "middle") {
      yearSelect.innerHTML = `
        <option value="1">أول متوسط</option>
        <option value="2">ثاني متوسط</option>
        <option value="3">ثالث متوسط</option>
      `;
      trackField.style.display = "none";
    } else {
      yearSelect.innerHTML = `
        <option value="1">أول ثانوي</option>
        <option value="2">ثاني ثانوي</option>
        <option value="3">ثالث ثانوي</option>
      `;
    }

    yearSelect.value = "1";
    termSelect.value = "1";
    if (trackSelect) trackSelect.value = "general";

    renderSubjects();
  }

  function showCumulative() {
    currentStage = "cumulative";
    hideAllScreens();
    cumulativeScreen.style.display = "";
    updateCumProgress();
  }

  function showWeighted() {
    currentStage = "weighted";
    hideAllScreens();
    weightedScreen.style.display = "";
    renderWeightedRows();
  }

  function totalWeightedPercent() {
    return weightedItems.reduce((sum, item) => sum + (parseFloat(item.percent) || 0), 0);
  }

  function updateWeightedRemaining() {
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

    // ربط الأحداث
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

    let sum = 0;
    let filled = 0;
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

  function updateCumProgress() {
    let filled = 0;
    [cumY1, cumY2, cumY3].forEach((inp) => {
      const v = parseFloat(inp.value);
      if (!isNaN(v) && v >= 0 && v <= 100) filled++;
    });
    cumProgress.textContent = filled + " من 3 صفوف" + (filled === 3 ? " — 100%" : "");
  }

  function calculateCumulative() {
    const y1 = parseFloat(cumY1.value);
    const y2 = parseFloat(cumY2.value);
    const y3 = parseFloat(cumY3.value);

    const vals = [y1, y2, y3];
    let filled = 0;
    vals.forEach((v) => {
      if (!isNaN(v) && v >= 0 && v <= 100) filled++;
    });

    if (filled === 0) {
      alert("أدخل معدل واحد على الأقل");
      return;
    }

    // نستخدم فقط القيم المدخلة الصحيحة
    // الوزن: أول 20% · ثاني 40% · ثالث 40%
    // إذا نقص صف، نعيد توزيع الأوزان نسبياً على المدخل فقط؟ 
    // حسب الوصف: نحسب على الثلاثة، والناقص يُعتبر 0 أو نطلب الثلاثة؟
    // الأفضل: نحسب فقط إذا الثلاثة موجودة، أو نحسب الموزون على الموجودين مع إعادة توزيع.
    // حسب طلب المستخدم: يدخل الثلاثة. سأطلب الثلاثة للدقة.

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
    cumY1.value = "";
    cumY2.value = "";
    cumY3.value = "";
    cumResult.classList.add("hidden");
    cumScore.textContent = "0.00";
    removeShareButtons(cumResult);
    updateCumProgress();
  }

  function needsTrack(year) {
    return currentStage === "secondary" && (year === "2" || year === "3");
  }

  function getSubjects() {
    const year = yearSelect.value;
    const term = termSelect.value;

    if (currentStage === "middle") {
      return (MIDDLE_SUBJECTS[year] && MIDDLE_SUBJECTS[year][term]) || [];
    }

    // secondary
    if (year === "1") {
      return (SECONDARY_SUBJECTS["1"] && SECONDARY_SUBJECTS["1"][term]) || [];
    }

    const track = trackSelect.value;
    return (SECONDARY_SUBJECTS[year] &&
            SECONDARY_SUBJECTS[year][track] &&
            SECONDARY_SUBJECTS[year][track][term]) || [];
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

  function collectSubjectsFromInputs(useWhatIfValues) {
    const inputs = subjectsContainer.querySelectorAll(".grade-input");
    const subjectsMeta = getSubjects();
    const list = [];
    inputs.forEach((input, i) => {
      const meta = subjectsMeta[i] || {};
      const weight = parseFloat(input.dataset.weight);
      let val;
      if (useWhatIfValues && input.dataset.whatif !== undefined && input.dataset.whatif !== "") {
        val = parseFloat(input.dataset.whatif);
      } else {
        val = parseFloat(input.value);
      }
      list.push({
        name: meta.name || input.previousElementSibling?.textContent?.trim() || ("مادة " + (i + 1)),
        weight: weight,
        grade: !isNaN(val) && val >= 0 && val <= 100 ? val : null,
        realGrade: parseFloat(input.value)
      });
    });
    return list;
  }

  function computeGpaFromList(list) {
    if (typeof hayyizComputeWeightedGpa === "function") {
      const cleaned = list
        .filter((s) => s.grade !== null && s.grade !== undefined)
        .map((s) => ({ grade: s.grade, weight: s.weight }));
      return hayyizComputeWeightedGpa(cleaned);
    }
    let totalWeighted = 0;
    let totalWeight = 0;
    list.forEach((s) => {
      if (s.grade !== null && s.grade !== undefined && !isNaN(s.weight)) {
        totalWeighted += s.grade * s.weight;
        totalWeight += s.weight;
      }
    });
    return totalWeight ? totalWeighted / totalWeight : null;
  }

  function saveRealSnapshot(list, gpa) {
    const snapshot = {
      stage: currentStage,
      year: yearSelect ? yearSelect.value : null,
      term: termSelect ? termSelect.value : null,
      track: trackSelect && trackField && trackField.style.display !== "none" ? trackSelect.value : null,
      subjects: list
        .filter((s) => s.realGrade !== null && !isNaN(s.realGrade) && s.realGrade >= 0 && s.realGrade <= 100)
        .map((s) => ({
          name: s.name,
          weight: s.weight,
          grade: s.realGrade
        })),
      gpa: gpa
    };
    if (typeof hayyizSaveGpaSnapshot === "function") {
      hayyizSaveGpaSnapshot(snapshot);
    } else {
      try {
        localStorage.setItem("hayyiz-gpa-snapshot", JSON.stringify(Object.assign({ version: 1, updatedAt: Date.now() }, snapshot)));
      } catch (e) {}
    }
  }

  function calculate() {
    const list = collectSubjectsFromInputs(false);
    const filled = list.filter((s) => s.grade !== null).length;
    if (!filled) {
      alert("أدخل درجة واحدة على الأقل");
      return;
    }

    const gpa = computeGpaFromList(list);
    if (gpa === null) {
      alert("أدخل درجة واحدة على الأقل");
      return;
    }

    // حفظ الدرجات الحقيقية فقط (ليس سيناريو ماذا لو)
    list.forEach((s) => { s.realGrade = s.grade; });
    saveRealSnapshot(list, gpa);

    scoreEl.textContent = gpa.toFixed(2);
    resultBox.classList.remove("hidden");
    ensureShareButtons(resultBox, gpa.toFixed(2), "المعدل الموزون");
    renderGoalAndWhatIf(list, gpa);
  }

  function resetAll() {
    subjectsContainer.querySelectorAll(".grade-input").forEach((i) => (i.value = ""));
    resultBox.classList.add("hidden");
    scoreEl.textContent = "0.00";
    removeShareButtons(resultBox);
  }


  // ===== الهدف الأكاديمي و«ماذا لو؟» =====
  let whatIfActive = false;

  function ensurePlanningPanel() {
    let panel = document.getElementById("hayyiz-gpa-planning");
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "hayyiz-gpa-planning";
    panel.className = "gpa-planning";
    panel.style.cssText = "margin-top:1.5rem;";
    // إدراج بعد صندوق النتيجة أو أزرار التحكم
    const controls = document.querySelector("#calculator-screen .controls-row");
    if (controls && controls.parentNode) {
      controls.parentNode.insertBefore(panel, controls.nextSibling);
    } else if (resultBox && resultBox.parentNode) {
      resultBox.parentNode.appendChild(panel);
    }
    return panel;
  }

  function renderGoalAndWhatIf(list, realGpa) {
    const panel = ensurePlanningPanel();
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
      '<input type="number" id="goal-target-input" min="0" max="100" step="0.01" placeholder="مثال: 92" value="' +
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
      } else {
        localStorage.setItem("hayyiz-academic-goal", JSON.stringify({ target: t, updatedAt: Date.now() }));
      }
      updateGoalGapUI(realGpa, t);
      alert("تم حفظ هدفك");
    });
    goalCard.appendChild(saveGoalBtn);
    panel.appendChild(goalCard);

    updateGoalGapUI(realGpa, targetVal !== "" ? targetVal : null);

    // --- ماذا لو؟ ---
    const whatCard = document.createElement("div");
    whatCard.className = "card";
    whatCard.style.cssText = "margin:0; padding:1.1rem 1.25rem; box-shadow:var(--shadow);";

    const whatTitle = document.createElement("h3");
    whatTitle.style.cssText = "font-size:1.05rem; margin:0 0 0.5rem;";
    whatTitle.innerHTML = '<i class="fa-solid fa-flask" aria-hidden="true"></i> ماذا لو؟';
    whatCard.appendChild(whatTitle);

    const whatDesc = document.createElement("p");
    whatDesc.style.cssText = "color:var(--text-muted); font-size:0.92rem; margin:0 0 0.85rem;";
    whatDesc.textContent = "جرّب درجات افتراضية دون تغيير درجاتك الحقيقية. السيناريو منفصل تماماً.";
    whatCard.appendChild(whatDesc);

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "btn btn-outline";
    toggleBtn.id = "whatif-toggle-btn";
    toggleBtn.innerHTML = whatIfActive
      ? '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i> إخفاء السيناريو'
      : '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> فتح سيناريو ماذا لو؟';
    whatCard.appendChild(toggleBtn);

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
      gapEl.textContent = "متبقي " + gap.toFixed(1) + " نقطة للوصول إلى هدفك.";
    } else if (gap < -0.009) {
      gapEl.textContent = "أنت فوق هدفك بـ " + Math.abs(gap).toFixed(1) + " نقطة.";
    } else {
      gapEl.textContent = "وصلت إلى هدفك.";
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

    const actions = document.createElement("div");
    actions.className = "controls-row";
    actions.style.marginTop = "1rem";

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "btn btn-outline";
    resetBtn.innerHTML = '<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> إعادة السيناريو';
    resetBtn.addEventListener("click", () => {
      container.querySelectorAll(".whatif-input").forEach((inp) => {
        const idx = parseInt(inp.dataset.index, 10);
        if (realList[idx]) inp.value = String(realList[idx].realGrade);
      });
      refreshWhatIf(realList, realGpa);
    });

    const toGoalsBtn = document.createElement("button");
    toGoalsBtn.type = "button";
    toGoalsBtn.className = "btn btn-primary";
    toGoalsBtn.innerHTML = '<i class="fa-solid fa-flag" aria-hidden="true"></i> حوّل هذا السيناريو إلى أهداف';
    toGoalsBtn.addEventListener("click", () => {
      convertWhatIfToGoals(realList, container);
    });

    actions.appendChild(toGoalsBtn);
    actions.appendChild(resetBtn);
    container.appendChild(actions);

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

    const hypoGpa = computeGpaFromList(hypo.map((s) => ({ grade: s.grade, weight: s.weight, realGrade: s.grade })));
    const summary = document.getElementById("whatif-summary");
    const impactBox = document.getElementById("whatif-impact");
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

    // ارتباط بالهدف
    const goal = typeof hayyizGetAcademicGoal === "function" ? hayyizGetAcademicGoal() : null;
    let goalLine = "";
    if (goal && typeof goal.target === "number") {
      const remain = goal.target - hypoGpa;
      if (remain > 0.009) {
        goalLine = "بقي " + remain.toFixed(1) + " نقطة للوصول إلى هدفك في هذا السيناريو.";
      } else {
        goalLine = "هذا السيناريو يتجاوز هدفك بـ " + Math.abs(remain).toFixed(1) + " نقطة.";
      }
    }

    // أكثر المواد تأثيراً (رفعها للحد الأقصى المنطقي = الدرجة الافتراضية الحالية vs الحقيقية)
    const impacts = [];
    realList.forEach((s, i) => {
      if (s.realGrade === null || isNaN(s.realGrade)) return;
      const inp = document.querySelector('#whatif-body .whatif-input[data-index="' + i + '"]');
      const newG = inp ? parseFloat(inp.value) : s.realGrade;
      if (isNaN(newG) || Math.abs(newG - s.realGrade) < 0.001) return;
      const baseList = realList.map((x) => ({ grade: x.realGrade, weight: x.weight }));
      const withChange = baseList.map((x, j) => (j === i ? { grade: newG, weight: x.weight } : x));
      const g1 = computeGpaFromList(baseList.map((x) => ({ grade: x.grade, weight: x.weight, realGrade: x.grade })));
      const g2 = computeGpaFromList(withChange.map((x) => ({ grade: x.grade, weight: x.weight, realGrade: x.grade })));
      if (g1 !== null && g2 !== null) {
        impacts.push({ name: s.name, delta: g2 - g1, from: s.realGrade, to: newG });
      }
    });
    impacts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    let impactHtml = goalLine ? ("<p style='margin:0 0 0.5rem;'>" + goalLine + "</p>") : "";
    if (impacts.length) {
      impactHtml += "<p style='margin:0;'><strong>أكثر المواد تأثيراً في هذا السيناريو:</strong> ";
      impactHtml += impacts.slice(0, 3).map((x) => {
        const sign = x.delta >= 0 ? "+" : "";
        return x.name + " (" + sign + x.delta.toFixed(2) + ")";
      }).join(" · ");
      impactHtml += "</p>";
    }
    if (impactBox) impactBox.innerHTML = impactHtml;
  }

  function convertWhatIfToGoals(realList, container) {
    const inputs = container.querySelectorAll(".whatif-input");
    const goals = [];
    inputs.forEach((inp) => {
      const idx = parseInt(inp.dataset.index, 10);
      const s = realList[idx];
      if (!s) return;
      const target = parseFloat(inp.value);
      if (isNaN(target) || target < 0 || target > 100) return;
      if (Math.abs(target - s.realGrade) < 0.01) return;
      goals.push({
        id: typeof hayyizGenerateId === "function" ? hayyizGenerateId() : ("g" + Date.now() + idx),
        name: s.name,
        current: s.realGrade,
        target: target,
        weight: s.weight,
        created: Date.now()
      });
    });
    if (!goals.length) {
      alert("عدّل درجة مادة واحدة على الأقل في السيناريو قبل التحويل.");
      return;
    }
    if (typeof hayyizSaveSubjectGoals === "function") {
      const prev = hayyizGetSubjectGoals() || [];
      // استبدال أهداف نفس اسم المادة
      const names = new Set(goals.map((g) => g.name));
      const merged = prev.filter((p) => !names.has(p.name)).concat(goals);
      hayyizSaveSubjectGoals(merged);
    } else {
      localStorage.setItem("hayyiz-subject-goals", JSON.stringify(goals));
    }

    // مزامنة مواد حيز (subjects) بالاسم
    goals.forEach((g) => {
      if (typeof hayyizAddSubject === "function") hayyizAddSubject(g.name);
    });

    alert("تم إنشاء " + goals.length + " هدف مادة من السيناريو. ستظهر في لوحة اليوم ويمكن ربط المهام بها.");
  }

  function tryRestoreSnapshot() {
    const snap = typeof hayyizGetGpaSnapshot === "function" ? hayyizGetGpaSnapshot() : null;
    if (!snap || !snap.subjects || !snap.subjects.length) return;
    // لا نسترجع تلقائياً في شاشة الاختيار — فقط إن كان المستخدم في الحاسبة
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

    const text = `حسبت ${label} في حيز وطلع ${scoreValue} 🎯\n\nجرب حاسبة المعدل مجانًا: https://just-c.github.io/adawati/gpa.html`;

    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "btn btn-primary";
    shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes" aria-hidden="true"></i> شارك نتيجتك';
    shareBtn.addEventListener("click", () => {
      if (navigator.share) {
        navigator.share({
          title: label + " — حيز",
          text: text,
          url: "https://just-c.github.io/adawati/gpa.html"
        }).catch(() => copyShareText(text));
      } else {
        copyShareText(text);
      }
    });

    const twitterBtn = document.createElement("a");
    twitterBtn.className = "btn btn-outline";
    twitterBtn.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`حسبت ${label} في حيز وطلع ${scoreValue} 🎯\n\nجرب حاسبة المعدل مجانًا:`)}&url=${encodeURIComponent("https://just-c.github.io/adawati/gpa.html")}`;
    twitterBtn.target = "_blank";
    twitterBtn.rel = "noopener noreferrer";
    twitterBtn.innerHTML = '<i class="fa-brands fa-x-twitter" aria-hidden="true"></i> تويتر / إكس';

    wrap.appendChild(shareBtn);
    wrap.appendChild(twitterBtn);
    container.appendChild(wrap);
  }

  function copyShareText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert("تم نسخ النص! الصقه في تويتر أو واتساب أو أي مكان");
      }).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      alert("تم نسخ النص! الصقه في تويتر أو واتساب أو أي مكان");
    } catch (e) {
      prompt("انسخ النص التالي:", text);
    }
    document.body.removeChild(ta);
  }

  // ===== أحداث =====
  document.getElementById("btn-middle").addEventListener("click", () => showCalculator("middle"));
  document.getElementById("btn-secondary").addEventListener("click", () => showCalculator("secondary"));
  document.getElementById("btn-cumulative").addEventListener("click", showCumulative);
  document.getElementById("btn-weighted").addEventListener("click", showWeighted);

  backToStageBtn.addEventListener("click", showStageScreen);
  backToStageCumBtn.addEventListener("click", showStageScreen);
  backToStageWeightedBtn.addEventListener("click", showStageScreen);

  yearSelect.addEventListener("change", renderSubjects);
  termSelect.addEventListener("change", renderSubjects);
  trackSelect.addEventListener("change", renderSubjects);
  calculateBtn.addEventListener("click", calculate);
  resetBtn.addEventListener("click", resetAll);

  // أحداث التراكمي
  cumCalculateBtn.addEventListener("click", calculateCumulative);
  cumResetBtn.addEventListener("click", resetCumulative);
  [cumY1, cumY2, cumY3].forEach((inp) => {
    inp.addEventListener("input", updateCumProgress);
  });

  // أحداث النسبة الموزونة
  weightedAddBtn.addEventListener("click", addWeightedItem);
  weightedCalculateBtn.addEventListener("click", calculateWeighted);
  weightedResetBtn.addEventListener("click", resetWeightedScores);
  if (linkToCumulative) {
    linkToCumulative.addEventListener("click", (e) => {
      e.preventDefault();
      showCumulative();
    });
  }

  // البداية: شاشة اختيار المرحلة
  showStageScreen();
})();