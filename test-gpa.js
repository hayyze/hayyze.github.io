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
class TestMockElement {
  constructor(tagName, id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = '';
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this._value = '';
    this.eventListeners = {};
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

// Case 26: Clicking "احسب المطلوب" explicitly creates tasks with source: "gpa-target-analysis"
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
  global.refreshWhatNeedUI(subjectList, 80.0, 95.0);

  const calcBtn = mockContainer.querySelectorAll('button').find(b => b.textContent.includes('احسب المطلوب'));
  calcBtn.click();

  const todos = global.hayyizGetTodos();
  assert(todos.length === 1 && todos[0].source === "gpa-target-analysis", "Case 26: Clicking 'احسب المطلوب' explicitly creates task marked with source: 'gpa-target-analysis'");
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

console.log(`\nTests Summary: ${passed} Passed, ${failed} Failed`);
if (failed > 0) {
  process.exit(1);
}
