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
  profileMonthlySalary.textContent = user.monthlySalary === null || user.monthlySalary === undefined ? "-" : String(user.monthlySalary);

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
}

async function apiFetch(path, { method = "GET", body } = {}) {
  const headers = {};
  let payload = body;
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
