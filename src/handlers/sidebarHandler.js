const sidebarService = require("../services/sidebarService");
const ErrorHandler = require("../utils/errorHandler");

exports.getSidebarMenuByOrgAndRole = async (req, res) => {
  const { orgId, role } = req.query;

  if (!orgId || !role) {
    return res
      .status(400)
      .json(ErrorHandler.generateErrorResponse(400, "orgId and role are required"));
  }

  try {
    const menu = await sidebarService.fetchSidebarMenuByOrgAndRole(orgId, role);
    return res.status(200).json({ status: "success", data: menu });
  } catch (err) {
    console.error("Sidebar Menu Fetch Error:", err);
    return res
      .status(500)
      .json(ErrorHandler.generateErrorResponse(500, "Internal Server Error"));
  }
};
