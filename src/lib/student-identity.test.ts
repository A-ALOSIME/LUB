import {expect,it} from 'vitest';
import {normalizeMajor,validNationalId} from './student-identity';
it('validates Saudi national and resident ID checksums without accepting other identifier types',()=>{
 expect(validNationalId('1000000008')).toBe(true);expect(validNationalId('2000000006')).toBe(true);
 for(const invalid of ['1000000009','3000000004','0000000000','123','1abcdefgh8'])expect(validNationalId(invalid)).toBe(false);
});
it('normalizes known Arabic and English major names and leaves unrelated majors unselected',()=>{
 expect(normalizeMajor('نُظم المعلومات')).toBe('نظم معلومات');expect(normalizeMajor('IT')).toBe('تقنية معلومات');expect(normalizeMajor('علوم الحاسب الآلي')).toBe('علوم حاسب');expect(normalizeMajor('هندسة كهربائية')).toBe('');
});
