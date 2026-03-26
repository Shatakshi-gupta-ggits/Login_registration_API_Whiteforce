const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    profilePic: {
      type: String,
      default: null,
    },
    dob: {
      type: Date,
      default: null,
    },
    salary: {
      type: Number,
      default: 0,
      min: 0,
    },
    role: {
      type: String,
      enum: ["employee", "manager", "admin"],
      required: true,
      default: "employee",
      trim: true,
      lowercase: true,
    },
    isLoggedIn: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    // Tree structure: employees are assigned to exactly one manager.
    // Admins sit "above" managers conceptually (via role), but the enforced hierarchy is managerId -> employees.
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Optimize hierarchy lookups: managers query employees by (role='employee', managerId=<id>).
userSchema.index({ role: 1, managerId: 1 });

// Backward compatibility: old UI/controllers used `monthlySalary`.
// Keep it as a virtual alias that maps to the canonical `salary` field.
userSchema.virtual("monthlySalary")
  .get(function () {
    return this.salary;
  })
  .set(function (v) {
    this.salary = v;
  });

// Hash password on save if it's a plain password (avoid double-hashing bcrypt hashes).
// Important: some scripts set password values that Mongoose may not mark as "modified",
// so we hash based on the value format rather than `isModified("password")`.
userSchema.pre("save", async function (next) {
  try {
    if (!this.password) return next();

    const pwd = String(this.password);
    const looksLikeBcryptHash = pwd.startsWith("$2");
    if (looksLikeBcryptHash) return next();

    const saltRounds = 8;
    this.password = await bcrypt.hash(pwd, saltRounds);
    return next();
  } catch (err) {
    return next(err);
  }
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = User;
