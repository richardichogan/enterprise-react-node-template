import { PDFParse } from 'pdf-parse';
import { readFileSync } from 'fs';
import { readdir } from 'fs/promises';

console.log('🧪 Testing PDFParse actual API...\n');

// Test 1: Look for any example files
const files = await readdir('./data').catch(() => []);
console.log('Available files:', files.slice(0, 5));

// Test 2: Check what PDFParse methods exist
console.log('\nPDFParse methods:');
const instance = new PDFParse();
const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(instance));
console.log('Methods:', methods.filter(m => !m.startsWith('_')));

// Test 3: Look for static methods
console.log('\nPDFParse static properties:', Object.getOwnPropertyNames(PDFParse).filter(p => typeof PDFParse[p] === 'function'));
