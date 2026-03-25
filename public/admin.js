const output = document.getElementById("output");
const show = (v) => (output.textContent = JSON.stringify(v, null, 2));
const adminStatus = document.getElementById("adminStatus");
const managementSection = document.getElementById("managementSection");
const usersTableBody = document.getElementById("usersTableBody");
let isAdminLoggedIn = false;

function setAdminUiState(enabled, message) {
  isAdminLoggedIn = enabled;
  managementSection.style.display = enabled ? "block" : "none";
  const table = document.getElementById("usersTable");
  if (table) table.style.display = enabled ? "table" : "none";
  adminStatus.textContent = message;
}

async function api(path, { method = "GET", body } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = {};
  let payload = body;
  if (body && !isFormData) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(path, { method, headers, body: payload, credentials: "include" });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text();
  return { ok: res.ok, status: res.status, data };
}

function toDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function formatDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function salaryText(v) {
  return v === null || v === undefined || v === "" ? "-" : String(v);
}

async function loadUsersTable() {
  if (!isAdminLoggedIn) return;
  const resp = await api("/api/admin/users?page=1&limit=100");
  if (!resp.ok) {
    show({ listUsers: resp });
    return;
  }

  const items = resp?.data?.items || [];
  usersTableBody.innerHTML = "";

  items.forEach((user) => {
    const tr = document.createElement("tr");
    const roleText = user.role ? String(user.role) : "-";

    tr.innerHTML = `
      <td>${user.id || "-"}</td>
      <td>${user.profilePic ? `<img src="${user.profilePic}" alt="pic" class="avatarThumb" />` : "-"}</td>
      <td>${user.name || "-"}</td>
      <td>${user.email || "-"}</td>
      <td>${roleText}</td>
      <td>${toDate(user.dob)}</td>
      <td>${salaryText(user.monthlySalary)}</td>
      <td>${user.isLoggedIn ? "Yes" : "No"}</td>
      <td>${formatDateTime(user.lastLoginAt)}</td>
      <td>${formatDateTime(user.createdAt)}</td>
      <td>${formatDateTime(user.updatedAt)}</td>
      <td class="row wrap"></td>
    `;

    const actionCell = tr.querySelector("td:last-child");

    const promoteBtn = document.createElement("button");
    promoteBtn.type = "button";
    promoteBtn.className = "secondary";
    promoteBtn.textContent = "Promote";
    promoteBtn.addEventListener("click", async () => {
      const promoteResp = await api(`/api/admin/users/${user.id}/promote-manager`, { method: "PATCH" });
      show({ promote: promoteResp });
      await loadUsersTable();
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "secondary";
    editBtn.textContent = "Quick Edit";
    editBtn.addEventListener("click", async () => {
      const newName = window.prompt("Enter new name", user.name || "");
      if (newName === null) return;
      const dobDefault = user.dob ? new Date(user.dob).toISOString().slice(0, 10) : "";
      const newDob = window.prompt("Enter DOB (yyyy-mm-dd, blank to clear)", dobDefault);
      if (newDob === null) return;
      const newSalary = window.prompt(
        "Enter new salary (blank to clear)",
        user.monthlySalary === null || user.monthlySalary === undefined ? "" : String(user.monthlySalary)
      );
      if (newSalary === null) return;
      const payload = {
        name: newName.trim(),
        dob: newDob.trim(),
        monthlySalary: newSalary.trim(),
      };
      const updateResp = await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: payload });
      show({ update: updateResp });
      await loadUsersTable();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      const ok = window.confirm(`Delete user ${user.email}?`);
      if (!ok) return;
      const delResp = await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
      show({ delete: delResp });
      await loadUsersTable();
    });

    actionCell.appendChild(promoteBtn);
    actionCell.appendChild(editBtn);
    actionCell.appendChild(deleteBtn);
    usersTableBody.appendChild(tr);
  });
}

document.getElementById("createUserForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdminLoggedIn) return show({ message: "Please login as admin first." });
  const fd = new FormData(e.currentTarget);
  const resp = await api("/api/admin/users", { method: "POST", body: fd });
  show({ createUser: resp });
  if (resp.ok) await loadUsersTable();
});

document.getElementById("searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdminLoggedIn) return show({ message: "Please login as admin first." });
  const fd = new FormData(e.currentTarget);
  const path = `/api/admin/users?search=${encodeURIComponent(fd.get("search") || "")}&page=${encodeURIComponent(fd.get("page") || "1")}&limit=${encodeURIComponent(fd.get("limit") || "10")}`;
  const resp = await api(path);
  show({ listUsers: resp });
  if (resp.ok && Array.isArray(resp?.data?.items)) {
    usersTableBody.innerHTML = "";
    resp.data.items.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.id || "-"}</td>
        <td>${u.profilePic ? `<img src="${u.profilePic}" alt="pic" class="avatarThumb" />` : "-"}</td>
        <td>${u.name || "-"}</td>
        <td>${u.email || "-"}</td>
        <td>${u.role ? String(u.role) : "-"}</td>
        <td>${toDate(u.dob)}</td>
        <td>${salaryText(u.monthlySalary)}</td>
        <td>${u.isLoggedIn ? "Yes" : "No"}</td>
        <td>${formatDateTime(u.lastLoginAt)}</td>
        <td>${formatDateTime(u.createdAt)}</td>
        <td>${formatDateTime(u.updatedAt)}</td>
        <td>-</td>
      `;
      usersTableBody.appendChild(tr);
    });
  }
});

document.getElementById("getByIdForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdminLoggedIn) return show({ message: "Please login as admin first." });
  const fd = new FormData(e.currentTarget);
  const resp = await api(`/api/admin/users/${(fd.get("id") || "").toString().trim()}`);
  show({ getUser: resp });
});

document.getElementById("promoteForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdminLoggedIn) return show({ message: "Please login as admin first." });
  const fd = new FormData(e.currentTarget);
  const id = (fd.get("id") || "").toString().trim();
  const resp = await api(`/api/admin/users/${id}/promote-manager`, { method: "PATCH" });
  show({ promote: resp });
  if (resp.ok) await loadUsersTable();
});

document.getElementById("updateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdminLoggedIn) return show({ message: "Please login as admin first." });
  const fd = new FormData(e.currentTarget);
  const id = (fd.get("id") || "").toString().trim();
  fd.delete("id");
  const resp = await api(`/api/admin/users/${id}`, { method: "PATCH", body: fd });
  show({ update: resp });
  if (resp.ok) await loadUsersTable();
});

document.getElementById("deleteForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdminLoggedIn) return show({ message: "Please login as admin first." });
  const fd = new FormData(e.currentTarget);
  const id = (fd.get("id") || "").toString().trim();
  const resp = await api(`/api/admin/users/${id}`, { method: "DELETE" });
  show({ delete: resp });
  if (resp.ok) await loadUsersTable();
});

document.getElementById("refreshUsersBtn").addEventListener("click", async () => {
  await loadUsersTable();
});

setAdminUiState(false, "Not logged in.");
show({ ready: true, note: "Admin panel is enabled only for an active admin session." });

(async () => {
  const meResp = await api("/api/auth/me");
  const role = String(meResp?.data?.user?.role || "").toLowerCase();
  if (meResp.ok && role === "admin") {
    setAdminUiState(true, `Admin session restored: ${meResp.data.user.email}`);
    await loadUsersTable();
    return;
  }
  setAdminUiState(
    false,
    "Access denied. Login from /ui with an admin account, then return to this page."
  );
})();

