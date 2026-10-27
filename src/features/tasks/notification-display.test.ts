import {expect,it} from 'vitest';
import {notificationHref} from './notification-display';
it('routes organization decisions directly to the opening requests tab and drops unrelated query parameters',()=>{expect(notificationHref('/applications?tab=organizations')).toBe('/applications?tab=organizations');expect(notificationHref('/applications?tab=organizations&next=//evil.test')).toBe('/applications?tab=organizations');expect(notificationHref('//evil.test/applications?tab=organizations')).toBeNull();expect(notificationHref('/applications?tab=unknown')).toBe('/applications');});
