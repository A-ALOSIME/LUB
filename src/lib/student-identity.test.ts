import {expect,it} from 'vitest';
import {normalizeMajor,validNationalId} from './student-identity';
it('accepts ten-digit national and resident ID formats without imposing a checksum',()=>{
 for(const valid of ['1000000008','2000000006','1000000009','1234567890','2222222222'])expect(validNationalId(valid)).toBe(true);
 for(const invalid of ['3000000004','0000000000','123','1abcdefgh8','12345678901'])expect(validNationalId(invalid)).toBe(false);
});
it('normalizes known Arabic and English major names and leaves unrelated majors unselected',()=>{
 expect(normalizeMajor('نُظم المعلومات')).toBe('نظم معلومات');expect(normalizeMajor('IT')).toBe('تقنية معلومات');expect(normalizeMajor('علوم الحاسب الآلي')).toBe('علوم حاسب');expect(normalizeMajor('هندسة كهربائية')).toBe('');
});
