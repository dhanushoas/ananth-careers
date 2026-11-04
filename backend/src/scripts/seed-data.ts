export const INDUSTRIES: { name: string; icon: string; description: string; categories: string[] }[] = [
  { name: 'IT & Software Development', icon: 'terminal', description: 'Software development, cloud, data, QA, IT support and cybersecurity roles.', categories: ['Software Development', 'Cloud & DevOps', 'Data & Analytics', 'Quality Assurance', 'IT Support', 'Cybersecurity', 'UI/UX Design'] },
  { name: 'Retail & Marketing', icon: 'storefront', description: 'Store operations, merchandising, digital marketing and brand roles.', categories: ['Store Operations', 'Merchandising', 'Digital Marketing', 'Brand Management', 'E-commerce'] },
  { name: 'Construction & Civil Engineering', icon: 'engineering', description: 'Site engineering, project management, architecture and skilled trades.', categories: ['Site Engineering', 'Project Management', 'Architecture', 'Quantity Surveying', 'Skilled Trades'] },
  { name: 'Hospitality & Food Industry', icon: 'restaurant', description: 'Hotels, restaurants, catering, kitchen and front-office roles.', categories: ['Culinary', 'Front Office', 'Housekeeping', 'Food & Beverage Service', 'Hotel Management'] },
  { name: 'Manufacturing', icon: 'precision_manufacturing', description: 'Production, quality, maintenance and plant operations.', categories: ['Production', 'Quality Control', 'Maintenance', 'Plant Operations', 'Supply Planning'] },
  { name: 'Banking & Finance', icon: 'account_balance', description: 'Banking, accounting, insurance, audit and financial analysis.', categories: ['Retail Banking', 'Accounting', 'Insurance', 'Audit & Compliance', 'Financial Analysis'] },
  { name: 'Healthcare & Medical', icon: 'medical_services', description: 'Doctors, nursing, pharmacy, lab and hospital administration.', categories: ['Nursing', 'Physicians', 'Pharmacy', 'Laboratory', 'Hospital Administration'] },
  { name: 'Logistics & Supply Chain', icon: 'local_shipping', description: 'Warehousing, fleet, delivery and supply chain operations.', categories: ['Warehouse Operations', 'Fleet & Drivers', 'Supply Chain', 'Last-mile Delivery'] },
  { name: 'Sales & Customer Support', icon: 'support_agent', description: 'Field sales, inside sales, customer service and BPO roles.', categories: ['Field Sales', 'Inside Sales', 'Customer Service', 'Telecalling', 'Account Management'] },
  { name: 'Education & Administration', icon: 'school', description: 'Teaching, training, academic administration and office roles.', categories: ['Teaching', 'Training', 'Academic Administration', 'Office Administration', 'Human Resources'] },
  { name: 'Freshers & Internships', icon: 'rocket_launch', description: 'Entry-level roles, graduate programmes and internships.', categories: ['Graduate Trainee', 'Internship', 'Apprenticeship'] },
  { name: 'Other Professional Categories', icon: 'work', description: 'Legal, media, consulting and other professional roles.', categories: ['Legal', 'Media & Content', 'Consulting', 'General'] },
];

