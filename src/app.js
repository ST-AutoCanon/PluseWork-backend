const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const path = require("path");
const session = require("express-session");
const { Server } = require("socket.io");
const sidebarRoutes = require("./routes/sidebarRoutes");
const organizationTableRoutes = require("./routes/organizationTableRoutes");
const EmployeeQueries = require("./services/employeeQueries");
const chatService = require("./services/chatService");
const apiKeyMiddleware = require("./middleware/apiKeyMiddleware");
const idleTimeout = require("./middleware/idleTimeout");

const holidayRoutes = require("./routes/holidayRoutes");
const loginRoutes = require("./routes/login");
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
const validateApiKey = require("./middleware/apiKeyMiddleware");
//attendancetracker
const adminAttendanceRoutes = require("./routes/adminAttendancetrackerRoute");
const adminAttendancetrackerRoute = require("./routes/adminAttendancetrackerRoute");
const face_admin_page = require("./routes/face_adminpageRoutes");
const employeeloginRoutes = require("./routes/employeeloginRoutes");
// require("./services/punchCronService");
const employeeBirthdayRoutes = require("./routes/employeeBirthday");

const meetingRoutes = require("./routes/meetingRoutes");
const notificationsRouter = require("./routes/notifications");

//vendors
const vendorRoutes = require("./routes/vendorRoutes"); // ✅ Import vendor routes

//generatepaysliproutes
const oldEmployeeRoutes = require("./routes/oldEmployeeDetailsRoute");
const oldEmployeeDetailsRoutes = require("./routes/oldEmployeeDetailsRoute");
const empExcelRoutes = require("./routes/emp_excelsheetRoutes");

//letters
const letterRoutes = require("./routes/letterRoutes");
const letterheadRoutes = require("./routes/letterheadRoute");
const letterheadTemplateRoutes = require("./routes/letterheadTemplateRoutes");

//compensation
const compensationRoutes = require("./routes/compensationRoutes");
const assignCompensationRoutes = require("./routes/assignCompensationRoute");
const employeeRoutesforsalarybreakup = require("./routes/compensationRoutes");
const overtimeRoutes = require("./routes/assignCompensationRoute");

const app = express();
const server = http.createServer(app);
//assets
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
const assetsRoutesforreturn = require("./routes/assetsRoutes");
const chatRoutes = require("./routes/chatRoutes");
const orgRoutes = require("./routes/orgRoutes");
const allowedOrigins = [
  "https://localhost",
  "capacitor://localhost",
  "https://sukalpatechsolutions.com",
  "http://localhost:3000",
  // Add your production domain
];

// Replace the current CORS middleware with this:
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Only allow specific origins for credentialed requests
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin"); // Important for caching
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key, x-employee-id, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers"
  );
  // res.setHeader('Access-Control-Allow-Headers',
  //   'Content-Type, Authorization, x-api-key, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
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

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/api/leave-policies", leavePolicy);

app.use(apiKeyMiddleware);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  })
);

app.use(idleTimeout);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/", holidayRoutes);
app.use("/", loginRoutes);
app.use("/", leaveRoutes);
app.use("/", projects);
app.use("/", invoices);
app.use("/", employeeRoutes);
app.use("/", meetingRoutes);
app.use("/api", notificationsRouter);
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
app.use("/", workDayRoutes);
app.use("/api", adminSalaryStatementRoutes);
app.use("/", salarylastmonthtotal);
app.use("/", admindashboardReimbursementRoutes);
app.use("/api", regFaceRoutes);
app.use("/api/face", faceRoutes);
app.use("/", faceDataRoutes);
app.use(checkFaceRoute);
app.get("/", (req, res) => {
  res.send("Employee Face Recognition API");
});
app.use("/assets", assetsRoutes);
app.use("/api/assets", assetsRoutes);
app.use("/api", assetsRoutesforreturn);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//attendancetracker
app.use("/api/attendance", adminAttendanceRoutes);
app.use("/admin/attendance", adminAttendanceRoutes);
app.use("/admin-attendance", adminAttendanceRoutes);
app.use("/face-punch", face_admin_page);
app.use("/api/employeelogin", employeeloginRoutes);
app.use("/api", empExcelRoutes);
app.use("/api/employee", employeeBirthdayRoutes);


