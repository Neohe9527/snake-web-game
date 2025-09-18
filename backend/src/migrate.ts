import { closeDb } from './database.js';
import { migrate } from './leaderboard-repository.js';

migrate();
console.log('Migration complete.');
closeDb();
