const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const { authenticateJWT } = require("../middlewares/auth.middleware");

const router = express.Router();
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    try {
      if (!req.user) {
        return res.redirect(
          `${process.env.FRONTEND_URL}/login?error=authentication_failed`
        );
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
    } catch (error) {
      console.error("Auth callback error:", error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
    }
  }
);

router.get("/me", authenticateJWT, (req, res) => {
  try {
    res.json({
      status: "success",
      data: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get user information",
    });
  }
});

router.post("/logout", authenticateJWT, (req, res) => {
  try {
   
    res.json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to logout",
    });
  }
});

// Test endpoint for development
router.post("/test-token", (req, res) => {
  try {
    // Generate a test JWT token for development
    const token = jwt.sign(
      {
        id: "test-user",
        email: "test@example.com",
        name: "Test User",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      status: "success",
      data: { token },
    });
  } catch (error) {
    console.error("Test token error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to generate test token",
    });
  }
});

module.exports = router;
