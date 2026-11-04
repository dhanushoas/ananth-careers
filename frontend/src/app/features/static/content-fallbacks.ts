import { AudienceContent, FaqContent, PolicyContent, ProcessContent } from '../../core/models';

/** Keys rendered by the generic content page. */
export type PageKey = 'about' | 'services' | 'faq' | 'privacy' | 'terms' | 'refund';
type PolicyKey = Exclude<PageKey, 'faq'>;

export const PAGE_TITLES: Record<PageKey, string> = {
  about: 'About Veejee Services',
  services: 'Our Services',
  faq: 'Frequently Asked Questions',
  privacy: 'Privacy Policy',
  terms: 'Terms of Use',
  refund: 'Refund Policy',
};

/** Shown when GET /content/:key has no value yet, so every page still has sensible structure. */
export const FALLBACK_CONTENT: Record<PolicyKey, PolicyContent> & { faq: FaqContent } = {
  about: {
    title: PAGE_TITLES.about,
    sections: [
      {
        heading: 'Who we are',
        body: 'Veejee Services is a recruitment consultancy – your recruitment partner. We connect candidates with client companies across India, from freshers and interns to experienced professionals.',
      },
      {
        heading: 'How we work',
        body: 'Candidates register with Veejee Services and our recruiters screen and shortlist them for open requirements. A profile is shared with a company only with the candidate’s consent, and we coordinate every interview through to placement.',
      },
      {
        heading: 'Industries we serve',
        body: 'IT & Software Development, Banking & Finance, Healthcare & Medical, Manufacturing, Construction & Civil Engineering, Retail & Marketing, Sales & Customer Support, Logistics & Supply Chain, Hospitality & Food Industry, Education & Administration, Freshers & Internships and other professional categories.',
      },
    ],
  },
  services: {
    title: PAGE_TITLES.services,
    sections: [
      {
        heading: 'For candidates',
        body: 'Free registration, profile and resume hosting, matching to suitable requirements, recruiter guidance and interview coordination until you are placed.',
      },
      {
        heading: 'For companies',
        body: 'Post recruitment requirements and receive screened, shortlisted candidates who have consented to share their profile. We schedule interviews and keep you updated to placement.',
      },
      {
        heading: 'Consultancy support',
        body: 'Role definition, bulk hiring drives and campus recruitment for freshers. Contact us to discuss your hiring needs.',
      },
    ],
  },
  faq: {
    items: [
      { question: 'Is Veejee Services free for candidates?', answer: 'Yes. Registering, applying and being placed through Veejee Services is free for candidates.' },
      {
        question: 'Will companies see my profile without my permission?',
        answer: 'No. Companies never browse our candidate database. We share your profile only for suitable roles, and only when you have given consent – you can change this at any time in your privacy settings.',
      },
      {
        question: 'How do companies receive candidates?',
        answer: 'Companies post requirements with Veejee Services. Our recruiters screen and shortlist candidates and submit consented profiles to the company through the employer portal.',
      },
      { question: 'Which resume format is supported?', answer: 'PDF files up to 5 MB. You can keep up to 5 resumes and choose a primary one.' },
      { question: 'Who schedules interviews?', answer: 'Veejee Services. The company requests an interview and our team schedules it with you.' },
    ],
  },
  privacy: {
    title: PAGE_TITLES.privacy,
    sections: [
      {
        heading: 'Overview',
        body: 'We only collect the data needed to provide recruitment services. Resumes are stored encrypted, your profile is shared with client companies only with your consent, and you can export or delete your data at any time from your account settings.',
      },
      { heading: 'Contact', body: 'For privacy questions, please reach us through the Contact page.' },
    ],
  },
  terms: {
    title: PAGE_TITLES.terms,
    sections: [
      {
        heading: 'Overview',
        body: 'By using Veejee Services you agree to provide accurate information and to use the platform only for genuine recruitment purposes.',
      },
    ],
  },
  refund: {
    title: PAGE_TITLES.refund,
    sections: [
      { heading: 'Overview', body: 'Candidates are never charged. For questions about paid services for companies, please contact us.' },
    ],
  },
};

