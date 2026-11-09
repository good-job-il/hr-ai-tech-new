import {assertPreviewEnvironment} from '../lib/preview-environment.mjs';
if(process.argv[2])process.loadEnvFile(process.argv[2]);
try{assertPreviewEnvironment(process.env);console.log('PASS: Preview configuration only; cloud behavior not yet verified.');}
catch(error){console.error(error.message);process.exitCode=1;}
