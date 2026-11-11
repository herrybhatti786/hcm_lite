// Tax slab calculations as specified in Section 3 & 6 of HCM Lite Challenge Brief

function calculateAnnualTax(annualGross) {
  if (annualGross <= 600000) {
    return 0;
  } else if (annualGross <= 1200000) {
    return (annualGross - 600000) * 0.05;
  } else if (annualGross <= 2400000) {
    return 30000 + (annualGross - 1200000) * 0.15;
  } else if (annualGross <= 3600000) {
    return 210000 + (annualGross - 2400000) * 0.25;
  } else {
    return 510000 + (annualGross - 3600000) * 0.35;
  }
}

function calculateSalaryBreakdown(basicSalary) {
  const basic = Number(basicSalary) || 0;
  const hra = basic * 0.40; // 40% of basic
  const medical = basic * 0.10; // 10% of basic
  const gross = basic * 1.50; // basic + hra + medical = 1.5 * basic

  const annualGross = gross * 12;
  const annualTax = calculateAnnualTax(annualGross);
  const monthlyTax = Math.round((annualTax / 12) * 100) / 100;

  return {
    basic: Math.round(basic * 100) / 100,
    hra: Math.round(hra * 100) / 100,
    medical: Math.round(medical * 100) / 100,
    gross: Math.round(gross * 100) / 100,
    annualGross: Math.round(annualGross * 100) / 100,
    annualTax: Math.round(annualTax * 100) / 100,
    monthlyTax: monthlyTax
  };
}

module.exports = {
  calculateAnnualTax,
  calculateSalaryBreakdown
};
