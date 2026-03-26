const db = require("../models");
const User = db.user;

const toUserDTO = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  profilePic: user.profilePic,
  dob: user.dob,
  salary: user.salary,
  monthlySalary: user.monthlySalary, // backward compatibility
  role: user.role,
  managerId: user.managerId ? user.managerId.toString() : null,
  isLoggedIn: user.isLoggedIn,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const ALLOWED_ROLES = ["admin", "manager", "employee"];

exports.createUserByAdmin = async (req, res) => {
  try {
    const { name, email, password, dob, salary, monthlySalary, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).send({ message: "name, email and password are required." });
    }

    const existing = await User.findOne({ email: String(email).trim().toLowerCase() }).exec();
    if (existing) {
      return res.status(400).send({ message: "Email is already in use." });
    }

    const roleName = String(role || "employee").trim().toLowerCase();
    const allowed = ["employee", "manager", "admin"];
    if (!allowed.includes(roleName)) {
      return res.status(400).send({ message: `Role ${roleName} does not exist.` });
    }

    const parsedDob = dob ? new Date(dob) : null;
    if (dob && Number.isNaN(parsedDob.getTime())) {
      return res.status(400).send({ message: "Invalid DOB format." });
    }

    const salaryInput = salary === undefined ? monthlySalary : salary;
    const salaryValue =
      salaryInput === undefined || salaryInput === null || salaryInput === ""
        ? null
        : Number(salaryInput);
    if (salaryValue !== null && (Number.isNaN(salaryValue) || salaryValue < 0)) {
      return res.status(400).send({ message: "salary must be non-negative." });
    }

    const user = new User({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      // password will be hashed by the model pre-save hook
      password,
      profilePic: req.file ? `/uploads/${req.file.filename}` : null,
      dob: parsedDob,
      salary: salaryValue === null ? 0 : salaryValue,
      role: roleName,
      isLoggedIn: false,
    });
    await user.save();

    const created = await User.findById(user._id).exec();
    return res.status(201).send({
      message: "User created successfully.",
      user: toUserDTO(created),
    });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Failed to create user." });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "10", 10)));
    const search = (req.query.search || "").trim();
    const roleFilter = (req.query.role || "").toString().trim().toLowerCase();

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (roleFilter) {
      if (!ALLOWED_ROLES.includes(roleFilter)) {
        return res.status(400).send({ message: "Invalid role filter." });
      }
      filter.role = roleFilter;
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      User.countDocuments(filter),
    ]);

    return res.status(200).send({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items: items.map(toUserDTO),
    });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Failed to list users." });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).exec();
    if (!user) {
      return res.status(404).send({ message: "User not found." });
    }
    return res.status(200).send({ user: toUserDTO(user) });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Failed to get user." });
  }
};

exports.promoteToManager = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(404).send({ message: "User not found." });
    }

    if (String(user.role || "").toLowerCase() === "admin") {
      return res.status(400).send({ message: "Admin users cannot be promoted to manager." });
    }

    user.role = "manager";
    await user.save();

    const updated = await User.findById(userId).exec();
    return res.status(200).send({
      message: "User promoted to manager.",
      user: toUserDTO(updated),
    });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Promotion failed." });
  }
};

exports.updateUserByAdmin = async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, dob, salary, monthlySalary } = req.body;

    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(404).send({ message: "User not found." });
    }

    // Admin is not allowed to change email/password via this endpoint.
    if (Object.prototype.hasOwnProperty.call(req.body, "email")) {
      return res.status(400).send({ message: "Email cannot be changed from this endpoint." });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "password")) {
      return res.status(400).send({ message: "Password cannot be changed from this endpoint." });
    }

    if (name !== undefined) user.name = String(name).trim();
    if (dob !== undefined) {
      if (!dob) user.dob = null;
      else {
        const parsed = new Date(dob);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).send({ message: "Invalid DOB format." });
        }
        user.dob = parsed;
      }
    }
    const salaryInput = salary === undefined ? monthlySalary : salary;
    if (salaryInput !== undefined) {
      if (salaryInput === "" || salaryInput === null) {
        user.salary = 0;
      } else {
        const salaryValue = Number(salaryInput);
        if (Number.isNaN(salaryValue) || salaryValue < 0) {
          return res.status(400).send({ message: "salary must be non-negative." });
        }
        user.salary = salaryValue;
      }
    }
    if (req.file) {
      user.profilePic = `/uploads/${req.file.filename}`;
    }

    await user.save();
    const updated = await User.findById(userId).exec();
    return res.status(200).send({
      message: "User updated successfully.",
      user: toUserDTO(updated),
    });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Update failed." });
  }
};

