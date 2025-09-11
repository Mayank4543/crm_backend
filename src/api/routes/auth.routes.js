const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Google OAuth login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth callback with error handling
router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, user, info) => {
    if (err) {
      console.error("OAuth error:", err);
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/login?error=oauth_error`
      );
    }

    if (!user) {
      console.error("No user returned from OAuth");
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/login?error=no_user`
      );
    }

    try {
      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name:
            user.name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim(),
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/dashboard?token=${token}`);
    } catch (tokenError) {
      console.error("Token generation error:", tokenError);
      res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/login?error=token_error`
      );
    }
  })(req, res, next);
});

// Logout
router.post("/logout", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// Get current user
router.get(
  "/me",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
      },
    });
  }
);

module.exports = router;
