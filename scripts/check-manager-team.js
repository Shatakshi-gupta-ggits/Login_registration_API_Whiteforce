const fetch = (...args) =>
  import("node-fetch").then(({ default: fetchFn }) => fetchFn(...args));

async function main() {
  // Adjust if your backend port differs.
  const BASE = "http://localhost:3004";

  // 1) Login as manager to get access token
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "manager@example.com", password: "Manager@123" }),
  });
  const loginData = await loginRes.json().catch(() => null);
  console.log("login status:", loginRes.status);
  console.log("login data keys:", loginData ? Object.keys(loginData) : null);

  const token = loginData?.token || loginData?.accessToken;
  if (!token) {
    console.log("No token. Login response:", loginData);
    return;
  }

  // 2) Call manager team endpoint
  const teamRes = await fetch(`${BASE}/api/manager/team`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const teamData = await teamRes.json().catch(() => null);
  console.log("team status:", teamRes.status);
  console.log("team response:", JSON.stringify(teamData, null, 2));
}

main().catch((e) => {
  console.error("check-manager-team failed:", e);
  process.exit(1);
});

