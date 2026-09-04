const fs = require("fs");
const commonJs = fs.readFileSync("./common.js", "utf8");
const gpaJs = fs.readFileSync("./gpa.js", "utf8");

global.window = global;
global.document = {
  readyState: "complete",
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};

eval(commonJs);
global.hayyizComputeWeightedGpa = hayyizComputeWeightedGpa;
global.hayyizGetTodos = hayyizGetTodos;
eval(gpaJs);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

// Case 1: Target < Current GPA
{
  const list = [{ name: "Math", weight: 5, grade: 95 }];
  const res = global.hayyizAnalyzeAcademicTarget(list, 90);
  assert(res.status === "achieved", "Case 1: Target < Current GPA returns achieved status");
}

// Case 2: Target == Current GPA
{
  const list = [{ name: "Math", weight: 5, grade: 90 }];
  const res = global.hayyizAnalyzeAcademicTarget(list, 90);
  assert(res.status === "achieved", "Case 2: Target == Current GPA returns achieved status");
}

// Case 3: Target > Current GPA & reachable
{
  const list = [
    { name: "Math", weight: 5, grade: 85 },
    { name: "Physics", weight: 5, grade: 88 }
  ];
  const res = global.hayyizAnalyzeAcademicTarget(list, 95);
  assert(res.status === "reachable" && res.verifiedGpa >= 95, "Case 3: Target > Current GPA and reachable verified >= target");
}

// Case 4: Target > Current GPA but impossible (> 100)
{
  const list = [
    { name: "Math", weight: 5, grade: 85 },
    { name: "Physics", weight: 5, grade: 88 }
  ];
  const res = global.hayyizAnalyzeAcademicTarget(list, 102);
  assert(res.status === "impossible" && !res.isPossible, "Case 4: Impossible target identified correctly");
}

// Case 5: Single improvable subject
{
  const list = [
    { name: "Math", weight: 5, grade: 100 },
    { name: "Physics", weight: 5, grade: 80 }
  ];
  const res = global.hayyizAnalyzeAcademicTarget(list, 95);
  assert(res.status === "reachable" && res.recommendedGrades[0].requiredGrade === 100 && res.recommendedGrades[1].requiredGrade > 80, "Case 5: Single improvable subject handles 100 max correctly");
}

// Case 6: All subjects grade 100
{
  const list = [
    { name: "Math", weight: 5, grade: 100 },
    { name: "Physics", weight: 5, grade: 100 }
  ];
  const res = global.hayyizAnalyzeAcademicTarget(list, 100);
  assert(res.status === "achieved", "Case 6: All subjects 100 returns achieved");
}

// Case 7: All subjects low grade
{
  const list = [
    { name: "Math", weight: 5, grade: 50 },
    { name: "Physics", weight: 5, grade: 40 }
  ];
  const res = global.hayyizAnalyzeAcademicTarget(list, 80);
  assert(res.status === "reachable" && res.verifiedGpa >= 80, "Case 7: All low grades target reachable");
}

// Case 8: Highly varying weights
{
  const list = [
    { name: "Subject A", weight: 10, grade: 80 },
    { name: "Subject B", weight: 1, grade: 80 }
  ];
  const res = global.hayyizAnalyzeAcademicTarget(list, 90);
  assert(res.status === "reachable" && res.verifiedGpa >= 90, "Case 8: Highly varying weights target reached correctly");
}

// Case 9: Decimal grades
{
  const list = [
    { name: "Math", weight: 5, grade: 85.5 },
    { name: "Physics", weight: 4, grade: 88.25 }
  ];
  const res = global.hayyizAnalyzeAcademicTarget(list, 92.5);
  assert(res.status === "reachable" && res.verifiedGpa >= 92.5, "Case 9: Decimal grades supported correctly");
}

// Case 10: Target = 100
{
  const list = [
    { name: "Math", weight: 5, grade: 90 },
    { name: "Physics", weight: 5, grade: 90 }
  ];
  const res = global.hayyizAnalyzeAcademicTarget(list, 100);
  assert(res.status === "reachable" && res.recommendedGrades.every(r => r.requiredGrade === 100), "Case 10: Target = 100 requires 100 in all subjects");
}

// Case 11: Missing data / empty inputs
{
  const res1 = global.hayyizAnalyzeAcademicTarget([], 95);
  const res2 = global.hayyizAnalyzeAcademicTarget([{ name: "Math", weight: 5, grade: null }], 95);
  assert(res1 === null && res2 === null, "Case 11: Missing data returns null cleanly");
}