/** A tiny but valid single-page PDF, used for the demo job seeker's resume. */
export function demoResumePdf(name: string) {
  const content = `BT /F1 18 Tf 72 720 Td (${name} - Resume) Tj 0 -30 Td /F1 12 Tf (Full-stack developer - Angular, Node.js, MongoDB) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

type DemoJob = {
  title: string;
  industry: number;
  category: number;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary' | 'freelance';
  workMode: 'onsite' | 'remote' | 'hybrid';
  city: string;
  state: string;
  exp: [number, number];
  salary: [number, number];
  period?: 'yearly' | 'monthly';
  skills: string[];
  featured?: boolean;
};

export const DEMO_COMPANIES: { name: string; industry: number; city: string; size: string; description: string; jobs: DemoJob[] }[] = [
  {
    name: 'Northwind Technologies',
    industry: 0,
    city: 'Bengaluru',
    size: '201-500',
    description: 'Northwind builds cloud software for logistics and retail businesses across India.',
    jobs: [
      { title: 'Senior Angular Developer', industry: 0, category: 0, employmentType: 'full_time', workMode: 'hybrid', city: 'Bengaluru', state: 'Karnataka', exp: [4, 8], salary: [1800000, 2800000], skills: ['Angular', 'TypeScript', 'RxJS', 'SCSS'], featured: true },
      { title: 'Node.js Backend Engineer', industry: 0, category: 0, employmentType: 'full_time', workMode: 'remote', city: 'Bengaluru', state: 'Karnataka', exp: [2, 5], salary: [1200000, 2000000], skills: ['Node.js', 'Express', 'MongoDB', 'REST APIs'], featured: true },
      { title: 'DevOps Engineer (AWS)', industry: 0, category: 1, employmentType: 'full_time', workMode: 'hybrid', city: 'Hyderabad', state: 'Telangana', exp: [3, 6], salary: [1500000, 2400000], skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'] },
      { title: 'QA Automation Engineer', industry: 0, category: 3, employmentType: 'contract', workMode: 'remote', city: 'Pune', state: 'Maharashtra', exp: [2, 4], salary: [800000, 1300000], skills: ['Playwright', 'Selenium', 'API Testing'] },
      { title: 'Software Engineering Intern', industry: 10, category: 1, employmentType: 'internship', workMode: 'onsite', city: 'Bengaluru', state: 'Karnataka', exp: [0, 0], salary: [20000, 30000], period: 'monthly', skills: ['JavaScript', 'Git', 'Problem Solving'] },
    ],
  },
  {
    name: 'Saffron Retail Group',
    industry: 1,
    city: 'Mumbai',
    size: '1000+',
    description: 'A leading omnichannel fashion and lifestyle retailer with 200+ stores.',
    jobs: [
      { title: 'Store Manager', industry: 1, category: 0, employmentType: 'full_time', workMode: 'onsite', city: 'Mumbai', state: 'Maharashtra', exp: [5, 10], salary: [700000, 1100000], skills: ['Retail Operations', 'Team Leadership', 'Inventory'], featured: true },
      { title: 'Digital Marketing Executive', industry: 1, category: 2, employmentType: 'full_time', workMode: 'hybrid', city: 'Mumbai', state: 'Maharashtra', exp: [1, 3], salary: [400000, 650000], skills: ['SEO', 'Google Ads', 'Social Media'] },
      { title: 'Visual Merchandiser', industry: 1, category: 1, employmentType: 'full_time', workMode: 'onsite', city: 'Delhi', state: 'Delhi', exp: [2, 5], salary: [350000, 550000], skills: ['Visual Merchandising', 'Planograms'] },
    ],
  },
  {
    name: 'Meridian Infra Projects',
    industry: 2,
    city: 'Chennai',
    size: '501-1000',
    description: 'Infrastructure and commercial construction across South India.',
    jobs: [
      { title: 'Site Engineer – Civil', industry: 2, category: 0, employmentType: 'full_time', workMode: 'onsite', city: 'Chennai', state: 'Tamil Nadu', exp: [2, 6], salary: [450000, 750000], skills: ['AutoCAD', 'Site Supervision', 'BOQ'], featured: true },
      { title: 'Construction Project Manager', industry: 2, category: 1, employmentType: 'full_time', workMode: 'onsite', city: 'Coimbatore', state: 'Tamil Nadu', exp: [8, 15], salary: [1400000, 2200000], skills: ['Project Planning', 'MS Project', 'Contracts'] },
      { title: 'Quantity Surveyor', industry: 2, category: 3, employmentType: 'contract', workMode: 'onsite', city: 'Bengaluru', state: 'Karnataka', exp: [3, 7], salary: [600000, 900000], skills: ['Estimation', 'Rate Analysis'] },
    ],
  },
  {
    name: 'Coastal Hospitality Pvt Ltd',
    industry: 3,
    city: 'Goa',
    size: '201-500',
    description: 'Boutique resorts and restaurants on India’s west coast.',
    jobs: [
      { title: 'Commis Chef', industry: 3, category: 0, employmentType: 'full_time', workMode: 'onsite', city: 'Panaji', state: 'Goa', exp: [1, 3], salary: [22000, 30000], period: 'monthly', skills: ['Continental Cuisine', 'Food Safety'] },
      { title: 'Front Office Associate', industry: 3, category: 1, employmentType: 'full_time', workMode: 'onsite', city: 'Panaji', state: 'Goa', exp: [0, 2], salary: [18000, 25000], period: 'monthly', skills: ['Guest Relations', 'Opera PMS', 'English'] },
    ],
  },
  {
    name: 'Apex Precision Manufacturing',
    industry: 4,
    city: 'Pune',
    size: '501-1000',
    description: 'Automotive components manufacturer supplying global OEMs.',
    jobs: [
      { title: 'Production Supervisor', industry: 4, category: 0, employmentType: 'full_time', workMode: 'onsite', city: 'Pune', state: 'Maharashtra', exp: [3, 8], salary: [500000, 800000], skills: ['Lean Manufacturing', '5S', 'Shift Management'] },
      { title: 'Quality Inspector', industry: 4, category: 1, employmentType: 'full_time', workMode: 'onsite', city: 'Chakan', state: 'Maharashtra', exp: [1, 4], salary: [300000, 450000], skills: ['ISO 9001', 'Measuring Instruments'] },
    ],
  },
  {
    name: 'TrustBridge Finance',
    industry: 5,
    city: 'Gurugram',
    size: '1000+',
    description: 'A digital-first NBFC offering loans and insurance to small businesses.',
    jobs: [
      { title: 'Relationship Manager – Business Loans', industry: 5, category: 0, employmentType: 'full_time', workMode: 'onsite', city: 'Gurugram', state: 'Haryana', exp: [2, 6], salary: [500000, 900000], skills: ['Sales', 'Credit Assessment', 'CRM'] },
      { title: 'Chartered Accountant', industry: 5, category: 1, employmentType: 'full_time', workMode: 'hybrid', city: 'Noida', state: 'Uttar Pradesh', exp: [1, 5], salary: [1000000, 1600000], skills: ['Ind AS', 'GST', 'Audit'] },
    ],
  },
  {
    name: 'CarePlus Hospitals',
    industry: 6,
    city: 'Hyderabad',
    size: '1000+',
    description: 'Multi-speciality hospital network with 12 hospitals.',
    jobs: [
      { title: 'Staff Nurse (ICU)', industry: 6, category: 0, employmentType: 'full_time', workMode: 'onsite', city: 'Hyderabad', state: 'Telangana', exp: [1, 5], salary: [360000, 540000], skills: ['Critical Care', 'BLS', 'Patient Care'], featured: true },
      { title: 'Pharmacist', industry: 6, category: 2, employmentType: 'part_time', workMode: 'onsite', city: 'Hyderabad', state: 'Telangana', exp: [0, 3], salary: [18000, 26000], period: 'monthly', skills: ['Dispensing', 'Inventory'] },
    ],
  },
  {
    name: 'SwiftMove Logistics',
    industry: 7,
    city: 'Ahmedabad',
    size: '501-1000',
    description: 'Warehousing and express delivery across 300 cities.',
    jobs: [
      { title: 'Warehouse Supervisor', industry: 7, category: 0, employmentType: 'full_time', workMode: 'onsite', city: 'Ahmedabad', state: 'Gujarat', exp: [2, 5], salary: [350000, 500000], skills: ['WMS', 'Inventory Control', 'Team Handling'] },
      { title: 'Delivery Partner', industry: 7, category: 3, employmentType: 'temporary', workMode: 'onsite', city: 'Surat', state: 'Gujarat', exp: [0, 1], salary: [15000, 22000], period: 'monthly', skills: ['Two-wheeler Licence', 'Navigation'] },
    ],
  },
  {
    name: 'BrightPath Learning',
    industry: 9,
    city: 'Kolkata',
    size: '51-200',
    description: 'K-12 schools and skill-development centres.',
    jobs: [
      { title: 'Mathematics Teacher (High School)', industry: 9, category: 0, employmentType: 'full_time', workMode: 'onsite', city: 'Kolkata', state: 'West Bengal', exp: [2, 8], salary: [360000, 600000], skills: ['CBSE Curriculum', 'Classroom Management'] },
      { title: 'Customer Support Executive', industry: 8, category: 2, employmentType: 'full_time', workMode: 'remote', city: 'Kolkata', state: 'West Bengal', exp: [0, 2], salary: [240000, 330000], skills: ['Communication', 'Hindi', 'English', 'CRM'] },
    ],
  },
];

export function jobDescription(title: string, company: string) {
  return {
    description: `${company} is hiring a ${title}. You will join a supportive team, work on meaningful projects and grow your career with structured learning and mentoring. We value integrity, ownership and collaboration, and we are committed to equal opportunity employment.`,
    responsibilities: [
      `Deliver the day-to-day responsibilities of the ${title} role to a high standard`,
      'Collaborate with team members and stakeholders to meet goals',
      'Maintain accurate records and follow company processes and safety standards',
      'Continuously improve your skills and share knowledge with the team',
    ],
    requirements: ['Relevant qualification or equivalent practical experience', 'Good communication skills', 'Willingness to learn and adapt'],
    qualifications: ['Graduate / Diploma in a relevant field'],
  };
}
