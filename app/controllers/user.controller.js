const db = require("../models");
const User = db.user;

const sanitizeUser = (userDoc) => ({
  id: userDoc._id,
  name: userDoc.name,
  email: userDoc.email,
  dob: userDoc.dob,
  profilePic: userDoc.profilePic,
  salary: userDoc.salary,
  monthlySalary: userDoc.monthlySalary, // backward compatibility
  role: userDoc.role,
  isLoggedIn: userDoc.isLoggedIn,
  lastLoginAt: userDoc.lastLoginAt,
  createdAt: userDoc.createdAt,
  updatedAt: userDoc.updatedAt,
});

const parseDob = (value) => {
  if (value === null || value === undefined) return undefined;
  if (value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
};

exports.allAccess = (req, res) => {
  res.status(200).send("Public Content.");
};

exports.userBoard = (req, res) => {
  res.status(200).send("Employee/Authenticated Content.");
};

exports.adminBoard = (req, res) => {
  res.status(200).send("Admin Content.");
};

exports.managerBoard = (req, res) => {
  res.status(200).send("Manager Content.");
};

exports.managerTeam = async (req, res) => {
  try {
    const managerId = req.userId;

    // Enforce hierarchy strictly: a manager can only see employees whose managerId matches them.
    const mongoose = require("mongoose");
    const managerObjectId = managerId ? new mongoose.Types.ObjectId(managerId) : null;

    const employees = await User.find({
      role: "employee",
      managerId: managerObjectId,
    })
      .select({ name: 1, email: 1, dob: 1, profilePic: 1 })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const sanitized = employees.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      dob: u.dob,
      profilePic: u.profilePic,
    }));

    return res.status(200).send({ items: sanitized });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Failed to load manager team." });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).send({ message: "User not found." });

    // Role/salary updates must use separate admin endpoints.
    const body = req.body || {};
    if (Object.prototype.hasOwnProperty.call(body, "role") || Object.prototype.hasOwnProperty.call(body, "salary") || Object.prototype.hasOwnProperty.call(body, "monthlySalary")) {
      return res.status(400).send({ message: "role and salary cannot be updated here." });
    }

    if (Object.prototype.hasOwnProperty.call(body, "password")) {
      return res.status(400).send({ message: "Password cannot be changed here." });
    }

    const { name, dob, email } = body;

    if (name !== undefined) user.name = String(name).trim();

    if (dob !== undefined) {
      const parsed = parseDob(dob);
      if (parsed === undefined) return res.status(400).send({ message: "Invalid DOB format." });
      user.dob = parsed;
    }

    if (req.file) {
      user.profilePic = `/uploads/${req.file.filename}`;
    }

    if (email !== undefined) {
      const nextEmail = String(email).trim().toLowerCase();
      const exists = await User.findOne({ email: nextEmail, _id: { $ne: userId } }).exec();
      if (exists) return res.status(400).send({ message: "Email is already in use." });
      user.email = nextEmail;
    }

    await user.save();
    return res.status(200).send({ user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Profile update failed." });
  }
};

exports.changePasswordMe = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).send({ message: "User not found." });

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).send({ message: "currentPassword and newPassword are required." });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).send({ message: "Password must be at least 6 characters." });
    }

    const bcrypt = require("bcryptjs");
    const ok = bcrypt.compareSync(currentPassword, user.password);
    if (!ok) return res.status(401).send({ message: "Current password is incorrect." });

    user.password = String(newPassword);
    await user.save(); // hashes via pre-save hook

    return res.status(200).send({ message: "Password updated successfully." });
  } catch (err) {
    return res.status(500).send({ message: err.message || "Password update failed." });
  }
};
