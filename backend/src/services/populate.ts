import { Types } from 'mongoose';
import { SUPER_ADMIN, type Permission } from '../common/constants';
import { User } from '../models';
import { notify } from './activity.service';

export const EMPLOYER_SUMMARY = 'companyName slug verificationStatus logoKey';

export const JOB_POPULATE = [
  { path: 'industry', select: 'name slug icon' },
  { path: 'category', select: 'name slug' },
  { path: 'employer', select: EMPLOYER_SUMMARY },
  { path: 'postedBy', select: 'name' },
];

export const isObjectId = (v: string) => Types.ObjectId.isValid(v) && String(new Types.ObjectId(v)) === v;

/** In-app notification to every admin holding a permission. */
export async function notifyAdmins(permission: Permission, n: { type: string; title: string; message: string; link?: string }) {
  const admins = await User.find({ role: 'admin', status: 'active', deletedAt: null, permissions: { $in: [SUPER_ADMIN, permission] } }).select('_id');
  await Promise.all(admins.map((a) => notify(a._id, n)));
}
