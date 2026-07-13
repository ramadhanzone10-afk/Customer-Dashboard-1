import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

function getSecret(): string {
  const secret = process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"];
  if (!secret) {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("JWT_SECRET or SESSION_SECRET environment variable is required in production.");
    }
    return "mc-dev-only-secret-not-for-production";
  }
  return secret;
}

export interface JwtPayload {
  userId: string;
  role: "teacher" | "student";
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}

declare module "express-serve-static-core" {
  interface Request {
    jwtUser?: JwtPayload;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized. Token diperlukan." });
    return;
  }
  try {
    req.jwtUser = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Token tidak valid atau sudah kadaluarsa." });
  }
}

export function requireTeacher(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.jwtUser?.role !== "teacher") {
      res.status(403).json({ error: "Hanya guru yang dapat mengakses fitur ini." });
      return;
    }
    next();
  });
}
