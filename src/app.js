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
const configRoutes = require("./routes/configRoutes");
const visibilityRoutes = require("./routes/visibilityRoutes");
const supervisorEmployeesRoutes = require("./routes/supervisorEmployeesRoutes");
const supervisorRoutes = require("./routes/supervisorRoutes");
const taskEmployeesRoutes = require("./routes/taskEmployeesRoutes");
const taskRoutes = require("./routes/taskroutes");
const taskMessagesRoutes = require("./routes/taskMessagesRoutes");
const employeeTaskRoutes = require("./routes/employeeTaskUpdateRoutes");
const weeklyTaskSupervisorRoutes = require("./routes/weekly_task_supervisor");
const weekTaskRoutes = require("./routes/weekTaskRoutes");
const reportsRoutes = require("./routes/reportRoutes");
const compensationRoutes = require("./routes/compensationRoutes");
const assignCompensationRoutes = require("./routes/assignCompensationRoute");
const employeeRoutesforsalarybreakup = require("./routes/compensationRoutes");
const overtimeRoutes = require("./routes/assignCompensationRoute");
const overtimeSummaryRoutes = require("./routes/overtimeSummaryRoutes");
const lossofPayCalculationRoutes = require("./routes/lossofPayCalculationRoutes");
const incentivesRoutes = require("./routes/incentivesRoutes");
const salaryRoutes2 = require("./routes/salaryCalculationPeriodRoutes");
const salaryDetailsRoutes = require("./routes/salaryDetailsRoutes");
const employeeBankReportRoutes = require("./routes/employeebankreportroute");
const salaryStatementRouter = require("./routes/salaryRoutes");
const salaryDetailsRouter = require("./routes/salaryDetailsRouter");
const salaryPeriodRoutes = require("./routes/salaryCalculationPeriodRoutes");
const orgWorkHoursRoutes = require("./routes/orgWorkHours.routes");
const customerRoutes = require("./routes/customerRoutes");
const { createSessionStore, _initPromise } = require("./lib/sessionStore");
const EmployeeQueries = require("./services/employeeQueries");
const chatService = require("./services/chatService");
const apiKeyMiddleware = require("./middleware/apiKeyMiddleware");
const idleTimeout = require("./middleware/idleTimeout");
const contact = require("./routes/contact");
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
const leaveRegularisationRoutes = require("./routes/leaveRegularisationRoutes");
const leaveregularisationRoutes = require("./routes/leaveRegularisationRoutes");
const recruitmentRoutes = require("./routes/recruitment");
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
const employeeProjectsRoute = require("./routes/employeeProjectsRoute");
const chatRoutes = require("./routes/chatRoutes");
const orgRoutes = require("./routes/orgRoutes");
const sidebarRoutes = require("./routes/sidebarRoutes");
const policyNotificationService = require("./services/policyNotificationService");
const { scheduleJob } = require("./jobs/profileMissingNotifier");
const organizationTableRoutes = require("./routes/organizationTableRoutes");
const subordinateRoutes = require("./routes/subordinateRoutes");
const salaryCalculationPeriodRoutes = require("./routes/salaryCalculationPeriodRoutes");
const salaryPreferenceRoutes = require("./routes/salaryPreferenceRoutes");
const payrollTemplateRoutes = require("./routes/payrollTemplateRoutes");
const app = express();
const server = http.createServer(app);
const exitRoutes = require("./routes/exitRoutes");
const teamRouter = require("./routes/team");
const clearanceRoutes = require("./routes/clearance");
const exitFilesRoutes = require("./routes/exitFilesRoutes");
const downloadRoutes = require("./routes/downloadRoutes");
const formsRoutes = require("./routes/forms.routes");
const officeLocationRoutes = require("./routes/officeLocationRoutes");
const officeEmployeeRoutes = require("./routes/officeEmployeeRoutes");

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://localhost",
  "capacitor://localhost",
  "https://sukalpatechsolutions.com",
  "https://sts-test.site",
  "https://sukalpatest.sts-test.site",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://192.168.1.2:3001",
  "http://122.166.77.12:3001",
  "https://test.sts-test.online",
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key, x-employee-id, x-org-id, X-Requested-With,x-role, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range",
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

