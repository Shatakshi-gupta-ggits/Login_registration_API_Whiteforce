require("dotenv").config();

const db = require("../app/models");
const dbConfig = require("../app/config/db.config");

const User = db.user;

async function main() {
  const mongoUri =
    process.env.MONGO_URI ||
    dbConfig.URI ||
    `mongodb+srv://${dbConfig.USER}:${dbConfig.PASSWORD}@${dbConfig.HOST}/?appName=Cluster0`;

  await db.mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const managers = await User.find({ role: "manager" }).exec();
  const employees = await User.find({ role: "employee" }).exec();

  console.log(`Managers count: ${managers.length}`);
  for (const m of managers) {
    const count = employees.filter((e) => String(e.managerId || "") === String(m._id)).length;
    console.log(`- ${m.email} (${m._id}) -> employees: ${count}`);
  }

  const unassigned = employees.filter((e) => !e.managerId).length;
  console.log(`Employees total: ${employees.length}`);
  console.log(`Unassigned employees: ${unassigned}`);

  // Print a few employees with their managerId values
  const sample = employees.slice(0, 10).map((e) => ({
    id: String(e._id),
    email: e.email,
    managerId: e.managerId ? String(e.managerId) : null,
  }));
  console.log("Employee sample:", JSON.stringify(sample, null, 2));

  await db.mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("inspect-hierarchy failed:", err.message || err);
  try {
    await db.mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

