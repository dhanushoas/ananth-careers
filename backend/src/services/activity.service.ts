import type { Request } from 'express';
import type { ClientSession } from 'mongoose';
import { logger } from '../common/logger';
import { AuditLog, Notification, type ObjectId } from '../models';

type Id = ObjectId | string;

export async function notify(
  user: Id,
  n: { type: string; title: string; message: string; link?: string },
  session?: ClientSession,
) {
  await Notification.create([{ user, ...n }], { session });
}

export type Actor = { id?: string; role?: string; ip?: string; userAgent?: string };

export function actorFrom(req: Request): Actor {
  return {
    id: req.auth?.userId,
    role: req.auth?.role,
    ip: req.ip,
    userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
  };
}

/** Append-only audit trail for security-relevant and administrative actions. Never throws. */
export async function audit(actor: Actor, action: string, entityType: string, entityId?: Id, metadata?: Record<string, unknown>) {
  try {
    await AuditLog.create({
      actor: actor.id,
      actorRole: actor.role,
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      metadata,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  } catch (err) {
    logger.error({ err, action }, 'Failed to write audit log');
  }
}
