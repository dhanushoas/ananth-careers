import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import type { Permission, Role } from './constants';
import { ValidationError } from './errors';
import { sendSuccess } from './http';
import { authenticate, requirePermission, requireRoles, type AuthContext } from '../middleware/auth';
import { uploadMiddleware, type UploadKind } from '../middleware/upload';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Schema = z.ZodType;
type Out<S> = S extends Schema ? z.output<S> : undefined;

export interface Ctx<B, Q, P, A> {
  req: Request;
  res: Response;
  body: B;
  query: Q;
  params: P;
  auth: A;
}

export interface RouteDef<B extends Schema | undefined, Q extends Schema | undefined, P extends Schema | undefined, Auth extends AuthMode> {
  method: Method;
  path: string;
  summary: string;
  /** public: no token; optional: token used if present; any: any signed-in user; Role[]: restricted. */
  auth: Auth;
  permission?: Permission;
  body?: B;
  query?: Q;
  params?: P;
  upload?: UploadKind;
  middleware?: RequestHandler[];
  status?: number;
  message?: string;
  /** Handler writes the response itself (file downloads). */
  raw?: boolean;
  handler: (ctx: Ctx<Out<B>, Out<Q>, Out<P>, Auth extends 'public' | 'optional' ? AuthContext | undefined : AuthContext>) => Promise<unknown>;
}

type AuthMode = 'public' | 'optional' | 'any' | Role[];

export interface RegisteredRoute {
  tag: string;
  method: Method;
  path: string;
  def: RouteDef<Schema | undefined, Schema | undefined, Schema | undefined, AuthMode>;
}
export const routeRegistry: RegisteredRoute[] = [];

function parse<S extends Schema | undefined>(schema: S, value: unknown, location: string): Out<S> {
  if (!schema) return undefined as Out<S>;
  const r = schema.safeParse(value ?? {});
  if (!r.success) {
    throw new ValidationError(
      location === 'params' ? 'Invalid request parameters' : 'Some fields are invalid',
      r.error.issues.map((i) => ({ field: i.path.join('.') || location, message: i.message })),
    );
  }
  return r.data as Out<S>;
}

/** Declarative router: validation, auth, uploads, response envelope and OpenAPI docs from one definition. */
export class ApiRouter {
  readonly router = Router();
  constructor(
    readonly tag: string,
    readonly basePath: string,
  ) {}

  route<B extends Schema | undefined = undefined, Q extends Schema | undefined = undefined, P extends Schema | undefined = undefined, A extends AuthMode = AuthMode>(
    def: RouteDef<B, Q, P, A>,
  ) {
    const chain: RequestHandler[] = [];
    if (def.auth !== 'public') chain.push(authenticate(def.auth === 'optional'));
    if (Array.isArray(def.auth)) chain.push(requireRoles(def.auth));
    if (def.permission) chain.push(requirePermission(def.permission));
    if (def.upload) chain.push(uploadMiddleware(def.upload));
    if (def.middleware) chain.push(...def.middleware);

    chain.push(async (req, res, next) => {
      try {
        const ctx = {
          req,
          res,
          params: parse(def.params, req.params, 'params'),
          query: parse(def.query, req.query, 'query'),
          body: parse(def.body, req.body, 'body'),
          auth: req.auth,
        } as Parameters<typeof def.handler>[0];
        const data = await def.handler(ctx);
        if (!def.raw) sendSuccess(res, data, def.message, def.status ?? 200);
      } catch (err) {
        next(err);
      }
    });

    this.router[def.method](def.path, ...chain);
    routeRegistry.push({ tag: this.tag, method: def.method, path: this.basePath + def.path, def: def as unknown as RegisteredRoute['def'] });
    return this;
  }
}
