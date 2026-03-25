const dashboardTitle = document.getElementById("dashboardTitle");
const userDashboard = document.getElementById("userDashboard");
const welcomeText = document.getElementById("welcomeText");
const profilePicImg = document.getElementById("profilePicImg");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileRoles = document.getElementById("profileRoles");
const profileDob = document.getElementById("profileDob");
const profileMonthlySalary = document.getElementById("profileMonthlySalary");
const boardMessage = document.getElementById("boardMessage");
const userActions = document.getElementById("userActions");

const profilePicInput = document.getElementById("profilePicInput");
const profilePicPreviewImg = document.getElementById("profilePicPreviewImg");
const profilePicPreviewHint = document.getElementById("profilePicPreviewHint");
const uploadProfilePicBtn = document.getElementById("uploadProfilePicBtn");
const uploadProgressWrap = document.getElementById("uploadProgressWrap");
const uploadProgressBar = document.getElementById("uploadProgressBar");
const uploadProgressText = document.getElementById("uploadProgressText");
const uploadMessage = document.getElementById("uploadMessage");

const ACCESS_TOKEN_KEY = "accessToken";
const sessionExpiryNoticeEl = document.getElementById("sessionExpiryNotice");
let isAutoLoggingOut = false;

function setStoredAccessToken(token) {
  if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

function getStoredAccessToken() {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getJwtExpMs(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return null;
  return Number(payload.exp) * 1000;
}

function isJwtExpired(token) {
  const expMs = getJwtExpMs(token);
  if (!expMs) return false;
  return Date.now() >= expMs;
}

function showSessionExpiryNotice(message) {
  if (!sessionExpiryNoticeEl) return;
  sessionExpiryNoticeEl.textContent = message || "Your session has expired.";
  sessionExpiryNoticeEl.style.display = "block";
}

async function callBackendLogout(token) {
  try {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    await fetch("/api/auth/signout", {
      method: "POST",
      headers,
      credentials: "include",
    });
  } catch {
    // ignore network errors during logout
  }
}

async function autoLogout({ message, redirectTo = "/ui" } = {}) {
  if (isAutoLoggingOut) return;
  isAutoLoggingOut = true;

  const token = getStoredAccessToken();
  showSessionExpiryNotice(message || "Your session has expired. Please sign in again.");

  // Best-effort: ask backend to blacklist token + clear cookie-session.
  await callBackendLogout(token);

  // Clear local state.
  setStoredAccessToken(null);
  renderUserDashboard(null);
  if (profilePicInput) profilePicInput.value = "";

  setTimeout(() => {
    window.location.href = redirectTo;
  }, 1200);
}

function shouldSkipExpiryCheck(path) {
  const p = String(path || "");
  return (
    p.startsWith("/api/auth/signin") ||
    p.startsWith("/api/auth/signup") ||
    p.startsWith("/api/auth/register") ||
    p.startsWith("/api/auth/login") ||
    p.startsWith("/api/auth/signout") ||
    p.startsWith("/api/auth/logout")
  );
}

function isProfilePicFileAllowed(file) {
  if (!file) return { ok: false, message: "Please choose an image file first." };

  const maxBytes = 5 * 1024 * 1024; // 5MB
  if (file.size > maxBytes) return { ok: false, message: "Image must be <= 5MB." };

  const allowedTypes = new Set(["image/jpeg", "image/png", "image/gif"]);
  if (file.type && allowedTypes.has(file.type)) return { ok: true };

  // Fallback: trust extension if browser didn't provide a type.
  const ext = String(file.name || "").toLowerCase().split(".").pop();
  if (["jpg", "jpeg", "png", "gif"].includes(ext)) return { ok: true };

  return { ok: false, message: "Only JPG, PNG, and GIF images are allowed." };
}

function setUploading(isUploading) {
  if (!profilePicInput || !uploadProfilePicBtn) return;
  profilePicInput.disabled = isUploading;
  uploadProfilePicBtn.disabled = isUploading;

  if (isUploading) {
    uploadMessage.textContent = "";
    uploadProgressWrap.style.display = "flex";
  }
}

function resetUploadUI() {
  if (profilePicInput) profilePicInput.value = "";
  if (profilePicPreviewImg) {
    profilePicPreviewImg.src = "";
    profilePicPreviewImg.style.display = "none";
  }
  if (profilePicPreviewHint) profilePicPreviewHint.style.display = "inline";

  if (uploadProgressWrap) uploadProgressWrap.style.display = "none";
  if (uploadProgressBar) uploadProgressBar.value = 0;
  if (uploadProgressText) uploadProgressText.textContent = "0%";
  if (uploadMessage) uploadMessage.textContent = "";
}

function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function renderUserDashboard(user) {
  if (!user) {
    userDashboard.style.display = "none";
    welcomeText.textContent = "";
    userActions.innerHTML = "";
    resetUploadUI();
    if (sessionExpiryNoticeEl) sessionExpiryNoticeEl.style.display = "none";
    return;
  }

  const role = String(user.role || "").toLowerCase();
  const isManager = role === "manager";

  userDashboard.style.display = "block";

  welcomeText.textContent = `Welcome ${user.name || user.email} (${role || "user"})`;
  dashboardTitle.textContent = isManager ? "Manager Dashboard" : "User Dashboard";

  profilePicImg.style.display = user.profilePic ? "block" : "none";
  if (user.profilePic) profilePicImg.src = user.profilePic;

  profileName.textContent = user.name || "-";
  profileEmail.textContent = user.email || "-";
  profileRoles.textContent = role || "-";
  profileDob.textContent = formatDate(user.dob);
  profileMonthlySalary.textContent =
    user.salary === null || user.salary === undefined ? "-" : String(user.salary);

  boardMessage.textContent = "Loading board...";
  const boardPath = isManager ? "/api/test/manager" : "/api/test/user";
  apiFetch(boardPath).then((resp) => {
    boardMessage.textContent = resp?.ok ? resp.data : "Unable to load board.";
  }).catch(() => {
    boardMessage.textContent = "Unable to load board.";
  });

  userActions.innerHTML = "";
  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "secondary";
  refreshBtn.textContent = "Refresh My Profile";
  refreshBtn.addEventListener("click", async () => {
    const resp = await apiFetch("/api/auth/me");
    if (resp.ok) renderUserDashboard(resp.data.user);
  });
  userActions.appendChild(refreshBtn);

  // Clear any "previous upload" UI whenever profile data is refreshed.
  resetUploadUI();
}

async function apiFetch(path, { method = "GET", body } = {}) {
  const headers = {};
  let payload = body;

  const token = getStoredAccessToken();
  if (token && !shouldSkipExpiryCheck(path)) {
    if (isJwtExpired(token)) {
      await autoLogout({ message: "Session expired. Redirecting to login..." });
      return { ok: false, status: 401, data: null };
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(path, {
    method,
    headers,
    body: payload,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => "");
  }

  if (res.status === 401 || res.status === 403) {
    await autoLogout({ message: "Your session has expired. Redirecting to login..." });
    return { ok: false, status: res.status, data };
  }

  return { ok: res.ok, status: res.status, data };
}

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const email = (fd.get("email") || "").toString();
  const password = (fd.get("password") || "").toString();

  const signupResp = await apiFetch("/api/auth/signup", { method: "POST", body: fd });

  if (!signupResp.ok) {
    return;
  }

  const signinBody = { email, password };
  const signinResp = await apiFetch("/api/auth/signin", { method: "POST", body: signinBody });
  if (signinResp.ok) {
    const accessToken = signinResp?.data?.accessToken || signinResp?.data?.token;
    if (accessToken) setStoredAccessToken(accessToken);
    renderUserDashboard(signinResp.data.user);
    const role = String(signinResp?.data?.user?.role || "").toLowerCase();
    if (role === "admin") {
      window.location.href = "/admin";
      return;
    }
  }
});

document.getElementById("signinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const body = {
    email: fd.get("email"),
    password: fd.get("password"),
  };
  const resp = await apiFetch("/api/auth/signin", { method: "POST", body });
  if (resp.ok) {
    renderUserDashboard(resp.data.user);
    const role = String(resp?.data?.user?.role || "").toLowerCase();
    if (role === "admin") {
      window.location.href = "/admin";
      return;
    }
  }
});

