import './style.css';
import { findJournalFields, applyReplacements } from './bib-parser';
import { loadDatabase, findAbbreviationCandidates, formatAbbreviation, setDatabaseSource, isDatabaseLoaded } from './abbreviation-engine';
import type { MatchResult } from './abbreviation-engine';
import type { BibFieldMatch } from './bib-parser';

interface ActiveMatch {
  match: BibFieldMatch;
  candidates: MatchResult[];
  selectedIndex: number;
}

// UI Elements
const dbStatus = document.getElementById('dbStatus') as HTMLDivElement;
const bibInput = document.getElementById('bibInput') as HTMLTextAreaElement;
const uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement;
const ctaUploadBtn = document.getElementById('ctaUploadBtn') as HTMLButtonElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const dropzone = document.getElementById('dropzone') as HTMLDivElement;
const uploadCta = document.getElementById('uploadCta') as HTMLDivElement;
const convertBtn = document.getElementById('convertBtn') as HTMLButtonElement;
const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement;
const outputView = document.getElementById('outputView') as HTMLDivElement;
const diffPlaceholder = document.getElementById('diffPlaceholder') as HTMLDivElement;

// Config Elements
const strictnessRadios = document.getElementsByName('strictness') as NodeListOf<HTMLInputElement>;
const thresholdContainer = document.getElementById('thresholdContainer') as HTMLDivElement;
const thresholdSlider = document.getElementById('thresholdSlider') as HTMLInputElement;
const thresholdValue = document.getElementById('thresholdValue') as HTMLSpanElement;
const targetJournal = document.getElementById('targetJournal') as HTMLInputElement;
const targetBooktitle = document.getElementById('targetBooktitle') as HTMLInputElement;
const dbSourceSelect = document.getElementById('dbSource') as HTMLSelectElement;
const abbrStyleSelect = document.getElementById('abbrStyle') as HTMLSelectElement;

// Stat Elements
const statTotal = document.getElementById('statTotal') as HTMLDivElement;
const statMatches = document.getElementById('statMatches') as HTMLDivElement;
const statFuzzy = document.getElementById('statFuzzy') as HTMLDivElement;
const statUnmatched = document.getElementById('statUnmatched') as HTMLDivElement;

// App State
let databaseLoaded = false;
let convertedContent = '';
let currentFileName = 'references-abbreviated.bib';
let activeMatches: ActiveMatch[] = [];
let totalFieldsCount = 0;

// Initialize App
async function init() {
  try {
    dbStatus.textContent = 'Loading database...';
    dbStatus.className = 'db-badge loading';
    
    const source = dbSourceSelect.value as 'wos' | 'iso';
    const url = source === 'iso' ? './iso-abbreviations.json' : './wos-abbreviations.json';
    setDatabaseSource(source);
    await loadDatabase(source, url);
    
    databaseLoaded = true;
    dbStatus.textContent = 'Database Ready';
    dbStatus.className = 'db-badge ready';
    
    checkConvertState();
  } catch (error) {
    console.error('Failed to load journal abbreviation database:', error);
    dbStatus.textContent = 'Error loading database';
    dbStatus.className = 'db-badge loading';
  }
}

// Enable/Disable convert button based on state
function checkConvertState() {
  const hasInput = bibInput.value.trim().length > 0;
  convertBtn.disabled = !databaseLoaded || !hasInput;
  
  if (hasInput) {
    uploadCta.classList.add('hidden');
  } else {
    uploadCta.classList.remove('hidden');
  }
}

// File Reading Handler
function handleFile(file: File) {
  if (!file) return;
  
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  currentFileName = `${baseName}-abbreviated.bib`;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    bibInput.value = text;
    checkConvertState();
  };
  reader.readAsText(file);
}

// Drag & Drop Listeners
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    handleFile(files[0]);
  }
});

// Input Change Listeners
bibInput.addEventListener('input', checkConvertState);

// File Upload Button Clicks
uploadBtn.addEventListener('click', () => fileInput.click());
ctaUploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const files = fileInput.files;
  if (files && files.length > 0) {
    handleFile(files[0]);
  }
});

// Clear Button
clearBtn.addEventListener('click', () => {
  bibInput.value = '';
  convertedContent = '';
  fileInput.value = '';
  currentFileName = 'references-abbreviated.bib';
  activeMatches = [];
  totalFieldsCount = 0;
  checkConvertState();
  resetStats();
  
  outputView.innerHTML = '';
  outputView.appendChild(diffPlaceholder);
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
});

// Reset Stats View
function resetStats() {
  statTotal.textContent = '-';
  statMatches.textContent = '-';
  statFuzzy.textContent = '-';
  statUnmatched.textContent = '-';
}

