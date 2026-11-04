import { CONTENT_KEYS } from '../../common/constants';
import { NotFoundError } from '../../common/errors';
import { ContactEnquiry, Employer, Industry, Job, Notification, SiteContent, Testimonial, User } from '../../models';
import { queueEmail } from '../../services/email/email.service';
import { notifyAdmins } from '../../services/populate';
import { DEFAULT_CONTENT } from './default-content';

export async function getContent(key: (typeof CONTENT_KEYS)[number]) {
  const doc = await SiteContent.findOne({ key });
  if (doc) return { key, value: doc.value, updatedAt: doc.updatedAt };
  const value = DEFAULT_CONTENT[key];
  if (!value) throw new NotFoundError('Content');
  return { key, value, updatedAt: null };
}

export const publishedTestimonials = () => Testimonial.find({ published: true, consentConfirmed: true }).sort({ updatedAt: -1 }).limit(12).select('name role company quote rating');

export async function publicStats() {
  const [jobs, employers, jobSeekers, industries] = await Promise.all([
    Job.countDocuments({ status: 'published', deletedAt: null }),
    Employer.countDocuments({ verificationStatus: 'verified', deletedAt: null }),
    User.countDocuments({ role: 'candidate', deletedAt: null }),
    Industry.countDocuments({ active: true }),
  ]);
  return { jobs, employers, jobSeekers, industries };
}

export async function createEnquiry(input: { name: string; email: string; phone?: string; subject: string; message: string; enquiryType: 'candidate' | 'employer' | 'general' }, ip?: string) {
  const enquiry = await ContactEnquiry.create({ ...input, ip });
  await queueEmail(input.email, 'contactConfirmation', { name: input.name, subject: input.subject });
  await notifyAdmins('enquiries:manage', { type: 'enquiry.new', title: 'New contact enquiry', message: `${input.name}: ${input.subject}`, link: '/admin/enquiries' });
  return { id: String(enquiry._id) };
}

export async function listNotifications(userId: string, unread: boolean, page: number, limit: number) {
  const filter: Record<string, unknown> = { user: userId };
  if (unread) filter.readAt = null;
  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
  ]);
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export const unreadCount = async (userId: string) => ({ count: await Notification.countDocuments({ user: userId, readAt: null }) });

export async function markRead(userId: string, id: string) {
  const n = await Notification.findOneAndUpdate({ _id: id, user: userId }, { readAt: new Date() }, { new: true });
  if (!n) throw new NotFoundError('Notification');
  return n;
}

export const markAllRead = (userId: string) => Notification.updateMany({ user: userId, readAt: null }, { readAt: new Date() });
