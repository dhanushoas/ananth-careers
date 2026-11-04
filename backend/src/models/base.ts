import mongoose from 'mongoose';

// Global safety + serialisation defaults applied to every model.
mongoose.set('strictQuery', true);
// NoSQL-injection defence: every request input is parsed by a Zod schema into primitive
// types before reaching a query, and `sanitizeRequest` strips `$`/`.` keys from bodies.

const transform = (_doc: unknown, ret: Record<string, unknown>) => {
  if (ret._id !== undefined) {
    ret.id = String(ret._id);
    delete ret._id;
  }
  delete ret.__v;
  return ret;
};
mongoose.set('toJSON', { virtuals: true, versionKey: false, transform });
mongoose.set('toObject', { virtuals: true, versionKey: false, transform });

export { mongoose };
export const { Schema, model, Types } = mongoose;
export type ObjectId = mongoose.Types.ObjectId;

/** Wrap a unit of work in a MongoDB transaction (requires a replica set – Atlas always is). */
export async function withTransaction<T>(work: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/** toJSON options that additionally hide internal/sensitive fields. */
export function jsonHiding(...fields: string[]) {
  return {
    virtuals: true,
    versionKey: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transform: (_doc: unknown, ret: any) => {
      ret.id = String(ret._id);
      delete ret._id;
      for (const f of fields) delete ret[f];
      return ret;
    },
  };
}

/** Serialise a document to a plain, mutable JSON object (applies the global id/__v transform). */
export const plain = (doc: { toJSON(): unknown }) => doc.toJSON() as Record<string, unknown>;
