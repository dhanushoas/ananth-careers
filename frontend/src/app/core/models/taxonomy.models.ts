export interface Industry {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  order?: number;
  active: boolean;
  jobCount?: number;
}

export interface RefSummary {
  id: string;
  name: string;
  slug: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  /** Industry id (some endpoints may populate it). */
  industry: string | RefSummary;
  active: boolean;
}

export interface IndustryDetail {
  industry: Industry;
  categories: Category[];
}

export interface IndustryInput {
  name: string;
  description?: string;
  icon?: string;
  order?: number;
  active?: boolean;
}

export interface CategoryInput {
  name: string;
  industry: string;
  active?: boolean;
}
