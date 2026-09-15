// =========================================================
// منطق الحسابات المشترك — نفس منطق ملف الإكسل (توزيع يومي + احتياج ماكينات/عمالة)
// =========================================================

// رقم أسبوع اليوم (1-4) داخل الشهر، ومعرفة هل هو يوم جمعة (احتياطي)
export function dayInfo(date) {
  const dayOfMonth = date.getDate();
  const weekNumber = Math.min(4, Math.ceil(dayOfMonth / 7));
  const isFriday = date.getDay() === 5; // JS: الجمعة = 5
  return { weekNumber, isFriday };
}

// هدف اليوم لصنف معيّن = خطة الأسبوع ÷ 6 أيام شغل (صفر يوم الجمعة)
export function dailyTargetForItem(item, date) {
  const { weekNumber, isFriday } = dayInfo(date);
  if (isFriday) return 0;
  const weekKey = "w" + weekNumber;
  const weeklyQty = Number(item[weekKey] || 0);
  return weeklyQty / 6;
}

// إجمالي هدف اليوم لكل الأصناف
export function totalDailyTarget(items, date) {
  return items.reduce((sum, it) => sum + dailyTargetForItem(it, date), 0);
}

// احتياج الماكينات لكل عملية في عيلة معينة، ليوم معين
// items: كل الأصناف (لازم فيها item.family و item.rates = [{opSeq, hoursPerUnit, shiftCapacity}])
// familyOps: عمليات العيلة [{seq, name, machines, shiftHours}]
export function machineRequirement(items, familyName, familyOps, date) {
  const familyItems = items.filter(it => it.family === familyName);
  return familyOps.map(op => {
    let machineShiftsNeeded = 0;
    for (const it of familyItems) {
      const rate = (it.rates || []).find(r => r.opSeq === op.seq);
      if (!rate || !rate.hoursPerUnit) continue; // الصنف مش بيمر بالعملية دي
      const dailyQty = dailyTargetForItem(it, date);
      const cap = rate.shiftCapacity > 0 ? rate.shiftCapacity : 1;
      machineShiftsNeeded += dailyQty / cap;
    }
    machineShiftsNeeded = Math.ceil(machineShiftsNeeded);
    return {
      opSeq: op.seq,
      opName: op.name,
      machinesAvailable: op.machines || 0,
      machineShiftsNeeded,
      shortfall: Math.max(0, machineShiftsNeeded - (op.machines || 0) * 2), // بافتراض وردتين
    };
  });
}

export const LABOR_CATEGORY_LABELS = {
  auto_weld: "لحام أوتوماتيك",
  manual_weld: "لحام يدوي",
  manual_weld_excellent: "لحام يدوي ممتاز",
  press_tech: "فني مكابس",
  grinder: "حجار",
  operator: "عامل تشغيل",
};

// احتياج العمالة لكل فئة، عبر كل العائلات، ليوم معين
// families: [{id, operations:[...]}], items: كل الأصناف
export function laborRequirement(items, families, date) {
  const totals = {};
  Object.keys(LABOR_CATEGORY_LABELS).forEach(k => (totals[k] = 0));

  for (const fam of families) {
    const ops = fam.operations || [];
    const machineRows = machineRequirement(items, fam.id, ops, date);
    machineRows.forEach(row => {
      const opDef = ops.find(o => o.seq === row.opSeq);
      if (!opDef || !opDef.workerCategory) return;
      const workersPerOp = Number(opDef.workersPerOp || 1);
      totals[opDef.workerCategory] = (totals[opDef.workerCategory] || 0) + row.machineShiftsNeeded * workersPerOp;
    });
  }
  return Object.entries(totals).map(([key, count]) => ({
    key, label: LABOR_CATEGORY_LABELS[key] || key, count: Math.ceil(count),
  }));
}

export function fmt(n) {
  return Math.round(n * 10) / 10;
}
