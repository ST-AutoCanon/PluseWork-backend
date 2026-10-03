"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import "./vendors.css";
import { FaEye, FaPencilAlt } from "react-icons/fa";
import { Eye, Download } from "react-feather";
import Modal from "../Modal/Modal.client";
import { useAuth } from "../../context/AuthProvider.client";
import VendorRegistration from "./vendorRegistration";
const Vendors = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    company_name: "",
    registered_address: "",
    branch_address: "",
    city: "",
    state: "",
    pin_code: "",
    gst_number: "",
    pan_number: "",
    company_type: "",
    msme_status: "Not Applicable",
    contact1_name: "",
    contact1_designation: "",
    contact1_mobile: "",
    contact1_email: "",
    contact2_name: "",
    contact2_designation: "",
    contact2_mobile: "",
    contact2_email: "",
    contact3_name: "",
    contact3_designation: "",
    contact3_mobile: "",
    contact3_email: "",
    bank_name: "",
    branch: "",
    account_number: "",
    ifsc_code: "",
    nature_of_business: "",
    product_category: "",
    years_of_experience: "",
  });

  const [alertModal, setAlertModal] = useState({
    isVisible: false,
    title: "",
    message: "",
    buttons: null,
  });
  const [files, setFiles] = useState({
    gst_certificate: null,
    pan_card: null,
    cancelled_cheque: null,
    msme_certificate: null,
    incorporation_certificate: null,
  });
  const [vendors, setVendors] = useState([]);
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [selectedRegistrationRequest, setSelectedRegistrationRequest] = useState(null);
  const [showRegistrationRequests, setShowRegistrationRequests] = useState(false);
  const [isApprovingRegistration, setIsApprovingRegistration] = useState(false);
  const [isRejectingRegistration, setIsRejectingRegistration] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [showCompanyDetailsPopup, setShowCompanyDetailsPopup] = useState(false);
  const [showContactDetailsPopup, setShowContactDetailsPopup] = useState(false);
  const [showBankDetailsPopup, setShowBankDetailsPopup] = useState(false);
  const [showBusinessInfoPopup, setShowBusinessInfoPopup] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedVendorFiles, setSelectedVendorFiles] = useState(null);
  const [mobileErrors, setMobileErrors] = useState(["", "", ""]);
  const [emailErrors, setEmailErrors] = useState(["", "", ""]);
  const [error, setError] = useState("");
