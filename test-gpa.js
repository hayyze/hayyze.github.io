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

eval(commonJs);
global.hayyizComputeWeightedGpa = hayyizComputeWeightedGpa;
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

console.log(`\nTests Summary: ${passed} Passed, ${failed} Failed`);
if (failed > 0) {
  process.exit(1);
}
