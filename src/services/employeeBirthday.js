

const {
  getTenantPoolByOrgId,
} = require("../db/tenantPoolManager");

const {
  GET_TODAYS_BIRTHDAYS_AND_ANNIVERSARIES,
} = require("../constants/employeeBirthday");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.headers["org-id"] ||
    req.headers["orgid"] ||
    null
  );
};

const getOrdinal = (number) => {
  const n = Number(number) || 0;
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }

  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
};

const fetchEmployeeBirthday = async (req, email) => {
  const orgId = getOrgIdFromHeaders(req);

  if (!orgId) {
    throw new Error("Missing x-org-id header");
  }

  const tenantDb = await getTenantPoolByOrgId(orgId);

  const [rows] = await tenantDb.query(
    GET_TODAYS_BIRTHDAYS_AND_ANNIVERSARIES
  );

  const loggedInEmail = String(email || "")
    .trim()
    .toLowerCase();

  const celebrations = [];

  rows.forEach((employee) => {
    const employeeEmail = String(employee.email || "")
      .trim()
      .toLowerCase();

    const isSelf = employeeEmail === loggedInEmail;

    const fullName =
      employee.full_name ||
      `${employee.first_name || ""} ${employee.last_name || ""}`.trim();

    const base = {
      employee_id: employee.employee_id,
      first_name: employee.first_name,
      last_name: employee.last_name,
      full_name: fullName,
      email: employee.email,
      dob: employee.dob,
      joining_date: employee.joining_date,
      is_self: isSelf,
      birthday_today: employee.birthday_today === 1,
      work_anniversary_today:
        employee.work_anniversary_today === 1,
      completed_years: Number(employee.completed_years) || 0,
    };

    // Birthday (independent)
    if (base.birthday_today) {
      celebrations.push({
        ...base,
        type: "birthday",
        message: isSelf
          ? `Happy Birthday, ${fullName}! 🎂`
          : `Today is ${fullName}'s birthday. Wish them! 🎉`,
      });
    }

    // Work Anniversary (independent – can exist together with birthday)
    if (base.work_anniversary_today) {
      const years = base.completed_years;
      const ordinalYears = getOrdinal(years);

      celebrations.push({
        ...base,
        type: "work_anniversary",
        message: isSelf
          ? `Happy ${ordinalYears} Work Anniversary, ${fullName}! 🎉`
          : `Today is ${fullName}'s ${ordinalYears} Work Anniversary. Wish them! 🎉`,
      });
    }
  });

  const myCelebrations = celebrations.filter(
    (item) => item.is_self
  );

  const otherCelebrations = celebrations.filter(
    (item) => !item.is_self
  );

  return {
    show: celebrations.length > 0,
    today: new Date().toISOString().split("T")[0],
    myCelebrations,
    otherCelebrations,
    celebrations,
  };
};

module.exports = {
  fetchEmployeeBirthday,
};