// Case 12 & 16: Subject ranking - higher weight near 100 vs lower weight with large headroom
{
  const list = [
    { name: "Math (Weight 5)", weight: 5, grade: 98 },
    { name: "Arabic (Weight 4)", weight: 4, grade: 80 }
  ];
  const impacts = global.hayyizCalculateSubjectImpacts(list);
  assert(impacts[0].name === "Arabic (Weight 4)", "Case 12 & 16: Subject with higher headroom is ranked #1 over higher weight near 100");
}

// Case 13: Exact calculation verification using hayyizComputeWeightedGpa
{
  const list = [
    { name: "Math", weight: 6, grade: 82 },
    { name: "Science", weight: 4, grade: 88 },
    { name: "English", weight: 4, grade: 90 }
  ];
  const target = 93.5;
  const analysis = global.hayyizAnalyzeAcademicTarget(list, target);
  const evalList = analysis.recommendedGrades.map(r => ({ grade: r.requiredGrade, weight: r.weight }));
  const verified = global.hayyizComputeWeightedGpa(evalList);
  assert(verified >= target - 0.0001, `Case 13: Verified GPA (${verified.toFixed(4)}) is >= Target GPA (${target})`);
}

// Case 14: Duplicate subject names in custom tracks (index stability)
{
  const list = [
    { name: "مشروع", weight: 5, grade: 75 },
    { name: "مشروع", weight: 5, grade: 95 }
  ];
  const impacts = global.hayyizCalculateSubjectImpacts(list);
  assert(impacts[0].index === 0 && impacts[0].grade === 75, "Case 14: Duplicate subject names tracked stably by index");
}

// Mock DOM elements for testing UI button click interactions
class ClassList {
  constructor() { this.classes = new Set(); }
  add(cls) { this.classes.add(cls); }
  remove(cls) { this.classes.delete(cls); }
  contains(cls) { return this.classes.has(cls); }
}

class TestMockElement {
  constructor(tagName, id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.classList = new ClassList();
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this._value = '';
    this.eventListeners = {};
  }
  get className() { return Array.from(this.classList.classes).join(' '); }
  set className(val) {
    this.classList.classes.clear();
    if (val) val.split(/\s+/).forEach(c => c && this.classList.add(c));
  }
  get value() { return this._value; }
  set value(v) { this._value = String(v); }
  get innerHTML() { return this._innerHTML || ''; }
  set innerHTML(h) {
    this._innerHTML = String(h);
    this._textContent = String(h).replace(/<[^>]*>/g, '');
  }
  get textContent() {
    if (this.children.length > 0) {
      return this.children.map(c => typeof c === 'string' ? c : c.textContent).join('');
    }
    return this._textContent || '';
  }
  set textContent(t) {
    this._textContent = String(t);
    this._innerHTML = String(t);
    this.children = [];
  }
  appendChild(child) {
    if (typeof child === 'string') {
      this.children.push(child);
    } else {
      child.parentNode = this;
      this.children.push(child);
    }
    return child;
  }
  replaceChildren(...newChildren) {
    this.children = [];
    newChildren.forEach(c => this.appendChild(c));
  }
  querySelector(selector) {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return this.children.find(c => c.className && c.className.includes(cls)) || null;
    }
    return null;
  }
  querySelectorAll(selector) {
    const results = [];
    const search = (node) => {
      if (!node || typeof node === 'string') return;
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        if (node.className && node.className.split(' ').includes(cls)) results.push(node);
      } else if (node.tagName && node.tagName.toLowerCase() === selector.toLowerCase()) {
        results.push(node);
      }
      if (node.children) node.children.forEach(search);
    };
    search(this);
    return results;
  }
  addEventListener(event, fn) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(fn);
  }
  click() {
    if (this.eventListeners['click']) {
      this.eventListeners['click'].forEach(fn => fn({ preventDefault: () => {} }));
    }
  }
  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) this.parentNode.children.splice(idx, 1);
    }
  }
  focus() { this._focused = true; }
}

