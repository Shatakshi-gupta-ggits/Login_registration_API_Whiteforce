require("dotenv").config();

const bcrypt = require("bcryptjs");
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

  const admin = await User.findOne({ email: "admin@example.com" }).exec();
  if (!admin) throw new Error("admin@example.com not found");

  const pass = String(admin.password || "");
  console.log("stored password prefix:", pass.slice(0, 3));
  console.log("stored password length:", pass.length);
  console.log("startsWith $2:", pass.startsWith("$2"));

  const ok = bcrypt.compareSync("Admin@123", admin.password);
  console.log("bcrypt compare Admin@123 =>", ok);

  await db.mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("inspect-admin-password failed:", err.message || err);
    try {
      await db.mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });

