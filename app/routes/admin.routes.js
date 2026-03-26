const { authJwt, upload } = require("../middlewares");
const controller = require("../controllers/admin.controller");

module.exports = function (app) {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
    next();
  });

  app.get("/api/admin/users", [authJwt.verifyToken, authJwt.isAdmin], controller.listUsers);
  app.post(
    "/api/admin/users",
    [authJwt.verifyToken, authJwt.isAdmin, upload.single("profilePic")],
    controller.createUserByAdmin
  );

  app.get("/api/admin/users/:id", [authJwt.verifyToken, authJwt.isAdmin], controller.getUserById);
  app.patch(
    "/api/admin/users/:id/promote-manager",
    [authJwt.verifyToken, authJwt.isAdmin],
    controller.promoteToManager
  );

  app.patch(
    "/api/admin/users/:id",
    [authJwt.verifyToken, authJwt.isAdmin, upload.single("profilePic")],
    controller.updateUserByAdmin
  );

  // Task 3: admin-only management endpoints
  app.put(
    "/api/admin/users/:id/manager",
    [authJwt.verifyToken, authJwt.isAdmin],
    controller.assignManagerByAdmin
  );
  app.put(
    "/api/admin/users/:id/role",
    [authJwt.verifyToken, authJwt.isAdmin],
    controller.updateUserRoleByAdmin
  );
  app.put(
    "/api/admin/users/:id/salary",
    [authJwt.verifyToken, authJwt.isAdmin],
    controller.updateUserSalaryByAdmin
  );
  app.put(
    "/api/admin/users/:id",
    [authJwt.verifyToken, authJwt.isAdmin, upload.single("profilePic")],
    controller.updateUserDetailsByAdmin
  );

  app.delete(
    "/api/admin/users/:id",
    [authJwt.verifyToken, authJwt.isAdmin],
    controller.deleteUserByAdmin
  );
};

