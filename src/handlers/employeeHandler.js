// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");
// const upload = require("../utils/multerConfig");
// const employeeService = require("../services/employeeService");
// const ErrorHandler = require("../utils/errorHandler");
// const xlsx = require("xlsx");

// /**
//  * Bulk add employees from an Excel file.
//  * Expects the Excel file to be uploaded via req.file (using a middleware like multer).
//  * Each row in the Excel should have headers matching the employeeData keys (e.g., first_name, email, etc.).
//  */
// exports.bulkAddEmployees = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res
//         .status(400)
//         .json(
//           ErrorHandler.generateErrorResponse(
//             400,
//             "Excel file is required for bulk upload."
//           )
//         );
//     }

//     // Parse the Excel file
//     const workbook = xlsx.readFile(req.file.path);
//     const sheetName = workbook.SheetNames[0];
//     const worksheet = workbook.Sheets[sheetName];
//     const employeesData = xlsx.utils.sheet_to_json(worksheet);

//     // Prepare arrays for success and error results
//     const results = [];
//     const errors = [];

//     // Process each employee record in the Excel sheet
//     for (const employeeData of employeesData) {
//       try {
//         // You can add any necessary data validation or transformation here.
//         // The addEmployee service already handles duplicate checks and sending reset emails.
//         const dbResult = await employeeService.addEmployee(employeeData);
//         results.push({
//           email: employeeData.email,
//           status: "success",
//         });
//       } catch (error) {
//         console.error(
//           `Error adding employee with email ${employeeData.email}:`,
//           error
//         );
//         errors.push({
//           email: employeeData.email,
//           error: error.message || "Error adding employee",
//         });
//       }
//     }

//     return res.status(201).json(
//       ErrorHandler.generateSuccessResponse(
//         201,
//         "Bulk employee process completed.",
//         {
//           added: results,
//           errors: errors,
//         }
//       )
//     );
//   } catch (error) {
//     console.error("Bulk employee addition error:", error);
//     return res
//       .status(500)
//       .json(
//         ErrorHandler.generateErrorResponse(
//           500,
//           "Failed to add employees in bulk."
//         )
//       );
//   }
// };

// // Update the addEmployee Handler to handle file upload
// exports.addEmployee = async (req, res) => {
//   try {
//     const employeeData = req.body;

//     if (req.file) {
//       employeeData.photo_url = `photos/${req.file.filename}`;
//     }

//     const newEmployee = await employeeService.addEmployee(employeeData);
//     return res.status(201).json(
//       ErrorHandler.generateSuccessResponse(
//         201,
//         "Employee added successfully. Reset email sent.",
//         {
//           data: employeeData,
//         }
//       )
//     );
//   } catch (error) {
//     if (error.code === "ER_DUP_ENTRY") {
//       return res
//         .status(400)
//         .json(
//           ErrorHandler.generateErrorResponse(
//             400,
//             "Email already exists. Please try a different email."
//           )
//         );
//     } else if (error.code === "DUPLICATE_AADHAAR_PAN") {
//       return res
//         .status(400)
//         .json(
//           ErrorHandler.generateErrorResponse(
//             400,
//             "Employee already exists. Please verify the details."
//           )
//         );
//     }
//     return res
//       .status(500)
//       .json(
//         ErrorHandler.generateErrorResponse(
//           500,
//           "Failed to add employee and send email"
//         )
//       );
//   }
// };

// /**
//  * Handler to fetch all employees or search employees based on the search query and date filters.
//  */
// exports.searchEmployees = async (req, res) => {
//   try {
//     const { search, fromDate, toDate } = req.query;

//     const employees = await employeeService.searchEmployees(
//       search,
//       fromDate,
//       toDate
//     );

//     return res
//       .status(200)
//       .json(ErrorHandler.generateSuccessResponse(200, { data: employees }));
//   } catch (error) {
//     console.error("Error fetching employees:", error);

//     return res
//       .status(500)
//       .json(
//         ErrorHandler.generateErrorResponse(500, "Failed to fetch employees")
//       );
//   }
// };

// /**
//  * Handler to edit an employee.
//  */
// exports.editEmployee = async (req, res) => {
//   try {
//     const employeeId = req.params.employeeId;
//     const updatedData = req.body;

