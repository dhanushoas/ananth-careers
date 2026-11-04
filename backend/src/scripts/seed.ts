/**
 * Seeds reference data (industries, categories, platform settings) and the first super administrator.
 *   npm run seed                 – taxonomy + super admin (uses SEED_ADMIN_* env vars)
 *   npm run seed -- --demo       – ALSO loads clearly-marked demo companies, recruiters, candidates and a sample pipeline
 *                                  (development only – refused when NODE_ENV=production)
 *   npm run seed -- --indexes    – synchronise MongoDB indexes (run on every production deploy)
 */
import mongoose from 'mongoose';
import { env } from '../config/env';
import { connectDatabase } from '../config/db';
import { CONSENT_VERSION } from '../common/constants';
import { slugify, uniqueSlug } from '../common/crypto';
import { logger } from '../common/logger';
import { Application, Candidate, Consent, Employer, Industry, Job, JobCategory, Recruiter, Resume, Shortlist, Submission, User, getSettings } from '../models';
import { hashPassword } from '../modules/auth/auth.service';
import { storage } from '../services/storage/storage.service';
import { scoreCandidate } from '../services/matching.service';
import { DEMO_COMPANIES, INDUSTRIES, demoResumePdf, jobDescription } from './seed-data';

export const DEMO_PASSWORD = 'Veejee@2026';
const DEMO_DOMAIN = 'veejee.example';

async function seedTaxonomy() {
  const industries = [];
  for (const [order, i] of INDUSTRIES.entries()) {
    const slug = slugify(i.name);
    const ind = await Industry.findOneAndUpdate({ slug }, { $setOnInsert: { name: i.name, slug, icon: i.icon, description: i.description, order, active: true } }, { upsert: true, new: true });
    const cats = [];
    for (const c of i.categories) {
      cats.push(await JobCategory.findOneAndUpdate({ industry: ind._id, slug: slugify(c) }, { $setOnInsert: { name: c, industry: ind._id, slug: slugify(c), active: true } }, { upsert: true, new: true }));
    }
    industries.push({ ind, cats });
  }
  return industries;
}

type Role = 'admin' | 'employer' | 'recruiter' | 'candidate';
async function ensureUser(data: { name: string; email: string; mobile: string; role: Role; password: string; permissions?: string[] }) {
  const existing = await User.findOne({ email: data.email });
  if (existing) return existing;
  return User.create({
    name: data.name,
    email: data.email,
    mobile: data.mobile,
    role: data.role,
    passwordHash: await hashPassword(data.password),
    status: 'active',
    emailVerified: true,
    emailVerifiedAt: new Date(),
    permissions: data.permissions ?? [],
    consent: { termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(), marketingEmails: false },
  });
}

