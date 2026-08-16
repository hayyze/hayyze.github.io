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
    ensureShareButtons(resultBox, gpa.toFixed(2), "المعدل الموزون");
  }

  function resetAll() {
    subjectsContainer.querySelectorAll(".grade-input").forEach((i) => (i.value = ""));
    resultBox.classList.add("hidden");
    scoreEl.textContent = "0.00";
    removeShareButtons(resultBox);
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