// Case 15: "احسب المطلوب" button DOM flow with valid target
{
  const mockContainer = new TestMockElement('div', 'whatneed-body');
  const mockTargetInput = new TestMockElement('input', 'goal-target-input');
  mockTargetInput.value = '95';

  let alertMessage = null;
  global.alert = (msg) => { alertMessage = msg; };
  global.document = {
    createElement: (tag) => new TestMockElement(tag),
    getElementById: (id) => {
      if (id === 'whatneed-body') return mockContainer;
      if (id === 'goal-target-input') return mockTargetInput;
      return null;
    }
  };

  const subjectList = [
    { name: "الرياضيات", weight: 5, grade: 80 },
    { name: "الفيزياء", weight: 5, grade: 90 }
  ];
  const realGpa = 85.0;

  // Initialize UI with initial null target
  global.refreshWhatNeedUI(subjectList, realGpa, null);

  // Locate the "احسب المطلوب" button in mockContainer
  const calcBtn = mockContainer.querySelectorAll('button').find(b => b.textContent.includes('احسب المطلوب'));
  assert(calcBtn !== null, "Case 15: 'احسب المطلوب' button is rendered even when initial target is empty");

  // Click the button with target 95
  calcBtn.click();

  assert(alertMessage === null, "Case 15: No alert triggered for valid target");
  const details = mockContainer.querySelector('.whatneed-details');
  assert(details !== null, "Case 15: .whatneed-details container created in DOM on button click");
  assert(details.textContent.includes("95.00"), "Case 15: DOM target analysis reflects target 95.00");
}

// Case 16: "احسب المطلوب" button click with empty target triggers Arabic validation alert
{
  const mockContainer = new TestMockElement('div', 'whatneed-body');
  const mockTargetInput = new TestMockElement('input', 'goal-target-input');
  mockTargetInput.value = '';

  let alertMessage = null;
  global.alert = (msg) => { alertMessage = msg; };
  global.document = {
    createElement: (tag) => new TestMockElement(tag),
    getElementById: (id) => {
      if (id === 'whatneed-body') return mockContainer;
      if (id === 'goal-target-input') return mockTargetInput;
      return null;
    }
  };

  const subjectList = [{ name: "الرياضيات", weight: 5, grade: 80 }];
  global.refreshWhatNeedUI(subjectList, 80.0, null);

  const calcBtn = mockContainer.querySelectorAll('button').find(b => b.textContent.includes('احسب المطلوب'));
  calcBtn.click();

  assert(alertMessage !== null && alertMessage.includes("يرجى إدخال معدل مستهدف صحيح"), "Case 16: Empty target input triggers friendly Arabic alert");
}

// Case 17: "احسب المطلوب" button click with out-of-range target (e.g. 150) triggers validation alert
{
  const mockContainer = new TestMockElement('div', 'whatneed-body');
  const mockTargetInput = new TestMockElement('input', 'goal-target-input');
  mockTargetInput.value = '150';

  let alertMessage = null;
  global.alert = (msg) => { alertMessage = msg; };
  global.document = {
    createElement: (tag) => new TestMockElement(tag),
    getElementById: (id) => {
      if (id === 'whatneed-body') return mockContainer;
      if (id === 'goal-target-input') return mockTargetInput;
      return null;
    }
  };

  const subjectList = [{ name: "الرياضيات", weight: 5, grade: 80 }];
  global.refreshWhatNeedUI(subjectList, 80.0, null);

  const calcBtn = mockContainer.querySelectorAll('button').find(b => b.textContent.includes('احسب المطلوب'));
  calcBtn.click();

  assert(alertMessage !== null && alertMessage.includes("يرجى إدخال معدل مستهدف صحيح"), "Case 17: Out-of-range target (150) triggers validation alert");
}

// Case 18: Repeated button clicks after changing target input dynamically updates DOM
{
  const mockContainer = new TestMockElement('div', 'whatneed-body');
  const mockTargetInput = new TestMockElement('input', 'goal-target-input');
  mockTargetInput.value = '90';

  global.alert = () => {};
  global.document = {
    createElement: (tag) => new TestMockElement(tag),
    getElementById: (id) => {
      if (id === 'whatneed-body') return mockContainer;
      if (id === 'goal-target-input') return mockTargetInput;
      return null;
    }
  };

  const subjectList = [{ name: "الرياضيات", weight: 5, grade: 80 }];
  global.refreshWhatNeedUI(subjectList, 80.0, 90);

  const calcBtn = mockContainer.querySelectorAll('button').find(b => b.textContent.includes('احسب المطلوب'));

  // First click with 90
  calcBtn.click();
  let details = mockContainer.querySelector('.whatneed-details');
  assert(details.textContent.includes("90.00"), "Case 18: First click renders target 90.00");

  // Change input to 98 and click again
  mockTargetInput.value = '98';
  calcBtn.click();
  details = mockContainer.querySelector('.whatneed-details');
  assert(details.textContent.includes("98.00"), "Case 18: Second click dynamically recalculates and renders target 98.00");
}