const DEMO_CANDIDATES = [
  {
    name: 'Kavya Reddy', email: `seeker@${DEMO_DOMAIN}`, careerLevel: 'experienced', years: 4, city: 'Bengaluru', state: 'Karnataka', industry: 0, consent: true, contact: true,
    headline: 'Full-stack developer – Angular & Node.js', roles: ['Angular Developer', 'Full Stack Developer'], notice: 30, expected: 1600000,
    skills: [['Angular', 'technical'], ['TypeScript', 'technical'], ['Node.js', 'technical'], ['MongoDB', 'technical'], ['RxJS', 'technical'], ['Communication', 'non_technical']],
    edu: ['B.Tech', 'Computer Science'], exp: ['Software Engineer', 'Acme Labs'],
  },
  {
    name: 'Rahul Verma', email: `rahul.candidate@${DEMO_DOMAIN}`, careerLevel: 'experienced', years: 6, city: 'Hyderabad', state: 'Telangana', industry: 0, consent: true, contact: false,
    headline: 'Senior frontend engineer', roles: ['Frontend Engineer', 'Angular Developer'], notice: 60, expected: 2400000,
    skills: [['Angular', 'technical'], ['TypeScript', 'technical'], ['SCSS', 'technical'], ['Team Leadership', 'non_technical']],
    edu: ['B.E.', 'Information Technology'], exp: ['Senior Frontend Engineer', 'PixelWorks'],
  },
  {
    name: 'Sneha Iyer', email: `sneha.candidate@${DEMO_DOMAIN}`, careerLevel: 'fresher', years: 0, city: 'Bengaluru', state: 'Karnataka', industry: 10, consent: true, contact: true,
    headline: 'Computer science graduate seeking first role', roles: ['Software Engineering Intern', 'Junior Developer'], notice: 0, expected: 300000,
    skills: [['JavaScript', 'technical'], ['Git', 'technical'], ['Problem Solving', 'non_technical']],
    edu: ['B.Sc', 'Computer Science'], exp: null,
  },
  {
    name: 'Arun Kumar', email: `arun.candidate@${DEMO_DOMAIN}`, careerLevel: 'experienced', years: 5, city: 'Chennai', state: 'Tamil Nadu', industry: 2, consent: false, contact: false,
    headline: 'Civil site engineer', roles: ['Site Engineer'], notice: 30, expected: 700000,
    skills: [['AutoCAD', 'technical'], ['Site Supervision', 'technical'], ['BOQ', 'technical']],
    edu: ['B.E.', 'Civil Engineering'], exp: ['Site Engineer', 'BuildRight Constructions'],
  },
  {
    name: 'Fatima Sheikh', email: `fatima.candidate@${DEMO_DOMAIN}`, careerLevel: 'experienced', years: 3, city: 'Hyderabad', state: 'Telangana', industry: 6, consent: true, contact: true,
    headline: 'ICU staff nurse', roles: ['Staff Nurse'], notice: 15, expected: 480000,
    skills: [['Critical Care', 'technical'], ['BLS', 'technical'], ['Patient Care', 'non_technical']],
    edu: ['B.Sc Nursing', 'Nursing'], exp: ['Staff Nurse', 'City Hospital'],
  },
  {
    name: 'Vikram Singh', email: `vikram.candidate@${DEMO_DOMAIN}`, careerLevel: 'experienced', years: 7, city: 'Mumbai', state: 'Maharashtra', industry: 1, consent: true, contact: false,
    headline: 'Retail store manager', roles: ['Store Manager'], notice: 45, expected: 950000,
    skills: [['Retail Operations', 'technical'], ['Inventory', 'technical'], ['Team Leadership', 'non_technical']],
    edu: ['MBA', 'Retail Management'], exp: ['Assistant Store Manager', 'MegaMart'],
  },
  {
    name: 'Priya Nair', email: `priya.candidate@${DEMO_DOMAIN}`, careerLevel: 'experienced', years: 2, city: 'Pune', state: 'Maharashtra', industry: 0, consent: true, contact: true,
    headline: 'QA automation engineer', roles: ['QA Engineer'], notice: 30, expected: 900000,
    skills: [['Playwright', 'technical'], ['Selenium', 'technical'], ['API Testing', 'technical']],
    edu: ['B.Tech', 'Electronics'], exp: ['QA Engineer', 'TestCraft'],
  },
  {
    name: 'Mohammed Irfan', email: `irfan.candidate@${DEMO_DOMAIN}`, careerLevel: 'fresher', years: 0, city: 'Ahmedabad', state: 'Gujarat', industry: 7, consent: false, contact: false,
    headline: 'Logistics graduate', roles: ['Warehouse Executive'], notice: 0, expected: 250000,
    skills: [['Inventory Control', 'technical'], ['MS Excel', 'technical']],
    edu: ['B.Com', 'Commerce'], exp: null,
  },
] as const;

