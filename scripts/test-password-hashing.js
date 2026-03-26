require("dotenv").config();

const db = require("../app/models");
const dbConfig = require("../app/config/db.config");

const User = db.user;
const bcrypt = require("bcryptjs");

async function main() {
  // Inject a temporary pre-save hook to confirm middleware is running.
  // This only affects this test document.
  User.schema.pre("save", function (next) {
    this.name = `${this.name} [hooked]`;
    next();
  });

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
  console.log("u.password before save prefix:", String(u.password).slice(0, 3));
  await u.save();
  console.log("u.password after save prefix:", String(u.password).slice(0, 3));
  console.log("u.name after save:", String(u.name));

  const saved = await User.findOne({ email }).exec();
  if (!saved) throw new Error("Test user not saved");

  const pass = String(saved.password || "");
  console.log("stored prefix:", pass.slice(0, 3));
  console.log("stored length:", pass.length);
  console.log("startsWith $2:", pass.startsWith("$2"));

  // Now save a user with an already-hashed password to verify schema/save behavior.
  const email2 = `hash_test_hashed_${Date.now()}@example.com`;
  const hashedPass = await bcrypt.hash("Admin@123", 8);
  const u2 = new User({
    name: "Hash Test 2",
    email: email2,
    password: hashedPass,
    role: "employee",
    salary: 0,
    isLoggedIn: false,
    lastLoginAt: null,
  });
  await u2.save();

  const saved2 = await User.findOne({ email: email2 }).exec();
  const pass2 = String(saved2?.password || "");
  console.log("manual-hashed stored prefix:", pass2.slice(0, 3));
  console.log("manual-hashed startsWith $2:", pass2.startsWith("$2"));

  // Cleanup
  await User.findByIdAndDelete(saved._id).exec();
  if (saved2?._id) await User.findByIdAndDelete(saved2._id).exec();
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

