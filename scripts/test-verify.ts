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
  await loadDatabase('ncbi', './ncbi-abbreviations.json');
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
@article{union2025,
  author = {Bob, Builder},
  title = {Union Title},
  journal = {1199 news. National Union of Hospital and Health Care Employees. District 1199},
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
  const formattedIso1 = formatAbbreviation('ACTA CRYSTALL A-CRYS', 'iso', 'Acta Crystallographica Section A-Crystal Physics Diffraction Theoretical and General Crystallography');
  console.log(`Formatted ISO: "ACTA CRYSTALL A-CRYS" -> "${formattedIso1}"`);
  if (formattedIso1 !== 'Acta Cryst. A') {
    throw new Error(`Failed formatting ACTA CRYSTALL A-CRYS, got "${formattedIso1}"`);
  }

  const formattedIso2 = formatAbbreviation('J APPL CRYSTALLOGR', 'iso', 'Journal of Applied Crystallography');
  console.log(`Formatted ISO: "J APPL CRYSTALLOGR" -> "${formattedIso2}"`);
  if (formattedIso2 !== 'J. Appl. Cryst.') {
    throw new Error(`Failed formatting J APPL CRYSTALLOGR, got "${formattedIso2}"`);
  }

  const formattedTitleDotless = formatAbbreviation('J APPL CRYSTALLOGR', 'title-dotless', 'Journal of Applied Crystallography');
  console.log(`Formatted Title-Dotless: "J APPL CRYSTALLOGR" -> "${formattedTitleDotless}"`);
  if (formattedTitleDotless !== 'J Appl Cryst') {
    throw new Error(`Failed formatting J APPL CRYSTALLOGR in title-dotless, got "${formattedTitleDotless}"`);
  }

  // Word completeness / non-shortened words test
  console.log("\nTesting complete words dot-omission...");
  const formattedScience = formatAbbreviation('Science', 'iso', 'Science');
  console.log(`Formatted 'Science' -> "${formattedScience}"`);
  if (formattedScience !== 'Science') {
    throw new Error(`Expected Science, got "${formattedScience}"`);
  }

  // ISO Database source assertions
  console.log("\nTesting ISO 4 database source...");
  setDatabaseSource('iso');
  const isoMatch = findAbbreviation('Journal of Applied Crystallography', 'normal');
  console.log(`ISO Match: "Journal of Applied Crystallography" -> "${isoMatch.abbreviation}"`);
  if (isoMatch.abbreviation !== 'J Appl Crystallogr') {
    throw new Error(`Expected J Appl Crystallogr, got "${isoMatch.abbreviation}"`);
  }

  const formattedIsoMatch = formatAbbreviation(isoMatch.abbreviation, 'iso', 'Journal of Applied Crystallography');
  console.log(`Formatted ISO Match: -> "${formattedIsoMatch}"`);
  if (formattedIsoMatch !== 'J. Appl. Cryst.') {
    throw new Error(`Expected J. Appl. Cryst., got "${formattedIsoMatch}"`);
  }

  // CrystEngComm casing assertion
  console.log("\nTesting CrystEngComm casing preservation...");
  const formattedCrystEngCommWoS = formatAbbreviation('CRYSTENGCOMM', 'iso');
  console.log(`Formatted 'CRYSTENGCOMM' (WoS) -> "${formattedCrystEngCommWoS}"`);
  if (formattedCrystEngCommWoS !== 'CrystEngComm') {
    throw new Error(`Expected CrystEngComm, got "${formattedCrystEngCommWoS}"`);
  }

  const formattedCrystEngCommISO = formatAbbreviation('CrystEngComm', 'iso');
  console.log(`Formatted 'CrystEngComm' (ISO) -> "${formattedCrystEngCommISO}"`);
  if (formattedCrystEngCommISO !== 'CrystEngComm') {
    throw new Error(`Expected CrystEngComm, got "${formattedCrystEngCommISO}"`);
  }

  // Combined fallback source test
  console.log("\nTesting combined ISO + NCBI fallback source...");
  setDatabaseSource('iso-ncbi');

  // Should find in ISO first
  const match1 = findAbbreviation('Journal of Applied Crystallography', 'normal');
  console.log(`Match 1 (ISO): "Journal of Applied Crystallography" -> "${match1.abbreviation}"`);
  if (match1.abbreviation !== 'J Appl Crystallogr') {
    throw new Error(`Expected J Appl Crystallogr, got "${match1.abbreviation}"`);
  }

  // Should fall back to NCBI for 1199 News
  const match2 = findAbbreviation('1199 news. National Union of Hospital and Health Care Employees. District 1199', 'normal');
  console.log(`Match 2 (NCBI Fallback): "1199 news..." -> "${match2.abbreviation}"`);
  if (match2.abbreviation !== '1199 News') {
    throw new Error(`Expected 1199 News, got "${match2.abbreviation}"`);
  }

  console.log("\nVerification SUCCESS: All tests passed!");
}

test().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
