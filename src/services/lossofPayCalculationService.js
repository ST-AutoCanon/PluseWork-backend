const db = require("../config");
const { GET_CURRENT_MONTH_LOP, GET_DEFERRED_LOP, GET_NEXT_MONTH_LOP } = require("../constants/lossofPayCalculationQueries");

const getCurrentMonthLOP = async () => {
  try {
    const [result] = await db.query(GET_CURRENT_MONTH_LOP);
    return result;
  } catch (error) {
    throw error;
  }
};

const getDeferredLOP = async () => {
  try {
    const [result] = await db.query(GET_DEFERRED_LOP);
    return result;
  } catch (error) {
    throw error;
  }
};

const getNextMonthLOP = async () => {
  try {
    const [result] = await db.query(GET_NEXT_MONTH_LOP);
    return result;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getCurrentMonthLOP,
  getDeferredLOP,
  getNextMonthLOP,
};