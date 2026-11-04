import type { CONTENT_KEYS } from '../../common/constants';

/**
 * Initial website content. Administrators can replace every block from
 * Admin → Website content; these defaults are served until then.
 * Policy texts are a professional starting point and must be reviewed by
 * legal counsel before launch.
 */
const updated = '2026-11-04';
const policy = (title: string, sections: [string, string][]) => ({ title, updatedAt: updated, sections: sections.map(([heading, body]) => ({ heading, body })) });

const PROCESS_STEPS = [
  { icon: 'person_add', title: 'Candidate registers', body: 'Candidates create a profile with their skills, education, experience, salary expectations and preferences, and upload a resume.' },
  { icon: 'fact_check', title: 'Veejee Services screens', body: 'Our recruiters verify profile information and evaluate each candidate’s suitability.' },
  { icon: 'filter_alt', title: 'We filter & shortlist', body: 'We match candidates against each company’s hiring requirements using a transparent match score – and our recruiters make the final call.' },
  { icon: 'send', title: 'Profile shared with the company', body: 'With the candidate’s consent, we share the shortlisted profile with the employer through our secure portal.' },
  { icon: 'groups', title: 'Company interviews', body: 'The employer reviews the profile and requests an interview. Veejee Services schedules it and keeps everyone informed.' },
  { icon: 'emoji_events', title: 'Placement', body: 'Once selected, we coordinate the offer and joining – and mark the candidate as successfully placed.' },
];

