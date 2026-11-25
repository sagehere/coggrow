import { DatabaseSync } from 'node:sqlite';
import { resolve, join } from 'node:path';

const output = process.argv[2];
if(!output){
  console.error('用法：node backup.js <新备份文件路径>');
  process.exit(2);
}
const source=join(process.env.DATA_DIR||'./data','coggrow.db');
const db=new DatabaseSync(source,{readOnly:true});
try{
  db.exec('PRAGMA busy_timeout = 5000');
  db.prepare('VACUUM INTO ?').run(resolve(output));
  console.log('备份已生成 '+resolve(output));
}finally{
  db.close();
}
