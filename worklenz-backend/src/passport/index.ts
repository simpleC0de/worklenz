import {PassportStatic} from "passport";

import {deserialize} from "./deserialize";
import {serialize} from "./serialize";

import LocalLogin from "./passport-strategies/passport-local-login";
import LocalSignup from "./passport-strategies/passport-local-signup";

/**
 * Use any passport middleware before the serialize and deserialize
 * @param {Passport} passport
 */
export default (passport: PassportStatic) => {
  const activeStrategies: string[] = [];

  passport.use("local-login", LocalLogin);
  passport.use("local-signup", LocalSignup);
  activeStrategies.push("local-login", "local-signup");

  // Only register Google OAuth if credentials are provided
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const GoogleLogin = require("./passport-strategies/passport-google").default;
    const GoogleMobileLogin = require("./passport-strategies/passport-google-mobile").default;
    passport.use(GoogleLogin);
    passport.use("google-mobile", GoogleMobileLogin);
    activeStrategies.push("google", "google-mobile");
    console.log("[PASSPORT] Google OAuth strategy registered successfully");
  } else {
    console.warn("[PASSPORT] Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  // Only register Discord OAuth if credentials are provided
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    const DiscordLogin = require("./passport-strategies/passport-discord").default;
    passport.use("discord", DiscordLogin);
    activeStrategies.push("discord");
    console.log("[PASSPORT] Discord OAuth strategy registered successfully");
  } else {
    console.warn("[PASSPORT] Discord OAuth not configured - missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET");
  }

  passport.serializeUser(serialize);
  passport.deserializeUser(deserialize);

  console.log("[PASSPORT] Passport initialized with strategies:", activeStrategies.join(", "));

  // Validate redirect URLs
  if (!process.env.LOGIN_SUCCESS_REDIRECT) {
    console.error("[PASSPORT] LOGIN_SUCCESS_REDIRECT environment variable not set!");
  }
  if (!process.env.LOGIN_FAILURE_REDIRECT) {
    console.error("[PASSPORT] LOGIN_FAILURE_REDIRECT environment variable not set!");
  }
};