async function seedDemo(taxonomy: Awaited<ReturnType<typeof seedTaxonomy>>) {
  const admin = await User.findOne({ role: 'admin' });
  // Veejee Services recruitment team
  const recruiters = [];
  for (const [i, r] of [
    { name: 'Arjun Mehta', email: `recruiter@${DEMO_DOMAIN}`, designation: 'Senior Recruitment Consultant', spec: [0, 10] },
    { name: 'Divya Nair', email: `recruiter2@${DEMO_DOMAIN}`, designation: 'Recruitment Consultant', spec: [1, 2, 3, 6] },
  ].entries()) {
    const user = await ensureUser({ name: r.name, email: r.email, mobile: `98765000${10 + i}`, role: 'recruiter', password: DEMO_PASSWORD });
    if (!(await Recruiter.exists({ user: user._id }))) {
      await Recruiter.create({ user: user._id, designation: r.designation, employeeCode: `VS-R00${i + 1}`, specializations: r.spec.map((x) => taxonomy[x]!.ind._id), createdBy: admin!._id });
    }
    recruiters.push(user);
  }

  // Client companies & requirements
  for (const [ci, c] of DEMO_COMPANIES.entries()) {
    const ownerEmail = ci === 0 ? `employer@${DEMO_DOMAIN}` : `hr@${slugify(c.name)}.example`;
    const owner = await ensureUser({ name: ci === 0 ? 'Priya Sharma' : `${c.name} HR`, email: ownerEmail, mobile: `98${String(10000000 + ci).padStart(8, '0')}`, role: 'employer', password: DEMO_PASSWORD });
    let employer = await Employer.findOne({ owner: owner._id });
    if (!employer) {
      employer = await Employer.create({
        owner: owner._id,
        companyName: c.name,
        slug: slugify(c.name),
        industry: taxonomy[c.industry]!.ind._id,
        description: c.description,
        size: c.size,
        headquarters: c.city,
        website: `https://${slugify(c.name)}.example`,
        registrationNumber: `U72900KA2015PTC0${String(80000 + ci)}`,
        contactPerson: owner.name,
        contactEmail: ownerEmail,
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        verifiedBy: admin?._id,
        accountManager: recruiters[ci % 2]!._id,
        featured: ci < 6,
      });
    }
    if (await Job.exists({ employer: employer._id })) continue;
    for (const [ji, j] of c.jobs.entries()) {
      const t = taxonomy[j.industry]!;
      await Job.create({
        ...jobDescription(j.title, c.name),
        title: j.title,
        slug: uniqueSlug(`${j.title} ${c.name}`),
        skills: j.skills,
        industry: t.ind._id,
        category: t.cats[j.category]?._id,
        employer: employer._id,
        companyName: c.name,
        postedBy: owner._id,
        employmentType: j.employmentType,
        workMode: j.workMode,
        locations: [{ city: j.city, state: j.state, country: 'India' }],
        experience: { min: j.exp[0], max: j.exp[1] },
        salary: { min: j.salary[0], max: j.salary[1], currency: 'INR', period: j.period ?? 'yearly', disclosed: true },
        openings: 1 + (ji % 3),
        noticePeriodMaxDays: ji % 2 === 0 ? 60 : undefined,
        confidential: ci === 5 && ji === 1,
        assignedRecruiter: recruiters[ci % 2]!._id,
        status: 'published',
        publishedAt: new Date(Date.now() - (ci * 3 + ji) * 86400_000),
        moderatedBy: admin?._id,
        moderatedAt: new Date(),
        featured: Boolean(j.featured),
      });
    }
  }

  // Candidates
  const profiles = [];
  for (const [i, d] of DEMO_CANDIDATES.entries()) {
    const user = await ensureUser({ name: d.name, email: d.email, mobile: `98765001${String(i).padStart(2, '0')}`, role: 'candidate', password: DEMO_PASSWORD });
    let c = await Candidate.findOne({ user: user._id });
    if (!c) {
      c = new Candidate({
        user: user._id,
        headline: d.headline,
        summary: `${d.headline}. Looking for opportunities through Veejee Services.`,
        location: { city: d.city, state: d.state, country: 'India' },
        careerLevel: d.careerLevel,
        totalExperienceYears: d.years,
        skills: d.skills.map(([name, type]) => ({ name, type, level: 'intermediate' })),
        education: [{ qualification: d.edu[0], specialization: d.edu[1], institution: 'Demo University', startYear: 2015, endYear: d.careerLevel === 'fresher' ? 2025 : 2019 }],
        experience: d.exp ? [{ title: d.exp[0], company: d.exp[1], location: d.city, startDate: new Date(Date.now() - d.years * 365 * 86400_000), current: true }] : [],
        currentSalary: d.careerLevel === 'fresher' ? undefined : Math.round(d.expected * 0.8),
        expectedSalary: { min: d.expected, currency: 'INR', period: 'yearly' },
        preferredRoles: [...d.roles],
        preferredLocations: [d.city],
        preferredWorkModes: ['onsite', 'hybrid'],
        preferredIndustries: [taxonomy[d.industry]!.ind._id],
        employmentTypes: d.careerLevel === 'fresher' ? ['full_time', 'internship'] : ['full_time'],
        noticePeriodDays: d.notice,
        availability: d.notice === 0 ? 'immediate' : d.notice <= 30 ? 'within_30_days' : 'within_60_days',
        consent: { profileSharing: d.consent, contactSharing: d.contact, updatedAt: new Date() },
        assignedRecruiter: recruiters[i % 2]!._id,
        assignedAt: new Date(),
        stage: 'registered',
        stageHistory: [{ stage: 'registered', visibleToCandidate: true, at: new Date(Date.now() - 20 * 86400_000) }],
      });
      const pdf = demoResumePdf(d.name);
      const key = await storage.save('resumes', pdf, 'pdf');
      const r = await Resume.create({ owner: user._id, storageKey: key, originalName: `${d.name.replace(/\s+/g, '-')}-Resume.pdf`, mimeType: 'application/pdf', size: pdf.length, isPrimary: true });
      c.primaryResume = r._id;
      c.stage = 'profile_completed';
      c.stageHistory.push({ stage: 'profile_completed', visibleToCandidate: true, note: 'Profile completed – ready for Veejee Services review', at: new Date(Date.now() - 15 * 86400_000) });
      await c.save();
      if (d.consent) await Consent.create({ candidate: user._id, type: 'profile_sharing', granted: true, version: CONSENT_VERSION });
      if (d.contact) await Consent.create({ candidate: user._id, type: 'contact_sharing', granted: true, version: CONSENT_VERSION });
    }
    profiles.push({ user, c });
  }

  // A sample pipeline so every portal has something to show.
  const angularJob = await Job.findOne({ title: 'Senior Angular Developer' });
  const qaJob = await Job.findOne({ title: 'QA Automation Engineer' });
  if (angularJob && !(await Application.exists({ job: angularJob._id }))) {
    const settings = await getSettings();
    const [kavya, rahul] = [profiles[0]!, profiles[1]!];
    const now = Date.now();
    for (const p of [kavya, rahul]) {
      await Application.create({
        job: angularJob._id,
        employer: angularJob.employer,
        candidate: p.user._id,
        candidateProfile: p.c._id,
        resume: p.c.primaryResume,
        status: p === kavya ? 'shortlisted' : 'applied',
        statusHistory: [{ status: 'applied', changedBy: p.user._id, at: new Date(now - 6 * 86400_000) }],
      });
    }
    await Job.updateOne({ _id: angularJob._id }, { applicationsCount: 2 });
    const sl = await Shortlist.create({
      job: angularJob._id,
      employer: angularJob.employer,
      candidate: kavya.user._id,
      candidateProfile: kavya.c._id,
      source: 'application',
      match: scoreCandidate(angularJob, kavya.c, settings.matchingWeights),
      status: 'submitted',
      shortlistedBy: recruiters[0]!._id,
      reviewedBy: admin?._id,
      reviewedAt: new Date(now - 4 * 86400_000),
    });
    const consent = await Consent.findOne({ candidate: kavya.user._id, type: 'profile_sharing' });
    await Submission.create({
      job: angularJob._id,
      employer: angularJob.employer,
      candidate: kavya.user._id,
      candidateProfile: kavya.c._id,
      shortlist: sl._id,
      resume: kavya.c.primaryResume,
      submittedBy: recruiters[0]!._id,
      recruiterSummary: '4 years of Angular/Node experience, strong communication, available in 30 days. Interviewed by Veejee Services – recommended.',
      contactShared: true,
      consentRecord: consent!._id,
      status: 'company_reviewing',
      statusHistory: [
        { status: 'submitted', changedBy: recruiters[0]!._id, byRole: 'staff', visibleToCandidate: true, at: new Date(now - 3 * 86400_000) },
        { status: 'company_reviewing', byRole: 'company', visibleToCandidate: true, at: new Date(now - 2 * 86400_000) },
      ],
    });
    kavya.c.stage = 'company_reviewing';
    kavya.c.stageHistory.push(
      { stage: 'under_review', visibleToCandidate: true, note: 'Your profile is being reviewed by Veejee Services', at: new Date(now - 5 * 86400_000) },
      { stage: 'shortlisted', visibleToCandidate: true, note: 'Shortlisted for Senior Angular Developer', at: new Date(now - 4 * 86400_000) },
      { stage: 'submitted', visibleToCandidate: true, note: 'Profile submitted to Northwind Technologies', at: new Date(now - 3 * 86400_000) },
      { stage: 'company_reviewing', visibleToCandidate: true, at: new Date(now - 2 * 86400_000) },
    );
    await kavya.c.save();
  }
  if (qaJob && !(await Application.exists({ job: qaJob._id }))) {
    const priya = profiles[6]!;
    await Application.create({
      job: qaJob._id,
      employer: qaJob.employer,
      candidate: priya.user._id,
      candidateProfile: priya.c._id,
      resume: priya.c.primaryResume,
      status: 'applied',
      statusHistory: [{ status: 'applied', changedBy: priya.user._id, at: new Date() }],
    });
    await Job.updateOne({ _id: qaJob._id }, { applicationsCount: 1 });
  }
  logger.info(
    `Demo data ready (password "${DEMO_PASSWORD}"): admin@${DEMO_DOMAIN}, recruiter@${DEMO_DOMAIN}, recruiter2@${DEMO_DOMAIN}, employer@${DEMO_DOMAIN}, seeker@${DEMO_DOMAIN} (+7 demo candidates)`,
  );
}

