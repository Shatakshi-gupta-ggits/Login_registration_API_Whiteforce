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

  const email = `hash_test_${Date.now()}@example.com`;
  const u = new User({
    name: "Hash Test",
    email,
    password: "Admin@123",
    role: "employee",
    salary: 0,
    isLoggedIn: false,
    lastLoginAt: null,
  });
  await u.save();

  const saved = await User.findOne({ email }).exec();
  if (!saved) throw new Error("Test user not saved");

  const pass = String(saved.password || "");
  console.log("stored prefix:", pass.slice(0, 3));
  console.log("stored length:", pass.length);
  console.log("startsWith $2:", pass.startsWith("$2"));

  // Cleanup
  await User.findByIdAndDelete(saved._id).exec();
  await db.mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("test-password-hashing failed:", err.message || err);
    try {
      await db.mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });

