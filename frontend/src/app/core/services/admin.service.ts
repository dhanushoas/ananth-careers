import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';
import {
  AdminStatsV2,
  ReportsV2,
  StaffRecruiter,
  StaffRecruiterInput,
  SystemSettings,
  AdminReports,
  AdminResume,
  AdminStats,
  AdminTestimonial,
  AdminUser,
  AdminUserQuery,
  Application,
  ApprovalStatus,
  AuditLog,
  AuditLogQuery,
  ContentKey,
  CreateAdminRequest,
  EmailOutboxItem,
  Employer,
  Enquiry,
  EnquiryStatus,
  Job,
  JobStatus,
  PageQuery,
  Paginated,
  Recruiter,
  TestimonialInput,
  UserStatus,
  VerificationStatus,
} from '../models';

/** All /admin endpoints. List endpoints are paginated per the contract conventions. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);

  stats(): Observable<AdminStats> {
    return this.api.get<AdminStats>('/admin/stats');
  }

  users(query: AdminUserQuery = {}): Observable<Paginated<AdminUser>> {
    return this.api.get<Paginated<AdminUser>>('/admin/users', { params: query });
  }

  setUserStatus(id: string, status: Extract<UserStatus, 'active' | 'blocked'>, reason?: string): Observable<AdminUser> {
    return this.api.patch<AdminUser>(`/admin/users/${id}/status`, { status, reason: reason || undefined });
  }

  createAdmin(body: CreateAdminRequest): Observable<AdminUser> {
    return this.api.post<AdminUser>('/admin/users/admins', body);
  }

  setPermissions(id: string, permissions: string[]): Observable<AdminUser> {
    return this.api.patch<AdminUser>(`/admin/users/${id}/permissions`, { permissions });
  }

  employers(query: PageQuery & { verificationStatus?: VerificationStatus; q?: string } = {}): Observable<Paginated<Employer>> {
    return this.api.get<Paginated<Employer>>('/admin/employers', { params: query });
  }

  verifyEmployer(id: string, status: 'verified' | 'rejected', reason?: string): Observable<Employer> {
    return this.api.patch<Employer>(`/admin/employers/${id}/verification`, { status, reason: reason || undefined });
  }


  recruiters(query: PageQuery & { approvalStatus?: ApprovalStatus } = {}): Observable<Paginated<Recruiter>> {
    return this.api.get<Paginated<Recruiter>>('/admin/recruiters', { params: query });
  }

  approveRecruiter(id: string, status: 'approved' | 'rejected', reason?: string): Observable<Recruiter> {
    return this.api.patch<Recruiter>(`/admin/recruiters/${id}/approval`, { status, reason: reason || undefined });
  }

  jobs(query: PageQuery & { status?: JobStatus; q?: string } = {}): Observable<Paginated<Job>> {
    return this.api.get<Paginated<Job>>('/admin/jobs', { params: query });
  }

  moderateJob(id: string, action: 'approve' | 'reject', reason?: string): Observable<Job> {
    return this.api.patch<Job>(`/admin/jobs/${id}/moderation`, { action, reason: reason || undefined });
  }

  featureJob(id: string, featured: boolean): Observable<Job> {
    return this.api.patch<Job>(`/admin/jobs/${id}/featured`, { featured });
  }


  resumes(query: PageQuery & { q?: string } = {}): Observable<Paginated<AdminResume>> {
    return this.api.get<Paginated<AdminResume>>('/admin/resumes', { params: query });
  }

  deleteResume(id: string): Observable<unknown> {
    return this.api.delete<unknown>(`/admin/resumes/${id}`);
  }

  enquiries(query: PageQuery & { status?: EnquiryStatus } = {}): Observable<Paginated<Enquiry>> {
    return this.api.get<Paginated<Enquiry>>('/admin/enquiries', { params: query });
  }

  updateEnquiry(id: string, status: EnquiryStatus, notes?: string): Observable<Enquiry> {
    return this.api.patch<Enquiry>(`/admin/enquiries/${id}`, { status, notes: notes ?? undefined });
  }

  emails(query: PageQuery & { status?: string } = {}): Observable<Paginated<EmailOutboxItem>> {
    return this.api.get<Paginated<EmailOutboxItem>>('/admin/emails', { params: query });
  }

  retryEmail(id: string): Observable<EmailOutboxItem> {
    return this.api.post<EmailOutboxItem>(`/admin/emails/${id}/retry`);
  }

  /** Returns the stored value for a content key (raw or `{ key, value }` — see unwrapContent). */
  content(key: ContentKey): Observable<unknown> {
    return this.api.get<unknown>(`/admin/content/${key}`);
  }

  saveContent(key: ContentKey, value: unknown): Observable<unknown> {
    return this.api.put<unknown>(`/admin/content/${key}`, { value });
  }

  testimonials(query: PageQuery = {}): Observable<Paginated<AdminTestimonial> | AdminTestimonial[]> {
    return this.api.get<Paginated<AdminTestimonial> | AdminTestimonial[]>('/admin/testimonials', { params: query });
  }

  createTestimonial(input: TestimonialInput): Observable<AdminTestimonial> {
    return this.api.post<AdminTestimonial>('/admin/testimonials', input);
  }

  updateTestimonial(id: string, input: Partial<TestimonialInput>): Observable<AdminTestimonial> {
    return this.api.patch<AdminTestimonial>(`/admin/testimonials/${id}`, input);
  }

  deleteTestimonial(id: string): Observable<unknown> {
    return this.api.delete<unknown>(`/admin/testimonials/${id}`);
  }

  reports(from?: string, to?: string): Observable<AdminReports> {
    return this.api.get<AdminReports>('/admin/reports', { params: { from, to } });
  }

  auditLogs(query: AuditLogQuery = {}): Observable<Paginated<AuditLog>> {
    return this.api.get<Paginated<AuditLog>>('/admin/audit-logs', { params: query });
  }

  // ---- v2 (consultancy model) ----
  statsV2(): Observable<AdminStatsV2> {
    return this.api.get<AdminStatsV2>('/admin/stats');
  }

  staffRecruiters(query: PageQuery & { active?: boolean; q?: string } = {}): Observable<Paginated<StaffRecruiter>> {
    return this.api.get<Paginated<StaffRecruiter>>('/admin/recruiters', { params: query });
  }

  /** Creates a Veejee Services recruiter and emails an invitation. */
  createStaffRecruiter(body: StaffRecruiterInput): Observable<StaffRecruiter> {
    return this.api.post<StaffRecruiter>('/admin/recruiters', body);
  }

  updateStaffRecruiter(id: string, body: StaffRecruiterInput): Observable<StaffRecruiter> {
    return this.api.patch<StaffRecruiter>(`/admin/recruiters/${id}`, body);
  }

  resendRecruiterInvite(id: string): Observable<unknown> {
    return this.api.post<unknown>(`/admin/recruiters/${id}/resend-invite`);
  }

  updateEmployer(id: string, body: { featured?: boolean; accountManager?: string | null }): Observable<Employer> {
    return this.api.patch<Employer>(`/admin/employers/${id}`, body);
  }

  settings(): Observable<SystemSettings> {
    return this.api.get<SystemSettings>('/admin/settings');
  }

  /** Partial updates merge server-side. */
  updateSettings(body: Partial<SystemSettings>): Observable<SystemSettings> {
    return this.api.put<SystemSettings>('/admin/settings', body);
  }

  reportsV2(from?: string, to?: string): Observable<ReportsV2> {
    return this.api.get<ReportsV2>('/admin/reports', { params: { from, to } });
  }
}
