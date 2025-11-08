import session from "express-session";
import db from "../config/db";
import { isProduction } from "../shared/utils";
import * as cookieSignature from "cookie-signature";
import { randomBytes } from "crypto";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pgSession = require("connect-pg-simple")(session);

// Validate session configuration
if (!process.env.SESSION_NAME) {
  console.warn("[SESSION] SESSION_NAME environment variable not set - using default");
}
if (!process.env.SESSION_SECRET) {
  console.warn("[SESSION] SESSION_SECRET environment variable not set - using development default (INSECURE)");
}

// Create PostgreSQL session store with error handling
let sessionStore;
try {
  sessionStore = new pgSession({
    pool: db.pool,
    tableName: "pg_sessions"
  });

  // Log store events for debugging
  sessionStore.on('connect', () => {
    console.log("[SESSION] Session store connected to PostgreSQL");
  });

  sessionStore.on('disconnect', () => {
    console.error("[SESSION] Session store disconnected from PostgreSQL");
  });

  sessionStore.on('error', (error: Error) => {
    console.error("[SESSION] Session store error:", {
      error: error.message,
      stack: error.stack
    });
  });

  console.log("[SESSION] Session store initialized successfully");
} catch (error: any) {
  console.error("[SESSION] Failed to initialize session store:", {
    error: error.message,
    stack: error.stack
  });
  throw error;
}

const sessionConfig = {
  name: process.env.SESSION_NAME,
  secret: process.env.SESSION_SECRET || "development-secret-key",
  proxy: false,
  resave: false,
  saveUninitialized: true,
  rolling: true,
  store: sessionStore,
  cookie: {
    path: "/",
    httpOnly: true,
    // For mobile app support in production, use "none", for local development use "lax"
    sameSite: "lax" as const,
    // Secure only in production (HTTPS required for sameSite: "none")
    secure: false,
    domain: undefined,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  },
  // Custom session ID handling for mobile apps
  genid: () => {
    return randomBytes(24).toString("base64url");
  }
};

const sessionMiddleware = session(sessionConfig);

// Enhanced session middleware that supports both cookies and headers for mobile apps
export default (req: any, res: any, next: any) => {
  // Check if mobile app is sending session ID via header (fallback for cookie issues)
  const headerSessionId = req.headers["x-session-id"];
  const headerSessionName = req.headers["x-session-name"];

  // Only process headers if they exist AND there's no existing valid session cookie
  if (headerSessionId && headerSessionName) {
    const secret = process.env.SESSION_SECRET || "development-secret-key";

    try {
      // Create a signed cookie using the session secret
      const signedSessionId = `s:${cookieSignature.sign(headerSessionId, secret)}`;
      const encodedSignedId = encodeURIComponent(signedSessionId);
      const sessionCookie = `${headerSessionName}=${encodedSignedId}`;

      if (req.headers.cookie) {
        // Replace existing session cookie while keeping other cookies
        req.headers.cookie = req.headers.cookie
          .split(";")
          .filter((cookie: string) => !cookie.trim().startsWith(headerSessionName))
          .concat(sessionCookie)
          .join(";");
      } else {
        // Set the session cookie from header
        req.headers.cookie = sessionCookie;
      }
    } catch (error: any) {
      console.error("[SESSION] Error processing session headers:", {
        error: error.message,
        path: req.path,
        hasHeaderSessionId: !!headerSessionId,
        hasHeaderSessionName: !!headerSessionName
      });
      // Fallback to the old method
      const sessionCookie = `${headerSessionName}=s%3A${headerSessionId}`;
      req.headers.cookie = sessionCookie;
    }
  }

  // Always call the original session middleware (handles both cookie and header-converted cases)
  sessionMiddleware(req, res, (err: any) => {
    if (err) {
      console.error("[SESSION] Session middleware error:", {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        sessionID: req.sessionID,
        hasSession: !!req.session
      });
    }
    next(err);
  });
};