export const PROCESS_FALLBACK: ProcessContent = {
  title: 'How our recruitment process works',
  intro: 'From registration to placement, Veejee Services handles every step between candidates and companies.',
  steps: [
    { icon: 'bi-person-plus', title: 'Register', body: 'Candidates create a free account with Veejee Services.' },
    { icon: 'bi-person-vcard', title: 'Complete your profile', body: 'Add skills, education, experience, preferences and a resume.' },
    { icon: 'bi-search', title: 'Review & screening', body: 'Our recruiters verify information and evaluate suitability.' },
    { icon: 'bi-bullseye', title: 'Matching to requirements', body: 'We match candidates to company requirements with a transparent score – recruiters make the final call.' },
    { icon: 'bi-shield-check', title: 'Shortlist & consent', body: 'Shortlisted profiles are approved internally and shared only with the candidate’s consent.' },
    { icon: 'bi-send-check', title: 'Submitted to company', body: 'The company reviews the profile in its secure portal.' },
    { icon: 'bi-calendar2-event', title: 'Interviews', body: 'The company requests an interview and Veejee Services schedules it.' },
    { icon: 'bi-trophy', title: 'Placement', body: 'We coordinate the offer and joining – successfully placed!' },
  ],
};

export const AUDIENCE_FALLBACK: Record<'job-seekers' | 'employers', AudienceContent> = {
  'job-seekers': {
    title: 'For job seekers',
    intro: 'Register once and let the Veejee Services recruitment team match you with suitable opportunities across industries.',
    benefits: [
      { icon: 'bi-gift', title: 'Free for candidates', body: 'We never charge candidates for registering, applying or being placed.' },
      { icon: 'bi-shield-lock', title: 'You control your data', body: 'Your profile is shared with a company only with your consent.' },
      { icon: 'bi-activity', title: 'Track every step', body: 'See your status, the companies your profile was shared with and your interviews.' },
      { icon: 'bi-headset', title: 'A recruiter on your side', body: 'Our recruiters guide you through interviews until you are placed.' },
    ],
    steps: [
      { title: 'Register & build your profile', body: 'Skills, education, experience, preferences and resume.' },
      { title: 'We review and match you', body: 'Recruiters screen your profile against open requirements.' },
      { title: 'Shortlisted & shared with consent', body: 'Suitable profiles go to the company only with your consent.' },
      { title: 'Interview & get placed', body: 'We schedule interviews and support you to joining.' },
    ],
  },
  employers: {
    title: 'For employers',
    intro: 'Tell us what you need. We screen, shortlist and coordinate interviews so you only meet suitable, interested candidates.',
    benefits: [
      { icon: 'bi-clipboard-check', title: 'Pre-screened candidates', body: 'Every profile you receive was reviewed by a Veejee Services recruiter.' },
      { icon: 'bi-speedometer2', title: 'Faster hiring', body: 'Receive a focused shortlist instead of hundreds of applications.' },
      { icon: 'bi-calendar2-check', title: 'Interviews handled for you', body: 'Request an interview – we arrange it with the candidate.' },
      { icon: 'bi-graph-up', title: 'Transparent progress', body: 'Follow each candidate from submission to placement and share feedback.' },
    ],
    steps: [
      { title: 'Register your company', body: 'Veejee Services verifies your company details.' },
      { title: 'Post a requirement', body: 'Role, vacancies, skills, experience, salary range, locations and qualifications.' },
      { title: 'Receive shortlisted candidates', body: 'Screened, consented profiles arrive in your portal.' },
      { title: 'Interview & hire', body: 'Request interviews, share feedback and confirm selections.' },
    ],
  },
};