// Case 19: Task creation for improvable academic subjects
{
  localStorage.setItem('hayyiz-todos', JSON.stringify([]));

  const recommendedGrades = [
    { name: "الرياضيات", currentGrade: 80, requiredGrade: 95, impactPriority: "عالية" },
    { name: "العلوم", currentGrade: 85, requiredGrade: 90, impactPriority: "متوسطة" }
  ];

  global.hayyizSyncGpaTargetTasks(recommendedGrades, 95.0);

  const todos = global.hayyizGetTodos();
  assert(todos.length === 2, "Case 19: Tasks created for 2 improvable academic subjects");
  assert(todos[0].text === "رفع درجة مادة الرياضيات" && todos[0].gpaRequiredGrade === 95, "Case 19: Task title and required grade set accurately for Mathematics");
}

// Case 20: Strict exclusion - No task created for المواظبة or السلوك
{
  localStorage.setItem('hayyiz-todos', JSON.stringify([]));

  const recommendedGrades = [
    { name: "الرياضيات", currentGrade: 80, requiredGrade: 95, impactPriority: "عالية" },
    { name: "المواظبة", currentGrade: 90, requiredGrade: 100, impactPriority: "متوسطة" },
    { name: "السلوك", currentGrade: 90, requiredGrade: 100, impactPriority: "متوسطة" },
    { name: "مواظبة وسلوك", currentGrade: 90, requiredGrade: 100, impactPriority: "متوسطة" }
  ];

  assert(global.isBehaviorOrAttendance("المواظبة") === true, "Case 20: isBehaviorOrAttendance recognizes 'المواظبة'");
  assert(global.isBehaviorOrAttendance("السلوك") === true, "Case 20: isBehaviorOrAttendance recognizes 'السلوك'");
  assert(global.isBehaviorOrAttendance("العلوم") === false, "Case 20: isBehaviorOrAttendance returns false for 'العلوم'");

  global.hayyizSyncGpaTargetTasks(recommendedGrades, 95.0);

  const todos = global.hayyizGetTodos();
  assert(todos.length === 1 && todos[0].gpaSubject === "الرياضيات", "Case 20: Behavior and Attendance subjects strictly excluded from task creation");
}

// Case 21: Deduplication - Repeated clicks do NOT duplicate tasks
{
  localStorage.setItem('hayyiz-todos', JSON.stringify([]));

  const recommendedGrades = [
    { name: "الفيزياء", currentGrade: 75, requiredGrade: 92, impactPriority: "عالية" }
  ];

  // First sync
  global.hayyizSyncGpaTargetTasks(recommendedGrades, 92.0);
  const todos1 = global.hayyizGetTodos();

  // Second sync (repeated click)
  global.hayyizSyncGpaTargetTasks(recommendedGrades, 92.0);
  const todos2 = global.hayyizGetTodos();

  assert(todos1.length === 1 && todos2.length === 1, "Case 21: Repeated sync calls do NOT create duplicate tasks");
}

// Case 22: Target changes update existing tasks in place without duplicates
{
  localStorage.setItem('hayyiz-todos', JSON.stringify([]));

  const recommendedGradesV1 = [
    { name: "الكيمياء", currentGrade: 80, requiredGrade: 90, impactPriority: "متوسطة" }
  ];
  global.hayyizSyncGpaTargetTasks(recommendedGradesV1, 90.0);

  const recommendedGradesV2 = [
    { name: "الكيمياء", currentGrade: 80, requiredGrade: 98, impactPriority: "عالية" }
  ];
  global.hayyizSyncGpaTargetTasks(recommendedGradesV2, 98.0);

  const todos = global.hayyizGetTodos();
  assert(todos.length === 1, "Case 22: Task list length remains 1 after target update (no duplicates)");
  assert(todos[0].gpaRequiredGrade === 98 && todos[0].notes.includes("98.00"), "Case 22: Existing task updated with new required grade (98.00)");
}

// Case 23: No improvable subjects (achieved state) creates 0 tasks
{
  localStorage.setItem('hayyiz-todos', JSON.stringify([]));

  const recommendedGrades = [
    { name: "اللغة العربية", currentGrade: 95, requiredGrade: 95, impactPriority: "منخفضة" }
  ];

  global.hayyizSyncGpaTargetTasks(recommendedGrades, 95.0);
  const todos = global.hayyizGetTodos();

  assert(todos.length === 0, "Case 23: Target already achieved produces 0 tasks");
}

