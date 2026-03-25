const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadsDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const extMap = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
    };

    const safeExt = extMap[file.mimetype] || path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/gif"]);
  if (!file.mimetype || !allowedTypes.has(file.mimetype)) {
    cb(new Error("Only JPG, PNG, and GIF images are allowed."), false);
    return;
  }
  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

