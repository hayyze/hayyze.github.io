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

  // ===== بيانات المرحلة الثانوية  =====
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
  const backToStageBtn = document.getElementById("back-to-stage");
  const backToStageCumBtn = document.getElementById("back-to-stage-cum");

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

  let currentStage = null; // "middle" | "secondary" | "cumulative"

  // ===== وظائف =====
  function showStageScreen() {
    stageScreen.style.display = "";
    calculatorScreen.style.display = "none";
    cumulativeScreen.style.display = "none";
    currentStage = null;
    resultBox.classList.add("hidden");
    scoreEl.textContent = "0.00";
    cumResult.classList.add("hidden");
    cumScore.textContent = "0.00";
  }

  function showCalculator(stage) {
    currentStage = stage;
    stageScreen.style.display = "none";
    cumulativeScreen.style.display = "none";
    calculatorScreen.style.display = "";

    // تحديث خيارات السنة حسب المرحلة
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
    stageScreen.style.display = "none";
    calculatorScreen.style.display = "none";
    cumulativeScreen.style.display = "";
    updateCumProgress();
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
  }

  function resetCumulative() {
    cumY1.value = "";
    cumY2.value = "";
    cumY3.value = "";
    cumResult.classList.add("hidden");
    cumScore.textContent = "0.00";
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
  }

  function resetAll() {
    subjectsContainer.querySelectorAll(".grade-input").forEach((i) => (i.value = ""));
    resultBox.classList.add("hidden");
    scoreEl.textContent = "0.00";
  }

  // ===== أحداث =====
  document.getElementById("btn-middle").addEventListener("click", () => showCalculator("middle"));
  document.getElementById("btn-secondary").addEventListener("click", () => showCalculator("secondary"));
  document.getElementById("btn-cumulative").addEventListener("click", showCumulative);

  backToStageBtn.addEventListener("click", showStageScreen);
  backToStageCumBtn.addEventListener("click", showStageScreen);

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

  // البداية: شاشة اختيار المرحلة
  showStageScreen();
})();