//////////////

//organization routes
app.use("/api", sidebarRoutes);
app.use("/", orgRoutes);
app.use("/api", payrollRoutes);
app.use("/api", organizationTableRoutes);
// vendor Route definitions
app.use("/", vendorRoutes); // ✅ Prefix all vendor routes with /vendors

//generatepayslip at adminside
app.use("/", oldEmployeeRoutes);
app.use("/", oldEmployeeDetailsRoutes);

//letterheadroutes
// Routes
// app.use("/api/letters", letterRoutes); // Mount letter routes
app.use("/api", letterRoutes);
app.use(
  "/letterheadfiles",
  express.static(path.join(__dirname, "letterheadfiles"))
);
app.use("/api", letterheadRoutes);
app.use("/api", letterheadTemplateRoutes);
app.get("/", (req, res) => {
  res.send("LetterHead API is running");
});
app.use("/api/templates", letterheadTemplateRoutes);

//

//compensation
app.use("/api/compensations", compensationRoutes);
app.use("/api/compensation", assignCompensationRoutes);
app.use("/api", employeeRoutesforsalarybreakup);

app.use("/api/overtime", overtimeRoutes);

app.use("/api", payrollRoutes);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "*" },
});

app.set("io", io);

io.use((socket, next) => {
  const userId = socket.handshake.query.userId;
  if (!userId) return next(new Error("Auth error"));
  socket.userId = userId;
  next();
});

io.on("connection", (socket) => {
  chatService
    .getUserRooms(socket.userId)
    .then((rooms) => rooms.forEach((r) => socket.join(r.id.toString())))
    .catch(console.error);

  EmployeeQueries.getThreadsByEmployee(socket.userId) // implement this to return thread IDs
    .then((threads) => threads.forEach((t) => socket.join(`query_${t.id}`)))
    .catch(console.error);

  // Handler for when the client selects a thread
  socket.on("joinThread", (threadId) => {
    socket.join(`query_${threadId}`);
    console.log(`${socket.id} joined query thread ${threadId}`);
  });

  // Handler for sending a new query message over socket
  socket.on("sendQueryMessage", async (payload) => {
    // payload: { thread_id, sender_id, sender_role, recipient_id, sender_name, message, attachmentBase64 }
    // 1️⃣ Persist via your existing addMessage logic:
    const messageId = await EmployeeQueries.addMessage(
      payload.thread_id,
      payload.sender_id,
      payload.sender_role,
      payload.message,
      payload.recipient_id,
      null, // we'll handle attachment separately
      payload.attachmentBase64 // if your service accepts base64
    );

    // 2️⃣ Build the message object
    const newMsg = {
      id: messageId,
      ...payload,
      created_at: new Date().toISOString(),
      attachment_url: payload.attachmentBase64
        ? `/attachments/${messageId}`
        : null, // or however you expose it
    };

    // 3️⃣ Broadcast to everyone in this query thread room
    io.to(`query_${payload.thread_id}`).emit("newMessage", newMsg);

    // 4️⃣ (Optional) update your REST‑based preview list
    socket.emit("messageAck", newMsg);
  });

  socket.on(
    "send_message",
    async ({ roomId, content, type, fileUrl, location }) => {
      if (!location?.lat || !location?.lng) {
        socket.emit("error", "Location required");
        return;
      }

      const { lat, lng, address } = location;

      const saved = await chatService.saveMessage(
        roomId,
        socket.userId,
        content,
        type,
        fileUrl,
        lat,
        lng,
        address
      );

      io.to(roomId.toString()).emit("new_message", {
        roomId: saved.roomId,
        id: saved.id,
        senderId: saved.senderId,
        content: saved.content,
        type: saved.type,
        fileUrl: saved.fileUrl,
        sentAt: saved.sentAt,
        location: {
          lat: saved.latitude,
          lng: saved.longitude,
          address: saved.address,
        },
      });
    }
  );

  socket.on("create_room", async ({ name, isGroup, members }) => {
    const roomId = await chatService.createRoom(
      name,
      isGroup,
      socket.userId,
      members
    );
    socket.join(roomId.toString());
    const [room] = await chatService.getUserRooms(socket.userId);
    socket.emit("room_created", room);
  });
});

const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = { app, server };
