

// // const OFFICE_LOCATION_QUERIES = {
// //   CREATE_OFFICE_LOCATION: `
// //     INSERT INTO office_locations
// //     (office_name, address, latitude, longitude, radius, status)
// //     VALUES (?, ?, ?, ?, ?, ?)
// //   `,

// //   GET_ALL_OFFICE_LOCATIONS: `
// //     SELECT
// //       id,
// //       office_name,
// //       address,
// //       latitude,
// //       longitude,
// //       radius,
// //       status,
// //       created_at
// //     FROM office_locations
// //     ORDER BY id DESC
// //   `,
// // };

// // module.exports = OFFICE_LOCATION_QUERIES;

// const OFFICE_LOCATION_QUERIES = {
//   CREATE_OFFICE_LOCATION: `
//     INSERT INTO office_locations
//     (office_name, address, latitude, longitude, radius, status)
//     VALUES (?, ?, ?, ?, ?, ?)
//   `,

//   GET_ALL_OFFICE_LOCATIONS: `
//     SELECT
//       id,
//       office_name,
//       address,
//       latitude,
//       longitude,
//       radius,
//       status,
//       created_at
//     FROM office_locations
//     ORDER BY id DESC
//   `,

//   UPDATE_OFFICE_LOCATION: `
//     UPDATE office_locations
//     SET
//       office_name = ?,
//       address = ?,
//       latitude = ?,
//       longitude = ?,
//       radius = ?,
//       status = ?
//     WHERE id = ?
//   `,

//   DELETE_OFFICE_LOCATION: `
//     DELETE FROM office_locations
//     WHERE id = ?
//   `,

//   GET_OFFICE_LOCATION_BY_ID: `
//     SELECT
//       id,
//       office_name,
//       address,
//       latitude,
//       longitude,
//       radius,
//       status,
//       created_at
//     FROM office_locations
//     WHERE id = ?
//     LIMIT 1
//   `,
// };

// module.exports = OFFICE_LOCATION_QUERIES;


const OFFICE_LOCATION_QUERIES = {
  CREATE_OFFICE_LOCATION: `
    INSERT INTO office_locations
    (office_name, address, latitude, longitude, radius, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `,

  GET_ALL_OFFICE_LOCATIONS: `
  SELECT
    ol.id,
    ol.office_name,
    ol.address,
    ol.latitude,
    ol.longitude,
    ol.radius,
    ol.status,
    ol.created_at,
    COUNT(ole.employee_id) AS employees
  FROM office_locations ol
  LEFT JOIN office_location_employees ole
    ON ol.id = ole.office_location_id
  GROUP BY
    ol.id,
    ol.office_name,
    ol.address,
    ol.latitude,
    ol.longitude,
    ol.radius,
    ol.status,
    ol.created_at
  ORDER BY ol.id DESC
`,

  UPDATE_OFFICE_LOCATION: `
    UPDATE office_locations
    SET
      office_name = ?,
      address = ?,
      latitude = ?,
      longitude = ?,
      radius = ?,
      status = ?
    WHERE id = ?
  `,

  DELETE_OFFICE_LOCATION: `
    DELETE FROM office_locations
    WHERE id = ?
  `,

  GET_OFFICE_LOCATION_BY_ID: `
    SELECT
      id,
      office_name,
      address,
      latitude,
      longitude,
      radius,
      status,
      created_at
    FROM office_locations
    WHERE id = ?
    LIMIT 1
  `,
};

module.exports = OFFICE_LOCATION_QUERIES;