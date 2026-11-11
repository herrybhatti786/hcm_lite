// Date & Working Day Calculation Utilities
const { getDatabase } = require('../db/database');

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date(NaN);
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return new Date(NaN);
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date(NaN);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function formatDate(d) {
  if (!d || isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWeekend(dateObj, weekendConfig = 'Saturday,Sunday') {
  if (!dateObj || isNaN(dateObj.getTime())) return false;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[dateObj.getUTCDay()];
  const weekendList = weekendConfig.split(',').map(s => s.trim().toLowerCase());
  return weekendList.includes(dayName.toLowerCase());
}

async function getHolidaysSet(db, year = null) {
  let sql = "SELECT date FROM holidays";
  const params = [];
  if (year) {
    sql += " WHERE year = ? OR date LIKE ?";
    params.push(year, `${year}-%`);
  }
  const rows = db.query(sql, params);
  return new Set(rows.map(r => r.date));
}

async function calculateWorkingDaysInMonth(db, year, month) {
  const settings = db.queryOne("SELECT weekend_days FROM settings LIMIT 1");
  const weekendConfig = settings ? settings.weekend_days : 'Saturday,Sunday';
  const holidays = await getHolidaysSet(db, year);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const dateStr = formatDate(d);
    if (!isWeekend(d, weekendConfig) && !holidays.has(dateStr)) {
      workingDays++;
    }
  }

  return { totalDays: daysInMonth, workingDays };
}

async function calculateLeaveDays(db, startDateStr, endDateStr) {
  const settings = db.queryOne("SELECT weekend_days FROM settings LIMIT 1");
  const weekendConfig = settings ? settings.weekend_days : 'Saturday,Sunday';

  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: 'Invalid date format. Expected YYYY-MM-DD.', daysCount: 0 };
  }

  if (start > end) return { error: 'Start date cannot be after end date.', daysCount: 0 };

  // Fetch all holidays so cross-year leaves are accurately covered
  const holidays = await getHolidaysSet(db);

  let workingDaysCount = 0;
  const curr = new Date(start.getTime());

  while (curr <= end) {
    const dateStr = formatDate(curr);
    if (!isWeekend(curr, weekendConfig) && !holidays.has(dateStr)) {
      workingDaysCount++;
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return { daysCount: workingDaysCount };
}

module.exports = {
  parseDate,
  formatDate,
  isWeekend,
  getHolidaysSet,
  calculateWorkingDaysInMonth,
  calculateLeaveDays,
};