// Config strictness toggle handler
strictnessRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked && radio.value === 'fuzzy') {
      thresholdContainer.style.display = 'flex';
    } else {
      thresholdContainer.style.display = 'none';
    }
    // Auto-reconvert if input exists to make UX dynamic
    if (bibInput.value.trim().length > 0) {
      runConversion();
    }
  });
});

// Slider value label update & auto-reconvert
thresholdSlider.addEventListener('input', () => {
  thresholdValue.textContent = thresholdSlider.value;
});
thresholdSlider.addEventListener('change', () => {
  if (bibInput.value.trim().length > 0) {
    runConversion();
  }
});

// Database source change handler
dbSourceSelect.addEventListener('change', async () => {
  const source = dbSourceSelect.value as 'wos' | 'iso';
  const url = source === 'iso' ? './iso-abbreviations.json' : './wos-abbreviations.json';
  
  dbStatus.textContent = 'Loading database...';
  dbStatus.className = 'db-badge loading';
  databaseLoaded = false;
  checkConvertState();
  
  try {
    setDatabaseSource(source);
    if (!isDatabaseLoaded(source)) {
      await loadDatabase(source, url);
    }
    databaseLoaded = true;
    dbStatus.textContent = 'Database Ready';
    dbStatus.className = 'db-badge ready';
    checkConvertState();
    
    if (bibInput.value.trim().length > 0) {
      runConversion();
    }
  } catch (error) {
    console.error('Failed to load journal abbreviation database:', error);
    dbStatus.textContent = 'Error loading database';
    dbStatus.className = 'db-badge loading';
  }
});

// Style change auto-reconvert
abbrStyleSelect.addEventListener('change', () => {
  if (bibInput.value.trim().length > 0) {
    runConversion();
  }
});

// Target fields auto-reconvert
[targetJournal, targetBooktitle].forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    if (bibInput.value.trim().length > 0) {
      runConversion();
    }
  });
});

// Main Conversion Routine
function runConversion() {
  if (!databaseLoaded) return;

  const content = bibInput.value;
  const fields = findJournalFields(content);
  
  // Get settings
  let strictness: 'strict' | 'normal' | 'fuzzy' = 'normal';
  for (const r of strictnessRadios) {
    if (r.checked) {
      strictness = r.value as 'strict' | 'normal' | 'fuzzy';
      break;
    }
  }
  
  const threshold = parseFloat(thresholdSlider.value);
  const checkJournal = targetJournal.checked;
  const checkBooktitle = targetBooktitle.checked;
  const styleVal = abbrStyleSelect.value as 'wos' | 'iso' | 'title-dotless';
  
  // Filter matches according to checkbox selection
  const filteredFields = fields.filter(f => {
    if (f.name === 'journal' && checkJournal) return true;
    if (f.name === 'booktitle' && checkBooktitle) return true;
    return false;
  });

  totalFieldsCount = filteredFields.length;
  activeMatches = [];

  for (const match of filteredFields) {
    const rawCandidates = findAbbreviationCandidates(match.value, strictness, threshold);
    
    // Format and deduplicate candidates based on styled value
    const formattedCandidates: MatchResult[] = [];
    const seen = new Set<string>();

    for (const cand of rawCandidates) {
      if (cand.matchType === 'none') {
        formattedCandidates.push(cand);
        continue;
      }
      const formattedAbbr = formatAbbreviation(cand.abbreviation, styleVal);
      if (!seen.has(formattedAbbr)) {
        seen.add(formattedAbbr);
        formattedCandidates.push({
          ...cand,
          abbreviation: formattedAbbr
        });
      }
    }

    if (formattedCandidates.length > 0 && formattedCandidates[0].matchType !== 'none') {
      activeMatches.push({
        match,
        candidates: formattedCandidates,
        selectedIndex: 0
      });
    }
  }

  updateConversionOutput();
  renderDiffView();

  copyBtn.disabled = false;
  downloadBtn.disabled = false;
}

// Recalculates converted BibTeX string and statistics based on current activeMatches selections
function updateConversionOutput() {
  const content = bibInput.value;
  
  const replacements = activeMatches.map(item => {
    const chosen = item.candidates[item.selectedIndex];
    return {
      match: item.match,
      newValue: chosen.abbreviation
    };
  });

  convertedContent = applyReplacements(content, replacements);

  // Update Stats
  let exactNormalCount = 0;
  let fuzzyCount = 0;

  activeMatches.forEach(item => {
    const chosen = item.candidates[item.selectedIndex];
    if (chosen.matchType === 'exact' || chosen.matchType === 'normal') {
      exactNormalCount++;
    } else if (chosen.matchType === 'fuzzy') {
      fuzzyCount++;
    }
  });

  const unmatchedCount = totalFieldsCount - exactNormalCount - fuzzyCount;

  statTotal.textContent = totalFieldsCount.toString();
  statMatches.textContent = exactNormalCount.toString();
  statFuzzy.textContent = fuzzyCount.toString();
  statUnmatched.textContent = unmatchedCount.toString();
}

