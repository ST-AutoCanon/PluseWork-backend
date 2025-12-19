
const db = require("../config");
const { 
  INSERT_INCENTIVE, 
  GET_INCENTIVES_BY_EMPLOYEE, 
  GET_ALL_INCENTIVES 
} = require("../constants/incentivesQueries");

const insertIncentive = async (employeeId, incentiveType, ctcPercentage, salesAmount, applicableMonth) => {
  try {
    const [result] = await db.query(INSERT_INCENTIVE, [
      employeeId,
      incentiveType,
      ctcPercentage || null,
      salesAmount || null,
      applicableMonth
    ]);
    return result;
  } catch (error) {
    throw error;
  }
};

const getIncentivesByEmployee = async (employeeId) => {
  try {
    const [result] = await db.query(GET_INCENTIVES_BY_EMPLOYEE, [employeeId]);
    return result;
  } catch (error) {
    throw error;
  }
};

const getAllIncentives = async () => {
  try {
    const [result] = await db.query(GET_ALL_INCENTIVES);
    return result;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  insertIncentive,
  getIncentivesByEmployee,
  getAllIncentives,
};
