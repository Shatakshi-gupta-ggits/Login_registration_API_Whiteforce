require("dotenv").config();

const db = require("../app/models");
const dbConfig = require("../app/config/db.config");

async function main() {
  const mongoUri =
    process.env.MONGO_URI ||
    dbConfig.URI ||
    `mongodb+srv://${dbConfig.USER}:${dbConfig.PASSWORD}@${dbConfig.HOST}/?appName=Cluster0`;

  await db.mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Ensure indexes for the manager->employees hierarchy are created.
  // This makes managerTeam queries fast and consistent.
  await db.user.ensureIndexes();
  console.log("User indexes ensured.");

  await db.mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("ensure-user-indexes failed:", err.message || err);
    try {
      await db.mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });

