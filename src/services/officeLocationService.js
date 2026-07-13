

// // const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
// // const OFFICE_LOCATION_QUERIES = require("../constants/officeLocationQueries");

// // class OfficeLocationService {
// //   static async getAllOfficeLocations(orgId) {
// //     if (!orgId) throw new Error("orgId is required");

// //     try {
// //       const tenantPool = await getTenantPoolByOrgId(orgId);

// //       const [rows] = await tenantPool.query(
// //         OFFICE_LOCATION_QUERIES.GET_ALL_OFFICE_LOCATIONS
// //       );

// //       return rows || [];
// //     } catch (error) {
// //       console.error("[OfficeLocationService] getAllOfficeLocations error:", error);
// //       throw new Error(error.message || "Failed to fetch office locations");
// //     }
// //   }

// //   static async createOfficeLocation(orgId, data) {
// //     if (!orgId) throw new Error("orgId is required");

// //     const {
// //       officeName,
// //       address,
// //       latitude,
// //       longitude,
// //       radius = 100,
// //       status = "Active",
// //     } = data;

// //     if (
// //       !officeName?.trim() ||
// //       !address?.trim() ||
// //       latitude === undefined ||
// //       latitude === null ||
// //       latitude === "" ||
// //       longitude === undefined ||
// //       longitude === null ||
// //       longitude === ""
// //     ) {
// //       throw new Error(
// //         "Office name, address, latitude and longitude are required"
// //       );
// //     }

// //     const lat = Number(latitude);
// //     const lng = Number(longitude);
// //     const rad = Number(radius);

// //     if (Number.isNaN(lat) || Number.isNaN(lng)) {
// //       throw new Error("Latitude and longitude must be valid numbers");
// //     }

// //     if (Number.isNaN(rad) || rad <= 0) {
// //       throw new Error("Radius must be a valid positive number");
// //     }

// //     try {
// //       const tenantPool = await getTenantPoolByOrgId(orgId);

// //       const [result] = await tenantPool.query(
// //         OFFICE_LOCATION_QUERIES.CREATE_OFFICE_LOCATION,
// //         [officeName.trim(), address.trim(), lat, lng, rad, status]
// //       );

// //       return {
// //         id: result.insertId,
// //         office: officeName.trim(),
// //         address: address.trim(),
// //         latitude: lat,
// //         longitude: lng,
// //         radius: rad,
// //         status,
// //         employees: 0,
// //       };
// //     } catch (error) {
// //       console.error("[OfficeLocationService] createOfficeLocation error:", error);
// //       throw new Error(error.message || "Failed to create office location");
// //     }
// //   }
// // }

// // module.exports = OfficeLocationService;


// const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
// const OFFICE_LOCATION_QUERIES = require("../constants/officeLocationQueries");

