import { describe, it, expect } from 'vitest';
import { suggestEmployees } from './payslipSuggestions';

const emps = [
  { id: '1', first_name: 'Petrișor', last_name: 'Samoilă' },
  { id: '2', first_name: 'Ana', last_name: 'Popescu' },
  { id: '3', first_name: 'Ioan', last_name: 'Grădinaru' },
];

describe('payslip person suggestions', () => {
  it('finds the person despite missing diacritics and swapped order', () => {
    expect(suggestEmployees('PETRISOR SAMOILA', emps)[0].e.id).toBe('1');
  });
  it('tolerates a small typo', () => {
    expect(suggestEmployees('GRADINARU IOAM', emps)[0].e.id).toBe('3');
  });
  it('suggests nobody for an unrelated name', () => {
    expect(suggestEmployees('ZZZ QQQ', emps)).toHaveLength(0);
  });
});