// Case 24: Impossible target analysis returns 0 tasks cleanly
{
  localStorage.setItem('hayyiz-todos', JSON.stringify([]));

  const list = [
    { name: "الرياضيات", weight: 5, grade: 50 }
  ];
  const res = global.hayyizAnalyzeAcademicTarget(list, 105);

  global.hayyizSyncGpaTargetTasks(res ? res.recommendedGrades : [], 105.0);
  const todos = global.hayyizGetTodos();

  assert(res.status === "impossible" && todos.length === 0, "Case 24: Impossible target analysis creates 0 tasks cleanly");
}

// Case 25: Typing target in input without clicking button creates ZERO tasks
{
  localStorage.setItem('hayyiz-todos', JSON.stringify([]));

  const mockContainer = new TestMockElement('div', 'whatneed-body');
  const mockTargetInput = new TestMockElement('input', 'goal-target-input');
  mockTargetInput.value = '95';

  global.alert = () => {};
  global.document = {
    createElement: (tag) => new TestMockElement(tag),
    getElementById: (id) => {
      if (id === 'whatneed-body') return mockContainer;
      if (id === 'goal-target-input') return mockTargetInput;
      return null;
    }
  };

  const subjectList = [{ name: "الرياضيات", weight: 5, grade: 80 }];

  // Simulate typing input: call refreshWhatNeedUI without clicking button
  global.refreshWhatNeedUI(subjectList, 80.0, 95.0);

  const todos = global.hayyizGetTodos();
  assert(todos.length === 0, "Case 25: Typing target or rendering analysis without clicking button creates 0 tasks");
}

// Case 26: Clicking "احسب المطلوب" shows confirmation before creating tasks
{
  localStorage.setItem('hayyiz-todos', JSON.stringify([]));

  const mockContainer = new TestMockElement('div', 'whatneed-body');
  const mockTargetInput = new TestMockElement('input', 'goal-target-input');
  const mockBody = new TestMockElement('body');
  mockTargetInput.value = '95';

  global.alert = () => {};
  global.document = {
    body: mockBody,
    createElement: (tag) => new TestMockElement(tag),
    getElementById: (id) => {
      if (id === 'whatneed-body') return mockContainer;
      if (id === 'goal-target-input') return mockTargetInput;
      if (id === 'gpa-tasks-confirm-modal') return mockBody.querySelector('#gpa-tasks-confirm-modal');
      return null;
    }
  };

  const subjectList = [{ name: "الرياضيات", weight: 5, grade: 80 }];
  global.refreshWhatNeedUI(subjectList, 80.0, 95.0);

  const calcBtn = mockContainer.querySelectorAll('button').find(b => b.textContent.includes('احسب المطلوب'));
  calcBtn.click();

  let todos = global.hayyizGetTodos();
  assert(todos.length === 0, "Case 26: Clicking 'احسب المطلوب' alone does not create tasks before confirmation");

  const createTasksBtn = mockBody.querySelectorAll('button').find(b => b.textContent.includes('إنشاء المهام'));
  assert(createTasksBtn !== null, "Case 26: Task creation confirmation modal is shown");
  createTasksBtn.click();

  todos = global.hayyizGetTodos();
  assert(todos.length === 1 && todos[0].source === "gpa-target-analysis", "Case 26: Confirming modal creates task marked with source: 'gpa-target-analysis'");
}

// Case 27: Manual user tasks with matching name are protected and NOT modified or overwritten
{
  localStorage.setItem('hayyiz-todos', JSON.stringify([
    {
      id: "manual_1",
      text: "رفع درجة مادة الرياضيات",
      notes: "ملاحظتي الشخصية اليدوية",
      priority: "high",
      completed: false,
      created: Date.now() - 100000
    }
  ]));

  const recommendedGrades = [
    { name: "الرياضيات", currentGrade: 80, requiredGrade: 95, impactPriority: "عالية" }
  ];

  global.hayyizSyncGpaTargetTasks(recommendedGrades, 95.0);

  const todos = global.hayyizGetTodos();
  assert(todos.length === 2, "Case 27: Manual task preserved and separate GPA task created (total 2 tasks)");
  const manualTask = todos.find(t => t.id === "manual_1");
  assert(manualTask && manualTask.notes === "ملاحظتي الشخصية اليدوية" && manualTask.source !== "gpa-target-analysis", "Case 27: Manual user task details and notes remain completely untouched");
}