export async function runSeed(opts: { demo: boolean; indexes?: boolean }) {
  if (opts.indexes) {
    for (const m of Object.values(mongoose.models)) await m.syncIndexes();
    logger.info('Indexes synchronised');
  }
  const taxonomy = await seedTaxonomy();
  await getSettings();
  const adminEmail = opts.demo ? `admin@${DEMO_DOMAIN}` : process.env.SEED_ADMIN_EMAIL;
  const adminPassword = opts.demo ? DEMO_PASSWORD : process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (!opts.demo && adminPassword.length < 12) throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters');
    await ensureUser({ name: process.env.SEED_ADMIN_NAME ?? 'Veejee Services Administrator', email: adminEmail.toLowerCase(), mobile: process.env.SEED_ADMIN_MOBILE ?? '9000000000', role: 'admin', password: adminPassword, permissions: ['*'] });
    logger.info(`Super administrator ensured: ${adminEmail}`);
  } else logger.warn('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set – no administrator created');
  if (opts.demo) {
    if (env.isProd) throw new Error('Refusing to load demo data in production');
    await seedDemo(taxonomy);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  connectDatabase()
    .then(() => runSeed({ demo: args.includes('--demo'), indexes: args.includes('--indexes') }))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.fatal({ err }, 'Seed failed');
      process.exit(1);
    });
}
