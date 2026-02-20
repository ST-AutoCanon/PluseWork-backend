

// const cron = require("node-cron");
// const moment = require("moment-timezone");
// const masterDb = require("../config");
// const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

// console.log("⏰ Auto punch cron started (tenant-based)");

// cron.schedule("55 59 23 * * *", async () => {
//   try {
//     console.log("⏰ Running work-hour based auto punch job...");

//     const now = moment().tz("Asia/Kolkata");
//     const nextDayStart = moment()
//       .tz("Asia/Kolkata")
//       .add(1, "day")
//       .startOf("day");

//     const [orgs] = await masterDb.query("SELECT id FROM organizations");

//     for (const org of orgs) {
//       try {
//         const tenantPool = await getTenantPoolByOrgId(org.id);

//         // 1️⃣ Get work hours
//         const [[orgConfig]] = await tenantPool.query(
//           `SELECT work_hours FROM org_work_hours WHERE org_id = ?`,
//           [org.id]
//         );

//         if (!orgConfig) continue;

//         const WORK_HOURS = orgConfig.work_hours;

//         // 2️⃣ Get active punched-in employees
//         const [punchedInUsers] = await tenantPool.query(
//           `SELECT ea.punch_id, ea.employee_id, ea.punchin_time
//            FROM emp_attendence ea
//            JOIN employees e 
//              ON e.employee_id = ea.employee_id
//            WHERE ea.punch_status = 'Punch In'
//              AND e.status = 'Active'`
//         );

//         for (const user of punchedInUsers) {
//           const punchInTime = moment(user.punchin_time);
//           const workedHours = now.diff(punchInTime, "hours", true);

//           // 🔴 3️⃣ Punch-Out for everyone
//           await tenantPool.query(
//             `UPDATE emp_attendence
//              SET punch_status = 'Punch Out',
//                  punchout_time = ?,
//                  punchout_device = 'Automatic',
//                  punchout_location = 'Automatic',
//                  punchmode = 'Automatic'
//              WHERE punch_id = ?`,
//             [now.format("YYYY-MM-DD HH:mm:ss"), user.punch_id]
//           );

//           // 🟢 4️⃣ If NOT crossed work hours → Re-login
//           if (workedHours < WORK_HOURS) {
//             await tenantPool.query(
//               `INSERT INTO emp_attendence
//                (employee_id, punch_status, punchin_time, punchin_device, punchin_location, punchmode)
//                VALUES (?, 'Punch In', ?, 'Automatic', 'Automatic', 'Automatic')`,
//               [
//                 user.employee_id,
//                 nextDayStart.format("YYYY-MM-DD HH:mm:ss"),
//               ]
//             );

//             console.log(
//               `🔄 Org ${org.id}: Re-logged employee ${user.employee_id} (Worked ${workedHours.toFixed(
//                 2
//               )} hrs)`
//             );
//           } else {
//             console.log(
//               `✅ Org ${org.id}: Completed hours. Auto punched out employee ${user.employee_id}`
//             );
//           }
//         }
//       } catch (tenantError) {
//         console.error(
//           `❌ Org ${org.id}: tenant cron failed`,
//           tenantError.message
//         );
//       }
//     }
//   } catch (err) {
//     console.error("❌ Auto punch cron master failure:", err);
//   }
// });
