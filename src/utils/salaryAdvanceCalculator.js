function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePlanData(value) {
  if (!value) return {};

  if (typeof value === "object") {
    return value;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  return {};
}

function includedValue(value, includeFlag) {
  return includeFlag ? toNumber(value) : 0;
}

/**
 * Mirrors the current frontend SalaryCalculations.js
 * base-net calculation for salary-advance eligibility.
 *
 * No:
 * - overtime
 * - record bonus
 * - incentive
 * - advance recovery
 * - LOP
 *
 * Statutory bonus remains part of the compensation plan calculation,
 * exactly like the current frontend utility.
 */
function calculateBaseNetSalary(
  ctc,
  rawPlanData,
  employeeId = "salary-advance",
) {
  const planData = parsePlanData(rawPlanData);

  const annualCtc = toNumber(ctc);

  if (annualCtc <= 0) {
    throw new Error(`Invalid CTC for employee ${employeeId}.`);
  }

  const monthlyCtc = annualCtc / 12;

  // ------------------------------------------------------------
  // BASIC
  // ------------------------------------------------------------
  let basicSalary = 0;

  if (
    planData.isBasicSalary &&
    planData.basicSalaryType === "percentage" &&
    planData.basicSalary &&
    !Number.isNaN(Number(planData.basicSalary))
  ) {
    basicSalary = monthlyCtc * (Number(planData.basicSalary) / 100);
  } else if (
    planData.basicSalaryAmount &&
    !Number.isNaN(Number(planData.basicSalaryAmount))
  ) {
    basicSalary = Number(planData.basicSalaryAmount);
  } else {
    basicSalary = monthlyCtc * 0.4;
  }

  // ------------------------------------------------------------
  // HRA
  // ------------------------------------------------------------
  let hra = 0;

  if (
    planData.isHouseRentAllowance &&
    planData.houseRentAllowanceType === "percentage" &&
    planData.houseRentAllowance &&
    !Number.isNaN(Number(planData.houseRentAllowance))
  ) {
    hra = basicSalary * (Number(planData.houseRentAllowance) / 100);
  } else if (
    planData.houseRentAllowanceAmount &&
    !Number.isNaN(Number(planData.houseRentAllowanceAmount))
  ) {
    hra = Number(planData.houseRentAllowanceAmount);
  } else {
    hra = basicSalary * 0.5;
  }

  // ------------------------------------------------------------
  // LTA
  // ------------------------------------------------------------
  let ltaAllowance = 0;

  if (
    planData.isLtaAllowance &&
    planData.ltaAllowanceType === "percentage" &&
    planData.ltaAllowance &&
    !Number.isNaN(Number(planData.ltaAllowance))
  ) {
    ltaAllowance = basicSalary * (Number(planData.ltaAllowance) / 100);
  } else if (
    planData.ltaAllowanceAmount &&
    !Number.isNaN(Number(planData.ltaAllowanceAmount))
  ) {
    ltaAllowance = Number(planData.ltaAllowanceAmount);
  }

  // ------------------------------------------------------------
  // STATUTORY BONUS
  // ------------------------------------------------------------
  let statutoryBonusYearly = 0;

  if (
    planData.isStatutoryBonus &&
    planData.statutoryBonusPercentage &&
    !Number.isNaN(Number(planData.statutoryBonusPercentage))
  ) {
    statutoryBonusYearly =
      (Number(planData.statutoryBonusPercentage) / 100) * annualCtc;
  } else if (
    planData.isStatutoryBonus &&
    planData.statutoryBonusAmount &&
    !Number.isNaN(Number(planData.statutoryBonusAmount))
  ) {
    statutoryBonusYearly = Number(planData.statutoryBonusAmount);
  }

  const statutoryBonus = statutoryBonusYearly / 12;

  // No OT / record bonus / incentive in base salary.
  let grossBeforeOther = basicSalary + hra + statutoryBonus;

  // ------------------------------------------------------------
  // PF
  // ------------------------------------------------------------
  const pfBase =
    planData.pfCalculationBase === "gross" ? grossBeforeOther : basicSalary;

  let employeePF = 0;
  let employerPF = 0;

  if (
    planData.isPFApplicable &&
    planData.isPFEmployee &&
    planData.pfEmployeeType === "percentage" &&
    planData.pfEmployeePercentage &&
    !Number.isNaN(Number(planData.pfEmployeePercentage))
  ) {
    employeePF = pfBase * (Number(planData.pfEmployeePercentage) / 100);
  } else if (
    planData.pfEmployeeAmount &&
    !Number.isNaN(Number(planData.pfEmployeeAmount))
  ) {
    employeePF = Number(planData.pfEmployeeAmount);
  }

  if (
    planData.isPFApplicable &&
    planData.isPFEmployer &&
    planData.pfEmployerType === "percentage" &&
    planData.pfEmployerPercentage &&
    !Number.isNaN(Number(planData.pfEmployerPercentage))
  ) {
    employerPF = pfBase * (Number(planData.pfEmployerPercentage) / 100);
  } else if (
    planData.pfEmployerAmount &&
    !Number.isNaN(Number(planData.pfEmployerAmount))
  ) {
    employerPF = Number(planData.pfEmployerAmount);
  }

  // ------------------------------------------------------------
  // INSURANCE
  // ------------------------------------------------------------
  const medicalBase =
    planData.medicalCalculationBase === "gross"
      ? grossBeforeOther
      : basicSalary;

  let insurance = 0;
  let insuranceEmployer = 0;

  if (
    planData.isInsuranceEmployee &&
    planData.insuranceEmployeeType === "percentage" &&
    planData.insuranceEmployeePercentage &&
    !Number.isNaN(Number(planData.insuranceEmployeePercentage))
  ) {
    insurance =
      medicalBase * (Number(planData.insuranceEmployeePercentage) / 100);
  } else if (
    planData.insuranceEmployeeAmount &&
    !Number.isNaN(Number(planData.insuranceEmployeeAmount))
  ) {
    insurance = Number(planData.insuranceEmployeeAmount);
  }

  if (
    planData.isInsuranceEmployer &&
    planData.insuranceEmployerType === "percentage" &&
    planData.insuranceEmployerPercentage &&
    !Number.isNaN(Number(planData.insuranceEmployerPercentage))
  ) {
    insuranceEmployer =
      medicalBase * (Number(planData.insuranceEmployerPercentage) / 100);
  } else if (
    planData.insuranceEmployerAmount &&
    !Number.isNaN(Number(planData.insuranceEmployerAmount))
  ) {
    insuranceEmployer = Number(planData.insuranceEmployerAmount);
  }

  // ------------------------------------------------------------
  // GRATUITY
  // ------------------------------------------------------------
  let gratuity = 0;

  if (
    planData.isGratuityApplicable &&
    planData.gratuityType === "percentage" &&
    planData.gratuityPercentage &&
    !Number.isNaN(Number(planData.gratuityPercentage))
  ) {
    gratuity = basicSalary * (Number(planData.gratuityPercentage) / 100);
  } else if (
    planData.gratuityAmount &&
    !Number.isNaN(Number(planData.gratuityAmount))
  ) {
    gratuity = Number(planData.gratuityAmount) / 12;
  }

  // ------------------------------------------------------------
  // OTHER ALLOWANCE BALANCING
  // ------------------------------------------------------------
  let otherAllowances = 0;
  let esicEmployer = 0;

  const fixedEmployer = employerPF + gratuity + insuranceEmployer;

  const fixedEarnings = basicSalary + hra + ltaAllowance;

  const fixedTotal = fixedEarnings + fixedEmployer;

  if (planData.isOtherAllowance) {
    if (
      planData.isESICEmployer &&
      planData.esicEmployerType === "percentage" &&
      planData.esicEmployerPercentage
    ) {
      const rate = Number(planData.esicEmployerPercentage) / 100;

      otherAllowances =
        (monthlyCtc - fixedTotal - fixedEarnings * rate) / (1 + rate);

      otherAllowances = Math.max(0, otherAllowances);

      esicEmployer = (fixedEarnings + otherAllowances) * rate;
    } else {
      otherAllowances = monthlyCtc - fixedTotal;

      otherAllowances = Math.max(0, otherAllowances);
    }
  }

  // ------------------------------------------------------------
  // FINAL GROSS
  // ------------------------------------------------------------
  const grossSalary =
    basicSalary + hra + ltaAllowance + otherAllowances + statutoryBonus;

  // ------------------------------------------------------------
  // ESI
  // ------------------------------------------------------------
  const grossForESI = basicSalary + hra + otherAllowances;

  let esic = 0;

  if (
    planData.isESICEmployee &&
    planData.esicEmployeeType === "percentage" &&
    planData.esicEmployeePercentage &&
    !Number.isNaN(Number(planData.esicEmployeePercentage))
  ) {
    esic = grossForESI * (Number(planData.esicEmployeePercentage) / 100);
  } else if (
    planData.esicEmployeeAmount &&
    !Number.isNaN(Number(planData.esicEmployeeAmount))
  ) {
    esic = Number(planData.esicEmployeeAmount);
  }

  if (
    planData.isESICEmployer &&
    planData.esicEmployerType === "percentage" &&
    planData.esicEmployerPercentage &&
    !Number.isNaN(Number(planData.esicEmployerPercentage))
  ) {
    esicEmployer =
      grossForESI * (Number(planData.esicEmployerPercentage) / 100);
  } else if (
    planData.isESICEmployer &&
    planData.esicEmployerAmount &&
    !Number.isNaN(Number(planData.esicEmployerAmount))
  ) {
    esicEmployer = Number(planData.esicEmployerAmount);
  }

  // ------------------------------------------------------------
  // PROFESSIONAL TAX
  // ------------------------------------------------------------
  let professionalTax = 0;

  if (planData.isProfessionalTax) {
    if (
      planData.professionalTaxType === "percentage" &&
      planData.professionalTax &&
      !Number.isNaN(Number(planData.professionalTax))
    ) {
      professionalTax = monthlyCtc * (Number(planData.professionalTax) / 100);
    } else if (
      planData.professionalTaxAmount &&
      !Number.isNaN(Number(planData.professionalTaxAmount))
    ) {
      professionalTax = Number(planData.professionalTaxAmount);
    }
  }

  // ------------------------------------------------------------
  // TDS
  // ------------------------------------------------------------
  let tds = 0;

  if (
    planData.isTDSApplicable &&
    Array.isArray(planData.tdsSlabs) &&
    planData.tdsSlabs.length > 0
  ) {
    let applicableRate = 0;

    for (const slab of planData.tdsSlabs) {
      const from = Number(slab.from) || 0;
      const to = Number(slab.to) || Infinity;

      if (annualCtc >= from && annualCtc <= to) {
        applicableRate = Number(slab.percentage) || 0;
        break;
      }
    }

    const annualTds = annualCtc * (applicableRate / 100);

    tds = Math.round((annualTds / 12) * 100) / 100;
  }

  // ------------------------------------------------------------
  // IMPORTANT:
  // No advanceRecovery here.
  // No LOP here.
  // ------------------------------------------------------------
  const employeeDeductions =
    includedValue(employeePF, planData.pfEmployeeIncludeInCtc) +
    includedValue(esic, planData.esicEmployeeIncludeInCtc) +
    includedValue(insurance, planData.insuranceEmployeeIncludeInCtc) +
    includedValue(professionalTax, planData.professionalTaxIncludeInCtc) +
    tds;

  const netSalary = grossSalary - employeeDeductions;

  return Math.round(netSalary || 0);
}

module.exports = {
  calculateBaseNetSalary,
};
