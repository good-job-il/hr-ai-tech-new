import{test}from'node:test';import{readFile}from'node:fs/promises';import{testDatabase}from'./support/database.mjs';
test('Agency-client pilot workflow runs with real database permissions and rolls back every fixture',async()=>{const pg=await testDatabase();try{await pg.exec(await readFile(new URL('./pilot-agency-client.sql',import.meta.url),'utf8'))}finally{await pg.close()}});
