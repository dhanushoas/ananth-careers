import { z } from 'zod';
import { routeRegistry } from '../common/route';

const envelope = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {},
    timestamp: { type: 'string', format: 'date-time' },
  },
};
const errorEnvelope = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' },
    errorCode: { type: 'string', example: 'VALIDATION_ERROR' },
    details: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } },
    timestamp: { type: 'string', format: 'date-time' },
  },
};

function jsonSchema(schema: z.ZodType) {
  try {
    return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  } catch {
    return { type: 'object' };
  }
}

/** Builds the OpenAPI 3.1 document from the route registry, so docs can never drift from the code. */
export function buildOpenApi(version: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routeRegistry) {
    const p = '/api/v1' + r.path.replace(/:(\w+)/g, '{$1}');
    const params: unknown[] = [];
    for (const m of r.path.matchAll(/:(\w+)/g)) params.push({ name: m[1], in: 'path', required: true, schema: { type: 'string' } });
    if (r.def.query) {
      const js = jsonSchema(r.def.query) as { properties?: Record<string, unknown>; required?: string[] };
      for (const [name, schema] of Object.entries(js.properties ?? {})) {
        params.push({ name, in: 'query', required: js.required?.includes(name) ?? false, schema });
      }
    }
    const auth = r.def.auth;
    const op: Record<string, unknown> = {
      tags: [r.tag],
      summary: r.def.summary,
      description: [
        auth === 'public' ? 'Public endpoint.' : auth === 'optional' ? 'Authentication optional.' : `Requires authentication${Array.isArray(auth) ? ` (roles: ${auth.join(', ')})` : ''}.`,
        r.def.permission ? `Admin permission: \`${r.def.permission}\`.` : '',
      ].join(' '),
      parameters: params,
      responses: {
        [String(r.def.status ?? 200)]: { description: r.def.message ?? 'Success', content: r.def.raw ? undefined : { 'application/json': { schema: envelope } } },
        '4XX': { description: 'Client error', content: { 'application/json': { schema: errorEnvelope } } },
        '5XX': { description: 'Server error', content: { 'application/json': { schema: errorEnvelope } } },
      },
    };
    if (auth !== 'public') op.security = [{ bearerAuth: [] }];
    if (r.def.upload) {
      op.requestBody = {
        required: true,
        content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } } },
      };
    } else if (r.def.body) {
      op.requestBody = { required: true, content: { 'application/json': { schema: jsonSchema(r.def.body) } } };
    }
    (paths[p] ??= {})[r.method] = op;
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Veejee Services – Your Recruitment Partner API',
      version,
      description:
        'REST API for the Veejee Services recruitment platform. All responses use the `{ success, message, data, timestamp }` envelope. ' +
        'Obtain an access token from `POST /auth/login`; refresh via `POST /auth/refresh` (httpOnly cookie + `X-Requested-With: XMLHttpRequest`).',
    },
    servers: [{ url: '/' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    paths,
  };
}