export const DEFAULT_CONTENT: Record<(typeof CONTENT_KEYS)[number], unknown> = {
  home: {
    heroTitle: 'Your Recruitment Partner',
    heroSubtitle:
      'Veejee Services connects qualified candidates with the right companies. We screen, shortlist and coordinate interviews – so candidates find the right role and employers meet the right people.',
    stats: [],
  },
  about: {
    title: 'About Veejee Services',
    intro:
      'Veejee Services is a recruitment consultancy that works between job seekers and companies. We do not simply list jobs – our recruitment team manages the full journey from registration to successful placement.',
    sections: [
      { heading: 'Our mission', body: 'To make quality employment accessible to everyone – freshers, skilled professionals and senior talent – through a transparent, respectful and secure recruitment process.' },
      { heading: 'How we are different', body: 'Every candidate is screened by our recruiters before any profile reaches a company, and every profile is shared only with the candidate’s consent. Companies receive a focused shortlist instead of hundreds of unfiltered applications.' },
      { heading: 'Industries we serve', body: 'IT & software development, banking & finance, healthcare, manufacturing, construction & civil engineering, retail & marketing, sales & customer support, logistics & supply chain, hospitality & food, education & administration, and freshers & internships.' },
    ],
    values: ['Integrity', 'Candidate consent & privacy', 'Transparency', 'Equal opportunity', 'Speed with quality'],
  },
  services: {
    title: 'Our Services',
    items: [
      { icon: 'person_search', title: 'Candidate screening', body: 'Profile verification, skills assessment and suitability review by experienced recruiters.' },
      { icon: 'filter_alt', title: 'Requirement-based shortlisting', body: 'We match registered candidates to each company requirement and share a focused, consented shortlist.' },
      { icon: 'event_available', title: 'Interview coordination', body: 'We schedule interviews, send invitations and reminders, and collect feedback from employers.' },
      { icon: 'business_center', title: 'Permanent & contract staffing', body: 'Full-time, contract, temporary and volume hiring across 11+ industries.' },
      { icon: 'school', title: 'Freshers & internships', body: 'Campus and entry-level hiring programmes that help graduates start their careers.' },
      { icon: 'insights', title: 'Hiring progress reporting', body: 'Employers track every submitted candidate from review to placement in their dashboard.' },
    ],
  },
  process: { title: 'How our recruitment process works', steps: PROCESS_STEPS },
  'job-seekers': {
    title: 'For job seekers',
    intro: 'Register once and let our recruitment team match you with suitable opportunities across industries.',
    benefits: [
      { icon: 'verified_user', title: 'Free for candidates', body: 'Veejee Services never charges candidates for registering, applying or being placed.' },
      { icon: 'lock', title: 'You control your data', body: 'Your profile is shared with a company only with your consent, and you can withdraw consent at any time.' },
      { icon: 'track_changes', title: 'Track every step', body: 'See your recruitment status, the companies your profile was shared with and your interview schedule in one dashboard.' },
      { icon: 'support_agent', title: 'A recruiter on your side', body: 'Our recruiters guide you through interviews and keep you updated until you are placed.' },
    ],
    steps: PROCESS_STEPS,
  },
  employers: {
    title: 'For employers',
    intro: 'Tell us what you need. We screen, shortlist and coordinate interviews so you only meet suitable, interested candidates.',
    benefits: [
      { icon: 'fact_check', title: 'Pre-screened candidates', body: 'Every profile you receive has been reviewed by a Veejee Services recruiter against your requirement.' },
      { icon: 'speed', title: 'Faster hiring', body: 'Post a requirement and receive a focused shortlist – no sifting through hundreds of applications.' },
      { icon: 'event_available', title: 'Interviews handled for you', body: 'Request an interview and we arrange the schedule with the candidate.' },
      { icon: 'insights', title: 'Transparent progress', body: 'Follow each candidate from submission to placement and share feedback in your employer portal.' },
    ],
    steps: [
      { title: 'Register your company', body: 'Create an account; our team verifies your company details.' },
      { title: 'Post a requirement', body: 'Share the role, vacancies, skills, experience, salary range, location and qualifications.' },
      { title: 'Receive shortlisted candidates', body: 'We submit screened, consented profiles to your portal.' },
      { title: 'Interview & hire', body: 'Accept, reject or request interviews – we coordinate until placement.' },
    ],
  },
  faq: {
    items: [
      { question: 'Is Veejee Services free for job seekers?', answer: 'Yes. Registration, profile creation and placement are free for candidates. Veejee Services never asks candidates to pay for a job.' },
      { question: 'How does the process work?', answer: 'You register and complete your profile. Our recruiters review it, match you with company requirements and – with your consent – share your profile with suitable employers. We then coordinate interviews and keep you updated until placement.' },
      { question: 'Can companies see my profile without my permission?', answer: 'No. Companies only see candidates that Veejee Services has shortlisted and submitted to them, and only if you have enabled profile sharing. Your phone number and email are shared only if you separately allow it.' },
      { question: 'How do I give or withdraw consent?', answer: 'Go to Account settings → Privacy & consent. Changes apply immediately and are recorded for your protection.' },
      { question: 'How do I apply for a specific job?', answer: 'Open any job opportunity and click "Apply through Veejee Services". Our recruiters review every application before anything is shared with the company.' },
      { question: 'I am an employer. How do I hire through Veejee Services?', answer: 'Register your company, wait for verification, then post your recruitment requirement. We will submit screened candidates to your employer portal.' },
      { question: 'How do I delete my account?', answer: 'Go to Account settings → Privacy and choose "Delete my account". Your resumes and personal details are permanently removed.' },
    ],
  },
  privacy: policy('Privacy Policy', [
    ['Who we are', 'Veejee Services ("we") operates this recruitment platform and acts as a Data Fiduciary under the Digital Personal Data Protection Act, 2023 (India) for personal data processed through it.'],
    ['Data we collect', 'Account data (name, email, mobile number), profile data you choose to provide (education, experience, skills, salary, notice period, preferences), resumes and photos, recruitment records (applications, shortlists, submissions, interviews), and technical data such as IP address required for security.'],
    ['Why we process it', 'To create and secure your account, screen and match you with job requirements, coordinate interviews, send service notifications, prevent fraud and comply with law.'],
    ['Sharing with employers – your consent', 'We share your profile with a company only after you have given profile-sharing consent, and your contact details only with separate contact-sharing consent. Every grant and withdrawal of consent is recorded with a timestamp. Companies see only candidates we have submitted to them.'],
    ['Service providers', 'We use service providers (cloud hosting, database, email delivery, file storage) bound by contract to protect your data. We do not sell personal data.'],
    ['Security', 'All traffic is encrypted with HTTPS/TLS. Passwords are hashed with Argon2id. Resumes and photos are encrypted at rest using AES-256-GCM. Internal recruiter notes are never visible to candidates or companies. Sensitive actions are audit-logged.'],
    ['Retention', 'We keep your data while your account is active. When you delete your account we erase your resumes, photos and profile, withdraw your consent, and anonymise records we must retain for legal or audit purposes.'],
    ['Your rights', 'You may access and export your data, correct it, withdraw consent, delete your account and nominate another person to exercise your rights, from Account settings or by contacting our Grievance Officer.'],
    ['Grievance Officer', 'Contact the Grievance Officer through the Contact Us page. We respond within the timelines prescribed under applicable law. You may also approach the Data Protection Board of India.'],
  ]),
  terms: policy('Terms & Conditions', [
    ['Acceptance', 'By creating an account or using Veejee Services you agree to these Terms and our Privacy Policy.'],
    ['Our role', 'Veejee Services is a recruitment intermediary. We screen, shortlist and submit candidates and coordinate interviews; hiring decisions are made by the employer.'],
    ['Candidates', 'You must provide accurate information and documents. Do not register with another person’s identity.'],
    ['Employers', 'Employers must be genuine businesses with real vacancies. Charging candidates any fee, posting misleading requirements or misusing candidate data is prohibited and will result in termination.'],
    ['Confidentiality', 'Candidate information received through Veejee Services may be used only for evaluating the candidate for the stated requirement.'],
    ['Liability', 'Veejee Services does not guarantee employment or hiring outcomes. To the extent permitted by law our liability is limited to the fees paid to us, if any.'],
    ['Governing law', 'These Terms are governed by the laws of India.'],
  ]),
  refund: policy('Refund & Service Policy', [
    ['Candidates', 'Veejee Services never charges candidates for registration, screening or placement.'],
    ['Employer services', 'The scope, fee and replacement terms of recruitment services for employers are confirmed in a written agreement before work begins.'],
    ['Refunds', 'Refund and replacement terms for employer services are as defined in the service agreement. Contact us through the Contact Us page with your invoice number for any request.'],
    ['Payment security', 'Payments are processed by an authorised payment gateway. Veejee Services never stores card numbers, CVV or banking credentials.'],
  ]),
};
