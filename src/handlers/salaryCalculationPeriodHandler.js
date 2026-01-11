// // const SalaryCalculationPeriodService = require("../services/salaryCalculationPeriodService");

// // const getOrgIdFromHeaders = (req) =>
// //   req.headers.org_id ||
// //   req.headers["org-id"] ||
// //   req.headers["x-org-id"] ||
// //   null;

// // /**
// //  * ADD / UPSERT SALARY CALCULATION PERIOD
// //  */
// // const addPeriodHandler = async (req, res, next) => {
// //   try {
// //     const orgId = getOrgIdFromHeaders(req);
// //     if (!orgId) {
// //       return res.status(400).json({ success: false, error: "orgId is required" });
// //     }

// //     const { cutoff_date } = req.body;
// //     if (!cutoff_date) {
// //       return res
// //         .status(400)
// //         .json({ success: false, error: "Cutoff date is required" });
// //     }

// //     const result = await SalaryCalculationPeriodService.addPeriod(
// //       orgId,
// //       cutoff_date
// //     );

// //     res.status(201).json(result);
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // /**
// //  * GET ALL PERIODS
// //  */
// // const getAllPeriodsHandler = async (req, res, next) => {
// //   try {
// //     const orgId = getOrgIdFromHeaders(req);
// //     if (!orgId) {
// //       return res.status(400).json({ success: false, error: "orgId is required" });
// //     }

// //     const result = await SalaryCalculationPeriodService.getAllPeriods(orgId);
// //     res.status(200).json(result);
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // /**
// //  * UPDATE PERIOD
// //  */
// // const updatePeriodHandler = async (req, res, next) => {
// //   try {
// //     const orgId = getOrgIdFromHeaders(req);
// //     if (!orgId) {
// //       return res.status(400).json({ success: false, error: "orgId is required" });
// //     }

// //     const { id } = req.params;
// //     const { cutoff_date } = req.body;

// //     if (!cutoff_date) {
// //       return res
// //         .status(400)
// //         .json({ success: false, error: "Cutoff date is required" });
// //     }

// //     const result = await SalaryCalculationPeriodService.updatePeriod(
// //       orgId,
// //       id,
// //       cutoff_date
// //     );

// //     res.status(200).json(result);
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // module.exports = {
// //   addPeriodHandler,
// //   getAllPeriodsHandler,
// //   updatePeriodHandler,
// // };
// const SalaryCalculationPeriodService = require("../services/salaryCalculationPeriodService");

// const getOrgIdFromRequest = (req) =>
//   req.headers["x-org-id"] ||
//   req.headers["org-id"] ||
//   req.headers["org_id"] ||
//   req.query.org_id ||
//   null;

// /**
//  * ADD / UPSERT SALARY CALCULATION PERIOD
//  */
// const addPeriodHandler = async (req, res, next) => {
//   try {
//     const orgId = getOrgIdFromRequest(req);
//     if (!orgId) {
//       return res.status(400).json({ success: false, error: "orgId is required" });
//     }

//     const { cutoff_date } = req.body;
//     if (!cutoff_date) {
//       return res
//         .status(400)
//         .json({ success: false, error: "Cutoff date is required" });
//     }

//     const result = await SalaryCalculationPeriodService.addPeriod(
//       orgId,
//       cutoff_date
//     );

//     res.status(201).json(result);
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * GET ALL PERIODS
//  */
// const getAllPeriodsHandler = async (req, res, next) => {
//   try {
//     const orgId = getOrgIdFromRequest(req);
//     if (!orgId) {
//       return res.status(400).json({ success: false, error: "orgId is required" });
//     }

//     const result = await SalaryCalculationPeriodService.getAllPeriods(orgId);
//     res.status(200).json(result);
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * UPDATE PERIOD
//  */
// const updatePeriodHandler = async (req, res, next) => {
//   try {
//     const orgId = getOrgIdFromRequest(req);
//     if (!orgId) {
//       return res.status(400).json({ success: false, error: "orgId is required" });
//     }

//     const { id } = req.params;
//     const { cutoff_date } = req.body;

//     if (!cutoff_date) {
//       return res
//         .status(400)
//         .json({ success: false, error: "Cutoff date is required" });
//     }

//     const result = await SalaryCalculationPeriodService.updatePeriod(
//       orgId,
//       id,
//       cutoff_date
//     );

//     res.status(200).json(result);
//   } catch (error) {
//     next(error);
//   }
// };

// module.exports = {
//   addPeriodHandler,
//   getAllPeriodsHandler,
//   updatePeriodHandler,
// };
// File: handlers/salaryCalculationPeriodHandler.js
const SalaryCalculationPeriodService = require("../services/salaryCalculationPeriodService");

const getOrgIdFromRequest = (req) =>
  req.headers["x-org-id"] ||
  req.headers["org-id"] ||
  req.headers["org_id"] ||
  req.query.org_id ||
  null;

const addPeriodHandler = async (req, res, next) => {
  try {
    const orgId = getOrgIdFromRequest(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: "orgId is required" });
    }

    const { cutoff_date } = req.body;

    // ← Added basic protection against bad input
    if (cutoff_date == null) {
      return res.status(400).json({ success: false, error: "cutoff_date is required" });
    }

    const result = await SalaryCalculationPeriodService.addPeriod(orgId, cutoff_date);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getAllPeriodsHandler = async (req, res, next) => {
  try {
    const orgId = getOrgIdFromRequest(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: "orgId is required" });
    }

    const result = await SalaryCalculationPeriodService.getAllPeriods(orgId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updatePeriodHandler = async (req, res, next) => {
  try {
    const orgId = getOrgIdFromRequest(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: "orgId is required" });
    }

    const { id } = req.params;
    const { cutoff_date } = req.body;

    if (cutoff_date == null) {
      return res.status(400).json({ success: false, error: "cutoff_date is required" });
    }

    const result = await SalaryCalculationPeriodService.updatePeriod(orgId, id, cutoff_date);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addPeriodHandler,
  getAllPeriodsHandler,
  updatePeriodHandler,
};