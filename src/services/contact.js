// services/contact.js
const db = require("../config");
const {
  INSERT_CONTACT_REQUEST,
  GET_CONTACT_REQUESTS,
} = require("../constants/contact");

const createContactRequestService = async (payload) => {
  const {
    name,
    email,
    organization = null,
    phone = null,
    message,
    preferredDate = null,
    ip = null,
    userAgent = null,
  } = payload;

  const params = [
    name,
    email,
    organization,
    phone,
    message,
    preferredDate,
    ip,
    userAgent,
  ];

  try {
    const [result] = await db.query(INSERT_CONTACT_REQUEST, params);
    console.info("[DB] INSERT_CONTACT_REQUEST result", {
      insertId: result.insertId,
      affectedRows: result.affectedRows,
    });
    return result;
  } catch (err) {
    console.error("createContactRequestService error:", err);
    throw err;
  }
};

const getContactRequestsService = async ({ orgId = null } = {}) => {
  try {
    const params = [];
    const [rows] = await db.query(GET_CONTACT_REQUESTS, params);
    return rows;
  } catch (err) {
    console.error("getContactRequestsService error:", err);
    throw err;
  }
};

module.exports = {
  createContactRequestService,
  getContactRequestsService,
};
