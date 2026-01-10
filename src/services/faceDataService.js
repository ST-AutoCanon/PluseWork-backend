const { getTenantPool } = require("../db/tenantPoolManager");
const {
  SAVE_FACE_DATA,
  GET_FACE_DATA_BY_EMPLOYEE,
} = require("../constants/faceDataQueries");

const saveFaceDataService = async (employee_id, descriptors) => {
  const tenantPool = await getTenantPool('tenant_1');
  await tenantPool.query(SAVE_FACE_DATA, [employee_id, JSON.stringify(descriptors)]);
};

const getFaceDataByEmployeeService = async (employee_id) => {
  const tenantPool = await getTenantPool('tenant_1');
  const [result] = await tenantPool.query(GET_FACE_DATA_BY_EMPLOYEE, [employee_id]);

  return result.length > 0 ? result[0] : null;
};

module.exports = {
  saveFaceDataService,
  getFaceDataByEmployeeService,
};
