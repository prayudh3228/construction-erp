import { react } from '@erp/config/eslint';

export default [...react, { ignores: ['.expo/**', 'dist/**', 'dist-web/**'] }];
