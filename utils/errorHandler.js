const ErrorTypes = {
  PARSE_ERROR: "PARSE_ERROR",
  STORAGE_ERROR: "STORAGE_ERROR",
  DOWNLOAD_ERROR: "DOWNLOAD_ERROR",
  PERMISSION_ERROR: "PERMISSION_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR"
};

const ErrorMessages = {
  PARSE_ERROR: "Failed to parse the page. The site structure may have changed.",
  STORAGE_ERROR: "Failed to save data locally. Storage may be full.",
  DOWNLOAD_ERROR: "Failed to download the ZIP file. Please try again.",
  PERMISSION_ERROR: "Missing required permissions. Please check extension settings.",
  NETWORK_ERROR: "Network error occurred. Please check your connection.",
  VALIDATION_ERROR: "Invalid input data. Please check your entries.",
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again."
};

function createError(code, message, details = null) {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    stack: new Error().stack
  };
}

function handleError(error, context = "") {
  const errorObj = typeof error === "string"
    ? createError(ErrorTypes.UNKNOWN_ERROR, error)
    : error instanceof Error
      ? createError(ErrorTypes.UNKNOWN_ERROR, error.message, { stack: error.stack })
      : error;

  if (context) {
    console.error(`[CodeExtractor][${context}]`, errorObj);
  } else {
    console.error("[CodeExtractor]", errorObj);
  }

  return errorObj;
}

function isRecoverable(error) {
  if (!error) return false;
  const recoverableTypes = [ErrorTypes.PARSE_ERROR, ErrorTypes.NETWORK_ERROR, ErrorTypes.VALIDATION_ERROR];
  return recoverableTypes.includes(error.code);
}

function getUserMessage(error) {
  if (!error) return ErrorMessages.UNKNOWN_ERROR;
  if (typeof error === "string") return error;
  return error.message || ErrorMessages[error.code] || ErrorMessages.UNKNOWN_ERROR;
}

function showErrorNotification(message, duration = 5000) {
  if (typeof window !== "undefined" && window.showToast) {
    window.showToast("error", message, duration);
  } else {
    console.error("[CodeExtractor][Notification]", message);
  }
}

function showWarningNotification(message, duration = 3000) {
  if (typeof window !== "undefined" && window.showToast) {
    window.showToast("warning", message, duration);
  } else {
    console.warn("[CodeExtractor][Notification]", message);
  }
}

function showSuccessNotification(message, duration = 2000) {
  if (typeof window !== "undefined" && window.showToast) {
    window.showToast("success", message, duration);
  } else {
    console.log("[CodeExtractor][Notification]", message);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ErrorTypes,
    ErrorMessages,
    createError,
    handleError,
    isRecoverable,
    getUserMessage,
    showErrorNotification,
    showWarningNotification,
    showSuccessNotification
  };
}
