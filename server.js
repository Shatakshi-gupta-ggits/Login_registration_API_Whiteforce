const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

require("dotenv").config();

const dbConfig = require("./app/config/db.config");

const app = express();

const allowedClientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: allowedClientOrigin,
    credentials: true,
  })
);
app.use(helmet());
/* for Angular Client (withCredentials) */
// app.use(
//   cors({
//     credentials: true,
//     origin: ["http://localhost:8081"],
//   })
// );

// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

app.use(
  cookieSession({
    name: "bezkoder-session",
    keys: [process.env.COOKIE_SECRET || "dev-cookie-secret"],
    httpOnly: true,
  })
);

const db = require("./app/models");
const Role = db.role;

db.mongoose.set('strictQuery', false);

const mongoUri = process.env.MONGO_URI || dbConfig.URI ||
  `mongodb+srv://${dbConfig.USER}:${dbConfig.PASSWORD}@${dbConfig.HOST}/?appName=Cluster0`;

console.log('Connecting to MongoDB URI:', mongoUri.replace(/:\/\/[^@]+@/, '://***:***@'));

db.mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log("Successfully connect to MongoDB.");
    initial();
  })
  .catch(err => {
    console.error("Connection error", err);
    // process.exit();
  });

// simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to bezkoder application." });
});

// minimal frontend (served from same origin)
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.get("/ui", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// routes
require("./app/routes/auth.routes")(app);
require("./app/routes/user.routes")(app);
require("./app/routes/admin.routes")(app);

// Multer upload errors -> client-friendly JSON
// (e.g. invalid mimetype, LIMIT_FILE_SIZE)
app.use((err, _req, res, _next) => {
  const msg = err?.message || "Upload failed.";
  const isMulter =
    err?.code === "LIMIT_FILE_SIZE" ||
    err?.name === "MulterError" ||
    /JPG|PNG|GIF|Only/i.test(msg);

  if (isMulter) {
    return res.status(400).send({ message: msg });
  }

  // Fallback for other errors
  return res.status(500).send({ message: msg });
});

// set port, listen for requests
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

function initial() {
  const requiredRoles = ["employee", "manager", "admin"];
  requiredRoles.forEach(async (roleName) => {
    try {
      const exists = await Role.findOne({ name: roleName }).exec();
      if (!exists) {
        await new Role({ name: roleName }).save();
        console.log(`added '${roleName}' to roles collection`);
      }
    } catch (err) {
      console.log("error", err);
    }
  });
}
