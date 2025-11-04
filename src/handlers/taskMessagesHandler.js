const service = require("../services/taskMessagesService");


const sendMessage = async (req, res) => {
  try {
    const { taskId, type, text, sender } = req.body; // sender = "employee" or "supervisor" (or employeeId)

    const messageObj = {
      type,
      text,
      time: new Date().toISOString(),
      sender,
    };

    const messages = await service.getTaskMessages(taskId);

    if (!messages) {
      await service.createTaskMessage(taskId, messageObj);
    } else {
      await service.appendTaskMessage(taskId, messageObj);
    }

    res.status(200).json({ success: true, message: "Message saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
};

const getMessages = async (req, res) => {
  try {
    const { taskId } = req.params;
    const messages = await service.getTaskMessages(taskId);

    if (!messages) {
      return res.status(404).json({ success: false, message: "No messages found" });
    }

    const parsed = typeof messages === "string" ? JSON.parse(messages) : messages;

    const progressMessages = parsed.messages.filter(m => m.type === "Progress");
    const clarificationMessages = parsed.messages.filter(m => m.type === "Clarification");

    res.status(200).json({
      success: true,
      allMessages: parsed.messages,
      progressMessages,
      clarificationMessages,
    });
  } catch (err) {
    console.error("Error in getMessages:", err);
    res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
};


module.exports = { sendMessage, getMessages};
