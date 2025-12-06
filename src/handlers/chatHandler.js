const chatService = require("../services/chatService");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orgId =
      req.headers["x-org-id"] ||
      req.query?.orgId ||
      req.body?.orgId ||
      (req.user && req.user.orgId) ||
      null;
    const uploadDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "ChatUploads",
      orgId
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

module.exports = {
  createRoom: async (req, res) => {
    try {
      const { name, isGroup, members } = req.body;
      const creatorId = req.user.id;
      const roomId = await chatService.createRoom(
        name,
        isGroup,
        creatorId,
        members
      );
      res.json({ roomId });
    } catch (err) {
      console.error("createRoom error:", err);
      res.status(500).json({ error: "Could not create room" });
    }
  },

  listRooms: async (req, res) => {
    try {
      const rooms = await chatService.getRoomsWithUnreadCounts(req.user.id);
      res.json(rooms);
    } catch (err) {
      console.error("listRooms error:", err);
      res.status(500).json({ error: "Could not fetch rooms" });
    }
  },

  getMessages: async (req, res) => {
    try {
      const { roomId } = req.params;
      await chatService.markMessagesRead(roomId, req.user.id);
      const msgs = await chatService.getMessagesWithRead(roomId, req.user.id);
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
      const { roomId } = req.params;
      await chatService.markMessagesRead(roomId, req.user.id);
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
          req.headers["x-org-id"] ||
          req.query?.orgId ||
          req.body?.orgId ||
          (req.user && req.user.orgId) ||
          null;
        const url = `/ChatUploads/${orgId}/${req.file.filename}`;
        res.json({ url });
      } catch (err) {
        console.error("uploadFile error:", err);
        res.status(500).json({ error: "File upload failed" });
      }
    },
  ],

  downloadAttachment: (req, res) => {
    const orgId =
      req.headers["x-org-id"] ||
      req.query?.orgId ||
      req.body?.orgId ||
      (req.user && req.user.orgId) ||
      null;
    const filename = req.params.filename;
    const uploadDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "ChatUploads",
      orgId
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
  },

  listMembers: async (req, res) => {
    try {
      const { roomId } = req.params;
      const members = await chatService.getRoomMembers(roomId);
      res.json(members);
    } catch (err) {
      console.error("listMembers error:", err);
      res.status(500).json({ error: "Could not fetch members" });
    }
  },

  addMember: async (req, res) => {
    try {
      const { roomId } = req.params;
      const { employeeId } = req.body;
      await chatService.addMemberToRoom(roomId, employeeId);
      res.status(204).end();
    } catch (err) {
      console.error("addMember error:", err);
      res.status(500).json({ error: "Could not add member" });
    }
  },

  removeMember: async (req, res) => {
    try {
      const { roomId, employeeId } = req.params;
      await chatService.removeMemberFromRoom(roomId, employeeId);
      res.status(204).end();
    } catch (err) {
      console.error("removeMember error:", err);
      res.status(500).json({ error: "Could not remove member" });
    }
  },

  deleteRoom: async (req, res) => {
    try {
      const { roomId } = req.params;
      await chatService.deleteRoom(roomId);
      res.status(204).end();
    } catch (err) {
      console.error("deleteRoom error:", err);
      res.status(500).json({ error: "Could not delete room" });
    }
  },

  deleteMessage: async (req, res) => {
    try {
      const { roomId, messageId } = req.params;
      const userId = req.user.id;
      await chatService.deleteMessage(messageId, roomId, userId);
      res.sendStatus(204);
    } catch (err) {
      console.error("deleteMessage error:", err);
      res.status(err.status === 403 ? 403 : 500).json({ error: err.message });
    }
  },
};