document.getElementById("signoutBtn").addEventListener("click", async () => {
  const resp = await apiFetch("/api/auth/signout", { method: "POST" });
  // Even if signout failed, clear local UI state.
  renderUserDashboard(null);
});

(async () => {
  const resp = await apiFetch("/api/auth/me");
  if (resp.ok) {
    renderUserDashboard(resp.data.user);
  }
})();

// Profile picture upload
if (profilePicInput && uploadProfilePicBtn) {
  profilePicInput.addEventListener("change", () => {
    const file = profilePicInput.files?.[0] || null;
    const check = isProfilePicFileAllowed(file);
    if (!check.ok) {
      uploadMessage.textContent = check.message;
      resetUploadUI();
      return;
    }

    if (profilePicPreviewHint) profilePicPreviewHint.style.display = "none";

    const reader = new FileReader();
    reader.onload = () => {
      if (!profilePicPreviewImg) return;
      profilePicPreviewImg.src = String(reader.result || "");
      profilePicPreviewImg.style.display = "block";
    };
    reader.readAsDataURL(file);

    uploadMessage.textContent = "";
  });

  uploadProfilePicBtn.addEventListener("click", async () => {
    const file = profilePicInput.files?.[0] || null;
    const check = isProfilePicFileAllowed(file);
    if (!check.ok) {
      uploadMessage.textContent = check.message;
      return;
    }

    setUploading(true);
    uploadProgressBar.value = 0;
    uploadProgressText.textContent = "0%";

    const fd = new FormData();
    fd.append("profilePic", file);

    const xhr = new XMLHttpRequest();
    xhr.open("PATCH", "/api/user/me");
    xhr.withCredentials = true; // use cookie-session JWT

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const percent = Math.round((e.loaded / e.total) * 100);
      uploadProgressBar.value = percent;
      uploadProgressText.textContent = `${percent}%`;
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        let data;
        try {
          data = JSON.parse(xhr.responseText || "{}");
        } catch {
          data = {};
        }

        if (data?.user) {
          renderUserDashboard(data.user);
          return;
        }
        uploadMessage.textContent = "Upload succeeded, but profile update failed to parse.";
        return;
      }

      let data;
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      uploadMessage.textContent = data?.message || "Upload failed.";
      uploadProgressWrap.style.display = "none";
    };

    xhr.onerror = () => {
      setUploading(false);
      uploadProgressWrap.style.display = "none";
      uploadMessage.textContent = "Network error during upload.";
    };

    xhr.send(fd);
  });
}
