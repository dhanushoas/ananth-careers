import { EmploymentType, Job, SalaryPeriod } from './job.models';
import { Interview } from './interview.models';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type SkillType = 'technical' | 'non_technical';
export type SkillLevel = 'beginner' | 'intermediate' | 'expert';

export interface Skill {
  name: string;
  type: SkillType;
  level?: SkillLevel;
}

export interface Education {
  qualification: string;
  institution: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
  grade?: string;
}

export interface Experience {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string | null;
  current: boolean;
  description?: string;
}

export interface ProfileLocation {
  city: string;
  state: string;
  country: string;
}

export interface ExpectedSalary {
  min?: number | null;
  max?: number | null;
  currency: 'INR';
  period: SalaryPeriod;
}

export interface JobSeekerProfile {
  id: string;
  user: string;
  headline: string;
  summary: string;
  location: ProfileLocation;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  skills: Skill[];
  education: Education[];
  experience: Experience[];
  totalExperienceYears: number;
  currentSalary?: number | null;
  expectedSalary: ExpectedSalary;
  preferredLocations: string[];
  preferredIndustries: string[];
  employmentTypes: EmploymentType[];
  noticePeriodDays?: number | null;
  primaryResume?: string | null;
  savedJobs: string[];
  profileCompletion: number;
  openToWork: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Body of PUT /jobseekers/me (server-managed fields omitted). */
export type JobSeekerProfileInput = Omit<
  JobSeekerProfile,
  'id' | 'user' | 'savedJobs' | 'profileCompletion' | 'createdAt' | 'updatedAt' | 'primaryResume'
>;

export interface JobSeekerDashboard {
  applications: { total: number; byStatus: Partial<Record<string, number>> };
  savedJobs: number;
  upcomingInterviews: Interview[];
  profileCompletion: number;
  recommendedJobs: Job[];
}
