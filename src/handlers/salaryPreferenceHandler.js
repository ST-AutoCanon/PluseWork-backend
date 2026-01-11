// // // src/handlers/salaryPreferenceHandler.js (or wherever your handler is)

// // const {
// //   getTenantPool,
// //   sanitizeDbName,
// // } = require("../db/tenantPoolManager");

// // const queries = require("../constants/salaryPreferenceQueries");

// // /**
// //  * Resolve tenant pool exactly like assets service
// //  */
// // async function getTenantPoolForOrgId(orgId) {
// //   if (!orgId) {
// //     const err = new Error("orgId required");
// //     err.code = "ORG_REQUIRED";
// //     throw err;
// //   }

// //   const dbName = sanitizeDbName(`tenant_${orgId}`);
// //   return getTenantPool(dbName);
// // }

// // /* ================= GET HANDLER ================= */
// // const getPreferencesHandler = async (req, res) => {
// //   try {
// //     const orgId = req.headers["x-org-id"] || req.query.orgId; // fallback if needed
// //     if (!orgId) {
// //       return res.status(400).json({ error: "Missing x-org-id header" });
// //     }

// //     const tenantPool = await getTenantPoolForOrgId(orgId);

// //     const [rows] = await tenantPool.query(queries.GET_SALARY_PREFERENCES, [orgId]);

// //     const prefs = rows.length > 0 ? rows[0] : {
// //       org_id: orgId,
// //       selected_month: null,
// //       selected_year: null,
// //       selected_template_id: null,
// //     };

// //     res.json(prefs);
// //   } catch (error) {
// //     console.error("❌ Error fetching salary preferences:", error);
// //     res.status(500).json({ error: "Internal server error" });
// //   }
// // };

// // /* ================= POST HANDLER ================= */
// // const savePreferencesHandler = async (req, res) => {
// //   try {
// //     const orgId = req.headers["x-org-id"];
// //     if (!orgId) {
// //       return res.status(400).json({ error: "Missing x-org-id header" });
// //     }

// //     const { selected_month, selected_year, selected_template_id } = req.body;

// //     if (!selected_month || !selected_year) {
// //       return res.status(400).json({ error: "selected_month and selected_year are required" });
// //     }

// //     const tenantPool = await getTenantPoolForOrgId(orgId);

// //     await tenantPool.query(
// //       queries.UPSERT_SALARY_PREFERENCES,
// //       [
// //         orgId,
// //         selected_month,
// //         selected_year,
// //         selected_template_id || null,
// //       ]
// //     );

// //     res.json({ success: true, message: "Preferences saved successfully" });
// //   } catch (error) {
// //     console.error("❌ Error saving salary preferences:", error);
// //     res.status(500).json({ error: "Internal server error" });
// //   }
// // };

// // module.exports = {
// //   getPreferencesHandler,
// //   savePreferencesHandler,
// // };

// // src/handlers/salaryPreferenceHandler.js

// const {
//   getTenantPool,
//   sanitizeDbName,
// } = require("../db/tenantPoolManager");

// const queries = require("../constants/salaryPreferenceQueries"); // adjust path/name if needed

// async function getTenantPoolForOrgId(orgId) {
//   if (!orgId) {
//     const err = new Error("orgId required");
//     err.code = "ORG_REQUIRED";
//     throw err;
//   }

//   const dbName = sanitizeDbName(`tenant_${orgId}`);
//   return getTenantPool(dbName);
// }

// /* ================= GET PREFERENCES HANDLER ================= */
// const getPreferencesHandler = async (req, res) => {
//   try {
//     const orgId = req.headers["x-org-id"];
//     if (!orgId) {
//       return res.status(400).json({ error: "Missing x-org-id header" });
//     }

//     const tenantPool = await getTenantPoolForOrgId(orgId);

//     const [rows] = await tenantPool.query(queries.GET_SALARY_PREFERENCES, [orgId]);

//     if (rows.length === 0) {
//       // Return defaults if no preferences saved yet
//       return res.json({
//         selected_month: null,
//         selected_year: null,
//         selected_template_id: null,
//       });
//     }

//     res.json(rows[0]); // Return the row directly
//   } catch (error) {
//     console.error("❌ Error fetching salary preferences:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

// /* ================= POST (SAVE) PREFERENCES HANDLER ================= */
// const savePreferencesHandler = async (req, res) => {
//   try {
//     const orgId = req.headers["x-org-id"];
//     if (!orgId) {
//       return res.status(400).json({ error: "Missing x-org-id header" });
//     }

//     const { selected_month, selected_year, selected_template_id } = req.body;

//     if (!selected_month || !selected_year) {
//       return res.status(400).json({ error: "selected_month and selected_year are required" });
//     }

//     const tenantPool = await getTenantPoolForOrgId(orgId);

//     await tenantPool.query(
//       queries.UPSERT_SALARY_PREFERENCES,
//       [
//         orgId,
//         selected_month,
//         selected_year,
//         selected_template_id || null,
//       ]
//     );

//     res.json({ success: true, message: "Preferences saved successfully" });
//   } catch (error) {
//     console.error("❌ Error saving salary preferences:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

// module.exports = {
//   getPreferencesHandler,
//   savePreferencesHandler,
// };
const {
  getPreferences,
  savePreferences,getSelectedTemplateId,
} = require("../services/salaryPreferenceService");

/* ================= GET ================= */
const getPreferencesHandler = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    if (!orgId) {
      return res.status(400).json({ error: "Missing x-org-id header" });
    }

    const prefs = await getPreferences(orgId);

    if (!prefs) {
      return res.json({
        selected_month: null,
        selected_year: null,
        selected_template_id: null,
      });
    }

    res.json(prefs);
  } catch (error) {
    console.error("❌ Error fetching salary preferences:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ================= SAVE ================= */
const savePreferencesHandler = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    if (!orgId) {
      return res.status(400).json({ error: "Missing x-org-id header" });
    }

    const {
      selected_month,
      selected_year,
      selected_template_id,
    } = req.body;

    if (!selected_month || !selected_year) {
      return res
        .status(400)
        .json({ error: "selected_month and selected_year are required" });
    }

    await savePreferences(orgId, {
      selected_month,
      selected_year,
      selected_template_id,
    });

    res.json({ success: true, message: "Preferences saved successfully" });
  } catch (error) {
    console.error("❌ Error saving salary preferences:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getPreferencesHandler,
  savePreferencesHandler,
};
