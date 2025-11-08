import express from "express";
import passport from "passport";

import AuthController from "../../controllers/auth-controller";

import signUpValidator from "../../middlewares/validators/sign-up-validator";
import resetEmailValidator from "../../middlewares/validators/reset-email-validator";
import updatePasswordValidator from "../../middlewares/validators/update-password-validator";
import passwordValidator from "../../middlewares/validators/password-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import FileConstants from "../../shared/file-constants";

const authRouter = express.Router();

// Local authentication
const options = (key: string): passport.AuthenticateOptions => ({
  failureRedirect: `/secure/verify?strategy=${key}`,
  successRedirect: `/secure/verify?strategy=${key}`
});

authRouter.post("/login", passport.authenticate("local-login", options("login")));
authRouter.post("/signup", signUpValidator, passwordValidator, passport.authenticate("local-signup", options("signup")));
authRouter.post("/signup/check", signUpValidator, passwordValidator, safeControllerFunction(AuthController.status_check));
authRouter.get("/verify", AuthController.verify);
authRouter.get("/check-password", safeControllerFunction(AuthController.checkPasswordStrength));

authRouter.post("/reset-password", resetEmailValidator, safeControllerFunction(AuthController.reset_password));
authRouter.post("/update-password", updatePasswordValidator, passwordValidator, safeControllerFunction(AuthController.verify_reset_email));

authRouter.post("/verify-captcha", safeControllerFunction(AuthController.verifyCaptcha));

// Google authentication
authRouter.get("/google", (req, res) => {
  try {
    // Validate Google configuration
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error("[GOOGLE-AUTH] Google OAuth not configured:", {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
      });
      return res.status(500).json({ done: false, message: "Google authentication not available" });
    }

    return passport.authenticate("google", {
      scope: ["email", "profile"],
      state: JSON.stringify({
        teamMember: req.query.teamMember || null,
        team: req.query.team || null,
        teamName: req.query.teamName || null,
        project: req.query.project || null
      })
    })(req, res);
  } catch (error: any) {
    console.error("[GOOGLE-AUTH] Error initiating Google authentication:", {
      error: error.message,
      stack: error.stack,
      path: req.path,
      query: req.query
    });
    return res.status(500).json({ done: false, message: "Google authentication failed" });
  }
});

authRouter.get("/google/verify", (req, res) => {
  try {
    // Validate redirect URLs
    if (!process.env.LOGIN_FAILURE_REDIRECT || !process.env.LOGIN_SUCCESS_REDIRECT) {
      console.error("[GOOGLE-VERIFY] Redirect URLs not configured:", {
        hasFailureRedirect: !!process.env.LOGIN_FAILURE_REDIRECT,
        hasSuccessRedirect: !!process.env.LOGIN_SUCCESS_REDIRECT
      });
      return res.status(500).json({ done: false, message: "OAuth redirect configuration missing" });
    }

    let error = "";
    if ((req.session as any).error) {
      error = `?error=${encodeURIComponent((req.session as any).error as string)}`;
      delete (req.session as any).error;
    }

    const failureRedirect = process.env.LOGIN_FAILURE_REDIRECT + error;
    return passport.authenticate("google", {
      failureRedirect,
      successRedirect: process.env.LOGIN_SUCCESS_REDIRECT
    })(req, res);
  } catch (error: any) {
    console.error("[GOOGLE-VERIFY] Error during Google callback:", {
      error: error.message,
      stack: error.stack,
      path: req.path,
      query: req.query,
      sessionExists: !!req.session
    });
    return res.status(500).json({ done: false, message: "Google authentication callback failed" });
  }
});

// Mobile Google Sign-In using Passport strategy
authRouter.post("/google/mobile", AuthController.googleMobileAuthPassport);

// Discord authentication
authRouter.get("/discord", (req, res, next) => {
  try {
    // Validate Discord configuration
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
      console.error("[DISCORD-AUTH] Discord OAuth not configured:", {
        hasClientId: !!process.env.DISCORD_CLIENT_ID,
        hasClientSecret: !!process.env.DISCORD_CLIENT_SECRET,
        hasCallbackUrl: !!process.env.DISCORD_CALLBACK_URL
      });
      return res.status(500).json({ done: false, message: "Discord authentication not available" });
    }

    const state = JSON.stringify({
      teamMember: req.query.teamMember || null,
      team: req.query.team || null,
      teamName: req.query.teamName || null,
      project: req.query.project || null
    });

    return passport.authenticate("discord", { state })(req, res, next);
  } catch (error: any) {
    console.error("[DISCORD-AUTH] Error initiating Discord authentication:", {
      error: error.message,
      stack: error.stack,
      path: req.path,
      query: req.query
    });
    return res.status(500).json({ done: false, message: "Discord authentication failed" });
  }
});

authRouter.get("/discord/verify", (req, res, next) => {
  try {
    // Validate redirect URLs
    if (!process.env.LOGIN_FAILURE_REDIRECT || !process.env.LOGIN_SUCCESS_REDIRECT) {
      console.error("[DISCORD-VERIFY] Redirect URLs not configured:", {
        hasFailureRedirect: !!process.env.LOGIN_FAILURE_REDIRECT,
        hasSuccessRedirect: !!process.env.LOGIN_SUCCESS_REDIRECT
      });
      return res.status(500).json({ done: false, message: "OAuth redirect configuration missing" });
    }

    let error = "";
    if ((req.session as any).error) {
      error = `?error=${encodeURIComponent((req.session as any).error as string)}`;
      delete (req.session as any).error;
    }

    const failureRedirect = process.env.LOGIN_FAILURE_REDIRECT + error;
    return passport.authenticate("discord", {
      failureRedirect,
      successRedirect: process.env.LOGIN_SUCCESS_REDIRECT
    })(req, res, next);
  } catch (error: any) {
    console.error("[DISCORD-VERIFY] Error during Discord callback:", {
      error: error.message,
      stack: error.stack,
      path: req.path,
      query: req.query,
      sessionExists: !!req.session
    });
    return res.status(500).json({ done: false, message: "Discord authentication callback failed" });
  }
});

// Passport logout
authRouter.get("/logout", AuthController.logout);

export default authRouter;
