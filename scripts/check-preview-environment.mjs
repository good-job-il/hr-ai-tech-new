import {validatePreviewEnvironment} from '../lib/site-environment.mjs';

// Read-only, no HTTP or database queries. Values are never printed.
if (process.argv[2]) process.loadEnvFile(process.argv[2]);
const errors = validatePreviewEnvironment(process.env);
if (errors.length) {
  console.error('Preview configuration: FAIL\n' + errors.map(error => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else console.log('Preview configuration: PASS (configuration only; cloud behavior not verified)');
