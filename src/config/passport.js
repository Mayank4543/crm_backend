// Passport configuration for Google OAuth
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const dotenv = require("dotenv");
const userService = require("../services/user.service");

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google OAuth profile:", JSON.stringify(profile, null, 2));

        const email = profile.emails?.[0]?.value;
        if (!email) {
          console.error("No email found in Google profile");
          return done(new Error("No email found in Google profile"), null);
        }

        // Check if user exists in database
        let user = await userService.findUserByEmail(email);

        // If user doesn't exist, create a new one
        if (!user) {
          const userData = {
            email: email,
            name:
              profile.displayName ||
              `${profile.name?.givenName || ""} ${
                profile.name?.familyName || ""
              }`.trim(),
            google_id: profile.id,
            profile_picture: profile.photos?.[0]?.value || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          console.log("Creating new user with data:", userData);
          user = await userService.createUser(userData);
        } else {
          // Update user's google ID if not already set
          if (!user.google_id) {
            const updateData = {
              google_id: profile.id,
              profile_picture:
                profile.photos?.[0]?.value || user.profile_picture,
              updated_at: new Date().toISOString(),
            };

            console.log("Updating existing user with data:", updateData);
            user = await userService.updateUser(user.id, updateData);
          }
        }

        console.log("Final user object:", user);
        return done(null, user);
      } catch (error) {
        console.error("Passport Google Strategy error:", error);
        return done(error, null);
      }
    }
  )
);