// ===== Generic Required Score Engine Tests (Tests A through O) =====

// Test A: Legacy 3 components (High School + Qudrat + Tahsili) backward compatibility
{
  const res = global.hayyizCalculateRequiredScore({
    highSchoolScore: 98,
    targetWeighted: 90,
    highSchoolWeight: 30,
    qudratWeight: 30,
    tahsiliWeight: 40,
    targetType: "tahsili",
    knownScore: 85
  });
  assert(res.isValid, "Test A: Legacy 3 components calculation is valid");
  assert(Math.abs(res.requiredScore - 87.75) < 1e-6, `Test A: Expected Tahsili score 87.75, got ${res.requiredScore}`);
  assert(res.hsContrib === 29.4 && res.knownContrib === 25.5, "Test A: Weighted contribution steps computed accurately");
}

// Test B: High School + Qudrat + Tahsili + STEP numeric verification
// Example from prompt:
// HS: 98 x 30% = 29.4
// Qudrat: 85 x 30% = 25.5
// STEP: 80 x 10% = 8.0
// Tahsili: required x 30%
// Target = 90%
// Total known points = 29.4 + 25.5 + 8.0 = 62.9
// Needed points = 90 - 62.9 = 27.1
// Required Tahsili = (27.1 / 0.30) = 90.33333333333333
{
  const res = global.hayyizCalculateRequiredScore({
    components: [
      { name: "الثانوية العامة", score: 98, weight: 30 },
      { name: "القدرات العامة", score: 85, weight: 30 },
      { name: "الاختبار التحصيلي", score: null, weight: 30 },
      { name: "STEP", score: 80, weight: 10 }
    ],
    targetWeighted: 90,
    targetIndex: 2
  });
  assert(res.isValid, "Test B: 4 components calculation is valid");
  assert(Math.abs(res.requiredScore - (27.1 / 0.30)) < 1e-6, `Test B: Expected Tahsili score ~90.333, got ${res.requiredScore}`);
}

// Test C: Custom test named "STEP" (ensuring name does not affect calculation logic)
{
  const res1 = global.hayyizCalculateRequiredScore({
    components: [
      { name: "الثانوية", score: 90, weight: 50 },
      { name: "STEP", score: null, weight: 50 }
    ],
    targetWeighted: 90,
    targetIndex: 1
  });
  // 90 - 45 = 45 -> Required = 90
  assert(res1.isValid && Math.abs(res1.requiredScore - 90) < 1e-6, "Test C: STEP custom test handled generically by weight and target index");
}

// Test D: Random custom test name ("اختبار الجامعة") handled identically
{
  const res2 = global.hayyizCalculateRequiredScore({
    components: [
      { name: "الثانوية", score: 90, weight: 50 },
      { name: "اختبار الجامعة", score: null, weight: 50 }
    ],
    targetWeighted: 90,
    targetIndex: 1
  });
  assert(res2.isValid && Math.abs(res2.requiredScore - 90) < 1e-6, "Test D: Random custom test name ('اختبار الجامعة') produces identical generic output");
}

// Test E: Multiple custom tests (5 components total)
{
  const res = global.hayyizCalculateRequiredScore({
    components: [
      { name: "الثانوية", score: 100, weight: 20 },
      { name: "القدرات", score: 90, weight: 20 },
      { name: "التحصيلي", score: 85, weight: 20 },
      { name: "STEP", score: 80, weight: 20 },
      { name: "اختبار الجامعة", score: null, weight: 20 }
    ],
    targetWeighted: 90,
    targetIndex: 4
  });
  // Known contribs = 20 + 18 + 17 + 16 = 71
  // Needed = 90 - 71 = 19
  // Required = (19 / 0.20) = 95
  assert(res.isValid && Math.abs(res.requiredScore - 95) < 1e-6, "Test E: 5 components calculation is correct");
}

// Test F: Weight sum != 100 rejection
{
  const res = global.hayyizCalculateRequiredScore({
    components: [
      { name: "الثانوية", score: 90, weight: 30 },
      { name: "القدرات", score: 80, weight: 30 }
    ],
    targetWeighted: 90
  });
  assert(!res.isValid && res.errorMessage.includes("مجموع أوزان القبول يجب أن يساوي 100%"), "Test F: Weight sum != 100 rejected cleanly");
}

