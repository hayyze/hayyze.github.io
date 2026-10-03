/* study-planner.js - Interactive engine for Study Planner */

(function () {
  'use strict';

  // State Management
  var subjects = [
    { id: 'subj_1', name: 'الرياضيات / الفيزياء', priority: 'high', difficulty: 'hard' },
    { id: 'subj_2', name: 'الكيمياء / الأحياء', priority: 'medium', difficulty: 'medium' },
    { id: 'subj_3', name: 'اللغة الإنجليزية / التخصص', priority: 'medium', difficulty: 'review' }
  ];

  // DOM Elements
  var examDateInput = document.getElementById('sp-exam-date');
  var dailyHoursInput = document.getElementById('sp-daily-hours');
  var dailyHoursVal = document.getElementById('sp-daily-hours-val');
  var addSubjectBtn = document.getElementById('sp-add-subject-btn');
  var subjectsListContainer = document.getElementById('sp-subjects-list');
  var generatePlanBtn = document.getElementById('sp-generate-plan-btn');
  var themeToggleBtn = document.getElementById('sp-theme-toggle');

  // Results Containers
  var metricDays = document.getElementById('sp-metric-days');
  var metricHours = document.getElementById('sp-metric-hours');
  var metricFocus = document.getElementById('sp-metric-focus');
  var metricReview = document.getElementById('sp-metric-review');
  var allocListContainer = document.getElementById('sp-alloc-list');
  var timelineContainer = document.getElementById('sp-timeline-container');

  // Multipliers
  var PRIORITY_WEIGHTS = { high: 1.4, medium: 1.0, low: 0.7 };
  var DIFFICULTY_WEIGHTS = { hard: 1.5, medium: 1.0, review: 0.6 };

  // Helper: Sanitize Text
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Set Default Date (10 days from today)
  function initDefaultDate() {
    if (!examDateInput) return;
    var target = new Date();
    target.setDate(target.getDate() + 10);
    var yyyy = target.getFullYear();
    var mm = String(target.getMonth() + 1).padStart(2, '0');
    var dd = String(target.getDate()).padStart(2, '0');
    examDateInput.value = yyyy + '-' + mm + '-' + dd;
    examDateInput.min = new Date().toISOString().split('T')[0];
  }

  // Render Subject Input Rows
  function renderSubjectsInputs() {
    if (!subjectsListContainer) return;
    subjectsListContainer.innerHTML = '';

    subjects.forEach(function (subj, index) {
      var itemDiv = document.createElement('div');
      itemDiv.className = 'sp-subject-item';
      itemDiv.dataset.id = subj.id;

      itemDiv.innerHTML =
        '<div class="sp-field">' +
          '<input type="text" class="sp-input sp-subj-name" value="' + escapeHtml(subj.name) + '" placeholder="اسم المادة" data-index="' + index + '">' +
        '</div>' +
        '<div class="sp-field">' +
          '<select class="sp-select sp-subj-priority" data-index="' + index + '">' +
            '<option value="high"' + (subj.priority === 'high' ? ' selected' : '') + '>أولوية عالية</option>' +
            '<option value="medium"' + (subj.priority === 'medium' ? ' selected' : '') + '>أولوية متوسطة</option>' +
            '<option value="low"' + (subj.priority === 'low' ? ' selected' : '') + '>أولوية منخفضة</option>' +
          '</select>' +
        '</div>' +
        '<div class="sp-field">' +
          '<select class="sp-select sp-subj-difficulty" data-index="' + index + '">' +
            '<option value="hard"' + (subj.difficulty === 'hard' ? ' selected' : '') + '>صعبة (تأسيس وشرح)</option>' +
            '<option value="medium"' + (subj.difficulty === 'medium' ? ' selected' : '') + '>متوسطة (فهم وتمارين)</option>' +
            '<option value="review"' + (subj.difficulty === 'review' ? ' selected' : '') + '>سهلة (مراجعة وتثبيت)</option>' +
          '</select>' +
        '</div>' +
        '<button type="button" class="sp-btn-icon-danger sp-remove-subj" data-index="' + index + '" title="حذف المادة" aria-label="حذف المادة">' +
          '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>' +
        '</button>';

      subjectsListContainer.appendChild(itemDiv);
    });

    attachSubjectListeners();
  }

  // Attach Event Listeners to Dynamic Subject Fields
  function attachSubjectListeners() {
    var nameInputs = subjectsListContainer.querySelectorAll('.sp-subj-name');
    var prioritySelects = subjectsListContainer.querySelectorAll('.sp-subj-priority');
    var difficultySelects = subjectsListContainer.querySelectorAll('.sp-subj-difficulty');
    var removeBtns = subjectsListContainer.querySelectorAll('.sp-remove-subj');

    nameInputs.forEach(function (input) {
      input.addEventListener('input', function (e) {
        var idx = parseInt(e.target.dataset.index, 10);
        if (subjects[idx]) {
          subjects[idx].name = e.target.value.trim() || 'مادة بدون عنوان';
        }
      });
    });

    prioritySelects.forEach(function (select) {
      select.addEventListener('change', function (e) {
        var idx = parseInt(e.target.dataset.index, 10);
        if (subjects[idx]) {
          subjects[idx].priority = e.target.value;
        }
      });
    });

    difficultySelects.forEach(function (select) {
      select.addEventListener('change', function (e) {
        var idx = parseInt(e.target.dataset.index, 10);
        if (subjects[idx]) {
          subjects[idx].difficulty = e.target.value;
        }
      });
    });

    removeBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var idx = parseInt(btn.dataset.index, 10);
        if (subjects.length <= 1) {
          alert('يجب أن تحتوي الخطة على مادة واحدة على الأقل.');
          return;
        }
        subjects.splice(idx, 1);
        renderSubjectsInputs();
        generatePlan();
      });
    });
  }

  // Add Subject
  function addSubject() {
    var newId = 'subj_' + Date.now();
    subjects.push({
      id: newId,
      name: 'مادة جديدة ' + (subjects.length + 1),
      priority: 'medium',
      difficulty: 'medium'
    });
    renderSubjectsInputs();
    generatePlan();
  }

  // Generate Plan Calculations
  function generatePlan() {
    if (!examDateInput || !dailyHoursInput) return;

    var selectedDate = new Date(examDateInput.value + 'T00:00:00');
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var diffTime = selectedDate - today;
    var remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (isNaN(remainingDays) || remainingDays <= 0) {
      remainingDays = 1;
    }

    var dailyHours = parseFloat(dailyHoursInput.value) || 3;
    var totalAvailableHours = remainingDays * dailyHours;

    // Determine Final Review Days Buffer (1 day if >= 4 days, else 0.5)
    var reviewDaysBuffer = remainingDays >= 4 ? (remainingDays >= 14 ? 2 : 1) : 0.5;
    var studyDays = Math.max(0.5, remainingDays - reviewDaysBuffer);
    var netStudyHours = studyDays * dailyHours;
    var reviewHours = reviewDaysBuffer * dailyHours;

    // Calculate Weights
    var totalWeight = 0;
    subjects.forEach(function (subj) {
      var pW = PRIORITY_WEIGHTS[subj.priority] || 1.0;
      var dW = DIFFICULTY_WEIGHTS[subj.difficulty] || 1.0;
      subj.weight = pW * dW;
      totalWeight += subj.weight;
    });

    // Calculate Allocated Hours
    subjects.forEach(function (subj) {
      var ratio = totalWeight > 0 ? subj.weight / totalWeight : 1 / subjects.length;
      subj.allocatedHours = Math.round((ratio * netStudyHours) * 10) / 10;
      subj.percentage = Math.round((subj.allocatedHours / netStudyHours) * 100);
    });

    // Update Metrics DOM
    if (metricDays) metricDays.textContent = remainingDays + ' أيام';
    if (metricHours) metricHours.textContent = totalAvailableHours + ' ساعة';
    if (metricFocus) metricFocus.textContent = Math.round(netStudyHours) + ' ساعة';
    if (metricReview) metricReview.textContent = Math.round(reviewHours) + ' ساعة';

    // Update Allocation Progress List
    renderAllocations();

    // Update Timeline Phases
    renderTimeline(remainingDays, studyDays, reviewDaysBuffer, netStudyHours);
  }

  // Render Allocation Bars
  function renderAllocations() {
    if (!allocListContainer) return;
    allocListContainer.innerHTML = '';

    subjects.forEach(function (subj) {
      var item = document.createElement('div');
      item.className = 'sp-alloc-item';

      var pTag = subj.priority === 'high' ? 'أولوية عالية' : (subj.priority === 'low' ? 'أولوية منخفضة' : 'أولوية متوسطة');
      var dTag = subj.difficulty === 'hard' ? 'صعبة' : (subj.difficulty === 'review' ? 'مراجعة' : 'متوسطة');

      item.innerHTML =
        '<div class="sp-alloc-meta">' +
          '<span class="sp-alloc-subject">' +
            '<strong>' + escapeHtml(subj.name) + '</strong> ' +
            '<small style="color:var(--sp-text-muted); font-weight:normal;">(' + pTag + ' • ' + dTag + ')</small>' +
          '</span>' +
          '<span class="sp-alloc-hours">' + subj.allocatedHours + ' ساعة (' + (subj.percentage || 0) + '%)</span>' +
        '</div>' +
        '<div class="sp-progress-track">' +
          '<div class="sp-progress-fill" style="width: ' + Math.min(100, Math.max(5, subj.percentage || 5)) + '%;"></div>' +
        '</div>';

      allocListContainer.appendChild(item);
    });
  }

  // Render Timeline Phases
  function renderTimeline(remainingDays, studyDays, reviewDaysBuffer, netStudyHours) {
    if (!timelineContainer) return;
    timelineContainer.innerHTML = '';

    var phase1Days = Math.max(1, Math.round(studyDays * 0.55));
    var phase2Days = Math.max(0, Math.round(studyDays - phase1Days));

    var hardSubjects = subjects.filter(function (s) { return s.difficulty === 'hard' || s.priority === 'high'; });
    var hardNames = hardSubjects.map(function (s) { return escapeHtml(s.name); }).join('، ') || 'المواد الأساسية';

    var html =
      '<div class="sp-phase-card">' +
        '<div class="sp-phase-header">' +
          '<span class="sp-phase-name">المرحلة الأولى: التركيز والتأسيس العميق</span>' +
          '<span class="sp-phase-days">' + phase1Days + ' أيام</span>' +
        '</div>' +
        '<p class="sp-phase-desc">خصص هذه الأيام للمواد التي تتطلب فهمًا وإعادة شرح (' + hardNames + '). استغل طاقتك الذهنية الأولى في حل المسائل وإتقان المفاهيم الصعبة.</p>' +
      '</div>';

    if (phase2Days > 0) {
      html +=
        '<div class="sp-phase-card">' +
          '<div class="sp-phase-header">' +
            '<span class="sp-phase-name">المرحلة الثانية: التمكين والممارسة التطبيقية</span>' +
            '<span class="sp-phase-days">' + phase2Days + ' أيام</span>' +
          '</div>' +
          '<p class="sp-phase-desc">تغطية المواد المتوسطة وإجراء تمارين ومراجعات سريعة على جميع الفصول. تحويل الفهم المبدئي إلى تثبيت وسرعة في الحل.</p>' +
        '</div>';
    }

    html +=
      '<div class="sp-phase-card final-review">' +
        '<div class="sp-phase-header">' +
          '<span class="sp-phase-name">المرحلة الثالثة: المراجعة الشاملة ليلة الاختبار</span>' +
          '<span class="sp-phase-days">' + reviewDaysBuffer + ' ' + (reviewDaysBuffer >= 2 ? 'أيام' : 'يوم') + '</span>' +
        '</div>' +
        '<p class="sp-phase-desc">مساحة مخصصة ومحجوزة لاسترجاع الملاحظات، ملخصات القوانين، والحل السريع. لا يُنصح بفتح أي مفاهيم جديدة خلال هذه المرحلة لتجنب التشتت.</p>' +
      '</div>';

    timelineContainer.innerHTML = html;
  }

  // Toggle Dark/Light Theme
  function toggleTheme() {
    var isDark = document.documentElement.classList.toggle('theme-dark');
    try {
      localStorage.setItem('hayyiz-theme', isDark ? 'dark' : 'light');
    } catch (e) {}
  }

  // Initialize Event Listeners
  function initEvents() {
    if (dailyHoursInput && dailyHoursVal) {
      dailyHoursInput.addEventListener('input', function () {
        dailyHoursVal.textContent = dailyHoursInput.value + ' ساعات';
        generatePlan();
      });
    }

    if (examDateInput) {
      examDateInput.addEventListener('change', generatePlan);
    }

    if (addSubjectBtn) {
      addSubjectBtn.addEventListener('click', addSubject);
    }

    if (generatePlanBtn) {
      generatePlanBtn.addEventListener('click', function () {
        generatePlan();
        var resultsSec = document.getElementById('sp-results-section');
        if (resultsSec) {
          resultsSec.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', toggleTheme);
    }
  }

  // Document Ready Initialization
  document.addEventListener('DOMContentLoaded', function () {
    initDefaultDate();
    renderSubjectsInputs();
    generatePlan();
    initEvents();
  });

})();
