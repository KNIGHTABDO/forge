import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Simple parser to grab the keys manually so we don't need any extra npm packages
const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env.local');
const envFile = readFileSync(envPath, 'utf8');

let key = '';
let cx = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('GOOGLE_SEARCH_API_KEY=')) key = line.split('=')[1].trim();
  if (line.startsWith('GOOGLE_SEARCH_CX=')) cx = line.split('=')[1].trim();
});

console.log('Testing your Google Key ending in:', key.slice(-5));

fetch(`https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=test`)
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      console.error('\n❌ Google Rejected It:', data.error.message);
    } else if (data.items) {
      console.log('\n✅ IT WORKS! Found results:', data.searchInformation.totalResults);
    } else {
      console.log('\n✅ API call successful! But no items returned.');
    }
  })
  .catch(err => console.error('\n❌ Network Error:', err.message));
