import { Salary } from '../../core/models';
import { SalaryRangePipe, formatInrCompact } from './salary-range.pipe';

const s = (p: Partial<Salary>): Salary => ({ currency: 'INR', period: 'yearly', disclosed: true, ...p });

describe('SalaryRangePipe', () => {
  const pipe = new SalaryRangePipe();

  it('formats a yearly range in lakhs', () => {
    expect(pipe.transform(s({ min: 450000, max: 800000 }))).toBe('₹4.5 L – 8 L / year');
  });

  it('formats monthly salaries in thousands', () => {
    expect(pipe.transform(s({ min: 25000, max: 40000, period: 'monthly' }))).toBe('₹25K – 40K / month');
  });

  it('handles only a minimum or only a maximum', () => {
    expect(pipe.transform(s({ min: 1200000 }))).toBe('From ₹12 L / year');
    expect(pipe.transform(s({ max: 30000, period: 'monthly' }))).toBe('Up to ₹30K / month');
  });

  it('collapses equal min and max', () => {
    expect(pipe.transform(s({ min: 600000, max: 600000 }))).toBe('₹6 L / year');
  });

  it('respects disclosed=false and missing values', () => {
    expect(pipe.transform(s({ min: 100, max: 200, disclosed: false }))).toBe('Not disclosed');
    expect(pipe.transform(s({}))).toBe('Not disclosed');
    expect(pipe.transform(null)).toBe('Not disclosed');
    expect(pipe.transform(undefined)).toBe('Not disclosed');
  });

  it('formats crores', () => {
    expect(formatInrCompact(25000000)).toBe('2.5 Cr');
    expect(formatInrCompact(950)).toBe('950');
  });
});
