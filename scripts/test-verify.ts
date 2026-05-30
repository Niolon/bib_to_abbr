import fs from 'fs';
import path from 'path';
import { findJournalFields, applyReplacements } from '../src/bib-parser';
import { loadDatabase, findAbbreviation, formatAbbreviation, setDatabaseSource } from '../src/abbreviation-engine';

// Mock fetch for Node environment so loadDatabase can load the JSON file from disk
global.fetch = async (url: any) => {
  const basename = url.split('/').pop();
  const filePath = path.join('./public', basename);
  const data = fs.readFileSync(filePath, 'utf-8');
  return {
    json: async () => JSON.parse(data)
  } as any;
};

async function test() {
  console.log("Loading databases...");
  await loadDatabase('wos', './wos-abbreviations.json');
  await loadDatabase('iso', './iso-abbreviations.json');
  console.log("Databases loaded successfully!");

  const sampleBib = `@article{doe2023,
  author = {Doe, John and Smith, Jane},
  title = {A Title},
  journal = {Acta Crystallographica Section A-Crystal Physics Diffraction Theoretical and General Crystallography},
  year = {2023}
}
@article{smith2024,
  author = {Smith, Jane},
  title = {Another Title},
  journal = {Journal of Applied Crystallography},
  year = {2024}
}
@inproceedings{proceedings2025,
  author = {Bob, Builder},
  title = {Conference Title},
  booktitle = {AASRI Conference on Power and Energy Systems},
  year = {2025}
}`;

  console.log("Parsing BibTeX fields...");
  const fields = findJournalFields(sampleBib);
  console.log(`Found ${fields.length} fields:`);
  fields.forEach(f => console.log(` - ${f.name}: "${f.value}" (raw: "${f.rawValue}")`));

  if (fields.length !== 3) {
    throw new Error(`Expected 3 fields, found ${fields.length}`);
  }

  const replacements: any[] = [];
  
  // Test matching
  console.log("\nMatching abbreviations:");
  for (const field of fields) {
    const result = findAbbreviation(field.value, 'normal');
    console.log(`Query: "${field.value}"`);
    console.log(`Match Type: ${result.matchType}`);
    console.log(`Abbreviation: "${result.abbreviation}"`);
    
    if (result.matchType === 'none') {
      console.error(`FAIL: No match found for "${field.value}"`);
      process.exit(1);
    }
    
    replacements.push({
      match: field,
      newValue: result.abbreviation
    });
  }

  const updatedBib = applyReplacements(sampleBib, replacements);
  console.log("\nUpdated BibTeX Output:");
  console.log(updatedBib);

  // Format test assertions
  const formattedIso1 = formatAbbreviation('ACTA CRYSTALL A-CRYS', 'iso');
  console.log(`Formatted ISO: "ACTA CRYSTALL A-CRYS" -> "${formattedIso1}"`);
  if (formattedIso1 !== 'Acta Cryst. A.') {
    throw new Error(`Failed formatting ACTA CRYSTALL A-CRYS, got "${formattedIso1}"`);
  }

  const formattedIso2 = formatAbbreviation('J APPL CRYSTALLOGR', 'iso');
  console.log(`Formatted ISO: "J APPL CRYSTALLOGR" -> "${formattedIso2}"`);
  if (formattedIso2 !== 'J. Appl. Cryst.') {
    throw new Error(`Failed formatting J APPL CRYSTALLOGR, got "${formattedIso2}"`);
  }

  const formattedTitleDotless = formatAbbreviation('J APPL CRYSTALLOGR', 'title-dotless');
  console.log(`Formatted Title-Dotless: "J APPL CRYSTALLOGR" -> "${formattedTitleDotless}"`);
  if (formattedTitleDotless !== 'J Appl Cryst') {
    throw new Error(`Failed formatting J APPL CRYSTALLOGR in title-dotless, got "${formattedTitleDotless}"`);
  }

  // ISO Database source assertions
  console.log("\nTesting ISO 4 database source...");
  setDatabaseSource('iso');
  const isoMatch = findAbbreviation('Journal of Applied Crystallography', 'normal');
  console.log(`ISO Match: "Journal of Applied Crystallography" -> "${isoMatch.abbreviation}"`);
  if (isoMatch.abbreviation !== 'J APPL CRYSTALLOGR') {
    throw new Error(`Expected J APPL CRYSTALLOGR, got "${isoMatch.abbreviation}"`);
  }

  const formattedIsoMatch = formatAbbreviation(isoMatch.abbreviation, 'iso');
  console.log(`Formatted ISO Match: -> "${formattedIsoMatch}"`);
  if (formattedIsoMatch !== 'J. Appl. Cryst.') {
    throw new Error(`Expected J. Appl. Cryst., got "${formattedIsoMatch}"`);
  }

  console.log("\nVerification SUCCESS: All tests passed!");
}

test().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