// class OfficeLocationService {
//   static async getAllOfficeLocations(orgId) {
//     if (!orgId) throw new Error("orgId is required");

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [rows] = await tenantPool.query(
//         OFFICE_LOCATION_QUERIES.GET_ALL_OFFICE_LOCATIONS
//       );

//       return rows || [];
//     } catch (error) {
//       console.error("[OfficeLocationService] getAllOfficeLocations error:", error);
//       throw new Error(error.message || "Failed to fetch office locations");
//     }
//   }

//   static async createOfficeLocation(orgId, data) {
//     if (!orgId) throw new Error("orgId is required");

//     const {
//       officeName,
//       address,
//       latitude,
//       longitude,
//       radius = 100,
//       status = "Active",
//     } = data;

//     if (
//       !officeName?.trim() ||
//       !address?.trim() ||
//       latitude === undefined ||
//       latitude === null ||
//       latitude === "" ||
//       longitude === undefined ||
//       longitude === null ||
//       longitude === ""
//     ) {
//       throw new Error(
//         "Office name, address, latitude and longitude are required"
//       );
//     }

//     const lat = Number(latitude);
//     const lng = Number(longitude);
//     const rad = Number(radius);

//     if (Number.isNaN(lat) || Number.isNaN(lng)) {
//       throw new Error("Latitude and longitude must be valid numbers");
//     }

//     if (Number.isNaN(rad) || rad <= 0) {
//       throw new Error("Radius must be a valid positive number");
//     }

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [result] = await tenantPool.query(
//         OFFICE_LOCATION_QUERIES.CREATE_OFFICE_LOCATION,
//         [officeName.trim(), address.trim(), lat, lng, rad, status]
//       );

//       return {
//         id: result.insertId,
//         office: officeName.trim(),
//         address: address.trim(),
//         latitude: lat,
//         longitude: lng,
//         radius: rad,
//         status,
//         employees: 0,
//       };
//     } catch (error) {
//       console.error("[OfficeLocationService] createOfficeLocation error:", error);
//       throw new Error(error.message || "Failed to create office location");
//     }
//   }

//   static async updateOfficeLocation(orgId, officeId, data) {
//     if (!orgId) throw new Error("orgId is required");
//     if (!officeId) throw new Error("officeId is required");

//     const {
//       officeName,
//       address,
//       latitude,
//       longitude,
//       radius = 100,
//       status = "Active",
//     } = data;

//     if (
//       !officeName?.trim() ||
//       !address?.trim() ||
//       latitude === undefined ||
//       latitude === null ||
//       latitude === "" ||
//       longitude === undefined ||
//       longitude === null ||
//       longitude === ""
//     ) {
//       throw new Error(
//         "Office name, address, latitude and longitude are required"
//       );
//     }

//     const lat = Number(latitude);
//     const lng = Number(longitude);
//     const rad = Number(radius);

//     if (Number.isNaN(lat) || Number.isNaN(lng)) {
//       throw new Error("Latitude and longitude must be valid numbers");
//     }

//     if (Number.isNaN(rad) || rad <= 0) {
//       throw new Error("Radius must be a valid positive number");
//     }

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [existing] = await tenantPool.query(
//         OFFICE_LOCATION_QUERIES.GET_OFFICE_LOCATION_BY_ID,
//         [officeId]
//       );

//       if (!existing.length) {
//         throw new Error("Office location not found");
//       }

//       await tenantPool.query(OFFICE_LOCATION_QUERIES.UPDATE_OFFICE_LOCATION, [
//         officeName.trim(),
//         address.trim(),
//         lat,
//         lng,
//         rad,
//         status,
//         officeId,
//       ]);

//       return {
//         id: Number(officeId),
//         office: officeName.trim(),
//         address: address.trim(),
//         latitude: lat,
//         longitude: lng,
//         radius: rad,
//         status,
//         employees: existing[0].employees || 0,
//       };
//     } catch (error) {
//       console.error("[OfficeLocationService] updateOfficeLocation error:", error);
//       throw new Error(error.message || "Failed to update office location");
//     }
//   }

//   static async deleteOfficeLocation(orgId, officeId) {
//     if (!orgId) throw new Error("orgId is required");
//     if (!officeId) throw new Error("officeId is required");

//     try {
//       const tenantPool = await getTenantPoolByOrgId(orgId);

//       const [existing] = await tenantPool.query(
//         OFFICE_LOCATION_QUERIES.GET_OFFICE_LOCATION_BY_ID,
//         [officeId]
//       );

//       if (!existing.length) {
//         throw new Error("Office location not found");
//       }

//       await tenantPool.query(OFFICE_LOCATION_QUERIES.DELETE_OFFICE_LOCATION, [
//         officeId,
//       ]);

//       return {
//         id: Number(officeId),
//       };
//     } catch (error) {
//       console.error("[OfficeLocationService] deleteOfficeLocation error:", error);
//       throw new Error(error.message || "Failed to delete office location");
//     }
//   }
// }

// module.exports = OfficeLocationService;

const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const OFFICE_LOCATION_QUERIES = require("../constants/officeLocationQueries");

class OfficeLocationService {
  static async getAllOfficeLocations(orgId) {
    if (!orgId) throw new Error("orgId is required");

    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [rows] = await tenantPool.query(
        OFFICE_LOCATION_QUERIES.GET_ALL_OFFICE_LOCATIONS
      );

      return rows || [];
    } catch (error) {
      console.error("[OfficeLocationService] getAllOfficeLocations error:", error);
      throw new Error(error.message || "Failed to fetch office locations");
    }
  }

  static async createOfficeLocation(orgId, data) {
    if (!orgId) throw new Error("orgId is required");

    const {
      officeName,
      address,
      latitude,
      longitude,
      radius = 100,
      status = "Active",
    } = data;

    if (
      !officeName?.trim() ||
      !address?.trim() ||
      latitude === undefined ||
      latitude === null ||
      latitude === "" ||
      longitude === undefined ||
      longitude === null ||
      longitude === ""
    ) {
      throw new Error(
        "Office name, address, latitude and longitude are required"
      );
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    const rad = Number(radius);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new Error("Latitude and longitude must be valid numbers");
    }

    if (Number.isNaN(rad) || rad <= 0) {
      throw new Error("Radius must be a valid positive number");
    }

    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [result] = await tenantPool.query(
        OFFICE_LOCATION_QUERIES.CREATE_OFFICE_LOCATION,
        [officeName.trim(), address.trim(), lat, lng, rad, status]
      );

      return {
        id: result.insertId,
        office: officeName.trim(),
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        radius: rad,
        status,
        employees: 0,
      };
    } catch (error) {
      console.error("[OfficeLocationService] createOfficeLocation error:", error);
      throw new Error(error.message || "Failed to create office location");
    }
  }

  static async updateOfficeLocation(orgId, officeId, data) {
    if (!orgId) throw new Error("orgId is required");
    if (!officeId) throw new Error("officeId is required");

    const {
      officeName,
      address,
      latitude,
      longitude,
      radius = 100,
      status = "Active",
    } = data;

    if (
      !officeName?.trim() ||
      !address?.trim() ||
      latitude === undefined ||
      latitude === null ||
      latitude === "" ||
      longitude === undefined ||
      longitude === null ||
      longitude === ""
    ) {
      throw new Error(
        "Office name, address, latitude and longitude are required"
      );
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    const rad = Number(radius);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new Error("Latitude and longitude must be valid numbers");
    }

    if (Number.isNaN(rad) || rad <= 0) {
      throw new Error("Radius must be a valid positive number");
    }

    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [existing] = await tenantPool.query(
        OFFICE_LOCATION_QUERIES.GET_OFFICE_LOCATION_BY_ID,
        [officeId]
      );

      if (!existing.length) {
        throw new Error("Office location not found");
      }

      await tenantPool.query(OFFICE_LOCATION_QUERIES.UPDATE_OFFICE_LOCATION, [
        officeName.trim(),
        address.trim(),
        lat,
        lng,
        rad,
        status,
        officeId,
      ]);

      return {
        id: Number(officeId),
        office: officeName.trim(),
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        radius: rad,
        status,
        employees: existing[0].employees || 0,
      };
    } catch (error) {
      console.error("[OfficeLocationService] updateOfficeLocation error:", error);
      throw new Error(error.message || "Failed to update office location");
    }
  }

  static async deleteOfficeLocation(orgId, officeId) {
    if (!orgId) throw new Error("orgId is required");
    if (!officeId) throw new Error("officeId is required");

    try {
      const tenantPool = await getTenantPoolByOrgId(orgId);

      const [existing] = await tenantPool.query(
        OFFICE_LOCATION_QUERIES.GET_OFFICE_LOCATION_BY_ID,
        [officeId]
      );

      if (!existing.length) {
        throw new Error("Office location not found");
      }

      await tenantPool.query(OFFICE_LOCATION_QUERIES.DELETE_OFFICE_LOCATION, [
        officeId,
      ]);

      return {
        id: Number(officeId),
      };
    } catch (error) {
      console.error("[OfficeLocationService] deleteOfficeLocation error:", error);
      throw new Error(error.message || "Failed to delete office location");
    }
  }
}

module.exports = OfficeLocationService;