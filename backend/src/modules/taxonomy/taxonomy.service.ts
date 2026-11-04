import { slugify } from '../../common/crypto';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { Employer, Industry, Job, JobCategory } from '../../models';
import { audit, type Actor } from '../../services/activity.service';

export async function listIndustries(includeInactive: boolean) {
  const [industries, counts] = await Promise.all([
    Industry.find(includeInactive ? {} : { active: true }).sort({ order: 1, name: 1 }),
    Job.aggregate<{ _id: unknown; count: number }>([
      { $match: { status: 'published', deletedAt: null } },
      { $group: { _id: '$industry', count: { $sum: 1 } } },
    ]),
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.count]));
  return industries.map((i) => ({ ...i.toJSON(), jobCount: map.get(String(i._id)) ?? 0 }));
}

export async function getIndustry(slug: string) {
  const industry = await Industry.findOne({ slug, active: true });
  if (!industry) throw new NotFoundError('Industry');
  const categories = await JobCategory.find({ industry: industry._id, active: true }).sort({ name: 1 });
  return { industry, categories };
}

type IndustryInput = { name: string; description?: string; icon?: string; order?: number; active?: boolean };

export async function createIndustry(input: IndustryInput, actor: Actor) {
  const slug = slugify(input.name);
  if (await Industry.exists({ slug })) throw new ConflictError('An industry with this name already exists', 'DUPLICATE_RESOURCE');
  const doc = await Industry.create({ ...input, slug });
  await audit(actor, 'industry.create', 'Industry', doc._id, { name: doc.name });
  return doc;
}

export async function updateIndustry(id: string, input: Partial<IndustryInput>, actor: Actor) {
  const doc = await Industry.findById(id);
  if (!doc) throw new NotFoundError('Industry');
  Object.assign(doc, input);
  if (input.name) doc.slug = slugify(input.name);
  await doc.save();
  await audit(actor, 'industry.update', 'Industry', doc._id, input);
  return doc;
}

export async function deleteIndustry(id: string, actor: Actor) {
  const inUse = (await Job.exists({ industry: id })) || (await Employer.exists({ industry: id }));
  if (inUse) throw new ConflictError('This industry is in use by jobs or companies. Deactivate it instead.', 'IN_USE');
  const doc = await Industry.findByIdAndDelete(id);
  if (!doc) throw new NotFoundError('Industry');
  await JobCategory.deleteMany({ industry: id });
  await audit(actor, 'industry.delete', 'Industry', id, { name: doc.name });
}

export async function listCategories(industry?: string, includeInactive = false) {
  const filter: Record<string, unknown> = includeInactive ? {} : { active: true };
  if (industry) filter.industry = industry;
  return JobCategory.find(filter).sort({ name: 1 });
}

type CategoryInput = { name: string; industry: string; active?: boolean };

export async function createCategory(input: CategoryInput, actor: Actor) {
  if (!(await Industry.exists({ _id: input.industry }))) throw new ValidationError('Unknown industry', [{ field: 'industry', message: 'Unknown industry' }]);
  const doc = await JobCategory.create({ ...input, slug: slugify(input.name) });
  await audit(actor, 'category.create', 'JobCategory', doc._id, { name: doc.name });
  return doc;
}

export async function updateCategory(id: string, input: Partial<CategoryInput>, actor: Actor) {
  const doc = await JobCategory.findById(id);
  if (!doc) throw new NotFoundError('Category');
  Object.assign(doc, input);
  if (input.name) doc.slug = slugify(input.name);
  await doc.save();
  await audit(actor, 'category.update', 'JobCategory', doc._id, input);
  return doc;
}

export async function deleteCategory(id: string, actor: Actor) {
  if (await Job.exists({ category: id })) throw new ConflictError('This category is used by jobs. Deactivate it instead.', 'IN_USE');
  const doc = await JobCategory.findByIdAndDelete(id);
  if (!doc) throw new NotFoundError('Category');
  await audit(actor, 'category.delete', 'JobCategory', id, { name: doc.name });
}
