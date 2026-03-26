require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("../app/models");
const dbConfig = require("../app/config/db.config");

const User = db.user;
const Role = db.role;

const DEMO_USERS = [
  { name: "Admin User", email: "admin@example.com", password: "Admin@123", role: "admin" },
  { name: "Manager User", email: "manager@example.com", password: "Manager@123", role: "manager" },
  {
    name: "Employee User",
    email: "employee@example.com",
    password: "Employee@123",
    role: "employee",
  },
];

async function ensureRoles() {
  const roles = ["employee", "manager", "admin"];
  await Promise.all(
    roles.map(async (r) => {
      const exists = await Role.findOne({ name: r }).exec();
      if (!exists) await new Role({ name: r }).save();
    })
  );
}

async function upsertUser({ name, email, password, role }) {
  const normalizedEmail = String(email).trim().toLowerCase();

  let user = await User.findOne({ email: normalizedEmail }).exec();
  if (!user) {
    user = new User({
      name: String(name).trim(),
      email: normalizedEmail,
      password: String(password),
      role: String(role).trim().toLowerCase(),
      isLoggedIn: false,
    });
  } else {
    user.name = String(name).trim();
    user.role = String(role).trim().toLowerCase();
    user.password = String(password); // triggers model pre-save hook to hash
    user.isLoggedIn = false;
    // If the stored password already equals the same plaintext value,
    // Mongoose may think it's unchanged; force the pre-save hook to run.
    user.markModified("password");
  }

  await user.save();
}

async function main() {
  const mongoUri =
    process.env.MONGO_URI ||
    dbConfig.URI ||
    `mongodb+srv://${dbConfig.USER}:${dbConfig.PASSWORD}@${dbConfig.HOST}/?appName=Cluster0`;

  await db.mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  await ensureRoles();

  // Clear dashboard content: keep only demo users, remove everything else.
  const demoEmails = DEMO_USERS.map((u) => u.email.toLowerCase());
  const deleteResult = await User.deleteMany({ email: { $nin: demoEmails } });
  console.log(`Deleted users (non-demo): ${deleteResult.deletedCount}`);

  // Upsert demo users to ensure admin credentials always match.
  for (const u of DEMO_USERS) {
    await upsertUser(u);
    console.log(`Seeded demo user: ${u.email} (${u.role})`);
  }

  // Seed hierarchy:
  // - admin sits "above" (role-based access)
  // - manager can only see employees where employee.managerId === manager._id
  const admin = await User.findOne({ email: "admin@example.com" }).exec();
  const manager = await User.findOne({ email: "manager@example.com" }).exec();
  const employee = await User.findOne({ email: "employee@example.com" }).exec();

  if (!admin || !manager || !employee) throw new Error("Demo users missing after reset.");

  employee.managerId = manager._id;
  admin.managerId = null;
  manager.managerId = null;
  await Promise.all([admin.save(), manager.save(), employee.save()]);

  // Quick sanity check: bcrypt compare on stored admin password.
  const ok = bcrypt.compareSync("Admin@123", admin.password);
  if (!ok) throw new Error("Admin demo password hashing mismatch after reset.");
  console.log("Sanity check passed: admin password matches.");

  await db.mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("reset-demo-data failed:", err.message || err);
  try {
    await db.mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});

