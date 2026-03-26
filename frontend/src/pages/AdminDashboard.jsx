import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../api/backendBase.js";
import { createAdminService } from "../api/services/adminService.js";
import { createProfileService } from "../api/services/profileService.js";

function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("users");

  const adminApi = useMemo(() => createAdminService(BACKEND_URL), []);
  const profileApi = useMemo(() => createProfileService(BACKEND_URL), []);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [toasts, setToasts] = useState([]);
  const navigate = useNavigate();

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("limit", String(limit));
    if (search) qs.set("search", search);
    if (roleFilter) qs.set("role", roleFilter);
    return qs.toString();
  }, [search, roleFilter, page, limit]);

  const roleOptions = useMemo(() => ["admin", "manager", "employee"], []);

  function pushToast(type, message) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }

  const [analytics, setAnalytics] = useState({
    totalUsers: 0,
    byRole: { admin: 0, manager: 0, employee: 0 },
    totalSalaryExpense: 0,
    recentRegistrations: 0,
    loading: false,
    error: null,
  });

  async function fetchAnalytics() {
    setAnalytics((a) => ({ ...a, loading: true, error: null }));
    try {
      const data = await adminApi.getUsers({ page: 1, limit: 1000 });
      const allUsers = data?.items || [];

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);

      let totalSalaryExpense = 0;
      const byRole = { admin: 0, manager: 0, employee: 0 };
      let recentRegistrations = 0;

      allUsers.forEach((u) => {
        const r = String(u.role || "employee").toLowerCase();
        if (byRole[r] !== undefined) byRole[r] += 1;
        totalSalaryExpense += Number(u.salary ?? 0) || 0;
        if (u.createdAt) {
          const created = new Date(u.createdAt);
          if (!Number.isNaN(created.getTime()) && created >= cutoff) recentRegistrations += 1;
        }
      });

      setAnalytics({
        totalUsers: allUsers.length,
        byRole,
        totalSalaryExpense,
        recentRegistrations,
        loading: false,
        error: null,
      });
    } catch (e) {
      setAnalytics((a) => ({ ...a, loading: false, error: e.message || "Analytics error" }));
      pushToast("error", e.message || "Failed to load analytics");
    }
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        if (!mounted) return;

        const data = await adminApi.getUsers({
          page,
          limit,
          search,
          role: roleFilter,
        });
        setUsers(data?.items || []);
        setTotalPages(data?.totalPages || 1);
        setTotalCount(data?.total || 0);
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Failed to load users.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [adminApi, page, limit, search, roleFilter]);

  useEffect(() => {
    if (!token) return;
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  // Modals state
  const [roleModal, setRoleModal] = useState({ open: false, userId: "", role: "employee" });
  const [salaryModal, setSalaryModal] = useState({ open: false, userId: "", salary: "" });
  const [detailsModal, setDetailsModal] = useState({
    open: false,
    userId: "",
    name: "",
    email: "",
    dob: "",
    profilePic: null,
  });
  const [assignManagerModal, setAssignManagerModal] = useState({
    open: false,
    employeeId: "",
    managerId: "",
  });
  const [managerOptions, setManagerOptions] = useState([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [newUserModalOpen, setNewUserModalOpen] = useState(false);

  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
    salary: 0,
    dob: "",
    profilePic: null,
  });

  // Profile tab state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    profilePic: null,
  });
  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
  });

  useEffect(() => {
    setProfileForm((p) => ({ ...p, name: user?.name || "", email: user?.email || "" }));
  }, [user]);

  async function apiPut(url, body, extraHeaders) {
    const fullUrl = url.startsWith("http") ? url : `${BACKEND_URL}${url}`;
    const res = await fetch(fullUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(extraHeaders || {}),
      },
      credentials: "include",
      body,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || "Request failed.");
    return data;
  }

  async function apiPost(url, body) {
    const fullUrl = url.startsWith("http") ? url : `${BACKEND_URL}${url}`;
    const res = await fetch(fullUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      body,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || "Request failed.");
    return data;
  }

  async function loadUsersAgain() {
    setLoading(true);
    try {
      const data = await adminApi.getUsers({
        page,
        limit,
        search,
        role: roleFilter,
      });
      setUsers(data?.items || []);
      setTotalPages(data?.totalPages || 1);
      setTotalCount(data?.total || 0);
      setError(null);
    } catch (e) {
      setError(e.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  async function openAssignManagerModal(employee) {
    setLoadingManagers(true);
    setManagerOptions([]);
    try {
      const mgrRes = await adminApi.getUsers({ page: 1, limit: 1000, role: "manager" });
      const managers = mgrRes?.items || [];
      setManagerOptions(managers);
      setAssignManagerModal({
        open: true,
        employeeId: employee?.id || "",
        managerId: employee?.managerId ? String(employee.managerId) : "",
      });
    } catch (e) {
      setError(e.message || "Failed to load managers.");
    } finally {
      setLoadingManagers(false);
    }
  }

  async function onDeleteUser(userId) {
    const ok = window.confirm("Delete this user?");
    if (!ok) return;
    try {
      await adminApi.deleteUser(userId);
      pushToast("success", "User deleted");
      await loadUsersAgain();
    } catch (e) {
      pushToast("error", e.message || "Delete failed");
    }
  }

  function closeRoleModal() {
    setRoleModal({ open: false, userId: "", role: "employee" });
  }

  function closeSalaryModal() {
    setSalaryModal({ open: false, userId: "", salary: "" });
  }

  function closeDetailsModal() {
    setDetailsModal({ open: false, userId: "", name: "", email: "", dob: "", profilePic: null });
  }

  function closeAssignManagerModal() {
    setAssignManagerModal({ open: false, employeeId: "", managerId: "" });
  }

  function renderModalBase({ open, title, children, onClose }) {
    if (!open) return null;
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          zIndex: 9999,
        }}
      >
        <div style={{ width: "100%", maxWidth: 520, background: "#fff", color: "#000", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>{title}</h3>
            <button type="button" className="secondary" onClick={onClose}>
              Close
            </button>
          </div>
          <div style={{ marginTop: 12 }}>{children}</div>
        </div>
      </div>
    );
  }

  // Small reusable color badge
  function RoleBadge({ role }) {
    const r = String(role || "").toLowerCase();
    const color =
      r === "admin" ? "#b91c1c" : r === "manager" ? "#0f766e" : "#1d4ed8";
    const bg =
      r === "admin" ? "rgba(185,28,28,0.12)" : r === "manager" ? "rgba(15,118,110,0.12)" : "rgba(29,78,216,0.12)";
    return (
      <span
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          background: bg,
          color,
          fontWeight: 600,
          display: "inline-block",
          minWidth: 92,
          textAlign: "center",
        }}
      >
        {r || "-"}
      </span>
    );
  }

  return (
    <div style={{ maxWidth: 1150, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Welcome, {user?.name}</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className={activeTab === "users" ? "secondary" : ""}
            onClick={() => setActiveTab("users")}
          >
            User Management
          </button>
          <button
            type="button"
            className={activeTab === "salary" ? "secondary" : ""}
            onClick={() => setActiveTab("salary")}
          >
            Salary Management
          </button>
          <button
            type="button"
            className={activeTab === "profile" ? "secondary" : ""}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </button>
          <button className="secondary" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </div>

      {/* Analytics cards */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px", border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <div style={{ color: "#666", fontSize: 13 }}>Total Users</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{analytics.totalUsers}</div>
        </div>
        <div style={{ flex: "1 1 220px", border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <div style={{ color: "#666", fontSize: 13 }}>Users by Role</div>
          <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
            <div>Admin: {analytics.byRole.admin}</div>
            <div>Manager: {analytics.byRole.manager}</div>
            <div>Employee: {analytics.byRole.employee}</div>
          </div>
        </div>
        <div style={{ flex: "1 1 220px", border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <div style={{ color: "#666", fontSize: 13 }}>Total Salary Expense</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{analytics.totalSalaryExpense}</div>
        </div>
        <div style={{ flex: "1 1 220px", border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <div style={{ color: "#666", fontSize: 13 }}>Recent Registrations (7 days)</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{analytics.recentRegistrations}</div>
        </div>
      </div>

      {/* Toasts */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 99999, display: "grid", gap: 10 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.type === "error" ? "rgba(220,38,38,0.95)" : "rgba(16,185,129,0.95)",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: 12,
              boxShadow: "0 6px 22px rgba(0,0,0,0.25)",
              maxWidth: 340,
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* User Management tab */}
      {activeTab === "users" ? (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>User Management</h3>
            <button type="button" className="secondary" onClick={() => setNewUserModalOpen(true)}>
              Add New User
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name/email"
              style={{ padding: 10, flex: "1 1 260px" }}
            />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              style={{ padding: 10 }}
            >
              <option value="">All</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
            </select>
            <select
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              style={{ padding: 10 }}
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
            </select>
          </div>

          <div style={{ marginTop: 14, overflowX: "auto" }}>
            {error ? <div style={{ color: "crimson" }}>{error}</div> : null}
            {loading ? <p>Loading...</p> : null}
            {!loading && !error ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Profile</th>
                    <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Name</th>
                    <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Email</th>
                    <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Current Role</th>
                    <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Current Salary</th>
                    <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>DOB</th>
                    <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                        {u.profilePic ? (
                          <img
                            src={u.profilePic}
                            alt="profile"
                            style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", border: "1px solid #ddd" }}
                          />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>{u.name}</td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>{u.email}</td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                        <RoleBadge role={u.role} />
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>{u.salary ?? 0}</td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>{formatDate(u.dob)}</td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setRoleModal({ open: true, userId: u.id, role: u.role || "employee" })}
                          >
                            Edit Role
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              setDetailsModal({
                                open: true,
                                userId: u.id,
                                name: u.name || "",
                                email: u.email || "",
                                dob: u.dob ? new Date(u.dob).toISOString().slice(0, 10) : "",
                                profilePic: null,
                              })
                            }
                          >
                            Edit Details
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setSalaryModal({ open: true, userId: u.id, salary: String(u.salary ?? 0) })}
                          >
                            Edit Salary
                          </button>
                          {String(u.role || "").toLowerCase() === "employee" ? (
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => openAssignManagerModal(u)}
                            >
                              Assign Manager
                            </button>
                          ) : null}
                          <button type="button" className="secondary" onClick={() => onDeleteUser(u.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 12, flexWrap: "wrap" }}>
            <div style={{ color: "#666" }}>
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> (Total: {totalCount})
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Salary Management tab */}
      {activeTab === "salary" ? (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginTop: 14 }}>
          <h3 style={{ margin: 0 }}>Salary Management</h3>
          <p style={{ color: "#666", marginTop: 8 }}>
            Update salaries using the dedicated salary endpoint.
          </p>
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            {error ? <div style={{ color: "crimson" }}>{error}</div> : null}
            {loading ? <p>Loading...</p> : null}
            {!loading && !error ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>User</th>
                    <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Role</th>
                    <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Salary</th>
                    <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                        {u.name} <div style={{ color: "#666", fontSize: 12 }}>{u.email}</div>
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                        <RoleBadge role={u.role} />
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>{u.salary ?? 0}</td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setSalaryModal({ open: true, userId: u.id, salary: String(u.salary ?? 0) })}
                        >
                          Edit Salary
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Profile tab */}
      {activeTab === "profile" ? (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginTop: 14 }}>
          <h3 style={{ margin: 0 }}>Profile</h3>
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
              <h4 style={{ marginTop: 0 }}>Update Profile</h4>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await profileApi.updateProfile({
                      name: profileForm.name,
                      email: profileForm.email,
                      profilePic: profileForm.profilePic,
                    });
                    pushToast("success", "Profile updated");
                  } catch (err) {
                    pushToast("error", err.message || "Profile update failed.");
                  }
                }}
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <label>
                    Name
                    <input value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} style={{ width: "100%", padding: 10 }} />
                  </label>
                  <label>
                    Email
                    <input value={profileForm.email} onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))} style={{ width: "100%", padding: 10 }} />
                  </label>
                  <label>
                    Profile Picture
                    <input type="file" accept="image/*" onChange={(e) => setProfileForm((p) => ({ ...p, profilePic: e.target.files?.[0] || null }))} style={{ width: "100%" }} />
                  </label>
                  <button type="submit" className="secondary">
                    Save Profile
                  </button>
                </div>
              </form>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
              <h4 style={{ marginTop: 0 }}>Change Password</h4>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await profileApi.changePassword({
                      currentPassword: pwForm.currentPassword,
                      newPassword: pwForm.newPassword,
                    });
                    pushToast("success", "Password changed");
                    setPwForm({ currentPassword: "", newPassword: "" });
                  } catch (err) {
                    pushToast("error", err.message || "Password change failed.");
                  }
                }}
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <label>
                    Current Password
                    <input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))} style={{ width: "100%", padding: 10 }} />
                  </label>
                  <label>
                    New Password
                    <input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))} style={{ width: "100%", padding: 10 }} />
                  </label>
                  <button type="submit" className="secondary">
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {/* Role modal */}
      {renderModalBase({
        open: roleModal.open,
        title: "Edit User Role",
        onClose: closeRoleModal,
        children: (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await adminApi.updateRole(roleModal.userId, roleModal.role);
                pushToast("success", "Role updated");
                closeRoleModal();
                await loadUsersAgain();
              } catch (err) {
                pushToast("error", err.message || "Failed to update role");
              }
            }}
          >
            <div style={{ display: "grid", gap: 10 }}>
              <label>
                New role
                <select value={roleModal.role} onChange={(e) => setRoleModal((m) => ({ ...m, role: e.target.value }))} style={{ width: "100%", padding: 10 }}>
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="secondary">
                Submit
              </button>
            </div>
          </form>
        ),
      })}

      {/* Salary modal */}
      {renderModalBase({
        open: salaryModal.open,
        title: "Edit User Salary",
        onClose: closeSalaryModal,
        children: (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const salaryValue = salaryModal.salary === "" ? null : Number(salaryModal.salary);
              const ok = window.confirm("Update salary?");
              if (!ok) return;
              try {
                await adminApi.updateSalary(salaryModal.userId, salaryValue);
                pushToast("success", "Salary updated");
                closeSalaryModal();
                await loadUsersAgain();
              } catch (err) {
                pushToast("error", err.message || "Failed to update salary");
              }
            }}
          >
            <div style={{ display: "grid", gap: 10 }}>
              <label>
                Salary
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={salaryModal.salary}
                  onChange={(e) => setSalaryModal((m) => ({ ...m, salary: e.target.value }))}
                  style={{ width: "100%", padding: 10 }}
                />
              </label>
              <button type="submit" className="secondary">
                Submit
              </button>
            </div>
          </form>
        ),
      })}

      {/* Details modal */}
      {renderModalBase({
        open: detailsModal.open,
        title: "Edit User Details",
        onClose: closeDetailsModal,
        children: (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const fd = new FormData();
                fd.append("name", detailsModal.name);
                fd.append("email", detailsModal.email);
                // If user cleared DOB input, send empty string so backend sets dob = null.
                fd.append("dob", detailsModal.dob || "");
                if (detailsModal.profilePic) fd.append("profilePic", detailsModal.profilePic);

                await adminApi.updateUserDetails(detailsModal.userId, fd);
                pushToast("success", "User details updated");
                closeDetailsModal();
                await loadUsersAgain();
              } catch (err) {
                pushToast("error", err.message || "Failed to update user details.");
              }
            }}
          >
            <div style={{ display: "grid", gap: 10 }}>
              <label>
                Name
                <input
                  value={detailsModal.name}
                  onChange={(e) => setDetailsModal((m) => ({ ...m, name: e.target.value }))}
                  style={{ width: "100%", padding: 10 }}
                />
              </label>
              <label>
                Email
                <input
                  value={detailsModal.email}
                  onChange={(e) => setDetailsModal((m) => ({ ...m, email: e.target.value }))}
                  style={{ width: "100%", padding: 10 }}
                />
              </label>
              <label>
                DOB
                <input
                  type="date"
                  value={detailsModal.dob}
                  onChange={(e) => setDetailsModal((m) => ({ ...m, dob: e.target.value }))}
                  style={{ width: "100%", padding: 10 }}
                />
              </label>
              <label>
                Profile Picture
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDetailsModal((m) => ({ ...m, profilePic: e.target.files?.[0] || null }))}
                  style={{ width: "100%" }}
                />
              </label>
              <button type="submit" className="secondary">
                Save Details
              </button>
            </div>
          </form>
        ),
      })}

      {/* Assign Manager modal */}
      {renderModalBase({
        open: assignManagerModal.open,
        title: "Assign Manager (Employee -> ManagerId)",
        onClose: closeAssignManagerModal,
        children: (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await adminApi.assignManager(assignManagerModal.employeeId, assignManagerModal.managerId || "");
                pushToast("success", "Manager assignment updated");
                closeAssignManagerModal();
                await loadUsersAgain();
              } catch (err) {
                pushToast("error", err.message || "Failed to assign manager.");
              }
            }}
          >
            <div style={{ display: "grid", gap: 10 }}>
              <label>
                Manager
                <select
                  value={assignManagerModal.managerId}
                  onChange={(ev) => setAssignManagerModal((m) => ({ ...m, managerId: ev.target.value }))}
                  style={{ width: "100%", padding: 10 }}
                  disabled={loadingManagers}
                >
                  <option value="">None</option>
                  {managerOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="secondary" disabled={loadingManagers}>
                Save Assignment
              </button>
            </div>
          </form>
        ),
      })}

      {/* Add new user modal */}
      {renderModalBase({
        open: newUserModalOpen,
        title: "Add New User (Admin)",
        onClose: () => setNewUserModalOpen(false),
        children: (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const fd = new FormData();
                fd.append("name", newUserForm.name);
                fd.append("email", newUserForm.email);
                fd.append("password", newUserForm.password);
                fd.append("role", newUserForm.role);
                fd.append("salary", String(newUserForm.salary ?? 0));
                if (newUserForm.dob) fd.append("dob", newUserForm.dob);
                if (newUserForm.profilePic) fd.append("profilePic", newUserForm.profilePic);

                await adminApi.createUser(fd);
                pushToast("success", "User created");
                setNewUserModalOpen(false);
                setNewUserForm({
                  name: "",
                  email: "",
                  password: "",
                  role: "employee",
                  salary: 0,
                  dob: "",
                  profilePic: null,
                });
                await loadUsersAgain();
              } catch (err) {
                pushToast("error", err.message || "User create failed");
              }
            }}
          >
            <div style={{ display: "grid", gap: 10 }}>
              <label>
                Name
                <input value={newUserForm.name} onChange={(e) => setNewUserForm((f) => ({ ...f, name: e.target.value }))} style={{ width: "100%", padding: 10 }} required />
              </label>
              <label>
                Email
                <input value={newUserForm.email} onChange={(e) => setNewUserForm((f) => ({ ...f, email: e.target.value }))} style={{ width: "100%", padding: 10 }} type="email" required />
              </label>
              <label>
                Password
                <input value={newUserForm.password} onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))} style={{ width: "100%", padding: 10 }} type="password" required />
              </label>
              <label>
                Role
                <select value={newUserForm.role} onChange={(e) => setNewUserForm((f) => ({ ...f, role: e.target.value }))} style={{ width: "100%", padding: 10 }}>
                  <option value="admin">admin</option>
                  <option value="manager">manager</option>
                  <option value="employee">employee</option>
                </select>
              </label>
              <label>
                Salary
                <input type="number" min="0" step="0.01" value={newUserForm.salary} onChange={(e) => setNewUserForm((f) => ({ ...f, salary: e.target.value }))} style={{ width: "100%", padding: 10 }} />
              </label>
              <label>
                DOB
                <input type="date" value={newUserForm.dob} onChange={(e) => setNewUserForm((f) => ({ ...f, dob: e.target.value }))} style={{ width: "100%", padding: 10 }} />
              </label>
              <label>
                Profile Pic
                <input type="file" accept="image/*" onChange={(e) => setNewUserForm((f) => ({ ...f, profilePic: e.target.files?.[0] || null }))} style={{ width: "100%" }} />
              </label>
              <button type="submit" className="secondary">
                Create User
              </button>
            </div>
          </form>
        ),
      })}
    </div>
  );
}