// Test G: Target test weight = 0 rejection
{
  const res = global.hayyizCalculateRequiredScore({
    components: [
      { name: "الثانوية", score: 90, weight: 100 },
      { name: "STEP", score: null, weight: 0 }
    ],
    targetWeighted: 90,
    targetIndex: 1
  });
  assert(!res.isValid && res.errorMessage.includes("يجب أن يكون أكبر من 0%"), "Test G: Target test weight = 0 rejected with clear message");
}

// Test H: Required score > 100 & maxPossibleWeighted across 4 components
// HS 80 (30%) = 24, Qudrat 70 (30%) = 21, STEP 80 (10%) = 8 -> sum known = 53
// Target = 95. Needed points = 42. Target weight Tahsili = 30%. Required = 140 (> 100).
// maxPossibleWeighted = 53 + 30 = 83.
{
  const res = global.hayyizCalculateRequiredScore({
    components: [
      { name: "الثانوية", score: 80, weight: 30 },
      { name: "القدرات", score: 70, weight: 30 },
      { name: "التحصيلي", score: null, weight: 30 },
      { name: "STEP", score: 80, weight: 10 }
    ],
    targetWeighted: 95,
    targetIndex: 2
  });
  assert(res.isValid && res.rangeStatus === "too_high", "Test H: Required score > 100 flagged as too_high");
  assert(res.maxPossibleWeighted === 83.0, `Test H: Expected max possible weighted score 83.0, got ${res.maxPossibleWeighted}`);
}

// Test I: Target already achieved (< 0 required score)
{
  const res = global.hayyizCalculateRequiredScore({
    components: [
      { name: "الثانوية", score: 100, weight: 90 },
      { name: "القدرات", score: null, weight: 10 }
    ],
    targetWeighted: 80,
    targetIndex: 1
  });
  assert(res.isValid && res.rangeStatus === "too_low", "Test I: Target already achieved flagged as too_low");
}

// Test J: Malformed non-numeric input rejection ('90abc', '90%', '1e2', '--5')
{
  const badInputs = ["98abc", "abc90", "90%", "1e2", "--5"];
  let allRejected = true;
  badInputs.forEach(inp => {
    const res = global.hayyizCalculateRequiredScore({
      components: [
        { name: "الثانوية", score: inp, weight: 50 },
        { name: "القدرات", score: null, weight: 50 }
      ],
      targetWeighted: 90
    });
    if (res.isValid) allRejected = false;
  });
  assert(allRejected, "Test J: Strict input validation rejects all malformed non-numeric inputs");
}

// Test K: Component removal / dynamic list
{
  const components = [
    { name: "الثانوية", score: 90, weight: 40 },
    { name: "القدرات", score: 80, weight: 30 },
    { name: "التحصيلي", score: null, weight: 30 }
  ];
  // Remove Qudrat and adjust weights to 100%
  const updatedComponents = [
    { name: "الثانوية", score: 90, weight: 50 },
    { name: "التحصيلي", score: null, weight: 50 }
  ];
  const res = global.hayyizCalculateRequiredScore({
    components: updatedComponents,
    targetWeighted: 90,
    targetIndex: 1
  });
  assert(res.isValid && Math.abs(res.requiredScore - 90) < 1e-6, "Test K: Dynamic component removal produces valid updated calculation");
}

// Test L: Changing required target component
{
  const comps = [
    { name: "الثانوية", score: 90, weight: 30 },
    { name: "القدرات", score: 80, weight: 30 },
    { name: "التحصيلي", score: 85, weight: 40 }
  ];

  // Target Index 1 (Qudrat) - clear Qudrat score
  comps[1].score = null;
  const resQ = global.hayyizCalculateRequiredScore({
    components: comps,
    targetWeighted: 90,
    targetIndex: 1
  });
  assert(resQ.isValid && resQ.targetTypeName === "القدرات", "Test L: Switching target component to Qudrat works correctly");

  // Target Index 2 (Tahsili) - restore Qudrat, clear Tahsili
  comps[1].score = 80;
  comps[2].score = null;
  const resT = global.hayyizCalculateRequiredScore({
    components: comps,
    targetWeighted: 90,
    targetIndex: 2
  });
  assert(resT.isValid && resT.targetTypeName === "التحصيلي", "Test L: Switching target component to Tahsili works correctly");
}