const [showVendorRegistration, setShowVendorRegistration] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [registrationMail, setRegistrationMail] = useState({
    vendorName: "",
    from: process.env.NEXT_PUBLIC_EMAIL_FROM || "hr@sukalpatech.com",
    recipientEmail: "",
    subject: "Vendor Registration Request-Sukalpa Tech Solutions ",
    body: "Dear Vendor,\n\nPlease complete your vendor registration using the secure link below. The link will remain active for 5 days.\n\nRegards,\nPulseWork Team",
  });
  const [isSendingRegistrationMail, setIsSendingRegistrationMail] = useState(false);
  const headers = useMemo(() => {
    if (!user) return null;
    const orgId =
      user?.orgId ??
      user?.org_id ??
      user?.raw?.org_id ??
      user?.Org_id ??
      user?.raw?.Org_id ??
      null;

    return {
      "x-employee-id": user.employeeId || user.id || "0",
      ...(orgId ? { "x-org-id": String(orgId) } : {}),
    };
  }, [
    user?.employeeId,
    user?.orgId,
    user?.org_id,
    user?.raw?.org_id,
    user?.Org_id,
    user?.raw?.Org_id,
  ]);

  useEffect(() => {
    if (!headers) return;

    const interceptor = axios.interceptors.request.use((config) => {
      config.headers = {
        ...(config.headers || {}),
        ...headers,
      };
      return config;
    });

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, [headers]);

  const showAlert = useCallback((message, title = "") => {
    setAlertModal({ isVisible: true, title, message, buttons: null });
  }, []);

  const closeAlert = () => {
    setAlertModal({ isVisible: false, title: "", message: "", buttons: null });
  };

  const openVendorRegistration = () => {
    setRegistrationStep(1);
    setRegistrationMail({
      vendorName: "",
      from: process.env.NEXT_PUBLIC_EMAIL_FROM || "finance@sukalpatechsolutions.com",
      recipientEmail: "",
      subject: "Request to Complete Vendor/Customer Registration",
      body: "Dear Sir/Madam,\n\nWe request you to complete the vendor/customer registration process using the secure link provided below.\nNote: The registration link will remain active for 5 days. Kindly complete the registration within this period.\n\nThank you for your cooperation.,\nBest regards,\n  Sukalpa Finance Team",
    });
    setShowVendorRegistration(true);
  };

  const sendRegistrationMail = async (event) => {
    event.preventDefault();
    setIsSendingRegistrationMail(true);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/vendors/registration-invite`,
        registrationMail,
        { withCredentials: true, headers }
      );
      if (!response.data?.success) throw new Error("Email was not sent");
      setShowVendorRegistration(false);
      showAlert("Vendor registration email sent. The link expires in 5 days.");
    } catch (err) {
      console.error("Error sending vendor registration email:", err);
      showAlert(err.response?.data?.message || "Failed to send vendor registration email");
    } finally {
      setIsSendingRegistrationMail(false);
    }
  };

  const togglePopup = () => {
    setShowForm(!showForm);
    setIsEditing(false);
    setEditingVendorId(null);
    setFormData({
      name: "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      company_name: "",
      registered_address: "",
      branch_address: "",
      city: "",
      state: "",
      pin_code: "",
      gst_number: "",
      pan_number: "",
      company_type: "",
      msme_status: "Not Applicable",
      contact1_name: "",
      contact1_designation: "",
      contact1_mobile: "",
      contact1_email: "",
      contact2_name: "",
      contact2_designation: "",
      contact2_mobile: "",
      contact2_email: "",
      contact3_name: "",
      contact3_designation: "",
      contact3_mobile: "",
      contact3_email: "",
      bank_name: "",
      branch: "",
      account_number: "",
      ifsc_code: "",
      nature_of_business: "",
      product_category: "",
      years_of_experience: "",
    });
    setFiles({
      gst_certificate: null,
      pan_card: null,
      cancelled_cheque: null,
      msme_certificate: null,
      incorporation_certificate: null,
    });
    setError("");
    setMobileErrors(["", "", ""]);
    setEmailErrors(["", "", ""]);
  };

  const fetchVendors = useCallback(async () => {
    if (!headers) return;
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/vendors/list`,
        { withCredentials: true, headers }
      );
      if (response.data && response.data.success) {
        setVendors(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching vendors:", err);
      showAlert("Failed to fetch vendors");
    }
  }, [headers, showAlert]);

  const fetchRegistrationRequests = useCallback(async () => {
    if (!headers) return;
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/vendors/registration-requests`,
        { withCredentials: true, headers }
      );
      if (response.data?.success) setRegistrationRequests(response.data.data || []);
    } catch (err) {
      console.error("Error fetching vendor registration requests:", err);
      showAlert("Failed to fetch vendor registration requests");
    }
  }, [headers, showAlert]);

  useEffect(() => {
    fetchVendors();
    fetchRegistrationRequests();
  }, [fetchVendors, fetchRegistrationRequests]);

  const handleApproveRegistration = async () => {
    if (!selectedRegistrationRequest) return;
    setIsApprovingRegistration(true);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/vendors/registration-requests/${selectedRegistrationRequest.invite_id}/approve`,
        {},
        { withCredentials: true, headers }
      );
      if (!response.data?.success) throw new Error("Approval failed");
      const approvedRequest = selectedRegistrationRequest;
      const vendorName = approvedRequest.submitted_data?.company_name || approvedRequest.vendor_name;
      const finishApproval = async (shouldSendEmail) => {
        closeAlert();
        try {
          if (shouldSendEmail) {
            await axios.post(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}/vendors/registration-requests/${approvedRequest.invite_id}/approval-email`,
              {},
              { withCredentials: true, headers }
            );
          }
          setShowRegistrationRequests(false);
          setSelectedRegistrationRequest(null);
          await Promise.all([fetchVendors(), fetchRegistrationRequests()]);
          showAlert(shouldSendEmail ? "Vendor approved and approval email sent successfully" : "Vendor registration approved successfully");
        } catch (err) {
          showAlert(err.response?.data?.message || "Vendor was approved, but the email could not be sent");
        }
      };
      setAlertModal({
        isVisible: true,
        title: "Vendor Approved",
        message: `${vendorName} was approved. Do you want to send the successful approval email to the vendor?`,
        buttons: [
          { label: "No", className: "ac-modal-btn ac-modal-btn-secondary", onClick: () => finishApproval(false) },
          { label: "Yes, Send Email", className: "ac-modal-btn ac-modal-btn-primary", onClick: () => finishApproval(true) },
        ],
      });
    } catch (err) {
      console.error("Error approving vendor registration:", err);
      showAlert(err.response?.data?.message || "Failed to approve vendor registration");
    } finally {
      setIsApprovingRegistration(false);
    }
  };

  const handleRejectRegistration = async () => {
    if (!selectedRegistrationRequest) return;
    setIsRejectingRegistration(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/vendors/registration-requests/${selectedRegistrationRequest.invite_id}/reject`,
        {},
        { withCredentials: true, headers }
      );
      setSelectedRegistrationRequest(null);
      await fetchRegistrationRequests();
      showAlert("Vendor registration request rejected");
    } catch (err) {
      showAlert(err.response?.data?.message || "Failed to reject vendor registration");
    } finally {
      setIsRejectingRegistration(false);
    }
  };

  const openRegistrationRequests = async () => {
    await fetchRegistrationRequests();
    setSelectedRegistrationRequest(null);
    setShowRegistrationRequests(true);
  };

  const filteredVendors = vendors.filter((vendor) =>
    (vendor.company_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const requestFieldGroups = [
    {
      title: "Company Details",
      fields: ["company_name", "registered_address", "city", "state", "pin_code", "gst_number", "pan_number", "company_type", "msme_status"],
    },
    {
      title: "Contact Details",
      fields: ["contact1_name", "contact1_designation", "contact1_mobile", "contact1_email", "contact2_name", "contact2_designation", "contact2_mobile", "contact2_email", "contact3_name", "contact3_designation", "contact3_mobile", "contact3_email"],
    },
    {
      title: "Bank Details",
      fields: ["bank_name", "branch", "branch_address", "account_number", "ifsc_code"],
    },
    {
      title: "Business Information",
      fields: ["nature_of_business", "product_category", "years_of_experience"],
    },
  ];
  const requestDocumentFields = [
    ["gst_certificate", "GST Certificate"],
    ["pan_card", "PAN Card"],
    ["cancelled_cheque", "Cancelled Cheque"],
    ["msme_certificate", "MSME Certificate"],
    ["incorporation_certificate", "Company Incorporation Certificate"],
  ];

  const formatRequestLabel = (field) =>
    field.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleShowCompanyDetails = (vendor) => {
    setSelectedVendor(vendor);
    setShowCompanyDetailsPopup(true);
  };

  const handleShowContactDetails = (vendor) => {
    setSelectedVendor(vendor);
    setShowContactDetailsPopup(true);
  };

  const handleShowBankDetails = (vendor) => {
    setSelectedVendor(vendor);
    setShowBankDetailsPopup(true);
  };

  const handleShowBusinessInfo = (vendor) => {
    setSelectedVendor(vendor);
    setShowBusinessInfoPopup(true);
  };

const normalizeDoc = (value) => {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str === "null" || str === "undefined" || str === "false") return null;
  return str;
};
const getFileDisplayName = (file) => {
  if (!file) return null;
  if (typeof file === "string") {
    return file.split(/[/\\]/).pop() || file;
  }
  return file.name || null;
};
const handleShowDocuments = (vendor) => {
  setSelectedVendorFiles({
    gst_certificate: normalizeDoc(vendor.gst_certificate),
    pan_card: normalizeDoc(vendor.pan_card),
    cancelled_cheque: normalizeDoc(vendor.cancelled_cheque),
    msme_certificate: normalizeDoc(vendor.msme_certificate),
    incorporation_certificate: normalizeDoc(vendor.incorporation_certificate),
  });
  setShowDocumentsPopup(true);
};

const handleShowDownloadPopup = (vendor) => {
  setSelectedVendorFiles({
    gst_certificate: normalizeDoc(vendor.gst_certificate),
    pan_card: normalizeDoc(vendor.pan_card),
    cancelled_cheque: normalizeDoc(vendor.cancelled_cheque),
    msme_certificate: normalizeDoc(vendor.msme_certificate),
    incorporation_certificate: normalizeDoc(vendor.incorporation_certificate),
  });
  setShowDownloadPopup(true);
};

  const handleViewDocument = async (documentPath) => {
    if (!documentPath) {
      showAlert("No document available.");
      return;
    }

    try {
      const orgId =
        user.orgId ||
        user.org_id ||
        (user.org && user.org.id) ||
        (user.organization && user.organization.id) ||
        null;
      const fileName = documentPath.split(/[/\\]/).pop();
      const fileUrl = `${
        process.env.NEXT_PUBLIC_BACKEND_URL
      }/vendors/download/${orgId}/${encodeURIComponent(fileName)}`;

      const response = await axios.get(fileUrl, {
        withCredentials: true,
        headers,
        responseType: "blob",
      });

      const extension = fileName.split(".").pop().toLowerCase();
      let mimeType = "application/octet-stream";

      if (extension === "pdf") mimeType = "application/pdf";
      else if (["jpg", "jpeg"].includes(extension)) mimeType = "image/jpeg";
      else if (extension === "png") mimeType = "image/png";

      const fileBlob = new Blob([response.data], { type: mimeType });
      const fileURL = window.URL.createObjectURL(fileBlob);
      window.open(fileURL, "_blank");
    } catch (error) {
      console.error(
        "Error viewing vendor document:",
        error.response?.data || error.message
      );
      showAlert("Failed to open vendor document.");
    }
  };

  const handleDownloadDocument = async (documentPath) => {
    if (!documentPath) {
      showAlert("No document available.");
      return;
    }

    try {
      const orgId =
        user.orgId ||
        user.org_id ||
        (user.org && user.org.id) ||
        (user.organization && user.organization.id) ||
        null;
      const fileName = documentPath.split(/[/\\]/).pop();
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/vendors/download/${orgId}/${fileName}`,
        { withCredentials: true, headers, responseType: "blob" }
      );

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading document:", error);
      showAlert("Failed to download file.");
    }
  };

  const handleDownloadAll = (vendorFiles) => {
    const fileKeys = [
      "gst_certificate",
      "pan_card",
      "cancelled_cheque",
      "msme_certificate",
      "incorporation_certificate",
    ];

    fileKeys.forEach((key) => {
      if (vendorFiles[key]) {
        handleDownloadDocument(vendorFiles[key]);
      }
    });
  };

  const handleEdit = (vendor) => {
    setIsEditing(true);
    const id = vendor.vendor_id || vendor.id || null;
    setEditingVendorId(id);
    setFormData((prev) => ({
      ...prev,
      name: vendor.name || "",
      contact_person: vendor.contact_person || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      address: vendor.address || "",
      company_name: vendor.company_name || "",
      registered_address: vendor.registered_address || "",
      branch_address: vendor.branch_address || "",
      city: vendor.city || "",
      state: vendor.state || "",
      pin_code: vendor.pin_code || "",
      gst_number: vendor.gst_number || "",
      pan_number: vendor.pan_number || "",
      company_type: vendor.company_type || "",
      msme_status: vendor.msme_status || "Not Applicable",
      contact1_name: vendor.contact1_name || "",
      contact1_designation: vendor.contact1_designation || "",
      contact1_mobile: vendor.contact1_mobile || "",
      contact1_email: vendor.contact1_email || "",
      contact2_name: vendor.contact2_name || "",
      contact2_designation: vendor.contact2_designation || "",
      contact2_mobile: vendor.contact2_mobile || "",
      contact2_email: vendor.contact2_email || "",
      contact3_name: vendor.contact3_name || "",
      contact3_designation: vendor.contact3_designation || "",
      contact3_mobile: vendor.contact3_mobile || "",
      contact3_email: vendor.contact3_email || "",
      bank_name: vendor.bank_name || "",
      branch: vendor.branch || "",
      account_number: vendor.account_number || "",
      ifsc_code: vendor.ifsc_code || "",
      nature_of_business: vendor.nature_of_business || "",
      product_category: vendor.product_category || "",
      years_of_experience: vendor.years_of_experience || "",
    }));
    setFiles({
      gst_certificate: vendor.gst_certificate || null,
      pan_card: vendor.pan_card || null,
      cancelled_cheque: vendor.cancelled_cheque || null,
      msme_certificate: vendor.msme_certificate || null,
      incorporation_certificate: vendor.incorporation_certificate || null,
    });
    setShowForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files: newFiles } = e.target;
    setFiles((prev) => ({
      ...prev,
      [name]: newFiles && newFiles[0] ? newFiles[0] : null,
    }));
  };

  const validateField = (name, value, index) => {
    if (name.includes("mobile")) {
      const mobileRegex = /^\d{10}$/;
      const errorText = mobileRegex.test(value)
        ? ""
        : "Enter a valid 10-digit mobile number";
      setMobileErrors((prev) => {
        const copy = [...prev];
        copy[index] = errorText;
        return copy;
      });
      return !errorText;
    }

    if (name.includes("email")) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const errorText = emailRegex.test(value)
        ? ""
        : "Enter a valid email address";
      setEmailErrors((prev) => {
        const copy = [...prev];
        copy[index] = errorText;
        return copy;
      });
      return !errorText;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      formData.years_of_experience &&
      Number(formData.years_of_experience) < 1
    ) {
      setError("Years of experience must be at least 1");
      return;
    }
    setError("");

    const formPayload = new FormData();
    Object.keys(formData).forEach((k) => {
      if (formData[k] !== undefined && formData[k] !== null) {
        formPayload.append(k, formData[k]);
      }
    });

    Object.keys(files).forEach((k) => {
      if (files[k]) formPayload.append(k, files[k]);
    });

    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (isEditing && editingVendorId) {
        const resp = await axios.put(
          `${base}/vendors/update/${editingVendorId}`,
          formPayload,
          {
            withCredentials: true,
            headers: {
              ...(headers || {}),
              "Content-Type": "multipart/form-data",
            },
          }
        );

        if (resp.data && resp.data.success) {
          await fetchVendors();

          showAlert("Vendor updated successfully");
          togglePopup();
        } else {
          showAlert("Failed to update vendor");
        }
      } else {
        const resp = await axios.post(`${base}/vendors/add`, formPayload, {
          withCredentials: true,
          headers: {
            ...(headers || {}),
            "Content-Type": "multipart/form-data",
          },
        });

        if (resp.data && resp.data.success) {
          await fetchVendors();

          showAlert("Vendor added successfully");
          togglePopup();
        } else {
          showAlert("Failed to add vendor");
        }
      }
    } catch (err) {
      console.error("Vendor submit error:", err);
      showAlert("Error while submitting vendor");
    }
  };

  return (
    <div className="vendors-container">
      
      <div className="header-container">
  <div className="vendor-search-container">
    <input
      type="text"
      placeholder="Search by Company Name..."
      value={searchTerm}
      onChange={handleSearchChange}
      className="search-input"
    />

    <i className="fas fa-search vendor-search-icon"></i>
  </div>

<div className="vendor-header-buttons">

  <button
    className="vendor-registration-btn"
    onClick={openVendorRegistration}
  >
    Vendor Registration
  </button>

  <button
    className="vendor-requests-btn"
    onClick={openRegistrationRequests}
  >
    Requests ({registrationRequests.length})
  </button>

  <button
    className="add-vendor-btn"
    onClick={togglePopup}
  >
    Add Vendor
  </button>

</div>
</div>

      {showVendorRegistration && (
        <VendorRegistration
          step={registrationStep}
          formData={registrationMail}
          handleChange={(event) =>
            setRegistrationMail((previous) => ({
              ...previous,
              [event.target.name]: event.target.value,
            }))
          }
          handleNext={() => setRegistrationStep(2)}
          handleBack={() => setRegistrationStep(1)}
          handleSubmit={sendRegistrationMail}
          handleCancel={() => setShowVendorRegistration(false)}
          isSending={isSendingRegistrationMail}
        />
      )}

      {showRegistrationRequests && (
        <div className="vendor-popup-overlay">
          <div className="vendor-popup-form vendor-request-popup">
            <button
              className="vendor-popup-close-btn"
              onClick={() => setShowRegistrationRequests(false)}
            >
              ×
            </button>
            <h2 className="vendor-form-title">Vendor Registration Requests</h2>
            {!selectedRegistrationRequest ? (
              registrationRequests.length ? (
                <div className="registration-request-list">
                  {registrationRequests.map((request) => (
                    <button
                      type="button"
                      className={`registration-request-item registration-request-${request.status || "pending"}`}
                      key={request.invite_id}
                      onClick={() => setSelectedRegistrationRequest(request)}
                    >
                      <span className="registration-request-company">
                        <strong>{request.submitted_data?.company_name || request.vendor_name || "Unnamed vendor"}</strong>
<small>
  {request.email ||
    request.recipient_email ||
    request.username ||
    "Email unavailable"}
</small>                      </span>
                      <span className="registration-request-meta">
                        <b className={`registration-status-badge registration-status-${request.status || "pending"}`}>{request.status || "pending"}</b>
                        <small>{request.submitted_at ? new Date(request.submitted_at).toLocaleString() : "-"}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="empty-request-message">No pending vendor requests.</p>
              )
            ) : (
              <>
                <div className="registration-request-heading">
                  <div><span>Vendor</span><strong>{selectedRegistrationRequest.submitted_data?.company_name || selectedRegistrationRequest.vendor_name || "Unnamed vendor"}</strong></div>
                  <b className={`registration-status-badge registration-status-${selectedRegistrationRequest.status || "pending"}`}>{selectedRegistrationRequest.status || "pending"}</b>
                </div>
                {requestFieldGroups.map((group) => (
                  <fieldset key={group.title}>
                    <legend>{group.title}</legend>
                    <div className="request-details-grid">
                      {group.fields.map((field) => (
                        <div className="request-detail-field" key={field}>
                          <label>{formatRequestLabel(field)}</label>
                          <div>{selectedRegistrationRequest.submitted_data?.[field] || "-"}</div>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <fieldset>
                  <legend>Documents Required</legend>
                  <div className="request-details-grid request-documents-grid">
                    {requestDocumentFields.map(([field, label]) => {
                      const documentPath = selectedRegistrationRequest.submitted_data?.[field];
                      return (
                        <div className="request-detail-field request-document-field" key={field}>
                          <label>{label}</label>
                          {documentPath ? (
                            <button type="button" onClick={() => handleViewDocument(documentPath)}>{documentPath.split(/[/\\\\]/).pop()}</button>
                          ) : <div>-</div>}
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="vendor-form-buttons">
                  <button
                    type="button"
                    className="vendor-close-btn"
                    onClick={() => setSelectedRegistrationRequest(null)}
                  >
                    Back to Requests
                  </button>
                  <button
                    type="button"
                    className="vendor-submit-btn"
                    onClick={handleApproveRegistration}
                    disabled={isApprovingRegistration || isRejectingRegistration || selectedRegistrationRequest.status !== "pending"}
                  >
                    {isApprovingRegistration ? "Approving..." : "Approve Vendor"}
                  </button>
                  <button
                    type="button"
                    className="vendor-reject-btn"
                    onClick={handleRejectRegistration}
                    disabled={isApprovingRegistration || isRejectingRegistration || selectedRegistrationRequest.status !== "pending"}
                  >
                    {isRejectingRegistration ? "Rejecting..." : "Reject Request"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="table-scroll-wrapper">
        <table className="vendor-table">
          <thead>
            <tr className="header-row">
              <th>Vendor ID</th>
              <th>Company Name</th>
              <th>Company Details</th>
              <th>Contact Details</th>
              <th>Bank Details</th>
              <th>Business Information</th>
              <th>Documents</th>
              <th>Last Edited</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {filteredVendors.map((vendor) => (
              <tr key={vendor.vendor_id}>
                <td>{vendor.vendor_id}</td>
                <td>{vendor.company_name}</td>
                <td>
                  <button
                    className="vendor-view-doc-btn"
                    onClick={() => handleShowCompanyDetails(vendor)}
                  >
                    <Eye size={16} style={{ marginRight: "5px" }} /> View
                  </button>
                </td>
                <td>
                  <button
                    className="vendor-view-doc-btn"
                    onClick={() => handleShowContactDetails(vendor)}
                  >
                    <Eye size={16} style={{ marginRight: "5px" }} /> View
                  </button>
                </td>
                <td>
                  <button
                    className="vendor-view-doc-btn"
                    onClick={() => handleShowBankDetails(vendor)}
                  >
                    <Eye size={16} style={{ marginRight: "5px" }} /> View
                  </button>
                </td>
                <td>
                  <button
                    className="vendor-view-doc-btn"
                    onClick={() => handleShowBusinessInfo(vendor)}
                  >
                    <Eye size={16} style={{ marginRight: "5px" }} /> View
                  </button>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      className="vendor-view-doc-btn"
                      onClick={() => handleShowDocuments(vendor)}
                    >
                      <Eye size={16} style={{ marginRight: "5px" }} />
                    </button>
                    <button
                      className="vendor-download-doc-btn"
                      onClick={() => handleShowDownloadPopup(vendor)}
                    >
                      <Download size={16} style={{ marginRight: "5px" }} />
                    </button>
                  </div>
                </td>
                <td>
                  {vendor.updated_at || vendor.created_at
                    ? new Date(
                        vendor.updated_at || vendor.created_at
                      ).toLocaleDateString()
                    : "-"}
                </td>
                <td>
                  <button
                    className="vendor-edit-btn"
                    onClick={() => handleEdit(vendor)}
                    title="Edit Vendor"
                  >
                    <FaPencilAlt size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="vendor-popup-overlay">
          <div className="vendor-popup-form">
            <button className="vendor-popup-close-btn" onClick={togglePopup}>
              ×
            </button>

            <h2 className="vendor-form-title">
              {isEditing ? "Edit Vendor" : "Vendor Registration Form"}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="companydetailsfeildset">
                <fieldset>
                  <legend>Company Details</legend>
                  <div className="contact-row four-columns">
                    <div className="contact-field">
                      <label htmlFor="company_name">
                        Company Name:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="company_name"
                        name="company_name"
                        placeholder="Enter Company Name"
                        value={formData.company_name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="city">
                        City:<span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="city"
                        name="city"
                        placeholder="Enter City"
                        value={formData.city}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="state">
                        State:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="state"
                        name="state"
                        placeholder="Enter State"
                        value={formData.state}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="pin_code">
                        Pin Code:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="pin_code"
                        name="pin_code"
                        placeholder="Enter Pin Code"
                        value={formData.pin_code}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="contact-row four-columns">
                    <div className="contact-field">
                      <label htmlFor="gst_number">
                        GST Number:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="gst_number"
                        name="gst_number"
                        placeholder="Enter GST Number"
                        value={formData.gst_number}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="pan_number">
                        PAN Number:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="pan_number"
                        name="pan_number"
                        placeholder="Enter PAN Number"
                        value={formData.pan_number}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="company_type">
                        Company Type:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="company_type"
                        name="company_type"
                        placeholder="Enter Company Type"
                        value={formData.company_type}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="msme_status">
                        MSME Status:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <select
                        id="msme_status"
                        name="msme_status"
                        value={formData.msme_status}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="Applicable">Applicable</option>
                        <option value="Not Applicable">Not Applicable</option>
                      </select>
                    </div>
                  </div>
                  <div className="contact-row two-columns">
                    <div className="contact-field">
                      <label htmlFor="registered_address">
                        Registered Address:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="registered_address"
                        name="registered_address"
                        placeholder="Enter Registered Address"
                        value={formData.registered_address}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="branch_address">
                        Branch/Manufacturing Address:
                      </label>
                      <input
                        id="branch_address"
                        name="branch_address"
                        placeholder="Enter Branch/Manufacturing Address"
                        value={formData.branch_address}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </fieldset>
              </div>

              <div className="contactdetailsfeildset">
                {[1, 2, 3].map((i) => (
                  <fieldset key={i} className="contact-fieldset spaced">
                    <legend>
  {i === 3 ? "Account Team Contact Details" : `Contact Details - ${i}`}
</legend>
                    <div className="contact-row four-columns">
                      <div className="contact-field">
                        <label htmlFor={`contact${i}_name`}>
                          Contact Person Name:
                          {i === 1 ? (
                            <span className="vendor-required-asterisk">*</span>
                          ) : null}
                        </label>
                        <input
                          id={`contact${i}_name`}
                          name={`contact${i}_name`}
                          placeholder="Enter Contact Person Name"
                          value={formData[`contact${i}_name`]}
                          onChange={handleInputChange}
                          required={i === 1}
                        />
                      </div>
                      <div className="contact-field">
                        <label htmlFor={`contact${i}_designation`}>
                          Designation:
                          {i === 1 ? (
                            <span className="vendor-required-asterisk">*</span>
                          ) : null}
                        </label>
                        <input
                          id={`contact${i}_designation`}
                          name={`contact${i}_designation`}
                          placeholder="Enter Designation"
                          value={formData[`contact${i}_designation`]}
                          onChange={handleInputChange}
                          required={i === 1}
                        />
                      </div>
                      <div className="contact-field">
                        <label htmlFor={`contact${i}_mobile`}>
                          Mobile Number:
                          {i === 1 ? (
                            <span className="vendor-required-asterisk">*</span>
                          ) : null}
                        </label>
                        <input
                          id={`contact${i}_mobile`}
                          name={`contact${i}_mobile`}
                          type="tel"
                          maxLength="10"
                          placeholder="Enter 10-digit Mobile Number"
                          value={formData[`contact${i}_mobile`]}
                          onChange={handleInputChange}
                          onBlur={(e) =>
                            validateField(e.target.name, e.target.value, i - 1)
                          }
                          required={i === 1}
                        />
                        {mobileErrors[i - 1] && (
                          <span className="error-message">
                            {mobileErrors[i - 1]}
                          </span>
                        )}
                      </div>
                      <div className="contact-field">
                        <label htmlFor={`contact${i}_email`}>
                          Email ID:
                          {i === 1 ? (
                            <span className="vendor-required-asterisk">*</span>
                          ) : null}
                        </label>
                        <input
                          id={`contact${i}_email`}
                          name={`contact${i}_email`}
                          type="email"
                          placeholder="Enter Email ID"
                          value={formData[`contact${i}_email`]}
                          onChange={handleInputChange}
                          onBlur={(e) =>
                            validateField(e.target.name, e.target.value, i - 1)
                          }
                          required={i === 1}
                        />
                        {emailErrors[i - 1] && (
                          <span className="error-message">
                            {emailErrors[i - 1]}
                          </span>
                        )}
                      </div>
                    </div>
                  </fieldset>
                ))}
              </div>

              <div className="feildsetbankdetails">
                <fieldset>
                  <legend>Bank Details</legend>
                  <div className="contact-row four-columns">
                    <div className="contact-field">
                      <label htmlFor="bank_name">
                        Bank Name:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="bank_name"
                        name="bank_name"
                        placeholder="Enter Bank Name"
                        value={formData.bank_name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="branch">
                        Branch:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="branch"
                        name="branch"
                        placeholder="Enter Branch"
                        value={formData.branch}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="account_number">
                        Account Number:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="account_number"
                        name="account_number"
                        placeholder="Enter Account Number"
                        value={formData.account_number}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="ifsc_code">
                        IFSC Code:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="ifsc_code"
                        name="ifsc_code"
                        placeholder="Enter IFSC Code"
                        value={formData.ifsc_code}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                </fieldset>
              </div>

              <div className="feildsetbusinessinformation">
                <fieldset>
                  <legend>Business Information</legend>
                  <div className="contact-row three-columns">
                    <div className="contact-field">
                      <label htmlFor="nature_of_business">
                        Nature of Business:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="nature_of_business"
                        name="nature_of_business"
                        placeholder="Enter Nature of Business"
                        value={formData.nature_of_business}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="product_category">
                        Category of Products:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="product_category"
                        name="product_category"
                        placeholder="Enter Category of Products/Services"
                        value={formData.product_category}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="years_of_experience">
                        Years of Experience:
                        <span className="vendor-required-asterisk">*</span>
                      </label>
                      <input
                        id="years_of_experience"
                        name="years_of_experience"
                        type="number"
                        min="1"
                        placeholder="Enter Years of Experience"
                        value={formData.years_of_experience}
                        onChange={handleInputChange}
                        required
                      />
                      {error && <span className="error-message">{error}</span>}
                    </div>
                  </div>
                </fieldset>
              </div>

              <fieldset>
  <legend>Documents Required (Attach Copies)</legend>

  <div className="contact-row three-columns">
    {/* GST Certificate */}
    <div className="contact-field">
      <label htmlFor="gst_certificate">
        GST Certificate:
        <span className="vendor-required-asterisk">*</span>
      </label>
      <input
        id="gst_certificate"
        type="file"
        name="gst_certificate"
        accept=".pdf,.jpg,.png,.jpeg"
        onChange={handleFileChange}
        required={!isEditing}
      />
      {getFileDisplayName(files.gst_certificate) && (
        <div className="selected-file-name">
          Current: {getFileDisplayName(files.gst_certificate)}
        </div>
      )}
    </div>

    {/* PAN Card */}
    <div className="contact-field">
      <label htmlFor="pan_card">
        PAN Card:
        <span className="vendor-required-asterisk">*</span>
      </label>
      <input
        id="pan_card"
        type="file"
        name="pan_card"
        accept=".pdf,.jpg,.png,.jpeg"
        onChange={handleFileChange}
        required={!isEditing}
      />
      {getFileDisplayName(files.pan_card) && (
        <div className="selected-file-name">
          Current: {getFileDisplayName(files.pan_card)}
        </div>
      )}
    </div>

    {/* Cancelled Cheque */}
    <div className="contact-field">
      <label htmlFor="cancelled_cheque">Cancelled Cheque:</label>
      <input
        id="cancelled_cheque"
        type="file"
        name="cancelled_cheque"
        accept=".pdf,.jpg,.png,.jpeg"
        onChange={handleFileChange}
      />
      {getFileDisplayName(files.cancelled_cheque) && (
        <div className="selected-file-name">
          Current: {getFileDisplayName(files.cancelled_cheque)}
        </div>
      )}
    </div>
  </div>

  <div className="contact-row two-columns">
    {/* MSME Certificate */}
    <div className="contact-field msme-field">
      <label htmlFor="msme_certificate">
        MSME Certificate (if applicable):
      </label>
      <input
        id="msme_certificate"
        type="file"
        name="msme_certificate"
        accept=".pdf,.jpg,.png,.jpeg"
        onChange={handleFileChange}
      />
      {getFileDisplayName(files.msme_certificate) && (
        <div className="selected-file-name">
          Current: {getFileDisplayName(files.msme_certificate)}
        </div>
      )}
    </div>

    {/* Incorporation Certificate */}
    <div className="contact-field">
      <label htmlFor="incorporation_certificate">
        Company Incorporation Certificate:
      </label>
      <input
        id="incorporation_certificate"
        type="file"
        name="incorporation_certificate"
        accept=".pdf,.jpg,.png,.jpeg"
        onChange={handleFileChange}
      />
      {getFileDisplayName(files.incorporation_certificate) && (
        <div className="selected-file-name">
          Current: {getFileDisplayName(files.incorporation_certificate)}
        </div>
      )}
    </div>
  </div>
</fieldset>

              <div className="vendor-form-buttons">
                <button
                  type="button"
                  onClick={togglePopup}
                  className="vendor-close-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="vendor-submit-btn">
                  {isEditing ? "Update" : "Add Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCompanyDetailsPopup && selectedVendor && (
        <div className="vendor-popup-overlay">
          <div className="vendor-popup-box">
            <button
              className="vendor-popup-close-btn"
              onClick={() => setShowCompanyDetailsPopup(false)}
            >
              ×
            </button>
            <h2 className="vendor-popup-title">Company Details</h2>
            <div className="vendor-details-container">
              <table className="details-table">
                <tbody>
                  <tr>
                    <td className="details-label">Company Name</td>
                    <td className="details-value">
                      {selectedVendor.company_name}
                    </td>
                  </tr>
                  <tr>
                    <td className="details-label">Registered Address</td>
                    <td className="details-value">
                      {selectedVendor.registered_address}
                    </td>
                  </tr>
                  <tr>
                    <td className="details-label">
                      Branch/Manufacturing Address
                    </td>
                    <td className="details-value">
                      {selectedVendor.branch_address || "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className="details-label">City</td>
                    <td className="details-value">{selectedVendor.city}</td>
                  </tr>
                  <tr>
                    <td className="details-label">State</td>
                    <td className="details-value">{selectedVendor.state}</td>
                  </tr>
                  <tr>
                    <td className="details-label">Pin Code</td>
                    <td className="details-value">{selectedVendor.pin_code}</td>
                  </tr>
                  <tr>
                    <td className="details-label">GST Number</td>
                    <td className="details-value">
                      {selectedVendor.gst_number}
                    </td>
                  </tr>
                  <tr>
                    <td className="details-label">PAN Number</td>
                    <td className="details-value">
                      {selectedVendor.pan_number}
                    </td>
                  </tr>
                  <tr>
                    <td className="details-label">Company Type</td>
                    <td className="details-value">
                      {selectedVendor.company_type}
                    </td>
                  </tr>
                  <tr>
                    <td className="details-label">MSME Status</td>
                    <td className="details-value">
                      {selectedVendor.msme_status || "Not Applicable"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showContactDetailsPopup && selectedVendor && (
        <div className="vendor-popup-overlay">
          <div className="vendor-popup-box">
            <button
              className="vendor-popup-close-btn"
              onClick={() => setShowContactDetailsPopup(false)}
            >
              ×
            </button>
            <h2 className="vendor-popup-title">Contact Details</h2>
            <div className="contact-grid">
              <div className="grid-label" rowSpan={2}>
                Contact 1
              </div>
              <div className="grid-field">
                Name: {selectedVendor.contact1_name || "-"}
              </div>
              <div className="grid-field">
                Designation: {selectedVendor.contact1_designation || "-"}
              </div>
              <div className="grid-field">
                Email: {selectedVendor.contact1_email || "-"}
              </div>
              <div className="grid-field">
                Mobile: {selectedVendor.contact1_mobile || "-"}
              </div>
              <div className="grid-label">Contact 2</div>
              <div className="grid-field">
                Name: {selectedVendor.contact2_name || "-"}
              </div>
              <div className="grid-field">
                Designation: {selectedVendor.contact2_designation || "-"}
              </div>
              <div className="grid-field">
                Email: {selectedVendor.contact2_email || "-"}
              </div>
              <div className="grid-field">
                Mobile: {selectedVendor.contact2_mobile || "-"}
              </div>
              <div className="grid-label">Contact 3</div>
              <div className="grid-field">
                Name: {selectedVendor.contact3_name || "-"}
              </div>
              <div className="grid-field">
                Designation: {selectedVendor.contact3_designation || "-"}
              </div>
              <div className="grid-field">
                Email: {selectedVendor.contact3_email || "-"}
              </div>
              <div className="grid-field">
                Mobile: {selectedVendor.contact3_mobile || "-"}
              </div>
            </div>
          </div>
        </div>
      )}

      {showBankDetailsPopup && selectedVendor && (
        <div className="vendor-popup-overlay">
          <div className="vendor-popup-box">
            <button
              className="vendor-popup-close-btn"
              onClick={() => setShowBankDetailsPopup(false)}
            >
              ×
            </button>
            <h2 className="vendor-popup-title">Bank Details</h2>
            <div className="vendor-details-container">
              <table className="details-table">
                <tbody>
                  <tr>
                    <td className="details-label">Bank Name</td>
                    <td className="details-value">
                      {selectedVendor.bank_name}
                    </td>
                  </tr>
                  <tr>
                    <td className="details-label">Branch</td>
                    <td className="details-value">{selectedVendor.branch}</td>
                  </tr>
                  <tr>
                    <td className="details-label">Account Number</td>
                    <td className="details-value">
                      {selectedVendor.account_number}
                    </td>
                  </tr>
                  <tr>
                    <td className="details-label">IFSC Code</td>
                    <td className="details-value">
                      {selectedVendor.ifsc_code}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showBusinessInfoPopup && selectedVendor && (
        <div className="vendor-popup-overlay">
          <div className="vendor-popup-box">
            <button
              className="vendor-popup-close-btn"
              onClick={() => setShowBusinessInfoPopup(false)}
            >
              ×
            </button>
            <h2 className="vendor-popup-title">Business Information</h2>
            <div className="vendor-details-container">
              <table className="details-table">
                <tbody>
                  <tr>
                    <td className="details-label">Nature of Business</td>
                    <td className="details-value">
                      {selectedVendor.nature_of_business}
                    </td>
                  </tr>
                  <tr>
                    <td className="details-label">Product Category</td>
                    <td className="details-value">
                      {selectedVendor.product_category}
                    </td>
                  </tr>
                  <tr>
                    <td className="details-label">Years of Experience</td>
                    <td className="details-value">
                      {selectedVendor.years_of_experience}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showDocumentsPopup && selectedVendorFiles && (
        <div className="vendor-popup-overlay">
          <div className="vendor-popup-form documents-popup">
            <button
              className="vendor-popup-close-btn"
              onClick={() => setShowDocumentsPopup(false)}
            >
              ×
            </button>
            <h2 className="vendor-form-title">Vendor Documents (View)</h2>
            <ul className="documents-list">
              <li>
                <span
                  className={
                    selectedVendorFiles.gst_certificate
                      ? "file-link"
                      : "file-link disabled"
                  }
                  onClick={() =>
                    handleViewDocument(selectedVendorFiles.gst_certificate)
                  }
                >
                  GST Certificate
                </span>
              </li>
              <li>
                <span
                  className={
                    selectedVendorFiles.pan_card
                      ? "file-link"
                      : "file-link disabled"
                  }
                  onClick={() =>
                    handleViewDocument(selectedVendorFiles.pan_card)
                  }
                >
                  PAN Card
                </span>
              </li>
              <li>
                <span
                  className={
                    selectedVendorFiles.cancelled_cheque
                      ? "file-link"
                      : "file-link disabled"
                  }
                  onClick={() =>
                    handleViewDocument(selectedVendorFiles.cancelled_cheque)
                  }
                >
                  Cancelled Cheque
                </span>
              </li>
              <li>
                <span
                  className={
                    selectedVendorFiles.msme_certificate
                      ? "file-link"
                      : "file-link disabled"
                  }
                  onClick={() =>
                    handleViewDocument(selectedVendorFiles.msme_certificate)
                  }
                >
                  MSME Certificate
                </span>
              </li>
              <li>
                <span
                  className={
                    selectedVendorFiles.incorporation_certificate
                      ? "file-link"
                      : "file-link disabled"
                  }
                  onClick={() =>
                    handleViewDocument(
                      selectedVendorFiles.incorporation_certificate
                    )
                  }
                >
                  Incorporation Certificate
                </span>
              </li>
            </ul>
            <div className="vendor-form-buttons">
              <button
                className="vendor-submit-btn"
                onClick={() => handleDownloadAll(selectedVendorFiles)}
                disabled={
                  !selectedVendorFiles.gst_certificate &&
                  !selectedVendorFiles.pan_card &&
                  !selectedVendorFiles.cancelled_cheque &&
                  !selectedVendorFiles.msme_certificate &&
                  !selectedVendorFiles.incorporation_certificate
                }
              >
                Download All
              </button>
            </div>
          </div>
        </div>
      )}

      {showDownloadPopup && selectedVendorFiles && (
        <div className="vendor-popup-overlay">
          <div className="vendor-popup-form documents-popup">
            <button
              className="vendor-popup-close-btn"
              onClick={() => setShowDownloadPopup(false)}
            >
              ×
            </button>
            <h2 className="vendor-form-title">Vendor Documents (Download)</h2>
            <ul className="documents-list">
              <li className="document-item">
                <span className="file-name">GST Certificate</span>
                <button
                  className="download-btn"
                  onClick={() =>
                    handleDownloadDocument(selectedVendorFiles.gst_certificate)
                  }
                  disabled={!selectedVendorFiles.gst_certificate}
                >
                  Download
                </button>
              </li>
              <li className="document-item">
                <span className="file-name">PAN Card</span>
                <button
                  className="download-btn"
                  onClick={() =>
                    handleDownloadDocument(selectedVendorFiles.pan_card)
                  }
                  disabled={!selectedVendorFiles.pan_card}
                >
                  Download
                </button>
              </li>
              <li className="document-item">
                <span className="file-name">Cancelled Cheque</span>
                <button
                  className="download-btn"
                  onClick={() =>
                    handleDownloadDocument(selectedVendorFiles.cancelled_cheque)
                  }
                  disabled={!selectedVendorFiles.cancelled_cheque}
                >
                  Download
                </button>
              </li>
              <li className="document-item">
                <span className="file-name">MSME Certificate</span>
                <button
                  className="download-btn"
                  onClick={() =>
                    handleDownloadDocument(selectedVendorFiles.msme_certificate)
                  }
                  disabled={!selectedVendorFiles.msme_certificate}
                >
                  Download
                </button>
              </li>
              <li className="document-item">
                <span className="file-name">Incorporation Certificate</span>
                <button
                  className="download-btn"
                  onClick={() =>
                    handleDownloadDocument(
                      selectedVendorFiles.incorporation_certificate
                    )
                  }
                  disabled={!selectedVendorFiles.incorporation_certificate}
                >
                  Download
                </button>
              </li>
            </ul>
            <div className="vendor-form-buttons">
              <button
                className="vendor-submit-btn"
                onClick={() => handleDownloadAll(selectedVendorFiles)}
                disabled={
                  !selectedVendorFiles.gst_certificate &&
                  !selectedVendorFiles.pan_card &&
                  !selectedVendorFiles.cancelled_cheque &&
                  !selectedVendorFiles.msme_certificate &&
                  !selectedVendorFiles.incorporation_certificate
                }
              >
                Download All
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isVisible={alertModal.isVisible}
        onClose={closeAlert}
        title={alertModal.title}
        buttons={alertModal.buttons || [{ label: "OK", onClick: closeAlert }]}
      >
        <p>{alertModal.message}</p>
      </Modal>
    </div>
  );
};

export default Vendors;
