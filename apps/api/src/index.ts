import { hello } from '@cmp/utils';
import type { User } from '@cmp/types';

const user: User = { id: '1', name: 'World', email: 'world@example.com' };
console.log(hello(user.name));
