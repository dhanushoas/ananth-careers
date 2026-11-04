import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { SUPER_ADMIN, type Permission, type Role } from '../common/constants';
import { ForbiddenError, UnauthenticatedError } from '../common/errors';
import { User, type IUser } from '../models';

export interface AuthContext {
  userId: string;
  role: Role;
  permissions: string[];
  sessionId: string;
  user: IUser;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

type AccessPayload = { sub: string; role: Role; sid: string };

const JWT_OPTS = { issuer: 'ananth-api', audience: 'ananth-web' } as const;

export function signAccessToken(p: AccessPayload) {
  return jwt.sign(p, env.JWT_ACCESS_SECRET, { ...JWT_OPTS, algorithm: 'HS256', expiresIn: env.JWT_ACCESS_TTL_SECONDS });
}

function verifyAccessToken(token: string): AccessPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { ...JWT_OPTS, algorithms: ['HS256'] }) as AccessPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new UnauthenticatedError('Your session has expired', 'TOKEN_EXPIRED');
    throw new UnauthenticatedError('Invalid authentication token');
  }
}

async function resolve(req: Request): Promise<AuthContext | undefined> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  const payload = verifyAccessToken(header.slice(7));
  // Load the user on every request so that blocking/deleting an account takes effect immediately.
  const user = await User.findById(payload.sub);
  if (!user || user.deletedAt) throw new UnauthenticatedError('Account no longer exists');
  if (user.status === 'blocked') throw new ForbiddenError('Your account has been blocked. Please contact support.', 'ACCOUNT_BLOCKED');
  return { userId: String(user._id), role: user.role, permissions: user.permissions, sessionId: payload.sid, user };
}

export const authenticate = (optional = false) => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    req.auth = await resolve(req);
    if (!req.auth && !optional) throw new UnauthenticatedError();
    next();
  } catch (err) {
    // An expired/invalid token on an optional route is treated as anonymous.
    if (optional && err instanceof UnauthenticatedError) {
      req.auth = undefined;
      return next();
    }
    next(err);
  }
};

export const requireRoles = (roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth) return next(new UnauthenticatedError());
  if (!roles.includes(req.auth.role)) return next(new ForbiddenError());
  next();
};

export function hasPermission(auth: AuthContext | undefined, permission: Permission) {
  return Boolean(auth && auth.role === 'admin' && (auth.permissions.includes(SUPER_ADMIN) || auth.permissions.includes(permission)));
}

export const requirePermission = (permission: Permission) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth) return next(new UnauthenticatedError());
  if (!hasPermission(req.auth, permission)) return next(new ForbiddenError());
  next();
};
