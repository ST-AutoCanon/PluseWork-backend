// handlers/chatHandler.js
const chatService = require("../services/chatService");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * Resolve orgId helper (checks headers, query, body, user)
 */
const resolveOrgIdFromReq = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.query?.orgId ||
    req.body?.orgId ||
    (req.user && req.user.orgId) ||
    null
  );
};

/**
 * File storage uses org-specific subfolder under ChatUploads
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orgId = resolveOrgIdFromReq(req) || "unknown";
    const uploadDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "ChatUploads",
      String(orgId)
    );
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (err) {
      return cb(err);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/**
 * Handlers
 */
module.exports = {
  createRoom: async (req, res) => {
    try {
      const orgId = resolveOrgIdFromReq(req);
      if (!orgId)
        return res.status(400).json({ error: "org_id header is required" });

      const { name, isGroup, members } = req.body;
      const creatorId = req.user.id;
      let memberArr = members;
      try {
        if (typeof members === "string") memberArr = JSON.parse(members);
      } catch (e) {}

      const roomId = await chatService.createRoom(
        orgId,
        name,
        isGroup,
        creatorId,
        memberArr || []
      );
      res.json({ roomId });
    } catch (err) {
      console.error("createRoom error:", err);
      res.status(500).json({ error: err.message || "Could not create room" });
    }
  },

  listRooms: async (req, res) => {
    try {
      const orgId = resolveOrgIdFromReq(req);
      if (!orgId)
        return res.status(400).json({ error: "org_id header is required" });

      const rooms = await chatService.getRoomsWithUnreadCounts(
        orgId,
        req.user.id
      );
      res.json(rooms);
    } catch (err) {
      console.error("listRooms error:", err);
      res.status(500).json({ error: "Could not fetch rooms" });
    }
  },

  getMessages: async (req, res) => {
    try {
      const orgId = resolveOrgIdFromReq(req);
      if (!orgId)
        return res.status(400).json({ error: "org_id header is required" });

      const { roomId } = req.params;
      await chatService.markMessagesRead(orgId, roomId, req.user.id);
      const msgs = await chatService.getMessagesWithRead(
        orgId,
        roomId,
        req.user.id
      );
      const shaped = msgs.map((m) => ({
        ...m,
        location:
          m.latitude != null
            ? { lat: m.latitude, lng: m.longitude, address: m.address }
            : null,
      }));
      res.json(shaped);
    } catch (err) {
      console.error("getMessages error:", err);
      res.status(500).json({ error: "Could not fetch messages" });
    }
  },

  markRead: async (req, res) => {
    try {
      const orgId = resolveOrgIdFromReq(req);
      if (!orgId)
        return res.status(400).json({ error: "org_id header is required" });

      const { roomId } = req.params;
      await chatService.markMessagesRead(orgId, roomId, req.user.id);
      res.status(204).end();
    } catch (err) {
      console.error("markRead error:", err);
      res.status(500).json({ error: "Could not mark messages read" });
    }
  },

  uploadFile: [
    upload.single("file"),
    (req, res) => {
      try {
        const orgId =
          resolveOrgIdFromReq(req) || (req.user && req.user.orgId) || "unknown";
        // url includes orgId segment for clarity and correct routing
        const url = `/ChatUploads/${orgId}/${req.file.filename}`;
        res.json({ url });
      } catch (err) {
        console.error("uploadFile error:", err);
        res.status(500).json({ error: "File upload failed" });
      }
    },
  ],

  downloadAttachment: (req, res) => {
    try {
      const orgId = req.params.orgId || resolveOrgIdFromReq(req);
      if (!orgId) return res.status(400).json({ error: "org_id required" });

      const filename = req.params.filename;
      const uploadDir = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "ChatUploads",
        String(orgId)
      );
      const filePath = path.join(uploadDir, filename);

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          return res.status(404).json({ error: "File not found" });
        }

        res.setHeader("Content-Length", stats.size);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        fs.createReadStream(filePath).pipe(res);
      });
    } catch (err) {
      console.error("downloadAttachment error:", err);
      res.status(500).json({ error: "Could not download file" });
    }
  },

  listMembers: async (req, res) => {
    try {
      const orgId = resolveOrgIdFromReq(req);
      if (!orgId)
        return res.status(400).json({ error: "org_id header is required" });

      const { roomId } = req.params;
      const members = await chatService.getRoomMembers(orgId, roomId);
      res.json(members);
    } catch (err) {
      console.error("listMembers error:", err);
      res.status(500).json({ error: "Could not fetch members" });
    }
  },

  addMember: async (req, res) => {
    try {
      const orgId = resolveOrgIdFromReq(req);
      if (!orgId)
        return res.status(400).json({ error: "org_id header is required" });

      const { roomId } = req.params;
      const { employeeId } = req.body;
      await chatService.addMemberToRoom(orgId, roomId, employeeId);
      res.status(204).end();
    } catch (err) {
      console.error("addMember error:", err);
      res.status(500).json({ error: "Could not add member" });
    }
  },

  removeMember: async (req, res) => {
    try {
      const orgId = resolveOrgIdFromReq(req);
      if (!orgId)
        return res.status(400).json({ error: "org_id header is required" });

      const { roomId, employeeId } = req.params;
      await chatService.removeMemberFromRoom(orgId, roomId, employeeId);
      res.status(204).end();
    } catch (err) {
      console.error("removeMember error:", err);
      res.status(500).json({ error: "Could not remove member" });
    }
  },

  deleteRoom: async (req, res) => {
    try {
      const orgId = resolveOrgIdFromReq(req);
      if (!orgId)
        return res.status(400).json({ error: "org_id header is required" });

      const { roomId } = req.params;
      await chatService.deleteRoom(orgId, roomId);
      res.status(204).end();
    } catch (err) {
      console.error("deleteRoom error:", err);
      res.status(500).json({ error: "Could not delete room" });
    }
  },

  deleteMessage: async (req, res) => {
    try {
      const orgId = resolveOrgIdFromReq(req);
      if (!orgId)
        return res.status(400).json({ error: "org_id header is required" });

      const { roomId, messageId } = req.params;
      const userId = req.user.id;
      await chatService.deleteMessage(orgId, messageId, roomId, userId);
      res.sendStatus(204);
    } catch (err) {
      console.error("deleteMessage error:", err);
      res.status(err.status === 403 ? 403 : 500).json({ error: err.message });
    }
  },
};