//     // Check if a new photo is uploaded
//     if (req.file) {
//       updatedData.photo_url = `photos/${req.file.filename}`;

//       // Fetch the existing employee to get the old photo URL
//       const existingEmployee = await employeeService.getEmployee(employeeId);

//       // Update employee with new photo URL first
//       await employeeService.editEmployee(employeeId, updatedData);

//       // Delete the old photo only if the new one is successfully saved
//       if (existingEmployee && existingEmployee.photo_url) {
//         const oldPhotoPath = path.join(
//           __dirname,
//           "../../",
//           existingEmployee.photo_url
//         );
//         if (fs.existsSync(oldPhotoPath)) {
//           fs.unlinkSync(oldPhotoPath);
//         }
//       }
//     } else {
//       // If no new photo is uploaded, update other data
//       await employeeService.editEmployee(employeeId, updatedData);
//     }

//     return res
//       .status(200)
//       .json(
//         ErrorHandler.generateSuccessResponse(
//           200,
//           "Employee updated successfully."
//         )
//       );
//   } catch (error) {
//     console.error("Error in editEmployee:", error);
//     return res
//       .status(500)
//       .json(
//         ErrorHandler.generateErrorResponse(500, "Failed to update employee.")
//       );
//   }
// };

// /**
//  * Handler to deactivate an employee.
//  */
// exports.deactivateEmployee = async (req, res) => {
//   try {
//     const employeeId = req.params.employeeId;
//     await employeeService.deactivateEmployee(employeeId);
//     return res
//       .status(200)
//       .json(
//         ErrorHandler.generateSuccessResponse(
//           200,
//           "Employee deactivated successfully"
//         )
//       );
//   } catch (error) {
//     return res
//       .status(400)
//       .json(
//         ErrorHandler.generateErrorResponse(400, "Failed to deactivate employee")
//       );
//   }
// };

// /**
//  * Handler to fetch an employee.
//  */
// exports.getEmployee = async (req, res) => {
//   const employeeId = req.query.employeeId || req.params.employeeId;
//   if (!employeeId) {
//     return res
//       .status(400)
//       .json(
//         ErrorHandler.generateErrorResponse(400, "Employee ID is required.")
//       );
//   }
//   try {
//     const profile = await employeeService.getEmployee(employeeId);
//     return res.status(200).json({
//       status: "success",
//       code: 200,
//       message: "Profile fetched successfully.",
//       data: profile,
//     });
//   } catch (error) {
//     console.error("Error in getEmployee:", error.message);
//     return res
//       .status(500)
//       .json(
//         ErrorHandler.generateErrorResponse(
//           500,
//           "Failed to fetch employee profile."
//         )
//       );
//   }
// };


const multer = require("multer");
const path = require("path");
const fs = require("fs");
const upload = require("../utils/multerConfig");
const employeeService = require("../services/employeeService");
const ErrorHandler = require("../utils/errorHandler");
const xlsx = require("xlsx");


exports.bulkAddEmployees = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(
            400,
            "Excel file is required for bulk upload."
          )
        );
    }

    // Parse the Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const employeesData = xlsx.utils.sheet_to_json(worksheet);

    // Prepare arrays for success and error results
    const results = [];
    const errors = [];

    // Process each employee record in the Excel sheet
    for (const employeeData of employeesData) {
      try {
        // You can add any necessary data validation or transformation here.
        // The addEmployee service already handles duplicate checks and sending reset emails.
        const dbResult = await employeeService.addEmployee(employeeData);
        results.push({
          email: employeeData.email,
          status: "success",
        });
      } catch (error) {
        console.error(
          `Error adding employee with email ${employeeData.email}:`,
          error
        );
        errors.push({
          email: employeeData.email,
          error: error.message || "Error adding employee",
        });
      }
    }

    return res.status(201).json(
      ErrorHandler.generateSuccessResponse(
        201,
        "Bulk employee process completed.",
        {
          added: results,
          errors: errors,
        }
      )
    );
  } catch (error) {
    console.error("Bulk employee addition error:", error);
    return res
      .status(500)
      .json(
        ErrorHandler.generateErrorResponse(
          500,
          "Failed to add employees in bulk."
        )
      );
  }
};