// Renders visual modifications in the results view
function renderDiffView() {
  outputView.innerHTML = '';
  
  if (activeMatches.length === 0) {
    const noChanges = document.createElement('div');
    noChanges.className = 'diff-placeholder';
    noChanges.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--success);">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <p>No changes needed. All journal names match abbreviations perfectly or no matches found.</p>
    `;
    outputView.appendChild(noChanges);
    return;
  }

  const diffList = document.createElement('div');
  diffList.style.display = 'flex';
  diffList.style.flexDirection = 'column';
  diffList.style.gap = '0.4rem';

  activeMatches.forEach((item) => {
    const container = document.createElement('div');
    container.style.border = '1px solid rgba(255,255,255,0.05)';
    container.style.borderRadius = '6px';
    container.style.padding = '0.35rem';
    container.style.background = 'rgba(255,255,255,0.01)';
    
    // Removed line (original title)
    const removedLine = document.createElement('div');
    removedLine.className = 'diff-line removed';
    removedLine.textContent = `- ${item.match.name} = ${item.match.quoteChar}${item.match.value}${item.match.quoteChar}`;
    container.appendChild(removedLine);

    // Added line container (abbreviated selection)
    const addedLine = document.createElement('div');
    const chosen = item.candidates[item.selectedIndex];
    addedLine.className = `diff-line ${chosen.matchType === 'fuzzy' ? 'fuzzy-added' : 'added'}`;
    
    // Prefix
    const prefix = document.createElement('span');
    prefix.textContent = `+ ${item.match.name} = ${item.match.quoteChar}`;
    addedLine.appendChild(prefix);

    // Render interactive select if there are multiple abbreviation choices
    if (item.candidates.length > 1) {
      const select = document.createElement('select');
      select.style.background = 'rgba(0, 0, 0, 0.4)';
      select.style.color = 'inherit';
      select.style.border = '1px solid rgba(255,255,255,0.2)';
      select.style.borderRadius = '4px';
      select.style.padding = '0.05rem 0.25rem';
      select.style.fontFamily = 'inherit';
      select.style.fontSize = 'inherit';
      select.style.cursor = 'pointer';
      select.style.outline = 'none';

      item.candidates.forEach((cand, cIdx) => {
        const option = document.createElement('option');
        option.value = cIdx.toString();
        option.selected = cIdx === item.selectedIndex;
        
        let label = cand.abbreviation;
        if (cand.confidence && cand.confidence < 1.0) {
          label += ` (${Math.round(cand.confidence * 100)}% match)`;
        } else {
          label += ` (${cand.matchType})`;
        }
        option.textContent = label;
        select.appendChild(option);
      });

      select.addEventListener('change', () => {
        item.selectedIndex = parseInt(select.value);
        updateConversionOutput();
        
        // Re-apply style class for fuzzy or normal coloring
        const currentChosen = item.candidates[item.selectedIndex];
        addedLine.className = `diff-line ${currentChosen.matchType === 'fuzzy' ? 'fuzzy-added' : 'added'}`;
      });

      addedLine.appendChild(select);
    } else {
      // Static text if only 1 option
      const valueSpan = document.createElement('span');
      valueSpan.style.fontWeight = 'bold';
      valueSpan.textContent = chosen.abbreviation;
      addedLine.appendChild(valueSpan);

      const suffix = document.createElement('span');
      suffix.style.opacity = '0.7';
      suffix.style.fontSize = '0.75rem';
      suffix.style.marginLeft = '0.5rem';
      
      if (chosen.confidence && chosen.confidence < 1.0) {
        suffix.textContent = `(${Math.round(chosen.confidence * 100)}% Match)`;
      } else {
        suffix.textContent = `(${chosen.matchType} match)`;
      }
      addedLine.appendChild(suffix);
    }

    // Closing quote/brace
    const closeQuote = document.createElement('span');
    closeQuote.textContent = item.match.quoteChar;
    addedLine.appendChild(closeQuote);

    container.appendChild(addedLine);
    diffList.appendChild(container);
  });

  outputView.appendChild(diffList);
}

// Convert Button Click
convertBtn.addEventListener('click', runConversion);

// Copy to Clipboard Action
copyBtn.addEventListener('click', async () => {
  if (!convertedContent) return;
  try {
    await navigator.clipboard.writeText(convertedContent);
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    copyBtn.style.borderColor = 'var(--success)';
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.style.borderColor = 'var(--border-color)';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy text:', err);
  }
});

// Download Action
downloadBtn.addEventListener('click', () => {
  if (!convertedContent) return;
  const blob = new Blob([convertedContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Start the app
init();
