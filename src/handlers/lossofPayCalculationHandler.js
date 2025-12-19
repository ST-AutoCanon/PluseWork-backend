const { getCurrentMonthLOP, getDeferredLOP, getNextMonthLOP } = require("../services/lossofPayCalculationService");

const handleGetCurrentMonthLOP = async (req, res) => {
  try {
    const currentMonthLOP = await getCurrentMonthLOP();
    res.status(200).json({ data: currentMonthLOP });
  } catch (error) {
    console.error("Error fetching current month LOP:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const handleGetDeferredLOP = async (req, res) => {
  try {
    const deferredLOP = await getDeferredLOP();
    res.status(200).json({ data: deferredLOP });
  } catch (error) {
    console.error("Error fetching deferred LOP:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const handleGetNextMonthLOP = async (req, res) => {
  try {
    const nextMonthLOP = await getNextMonthLOP();
    res.status(200).json({ data: nextMonthLOP });
  } catch (error) {
    console.error("Error fetching next month LOP:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  handleGetCurrentMonthLOP,
  handleGetDeferredLOP,
  handleGetNextMonthLOP,
};