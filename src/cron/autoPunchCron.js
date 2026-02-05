

const cron = require("node-cron");
const moment = require("moment-timezone");
const masterDb = require("../config");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

console.log("⏰ Auto punch cron started (tenant-based)");

cron.schedule("55 59 23 * * *", async () => {
  try {
    console.log("▶ Running automatic punch-out job...");

    const todayDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");

    const [orgs] = await masterDb.query("SELECT id FROM organizations");

    for (const org of orgs) {
      try {
        const tenantPool = await getTenantPoolByOrgId(org.id);

        // 1️⃣ Get org work hours
        const [[orgConfig]] = await tenantPool.query(
          `SELECT work_hours FROM org_work_hours WHERE org_id = ?`,
          [org.id]
        );

        if (!orgConfig) {
          console.log(`⚠️ Org ${org.id}: work hours not configured`);
          continue;
        }

        const WORK_HOURS = orgConfig.work_hours;

        const punchOutTime = moment()
          .tz("Asia/Kolkata")
          .format("YYYY-MM-DD HH:mm:ss");

        const punchInTime = moment()
          .tz("Asia/Kolkata")
          .add(WORK_HOURS, "hours")
          .format("YYYY-MM-DD HH:mm:ss");

        // 2️⃣ Get currently punched-in users
        const [punchedInUsers] = await tenantPool.query(
          `SELECT punch_id, employee_id, punchin_device, punchin_location
           FROM emp_attendence
           WHERE punch_status = 'Punch In'`
        );

        if (!punchedInUsers.length) {
          console.log(`ℹ️ Org ${org.id}: no punched-in users`);
          continue;
        }

        // 3️⃣ Auto punch-out
        await Promise.all(
          punchedInUsers.map((row) =>
            tenantPool.query(
              `UPDATE emp_attendence
               SET punch_status = 'Punch Out',
                   punchout_time = ?,
                   punchout_device = 'Automatic',
                   punchout_location = 'Automatic',
                   punchmode = 'Automatic'
               WHERE punch_id = ?`,
              [punchOutTime, row.punch_id]
            )
          )
        );

        console.log(
          `✅ Org ${org.id}: auto punched out ${punchedInUsers.length} employees`
        );

        await new Promise((resolve) => setTimeout(resolve, 5000));

        // 4️⃣ Eligible for auto punch-in
        const [eligibleEmployees] = await tenantPool.query(
          `SELECT 
             ea.employee_id,
             ea.punchin_device AS device,
             ea.punchin_location AS location
           FROM emp_attendence ea
           JOIN employees e 
             ON e.employee_id = ea.employee_id
           WHERE ea.punch_status = 'Punch Out'
             AND ea.punchmode = 'Automatic'
             AND e.status = 'Active'
             AND ea.punchout_time BETWEEN ? AND ?
             AND NOT EXISTS (
               SELECT 1 FROM emp_attendence sub
               WHERE sub.employee_id = ea.employee_id
               AND sub.punch_status = 'Punch In'
               AND sub.punchin_time > ea.punchout_time
             )`,
          [`${todayDate} 00:00:00`, `${todayDate} 23:59:59`]
        );

        if (!eligibleEmployees.length) {
          console.log(`ℹ️ Org ${org.id}: no eligible employees for punch-in`);
          continue;
        }

        // 5️⃣ Auto punch-in after org work hours
        await Promise.all(
          eligibleEmployees.map((emp) =>
            tenantPool.query(
              `INSERT INTO emp_attendence
               (employee_id, punch_status, punchin_time, punchin_device, punchin_location, punchmode)
               VALUES (?, 'Punch In', ?, 'Automatic', 'Automatic', 'Automatic')`,
              [emp.employee_id, punchInTime]
            )
          )
        );

        console.log(
          `✅ Org ${org.id}: auto punched in ${eligibleEmployees.length} active employees after ${WORK_HOURS} hours`
        );
      } catch (tenantError) {
        console.error(
          `❌ Org ${org.id}: tenant cron failed`,
          tenantError.message
        );
      }
    }
  } catch (err) {
    console.error("❌ Auto punch cron master failure:", err);
  }
});