exports.deleteUserByAdmin = async (req, res) => {
  try {
    const userId = req.params.id;
    if (String(req.userId) === String(userId)) {
      return res.status(400).send({ message: "You cannot delete your own admin account." });
    }

    const target = await User.findById(userId).exec();
    if (!target) {
      return res.status(404).send({ message: "User not found." });
    }
    if (String(target.role || "").toLowerCase() === "admin") {
      return res.status(400).send({ message: "Admin accounts cannot be deleted from this endpoint." });
    }

    const deleted = await User.findByIdAndDelete(userId).exec();
    if (!deleted) {
      return res.status(404).send({ message: "User not found." });
    }

    return res.status(200).send({ message: "User deleted successfully." });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Delete failed." });
  }
};

exports.updateUserRoleByAdmin = async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body || {};
    const nextRole = String(role || "").trim().toLowerCase();

    if (!nextRole) {
      return res.status(400).send({ message: "role is required." });
    }
    if (!ALLOWED_ROLES.includes(nextRole)) {
      return res.status(400).send({ message: "Invalid role value." });
    }

    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).send({ message: "User not found." });

    user.role = nextRole;
    await user.save();

    const updated = await User.findById(userId).exec();
    return res.status(200).send({ user: toUserDTO(updated) });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Update role failed." });
  }
};

exports.updateUserSalaryByAdmin = async (req, res) => {
  try {
    const userId = req.params.id;
    const { salary, monthlySalary } = req.body || {};
    const salaryInput = salary === undefined ? monthlySalary : salary;

    if (salaryInput === undefined) {
      return res.status(400).send({ message: "salary is required." });
    }

    const salaryValue = salaryInput === "" || salaryInput === null ? 0 : Number(salaryInput);
    if (Number.isNaN(salaryValue) || salaryValue < 0) {
      return res.status(400).send({ message: "salary must be non-negative." });
    }

    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).send({ message: "User not found." });

    user.salary = salaryValue;
    await user.save();

    const updated = await User.findById(userId).exec();
    return res.status(200).send({ user: toUserDTO(updated) });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Update salary failed." });
  }
};

exports.assignManagerByAdmin = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    let { managerId } = req.body || {};
    managerId = managerId === "" || managerId === undefined ? null : String(managerId);

    const target = await User.findById(targetUserId).exec();
    if (!target) return res.status(404).send({ message: "User not found." });

    // Only employees can be assigned under a manager.
    if (String(target.role || "").toLowerCase() !== "employee") {
      return res.status(400).send({ message: "Only employees can be assigned a manager." });
    }

    if (!managerId) {
      target.managerId = null;
      await target.save();
      const updated = await User.findById(targetUserId).exec();
      return res.status(200).send({ user: toUserDTO(updated) });
    }

    const manager = await User.findById(managerId).exec();
    if (!manager) return res.status(404).send({ message: "Manager user not found." });
    if (String(manager.role || "").toLowerCase() !== "manager") {
      return res.status(400).send({ message: "Selected user is not a manager." });
    }

    target.managerId = manager._id;
    await target.save();

    const updated = await User.findById(targetUserId).exec();
    return res.status(200).send({ user: toUserDTO(updated) });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Assign manager failed." });
  }
};

exports.updateUserDetailsByAdmin = async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, dob } = req.body || {};

    // Ensure role and salary cannot be updated here.
    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, "role") ||
      Object.prototype.hasOwnProperty.call(req.body || {}, "salary") ||
      Object.prototype.hasOwnProperty.call(req.body || {}, "monthlySalary")
    ) {
      return res.status(400).send({ message: "role and salary cannot be updated here." });
    }

    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).send({ message: "User not found." });

    if (name !== undefined) user.name = String(name).trim();

    if (email !== undefined) {
      const nextEmail = String(email).trim().toLowerCase();
      const exists = await User.findOne({ email: nextEmail, _id: { $ne: userId } }).exec();
      if (exists) return res.status(400).send({ message: "Email is already in use." });
      user.email = nextEmail;
    }

    if (dob !== undefined) {
      if (!dob) user.dob = null;
      else {
        const parsed = new Date(dob);
        if (Number.isNaN(parsed.getTime())) return res.status(400).send({ message: "Invalid DOB format." });
        user.dob = parsed;
      }
    }

    if (req.file) {
      user.profilePic = `/uploads/${req.file.filename}`;
    }

    await user.save();
    const updated = await User.findById(userId).exec();
    return res.status(200).send({ user: toUserDTO(updated) });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Update user failed." });
  }
};