// Update the addEmployee Handler to handle file upload


exports.addEmployee = async (req, res) => {
  console.log("📥 addEmployee called!");

  try {
    const employeeData = req.body;

    if (req.file) {
      employeeData.photo_url = `photos/${req.file.filename}`;
    }

    const newEmployee = await employeeService.addEmployee(employeeData);
    return res.status(201).json(
      ErrorHandler.generateSuccessResponse(
        201,
        "Employee added successfully. Reset email sent.",
        {
          data: employeeData,
        }
      )
    );
  } catch (error) {
  console.error("❌ Add Employee Error:", error);

  return res.status(500).json({
    status: "error",
    code: 500,
    message: "Failed to add employee",
    error: error.message || "Unknown server error"
  });
}
 {
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(
            400,
            "Email already exists. Please try a different email."
          )
        );
    } else if (error.code === "DUPLICATE_AADHAAR_PAN") {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(
            400,
            "Employee already exists. Please verify the details."
          )
        );
    }
    return res
      .status(500)
      .json(
        ErrorHandler.generateErrorResponse(
          500,
          "Failed to add employee and send email"
        )
      );
  }
};

/**
 * Handler to fetch all employees or search employees based on the search query and date filters.
 */
exports.searchEmployees = async (req, res) => {
  try {
    const { orgId, search, fromDate, toDate } = req.query;

    if (!orgId) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(
            400,
            "Organization ID is required."
          )
        );
    }

    const employees = await employeeService.searchEmployees(
      orgId,
      search,
      fromDate,
      toDate
    );

    return res
      .status(200)
      .json(ErrorHandler.generateSuccessResponse(200, { data: employees }));
  } catch (error) {
    console.error("Error fetching employees:", error);
    return res
      .status(500)
      .json(
        ErrorHandler.generateErrorResponse(500, "Failed to fetch employees")
      );
  }
};

/**
 * Handler to edit an employee.
 */
exports.editEmployee = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const updatedData = req.body;

    // Check if a new photo is uploaded
    if (req.file) {
      updatedData.photo_url = `photos/${req.file.filename}`;

      // Fetch the existing employee to get the old photo URL
      const existingEmployee = await employeeService.getEmployee(employeeId);

      // Update employee with new photo URL first
      await employeeService.editEmployee(employeeId, updatedData);

      // Delete the old photo only if the new one is successfully saved
      if (existingEmployee && existingEmployee.photo_url) {
        const oldPhotoPath = path.join(
          __dirname,
          "../../",
          existingEmployee.photo_url
        );
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
    } else {
      // If no new photo is uploaded, update other data
      await employeeService.editEmployee(employeeId, updatedData);
    }

    return res
      .status(200)
      .json(
        ErrorHandler.generateSuccessResponse(
          200,
          "Employee updated successfully."
        )
      );
  } catch (error) {
    console.error("Error in editEmployee:", error);
    return res
      .status(500)
      .json(
        ErrorHandler.generateErrorResponse(500, "Failed to update employee.")
      );
  }
};

/**
 * Handler to deactivate an employee.
 */
exports.deactivateEmployee = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    await employeeService.deactivateEmployee(employeeId);
    return res
      .status(200)
      .json(
        ErrorHandler.generateSuccessResponse(
          200,
          "Employee deactivated successfully"
        )
      );
  } catch (error) {
    return res
      .status(400)
      .json(
        ErrorHandler.generateErrorResponse(400, "Failed to deactivate employee")
      );
  }
};

/**
 * Handler to fetch an employee.
 */


exports.getEmployee = async (req, res) => {
  const employeeId = req.query.employeeId || req.params.employeeId;
  if (!employeeId) {
    return res
      .status(400)
      .json(
        ErrorHandler.generateErrorResponse(400, "Employee ID is required.")
      );
  }
  try {
    const profile = await employeeService.getEmployee(employeeId);
    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Profile fetched successfully.",
      data: profile,
    });
  } catch (error) {
    console.error("Error in getEmployee:", error.message);
    return res
      .status(500)
      .json(
        ErrorHandler.generateErrorResponse(
          500,
          "Failed to fetch employee profile."
        )
      );
  }
};