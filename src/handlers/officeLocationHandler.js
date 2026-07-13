

// // const OfficeLocationService = require("../services/officeLocationService");

// // const getAllOfficeLocations = async (req, res) => {
// //   try {
// //     const orgId = req.user?.orgId || req.query.orgId;

// //     if (!orgId) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "orgId is required",
// //       });
// //     }

// //     const offices = await OfficeLocationService.getAllOfficeLocations(orgId);

// //     return res.status(200).json({
// //       success: true,
// //       count: offices.length,
// //       data: offices,
// //     });
// //   } catch (error) {
// //     console.error("[officeLocationHandler] getAll error:", error);
// //     return res.status(500).json({
// //       success: false,
// //       message: error.message || "Server error",
// //     });
// //   }
// // };

// // const createOfficeLocation = async (req, res) => {
// //   try {
// //     const orgId = req.user?.orgId || req.body.orgId;

// //     if (!orgId) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "orgId is required",
// //       });
// //     }

// //     const newOffice = await OfficeLocationService.createOfficeLocation(
// //       orgId,
// //       req.body
// //     );

// //     return res.status(201).json({
// //       success: true,
// //       message: "Office location created successfully",
// //       data: newOffice,
// //     });
// //   } catch (error) {
// //     console.error("[officeLocationHandler] create error:", error);
// //     return res.status(500).json({
// //       success: false,
// //       message: error.message || "Failed to create office location",
// //     });
// //   }
// // };

// // module.exports = {
// //   getAllOfficeLocations,
// //   createOfficeLocation,
// // };

// const OfficeLocationService = require("../services/officeLocationService");

// const getAllOfficeLocations = async (req, res) => {
//   try {
//     const orgId = req.user?.orgId || req.query.orgId;

//     if (!orgId) {
//       return res.status(400).json({
//         success: false,
//         message: "orgId is required",
//       });
//     }

//     const offices = await OfficeLocationService.getAllOfficeLocations(orgId);

//     return res.status(200).json({
//       success: true,
//       count: offices.length,
//       data: offices,
//     });
//   } catch (error) {
//     console.error("[officeLocationHandler] getAll error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Server error",
//     });
//   }
// };

// const createOfficeLocation = async (req, res) => {
//   try {
//     const orgId = req.user?.orgId || req.body.orgId;

//     if (!orgId) {
//       return res.status(400).json({
//         success: false,
//         message: "orgId is required",
//       });
//     }

//     const newOffice = await OfficeLocationService.createOfficeLocation(
//       orgId,
//       req.body
//     );

//     return res.status(201).json({
//       success: true,
//       message: "Office location created successfully",
//       data: newOffice,
//     });
//   } catch (error) {
//     console.error("[officeLocationHandler] create error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Failed to create office location",
//     });
//   }
// };

// const updateOfficeLocation = async (req, res) => {
//   try {
//     const orgId = req.user?.orgId || req.body.orgId;
//     const { id } = req.params;

//     if (!orgId) {
//       return res.status(400).json({
//         success: false,
//         message: "orgId is required",
//       });
//     }

//     if (!id) {
//       return res.status(400).json({
//         success: false,
//         message: "officeId is required",
//       });
//     }

//     const updatedOffice = await OfficeLocationService.updateOfficeLocation(
//       orgId,
//       id,
//       req.body
//     );

//     return res.status(200).json({
//       success: true,
//       message: "Office location updated successfully",
//       data: updatedOffice,
//     });
//   } catch (error) {
//     console.error("[officeLocationHandler] update error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Failed to update office location",
//     });
//   }
// };

// const deleteOfficeLocation = async (req, res) => {
//   try {
//     const orgId = req.user?.orgId || req.query.orgId || req.body.orgId;
//     const { id } = req.params;

//     if (!orgId) {
//       return res.status(400).json({
//         success: false,
//         message: "orgId is required",
//       });
//     }

//     if (!id) {
//       return res.status(400).json({
//         success: false,
//         message: "officeId is required",
//       });
//     }

//     const deleted = await OfficeLocationService.deleteOfficeLocation(orgId, id);

//     return res.status(200).json({
//       success: true,
//       message: "Office location deleted successfully",
//       data: deleted,
//     });
//   } catch (error) {
//     console.error("[officeLocationHandler] delete error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Failed to delete office location",
//     });
//   }
// };

// module.exports = {
//   getAllOfficeLocations,
//   createOfficeLocation,
//   updateOfficeLocation,
//   deleteOfficeLocation,
// };

const OfficeLocationService = require("../services/officeLocationService");

const getAllOfficeLocations = async (req, res) => {
  try {
    const orgId = req.user?.orgId || req.query.orgId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const offices = await OfficeLocationService.getAllOfficeLocations(orgId);

    return res.status(200).json({
      success: true,
      count: offices.length,
      data: offices,
    });
  } catch (error) {
    console.error("[officeLocationHandler] getAll error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const createOfficeLocation = async (req, res) => {
  try {
    const orgId = req.user?.orgId || req.body.orgId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    const newOffice = await OfficeLocationService.createOfficeLocation(
      orgId,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Office location created successfully",
      data: newOffice,
    });
  } catch (error) {
    console.error("[officeLocationHandler] create error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create office location",
    });
  }
};

const updateOfficeLocation = async (req, res) => {
  try {
    const orgId = req.user?.orgId || req.body.orgId;
    const { id } = req.params;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "officeId is required",
      });
    }

    const updatedOffice = await OfficeLocationService.updateOfficeLocation(
      orgId,
      id,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Office location updated successfully",
      data: updatedOffice,
    });
  } catch (error) {
    console.error("[officeLocationHandler] update error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update office location",
    });
  }
};

const deleteOfficeLocation = async (req, res) => {
  try {
    const orgId = req.user?.orgId || req.query.orgId || req.body.orgId;
    const { id } = req.params;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "officeId is required",
      });
    }

    const deleted = await OfficeLocationService.deleteOfficeLocation(orgId, id);

    return res.status(200).json({
      success: true,
      message: "Office location deleted successfully",
      data: deleted,
    });
  } catch (error) {
    console.error("[officeLocationHandler] delete error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete office location",
    });
  }
};

module.exports = {
  getAllOfficeLocations,
  createOfficeLocation,
  updateOfficeLocation,
  deleteOfficeLocation,
};