(async () => {
  try {
    const store = await createSessionStore();
    app.set("trust proxy", 1);

    const sessionMiddleware = session({
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
    });

    app.use(sessionMiddleware);

    app.use(
      "/uploads",
      express.static(path.join(__dirname, "../../AssetUploads")),
    );
    app.use("/assets", express.static(path.join(__dirname, "assets")));
    app.use(
      "/letterheadfiles",
      express.static(path.join(__dirname, "letterheadfiles")),
    );
    app.use("/api/exit/download", downloadRoutes);
    app.use(apiKeyMiddleware);
    app.use(
      "/exitflowuploads",
      express.static(path.resolve(__dirname, "../exitflowuploads")),
    );

    app.use("/", contact);
    app.use(idleTimeout);

    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    webpush.setVapidDetails(
      "mailto:your-email@example.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
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

    cron.schedule(
      "30 17 * * *",
      async () => {
        try {
          await policyNotificationService.sendPolicyEndNotifications(10);
          await policyNotificationService.sendPolicyEndNotifications(5);
        } catch (err) {
          console.error("[cron] policy alert error:", err);
        }
      },
      { timezone: "Asia/Kolkata" },
    );

    cron.schedule(
      "00 12 * * *",
      async () => {
        try {
          await policyNotificationService.sendPolicyEndNotifications(10);
          await policyNotificationService.sendPolicyEndNotifications(5);
        } catch (err) {
          console.error("[cron] policy alert error:", err);
        }
      },
      { timezone: "Asia/Kolkata" },
    );

    cron.schedule(
      "*/15 * * * *",
      async () => {
        try {
          const closedCount =
            await EmployeeQueries.autoCloseExpiredThreadsAllOrgs();
          if (closedCount > 0) {
            console.log(
              `[cron] auto-closed ${closedCount} expired query threads`,
            );
          }
        } catch (err) {
          console.error("[cron] employee query auto-close error:", err);
        }
      },
      { timezone: "Asia/Kolkata" },
    );

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

    (async function initProfileNotifier() {
      if (process.env.ENABLE_PROFILE_NOTIFIER !== "true") {
        return;
      }
      const db = require("./config");
      const maxAttempts = 6;
      let attempt = 0;
      while (attempt < maxAttempts) {
        try {
          attempt++;
          await db.execute("SELECT 1");
          scheduleJob();
          return;
        } catch (err) {
          console.warn(
            `[startup] profileMissingNotifier DB ping failed (attempt ${attempt}/${maxAttempts})`,
            err && err.message ? err.message : err,
          );
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
      console.error(
        "[startup] profileMissingNotifier: DB did not become ready — job not scheduled",
      );
    })();

    app.use("/api", organizationTableRoutes);
    app.use("/api", payrollTemplateRoutes);
    app.use("/api/salary-prefe", salaryPreferenceRoutes);
    app.use("/api", sidebarRoutes);
    app.use("/api", configRoutes);
    app.use("/api/report", reportsRoutes);
    app.use("/api/org", visibilityRoutes);
    app.use("/api/weekly_task_supervisor", weeklyTaskSupervisorRoutes);
    app.use("/api/week_tasks", weekTaskRoutes);
    app.use("/api/tasks", taskRoutes);
    app.use("/api/messages", taskMessagesRoutes);
    app.use("/api/supervisor", supervisorRoutes);
    app.use("/api/supervisor", supervisorEmployeesRoutes);
    app.use("/api/task-emp-emp", taskEmployeesRoutes);
    app.use("/api/employee-tasks", employeeTaskRoutes);
    app.use("/api/subordinate", subordinateRoutes);
    app.use("/face-punch", face_admin_page);
    require("./cron/autoPunchCron");
    app.use("/", holidayRoutes);
    app.use("/", loginRoutes);
    app.use("/", meRoute);
    app.use("/", leaveRoutes);
    app.use("/api/leave-policies", leavePolicy);
    app.use("/", leavePolicy);
    const LeavePolicyHandler = require("./handlers/leavePolicyHandler");
    app.get("/api/leave-policies", (req, res, next) => {
      console.log("[ROUTE WRAPPER] /api/leave-policies hit, headers:", {
        "x-org-id": req.headers["x-org-id"] || req.headers["x_org_id"],
        "x-employee-id":
          req.headers["x-employee-id"] || req.headers["x_employee_id"],
        path: req.path,
        query: req.query,
      });
      return LeavePolicyHandler.getAllPolicies(req, res).catch(next);
    });
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
    app.use("/api/attendance", attendanceRoutes);
    app.use("/api/attendance", adminAttendanceRoutes);
    app.use("/admin/attendance", adminAttendanceRoutes);
    app.use("/admin-attendance", adminAttendanceRoutes);
    app.use("/face-punch", face_admin_page);
    app.use("/api/employeelogin", employeeloginRoutes);
    app.use("/api", empExcelRoutes);
    app.use("/api/employee", employeeBirthdayRoutes);
    app.use("/api/exit", exitRoutes);
    app.use("/api/clearance", clearanceRoutes);
    app.use("/api/team", teamRouter);
    app.use("/", orgRoutes);
    app.use("/api", payrollRoutes);
    app.use("/api", formsRoutes);
    app.use("/api/leave-regularisation", leaveRegularisationRoutes);
    app.use("/", recruitmentRoutes);
    app.use("/", customerRoutes);
    app.use("/api/overtime", overtimeRoutes);
    app.use("/api/overtime-summary", overtimeSummaryRoutes);
    app.use("/api", salaryPeriodRoutes);

    app.use("/api/compensation", assignCompensationRoutes);
    app.use("/api", employeeRoutesforsalarybreakup);
    app.use("/api/salary-details", salaryDetailsRoutes);
    app.use("/api/compensation", employeeBankReportRoutes);
    app.use("/api/lop", lossofPayCalculationRoutes);
    app.use("/api/salaryCalculationperiods", salaryCalculationPeriodRoutes);
    app.use("api/compensation", salaryRoutes2);
    app.use("/api/org", orgWorkHoursRoutes);

    app.use("/api/compensation", assignCompensationRoutes);
    app.use("/api/overtime", overtimeRoutes);
    app.use("/api/overtime-summary", overtimeSummaryRoutes);
    app.use("/api", salaryPeriodRoutes);
    app.use("/api/compensations", compensationRoutes);
    app.use("/api", employeeProjectsRoute);
    app.use("/", vendorRoutes);
    app.use("/", oldEmployeeRoutes);
    app.use("/api", letterRoutes);
    app.use("/api", letterheadRoutes);
    app.use("/api", letterheadTemplateRoutes);
    app.use("/api/templates", letterheadTemplateRoutes);
    app.use("/api/compensation", assignCompensationRoutes);
    app.use("/api/overtime", overtimeRoutes);
    app.use("/api/overtime-summary", overtimeSummaryRoutes);
    app.use("/api", employeeProjectsRoute);
    app.use("/api/lop", lossofPayCalculationRoutes);
    app.use("/api/org", orgWorkHoursRoutes);
    app.use("/api/compensations", compensationRoutes);
app.use("/api/office-locations", officeLocationRoutes);
app.use("/api/office-location-employees", officeEmployeeRoutes);
    app.get("/", (req, res) => res.send("Employee Face Recognition API"));

    function resolveOrgIdFromSocket(socket) {
      try {
        const headersOrg =
          socket.handshake?.headers?.["x-org-id"] ||
          socket.handshake?.headers?.["x_org_id"] ||
          socket.handshake?.headers?.["x-orgid"] ||
          null;
        const authOrg =
          socket.handshake?.auth?.orgId || socket.handshake?.auth?.org_id;
        const queryOrg =
          socket.handshake?.query?.orgId || socket.handshake?.query?.org_id;
        const candidate = headersOrg || authOrg || queryOrg || null;
        return candidate ? String(candidate) : null;
      } catch (e) {
        return null;
      }
    }

    const io = new Server(server, {
      cors: {
        origin: ["https://test.sts-test.online"],
        credentials: true,
      },
      path: "/api/socket.io",
    });

    io.use((socket, next) => {
      try {
        const session = socket.request.session;
        if (session && session.user) {
          socket.userId =
            session.user.employeeId ||
            session.user.id ||
            (session.user && session.user.employeeId) ||
            null;
          socket.authenticatedBy = "session";
          return next();
        }

        const apiKey =
          socket.handshake.auth?.apiKey ||
          socket.handshake.query?.apiKey ||
          socket.handshake.headers?.["x-api-key"];

        if (apiKey && apiKey === process.env.X_API_KEY) {
          const queryUser = socket.handshake.query?.userId || null;
          const authUser = socket.handshake.auth?.userId || null;
          const headerUser =
            socket.handshake.headers?.["x-employee-id"] || null;
          const userId = queryUser || authUser || headerUser || null;
          socket.userId = userId ? String(userId) : null;
          socket.authenticatedBy = "api-key";
          return next();
        }

        const queryUser = socket.handshake.query?.userId || null;
        const authUser = socket.handshake.auth?.userId || null;
        const headerUser = socket.handshake.headers?.["x-employee-id"] || null;
        const userId = queryUser || authUser || headerUser || null;
        socket.userId = userId ? String(userId) : null;
        socket.authenticatedBy = socket.userId
          ? "handshake-userid"
          : "anonymous";

        return next();
      } catch (err) {
        console.error("[socket] auth error:", err);
        return next(err);
      }
    });

    io.on("connection", (socket) => {
      console.log(
        "[socket] raw handshake.auth:",
        JSON.stringify(socket.handshake?.auth || {}),
      );
      console.log(
        "[socket] raw handshake.query:",
        JSON.stringify(socket.handshake?.query || {}),
      );
      console.log(
        "[socket] raw handshake.headers:",
        JSON.stringify({
          x_org_id: socket.handshake?.headers?.["x_org_id"] || null,
          x_org_id_alt: socket.handshake?.headers?.["x-org-id"] || null,
          x_orgid: socket.handshake?.headers?.["x-orgid"] || null,
          x_employee_id: socket.handshake?.headers?.["x-employee-id"] || null,
        }),
      );

      let socketOrgId = resolveOrgIdFromSocket(socket);
      try {
        if (
          !socketOrgId &&
          socket.request &&
          socket.request.session &&
          socket.request.session.user
        ) {
          const sessOrg =
            socket.request.session.user.orgId ||
            socket.request.session.user.org_id ||
            socket.request.session.user.organization_id ||
            null;
          if (sessOrg) socketOrgId = String(sessOrg);
        }
      } catch (e) {}

      console.log(
        `[socket] connected ${socket.id} userId=${socket.userId} via=${socket.authenticatedBy} orgId=${socketOrgId}`,
      );

      if (socket.userId && socketOrgId) {
        (async () => {
          try {
            const rooms = await chatService.getUserRooms(
              socketOrgId,
              socket.userId,
            );
            (rooms || []).forEach((r) => {
              try {
                socket.join(String(r.id));
              } catch (e) {}
            });
          } catch (err) {
            console.error("[socket] getUserRooms error:", err);
          }
        })();
      } else if (socket.userId && !socketOrgId) {
        console.warn(
          `[socket:${socket.id}] orgId not provided in handshake — skipping tenant chat room joins for user ${socket.userId}`,
        );
      }

      if (socket.userId) {
        EmployeeQueries.getThreadsByEmployee(socket.userId)
          .then((threads) => {
            threads.forEach((t) => socket.join(`query_${String(t.id)}`));
          })
          .catch((err) =>
            console.error("[socket] getThreadsByEmployee error:", err),
          );
      }

      socket.on("joinThread", (threadId) => {
        try {
          socket.join(`query_${String(threadId)}`);
        } catch (e) {
          console.error(`[socket:${socket.id}] joinThread error`, e);
        }
      });

      socket.on("sendQueryMessage", async (payload, callback) => {
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
            socketOrgId,
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
            newMsg,
          );
          if (typeof callback === "function")
            callback({ success: true, message: newMsg });
          socket.emit("messageAck", newMsg);
        } catch (err) {
          console.error(
            "[socket] sendQueryMessage error:",
            err && err.message ? err.message : err,
          );
          if (typeof callback === "function")
            callback({ success: false, error: err.message || "Unknown error" });
          socket.emit("error", err.message || "sendQueryMessage failed");
        }
      });

      socket.on("send_message", async (payload = {}, ack) => {
        try {
          const orgId = socketOrgId || resolveOrgIdFromSocket(socket);
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

          if (!orgId) {
            const errMsg = "Missing orgId for tenant chat operation";
            console.warn(`[socket:${socket.id}] ${errMsg}`);
            if (typeof ack === "function")
              ack({ success: false, error: errMsg });
            socket.emit("error", errMsg);
            return;
          }

          const saved = await chatService.saveMessage(
            orgId,
            roomId,
            effectiveSenderId,
            content,
            type,
            fileUrl,
            lat,
            lng,
            address,
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
            err && err.message ? err.message : err,
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
            const orgId = socketOrgId || resolveOrgIdFromSocket(socket);
            if (!orgId) {
              const errMsg = "Missing orgId for create_room";
              if (typeof callback === "function")
                callback({ success: false, error: errMsg });
              return;
            }

            const roomId = await chatService.createRoom(
              orgId,
              name,
              isGroup,
              socket.userId,
              members,
            );
            socket.join(String(roomId));

            const rooms = await chatService.getUserRooms(orgId, socket.userId);
            const room =
              (rooms || []).find((r) => String(r.id) === String(roomId)) ||
              null;

            socket.emit("room_created", room);
            if (typeof callback === "function")
              callback({ success: true, room });
          } catch (err) {
            console.error("[socket] create_room error:", err);
            if (typeof callback === "function")
              callback({
                success: false,
                error: err.message || "create_room failed",
              });
          }
        },
      );

      socket.on("disconnect", (reason) => {
        console.log(
          `[socket] ${socket.id} disconnected (${reason}) userId=${socket.userId}`,
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
      err,
    );
    process.exit(1);
  }
})();
