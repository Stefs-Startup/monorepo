import { hello } from '@cmp/utils';
import type { User } from '@cmp/types';

const user: User = { id: '2', name: 'Web User', email: 'web@example.com' };
console.log(hello(user.name));
