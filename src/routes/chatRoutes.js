const express = require("express");
const router = express.Router();
const simpleAuth = require("../middleware/simpleAuth");
const chatHandler = require("../handlers/chatHandler");

router.use(simpleAuth);

router.post("/rooms", chatHandler.createRoom);
router.get("/rooms", chatHandler.listRooms);
router.get("/rooms/:roomId/members", chatHandler.listMembers);
router.get("/rooms/:roomId/messages", chatHandler.getMessages);
router.post("/ChatUploads", chatHandler.uploadFile);
router.get("/ChatUploads/:orgId/:filename", chatHandler.downloadAttachment);
router.post("/rooms/:roomId/members", chatHandler.addMember);
router.delete("/rooms/:roomId/members/:employeeId", chatHandler.removeMember);
router.delete("/rooms/:roomId", chatHandler.deleteRoom);
router.delete("/rooms/:roomId/messages/:messageId", chatHandler.deleteMessage);
router.get("/rooms/:roomId/messages", chatHandler.getMessages);
router.post("/rooms/:roomId/read", chatHandler.markRead);

module.exports = router;