// Test M: Equal mode normal case
{
  const res = global.hayyizCalculateRequiredScore({
    components: [
      { name: "الثانوية العامة", score: 98, weight: 30 },
      { name: "القدرات العامة", score: null, weight: 30 },
      { name: "الاختبار التحصيلي", score: null, weight: 40 }
    ],
    targetWeighted: 90,
    targetMode: "equal"
  });
  // HS = 29.40. Needed = 60.60. Total weight = 70. Required = 60.6 / 0.7 = 86.57142857...
  assert(res.isValid && res.equalAssumption, "Test M: Equal mode normal case valid");
  assert(Math.abs(res.requiredScore - (60.6 / 0.7)) < 1e-6, "Test M: Equal mode score calculated correctly");
}

// Test N: Equal mode with additional custom component without score -> Rejection to prevent misleading output
{
  const res = global.hayyizCalculateRequiredScore({
    components: [
      { name: "الثانوية العامة", score: 98, weight: 30 },
      { name: "القدرات العامة", score: null, weight: 30 },
      { name: "الاختبار التحصيلي", score: null, weight: 30 },
      { name: "STEP", score: null, weight: 10 }
    ],
    targetWeighted: 90,
    targetMode: "equal"
  });
  assert(!res.isValid && res.errorMessage.includes("لا يمكن استخدام وضع الدرجة المتساوية عند وجود اختبارات مخصصة أخرى بدون درجات"), "Test N: Equal mode with unstated custom test rejected to prevent misleading output");
}

// Test O: maxPossibleWeighted with 4 components (2 unknown components)
// HS 90 (30%) = 27, Qudrat 80 (30%) = 24. Tahsili (30%) unknown, STEP (10%) unknown.
// Max possible = 27 + 24 + 30 + 10 = 91.0
{
  const res = global.hayyizCalculateRequiredScore({
    components: [
      { name: "الثانوية العامة", score: 90, weight: 30 },
      { name: "القدرات العامة", score: 80, weight: 30 },
      { name: "الاختبار التحصيلي", score: null, weight: 30 },
      { name: "STEP", score: null, weight: 10 }
    ],
    targetWeighted: 95,
    targetIndex: 2
  });
  assert(res.isValid && res.maxPossibleWeighted === 91.0, `Test O: Expected max possible weighted 91.0 across 4 components, got ${res.maxPossibleWeighted}`);
}

// UI DOM Interaction Test for new dynamic components UI
{
  const mockContainer = new TestMockElement('div', 'req-components-container');
  const mockAddBtn = new TestMockElement('button', 'req-add-component-btn');
  const mockTotalWeights = new TestMockElement('span', 'req-weights-total');
  const mockTargetSelect = new TestMockElement('select', 'req-target-component-select');
  const mockTargetInput = new TestMockElement('input', 'req-target-weighted');
  const mockCalcBtn = new TestMockElement('button', 'req-calculate-btn');
  const mockResetBtn = new TestMockElement('button', 'req-reset-btn');
  const mockResultBox = new TestMockElement('div', 'req-result-box');

  global.document = {
    createElement: (tag) => new TestMockElement(tag),
    getElementById: (id) => {
      if (id === 'req-components-container') return mockContainer;
      if (id === 'req-add-component-btn') return mockAddBtn;
      if (id === 'req-weights-total') return mockTotalWeights;
      if (id === 'req-target-component-select') return mockTargetSelect;
      if (id === 'req-target-weighted') return mockTargetInput;
      if (id === 'req-calculate-btn') return mockCalcBtn;
      if (id === 'req-reset-btn') return mockResetBtn;
      if (id === 'req-result-box') return mockResultBox;
      return null;
    }
  };

  // Initialize UI
  global.initRequiredScorePage();

  assert(mockContainer.children.length === 3, "UI Test: Initial rendering creates 3 component rows");

  // Click "+ إضافة اختبار"
  mockAddBtn.click();
  assert(mockContainer.children.length === 4, "UI Test: Clicking add button creates 4th component row (STEP)");

  // Verify options in targetSelect dropdown
  const options = mockTargetSelect.children;
  assert(options.some(o => o.textContent.includes('STEP')), "UI Test: Dynamic target dropdown includes STEP option");

  // Reset button restores 3 default components
  mockResetBtn.click();
  assert(mockContainer.children.length === 3, "UI Test: Reset button restores default 3 components");
}

console.log(`\nTests Summary: ${passed} Passed, ${failed} Failed`);
if (failed > 0) {
  process.exit(1);
}
