// server.js (merged, Redis session + previous features)
require("dotenv").config();
const path = require("path");
const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");
const { Server } = require("socket.io");
const webpush = require("web-push");
const cron = require("node-cron");

const { createSessionStore, _initPromise } = require("./lib/sessionStore"); // your redis session store factory
const EmployeeQueries = require("./services/employeeQueries");
const chatService = require("./services/chatService");
const apiKeyMiddleware = require("./middleware/apiKeyMiddleware");
const idleTimeout = require("./middleware/idleTimeout");

// ROUTES (adjust as needed)
const holidayRoutes = require("./routes/holidayRoutes");
const loginRoutes = require("./routes/login");
const meRoute = require("./routes/meRoute");
const leaveRoutes = require("./routes/leave");
const leavePolicy = require("./routes/leavePolicyRoutes");
const employeeRoutes = require("./routes/employee");
const employeeQueries = require("./routes/employeeQueries");
const projects = require("./routes/project");
const invoices = require("./routes/invoiceRoutes");
const resetPasswordRoutes = require("./routes/resetPassword");
const forgotPasswordRoutes = require("./routes/forgotPassword");
const addDepartmentRoutes = require("./routes/addDepartment");
const attendanceRoutes = require("./routes/attendance_Routes");
const empSessionRoutes = require("./routes/empSessionRoute");
const dashboardReimbursementRoutes = require("./routes/dashboardReimbursementRoutes");
const workDayRoutes = require("./routes/empWorkDay");
const workHourSummaryRoutes = require("./routes/empWorkHour");
const empLeaveQueryDashboard = require("./routes/empLeaveQueryDashboardRoutes");
const regFaceRoutes = require("./routes/reg_faceRoutes");
const faceRoutes = require("./routes/faceRoutes");
const faceDataRoutes = require("./routes/faceDataRoutes");
const checkFaceRoute = require("./routes/checkFaceRoute");
const admindashboardReimbursementRoutes = require("./routes/adminDashReimbursementRoutes");
const salaryRoutes = require("./routes/salaryRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const bankDetailsRoutes = require("./routes/payrollRoutes");
const salarylastmonthtotal = require("./routes/adminPayrollRoutes");
const reimbursementRoutes = require("./routes/reimbursementRoute");
const adminSalaryStatementRoutes = require("./routes/adminSalaryStatementRoute");
const assetsRoutes = require("./routes/assetsRoutes");
const adminAttendanceRoutes = require("./routes/adminAttendancetrackerRoute");
const face_admin_page = require("./routes/face_adminpageRoutes");
const employeeloginRoutes = require("./routes/employeeloginRoutes");
const employeeBirthdayRoutes = require("./routes/employeeBirthday");
const meetingRoutes = require("./routes/meetingRoutes");
const notificationsRouter = require("./routes/notifications");
const vendorRoutes = require("./routes/vendorRoutes");
const oldEmployeeRoutes = require("./routes/oldEmployeeDetailsRoute");
const empExcelRoutes = require("./routes/emp_excelsheetRoutes");
const letterRoutes = require("./routes/letterRoutes");
const letterheadRoutes = require("./routes/letterheadRoute");
const letterheadTemplateRoutes = require("./routes/letterheadTemplateRoutes");
const compensationRoutes = require("./routes/compensationRoutes");
const assignCompensationRoutes = require("./routes/assignCompensationRoute");
const overtimeRoutes = require("./routes/assignCompensationRoute");
const overtimeSummaryRoutes = require("./routes/overtimeSummaryRoutes");
const employeeProjectsRoute = require("./routes/employeeProjectsRoute");
const lossofPayCalculationRoutes = require("./routes/lossofPayCalculationRoutes");
const chatRoutes = require("./routes/chatRoutes");
const orgRoutes = require("./routes/orgRoutes");
const sidebarRoutes = require("./routes/sidebarRoutes");
const policyNotificationService = require("./services/policyNotificationService"); // used by cron
const { scheduleJob } = require("./jobs/profileMissingNotifier"); // optional job
const organizationTableRoutes = require("./routes/organizationTableRoutes");
const app = express();
const server = http.createServer(app);

// ---------- Basic middleware ----------
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Static assets
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use(
  "/letterheadfiles",
  express.static(path.join(__dirname, "letterheadfiles"))
);

// ---------- CORS ----------
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://localhost",
  "capacitor://localhost",
  "https://sukalpatechsolutions.com",
  "https://sts-test.site",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://122.166.77.12:3000",
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) {
    // allow non-browser tools like Postman
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key, x-employee-id, x-org-id, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range"
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// ---------- Prepare to start: create session store (Redis) then register routes ----------
(async () => {
  try {
    const store = await createSessionStore(); // will throw if cannot connect
    app.set("trust proxy", 1);

    app.use(
      session({
        name: "sid",
        store,
        secret: process.env.SESSION_SECRET || "keyboard-cat",
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          maxAge: 24 * 60 * 60 * 1000,
          path: "/",
        },
      })
    );

    // API key and idle timeout middlewares
    app.use(apiKeyMiddleware);
    app.use(idleTimeout);

    // other body parsing (safe duplicates)
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    // ---------- Push notifications & Cron jobs (from previous file) ----------
    // VAPID config
    webpush.setVapidDetails(
      "mailto:your-email@example.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const subscriptions = [];

    app.get("/vapidPublicKey", (req, res) => {
      if (!process.env.VAPID_PUBLIC_KEY) {
        return res
          .status(500)
          .json({ error: "VAPID_PUBLIC_KEY not set in env" });
      }
      res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
    });

    app.post("/subscribe", (req, res) => {
      const sub = req.body;
      if (!sub || !sub.endpoint)
        return res.status(400).send("Invalid subscription");
      if (!subscriptions.find((s) => s.endpoint === sub.endpoint)) {
        subscriptions.push(sub);
      }
      res.status(201).json({ success: true });
    });

    app.post("/check-subscription", (req, res) => {
      const { endpoint } = req.body;
      const exists = subscriptions.some((s) => s.endpoint === endpoint);
      res.json({ exists });
    });

    // Cron jobs — policy notifications (two schedules)
    cron.schedule(
      "30 17 * * *",
      async () => {
        try {
          await policyNotificationService.sendPolicyEndNotifications(10);
          await policyNotificationService.sendPolicyEndNotifications(5);
          console.log(
            "[cron] policy end alerts executed at 17:30 Asia/Kolkata"
          );
        } catch (err) {
          console.error("[cron] policy alert error:", err);
        }
      },
      { timezone: "Asia/Kolkata" }
    );

    cron.schedule(
      "00 12 * * *",
      async () => {
        try {
          await policyNotificationService.sendPolicyEndNotifications(10);
          await policyNotificationService.sendPolicyEndNotifications(5);
          console.log(
            "[cron] policy end alerts executed at 12:00 Asia/Kolkata"
          );
        } catch (err) {
          console.error("[cron] policy alert error:", err);
        }
      },
      { timezone: "Asia/Kolkata" }
    );

    // daily push notification sample (keeps same behavior as previous code)
    cron.schedule("0 20 * * *", async () => {
      const payload = JSON.stringify({
        title: "Friendly Reminder",
        body: "🕒 After today’s work, please log off 💻from STS Web.",
        icon: "/logo192.png",
        url: "/",
      });
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(sub, payload);
        } catch (err) {
          console.error("Push failed for", sub.endpoint, ":", err);
        }
      }
    });

    // Profile Missing Notifier scheduling (optional)
    (async function initProfileNotifier() {
      if (process.env.ENABLE_PROFILE_NOTIFIER !== "true") {
        console.log("[startup] profileMissingNotifier disabled");
        return;
      }
      const db = require("./config"); // ensure path exists
      const maxAttempts = 6;
      let attempt = 0;
      while (attempt < maxAttempts) {
        try {
          attempt++;
          await db.execute("SELECT 1");
          scheduleJob();
          console.log("[startup] profileMissingNotifier scheduled (DB ready)");
          return;
        } catch (err) {
          console.warn(
            `[startup] profileMissingNotifier DB ping failed (attempt ${attempt}/${maxAttempts})`,
            err && err.message ? err.message : err
          );
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
      console.error(
        "[startup] profileMissingNotifier: DB did not become ready — job not scheduled"
      );
    })();

    // ---------- Mount routes (same as earlier) ----------
    app.use("/", holidayRoutes);
    app.use("/", loginRoutes);
    app.use("/", meRoute);
    app.use("/", leaveRoutes);
    app.use("/", projects);
    app.use("/", invoices);
    app.use("/", employeeRoutes);
    app.use("/", meetingRoutes);
    app.use("/api", notificationsRouter);
    app.use("/api/orgs", require("./routes/templateRoutes"));
    app.use("/", employeeQueries);
    app.use("/", resetPasswordRoutes);
    app.use("/", forgotPasswordRoutes);
    app.use("/", addDepartmentRoutes);
    app.use("/", reimbursementRoutes);
    app.use("/", chatRoutes);
    app.use("/attendance", attendanceRoutes);
    app.use("/", dashboardReimbursementRoutes);
    app.use("/", workDayRoutes);
    app.use("/", empSessionRoutes);
    app.use("/api", workHourSummaryRoutes);
    app.use("/", empLeaveQueryDashboard);
    app.use("/salary", salaryRoutes);
    app.use("/api", payrollRoutes);
    app.use("/api", bankDetailsRoutes);
    app.use("/api", adminSalaryStatementRoutes);
    app.use("/", salarylastmonthtotal);
    app.use("/", admindashboardReimbursementRoutes);
    app.use("/api", regFaceRoutes);
    app.use("/api/face", faceRoutes);
    app.use("/", faceDataRoutes);
    app.use(checkFaceRoute);
    app.use("/api", assetsRoutes);
    app.use("/api/attendance", adminAttendanceRoutes);
    app.use("/admin/attendance", adminAttendanceRoutes);
    app.use("/admin-attendance", adminAttendanceRoutes);
    app.use("/face-punch", face_admin_page);
    app.use("/api/employeelogin", employeeloginRoutes);
    app.use("/api", empExcelRoutes);
    app.use("/api/employee", employeeBirthdayRoutes);
    app.use("/api", sidebarRoutes);
    app.use("/", orgRoutes);
    app.use("/api", payrollRoutes);
    app.use("/api", organizationTableRoutes);
    app.use("/", vendorRoutes);
    app.use("/", oldEmployeeRoutes);
    app.use("/", oldEmployeeRoutes);
    app.use("/api", letterRoutes);
    app.use("/api", letterheadRoutes);
    app.use("/api", letterheadTemplateRoutes);
    app.use("/api/templates", letterheadTemplateRoutes);
    app.use("/api/compensations", compensationRoutes);
    app.use("/api/compensation", assignCompensationRoutes);
    app.use("/api/overtime", overtimeRoutes);
    app.use("/api/overtime-summary", overtimeSummaryRoutes);
    app.use("/api", employeeProjectsRoute);
    app.use("/api/lop", lossofPayCalculationRoutes);
    app.use("/api/leave-policies", leavePolicy);
    app.get("/", (req, res) => res.send("Employee Face Recognition API"));

    const io = new Server(server, {
      cors: { origin: process.env.FRONTEND_URL || "*", credentials: true },
      path: "/api/socket.io",
    });
    app.set("io", io);

    io.use((socket, next) => {
      const apiKey =
        socket.handshake.auth?.apiKey ||
        socket.handshake.query?.apiKey ||
        socket.handshake.headers?.["x-api-key"];

      if (!apiKey || apiKey !== process.env.X_API_KEY) {
        return next(new Error("Forbidden: invalid api key"));
      }

      const queryUser = socket.handshake.query?.userId || null;
      const authUser = socket.handshake.auth?.userId || null;
      const headerUser = socket.handshake.headers?.["x-employee-id"] || null;
      const userId = queryUser || authUser || headerUser || null;

      socket.userId = userId ? String(userId) : null;

      if (!userId) {
        console.warn(
          "[socket] no userId in handshake; allowing connection but functionality may be limited"
        );
        socket.userId = null;
        return next();
      }

      socket.userId = String(userId);
      return next();
    });

    io.on("connection", (socket) => {
      console.log(
        `[socket] new connection ${socket.id} userId=${socket.userId}`,
        {
          query: socket.handshake.query,
          auth: socket.handshake.auth,
        }
      );

      if (socket.userId) {
        chatService
          .getUserRooms(socket.userId)
          .then((rooms) => {
            console.log(
              `[socket:${socket.id}] joining ${rooms.length} rooms for user ${socket.userId}`
            );
            rooms.forEach((r) => socket.join(String(r.id)));
          })
          .catch((err) => console.error("[socket] getUserRooms error:", err));

        EmployeeQueries.getThreadsByEmployee(socket.userId)
          .then((threads) => {
            console.log(
              `[socket:${socket.id}] joining ${threads.length} query threads for user ${socket.userId}`
            );
            threads.forEach((t) => socket.join(`query_${String(t.id)}`));
          })
          .catch((err) =>
            console.error("[socket] getThreadsByEmployee error:", err)
          );
      } else {
        console.log(
          `[socket:${socket.id}] connected without userId — will require payload senderId for message saves.`
        );
      }

      socket.on("joinThread", (threadId) => {
        try {
          console.log(`[socket:${socket.id}] joinThread ${threadId}`);
          socket.join(`query_${String(threadId)}`);
        } catch (e) {
          console.error(`[socket:${socket.id}] joinThread error`, e);
        }
      });

      socket.on("sendQueryMessage", async (payload, callback) => {
        console.log(`[socket:${socket.id}] sendQueryMessage payload:`, payload);
        try {
          if (!payload || !payload.thread_id) {
            const errMsg =
              "Invalid payload for sendQueryMessage (missing thread_id)";
            if (typeof callback === "function")
              callback({ success: false, error: errMsg });
            return;
          }

          const senderIdToUse = payload.sender_id ?? socket.userId ?? null;
          if (!senderIdToUse) {
            const errMsg = "Missing sender id for sendQueryMessage";
            if (typeof callback === "function")
              callback({ success: false, error: errMsg });
            socket.emit("error", errMsg);
            return;
          }

          const messageId = await EmployeeQueries.addMessage(
            payload.thread_id,
            senderIdToUse,
            payload.sender_role,
            payload.message,
            payload.recipient_id,
            null,
            payload.attachmentBase64
          );

          console.log(
            `[socket:${socket.id}] sendQueryMessage inserted id=${messageId}`
          );

          const newMsg = {
            id: messageId,
            thread_id: String(payload.thread_id),
            sender_id: senderIdToUse,
            sender_role: payload.sender_role,
            recipient_id: payload.recipient_id,
            sender_name: payload.sender_name || null,
            message: payload.message,
            created_at: new Date().toISOString(),
            attachment_url: payload.attachmentBase64
              ? `/attachments/${messageId}`
              : null,
          };

          io.to(`query_${String(payload.thread_id)}`).emit(
            "newMessage",
            newMsg
          );
          if (typeof callback === "function")
            callback({ success: true, message: newMsg });
          socket.emit("messageAck", newMsg);
        } catch (err) {
          console.error(
            "[socket] sendQueryMessage error:",
            err && err.message ? err.message : err
          );
          if (typeof callback === "function")
            callback({ success: false, error: err.message || "Unknown error" });
          socket.emit("error", err.message || "sendQueryMessage failed");
        }
      });

      socket.on("send_message", async (payload = {}, ack) => {
        console.log(
          `[socket:${socket.id}] send_message payload:`,
          payload && {
            ...payload,
            location: payload?.location ? "present" : null,
          }
        );

        try {
          const { roomId, content, type, fileUrl, location } = payload;
          const payloadSenderId = payload.senderId ?? payload.sender_id ?? null;

          if (!roomId) {
            const errMsg = "Missing roomId in send_message";
            if (typeof ack === "function")
              ack({ success: false, error: errMsg });
            socket.emit("error", errMsg);
            return;
          }

          const effectiveSenderId = socket.userId ?? payloadSenderId ?? null;
          if (!effectiveSenderId) {
            const errMsg =
              "Missing sender id in send_message (socket not authed and payload has no senderId)";
            console.warn(`[socket:${socket.id}] ${errMsg}`);
            if (typeof ack === "function")
              ack({ success: false, error: errMsg });
            socket.emit("error", errMsg);
            return;
          }

          const lat = location?.lat ?? null;
          const lng = location?.lng ?? null;
          const address = location?.address ?? null;

          const saved = await chatService.saveMessage(
            roomId,
            effectiveSenderId,
            content,
            type,
            fileUrl,
            lat,
            lng,
            address
          );

          console.log(
            `[socket:${socket.id}] saved chat message id=${saved.id} room=${roomId} sender=${effectiveSenderId}`
          );

          const emitted = {
            roomId: saved.roomId,
            id: saved.id,
            senderId: saved.senderId,
            senderName: saved.senderName ?? saved.sender_name ?? null,
            photoUrl: saved.photoUrl ?? saved.photo_url ?? null,
            content: saved.content,
            type: saved.type,
            fileUrl: saved.fileUrl ?? saved.file_url ?? null,
            sentAt: saved.sentAt,
            readAt: saved.readAt ?? null,
            location: lat != null && lng != null ? { lat, lng, address } : null,
          };

          io.to(String(roomId)).emit("new_message", emitted);

          if (typeof ack === "function")
            ack({ success: true, message: emitted });
        } catch (err) {
          console.error(
            "[socket] send_message error:",
            err && err.message ? err.message : err
          );
          if (typeof ack === "function")
            ack({
              success: false,
              error: err.message || "send_message failed",
            });
          socket.emit("error", err.message || "send_message failed");
        }
      });

      socket.on(
        "create_room",
        async ({ name, isGroup, members } = {}, callback) => {
          try {
            const roomId = await chatService.createRoom(
              name,
              isGroup,
              socket.userId,
              members
            );

            socket.join(String(roomId));

            const [room] = await chatService.getUserRooms(socket.userId);

            socket.emit("room_created", room);

            if (typeof callback === "function") {
              callback({ success: true, room });
            }
          } catch (err) {
            console.error(
              "[socket] create_room error:",
              err && err.message ? err.message : err
            );
            if (typeof callback === "function") {
              callback({
                success: false,
                error: err.message || "create_room failed",
              });
            }
          }
        }
      );

      socket.on("disconnect", (reason) => {
        console.log(
          `[socket] ${socket.id} disconnected (${reason}) userId=${socket.userId}`
        );
      });
    });

    const PORT = process.env.PORT;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error(
      "Failed to initialize session store or start server. Aborting.",
      err
    );
    process.exit(1);
  }
})();
