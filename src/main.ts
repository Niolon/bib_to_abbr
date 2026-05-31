import './style.css'
import { findJournalFields, applyReplacements } from './bib-parser'
import {
  loadDatabase,
  findAbbreviationCandidates,
  formatAbbreviation,
  setDatabaseSource,
  isDatabaseLoaded,
  addCustomRule,
  deleteCustomRule,
  getCustomRules,
  normalizeString,
} from './abbreviation-engine'
import type { MatchResult } from './abbreviation-engine'
import type { BibFieldMatch } from './bib-parser'

interface ActiveMatch {
  match: BibFieldMatch
  candidates: MatchResult[]
  selectedIndex: number
}

// UI Elements
const dbStatus = document.getElementById('dbStatus') as HTMLDivElement | null
const bibInput = document.getElementById('bibInput') as HTMLTextAreaElement
const uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement
const ctaUploadBtn = document.getElementById('ctaUploadBtn') as HTMLButtonElement
const fileInput = document.getElementById('fileInput') as HTMLInputElement
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement
const dropzone = document.getElementById('dropzone') as HTMLDivElement
const uploadCta = document.getElementById('uploadCta') as HTMLDivElement
const convertBtn = document.getElementById('convertBtn') as HTMLButtonElement
const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement
const outputView = document.getElementById('outputView') as HTMLDivElement
const diffPlaceholder = document.getElementById('diffPlaceholder') as HTMLDivElement

// Rules Panel UI Elements
const rulesPanel = document.getElementById('rulesPanel') as HTMLDivElement
const rulesPanelHeader = document.getElementById('rulesPanelHeader') as HTMLDivElement
const rulesPanelContent = document.getElementById('rulesPanelContent') as HTMLDivElement
const toggleRulesBtn = document.getElementById('toggleRulesBtn') as HTMLButtonElement
const inconsistencyBadge = document.getElementById('inconsistencyBadge') as HTMLSpanElement

// Tab Elements
const tabCustomRules = document.getElementById('tabCustomRules') as HTMLButtonElement
const tabUnification = document.getElementById('tabUnification') as HTMLButtonElement

// Custom Rules Elements
const customJournalInput = document.getElementById('customJournalInput') as HTMLInputElement
const customAbbrInput = document.getElementById('customAbbrInput') as HTMLInputElement
const addRuleBtn = document.getElementById('addRuleBtn') as HTMLButtonElement
const cookiePersistCheckbox = document.getElementById('cookiePersistCheckbox') as HTMLInputElement
const rulesList = document.getElementById('rulesList') as HTMLDivElement

// Unification Elements
const unifyAllBtn = document.getElementById('unifyAllBtn') as HTMLButtonElement
const inconsistenciesList = document.getElementById('inconsistenciesList') as HTMLDivElement

// Config Elements
const strictnessRadios = document.getElementsByName('strictness') as NodeListOf<HTMLInputElement>
const thresholdContainer = document.getElementById('thresholdContainer') as HTMLDivElement
const thresholdSlider = document.getElementById('thresholdSlider') as HTMLInputElement
const thresholdValue = document.getElementById('thresholdValue') as HTMLSpanElement
const targetJournal = document.getElementById('targetJournal') as HTMLInputElement
const targetBooktitle = document.getElementById('targetBooktitle') as HTMLInputElement
const dbSourceSelect = document.getElementById('dbSource') as HTMLSelectElement
const abbrStyleSelect = document.getElementById('abbrStyle') as HTMLSelectElement

// Stat Elements
const statTotal = document.getElementById('statTotal') as HTMLDivElement
const statMatches = document.getElementById('statMatches') as HTMLDivElement
const statFuzzy = document.getElementById('statFuzzy') as HTMLDivElement
const statUnmatched = document.getElementById('statUnmatched') as HTMLDivElement

// App State
let databaseLoaded = false
let convertedContent = ''
let currentFileName = 'references-abbreviated.bib'
let activeMatches: ActiveMatch[] = []
let totalFieldsCount = 0

// Cookie helpers
function setCookie(name: string, value: string, days: number = 365) {
  const d = new Date()
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000)
  const expires = 'expires=' + d.toUTCString()
  document.cookie = name + '=' + encodeURIComponent(value) + ';' + expires + ';path=/;SameSite=Lax'
}

function getCookie(name: string): string {
  const cname = name + '='
  const decodedCookie = decodeURIComponent(document.cookie)
  const ca = decodedCookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') {
      c = c.substring(1)
    }
    if (c.indexOf(cname) === 0) {
      return c.substring(cname.length, c.length)
    }
  }
  return ''
}

function deleteCookie(name: string) {
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;SameSite=Lax'
}

function persistRulesToCookie() {
  if (cookiePersistCheckbox.checked) {
    const rules = getCustomRules()
    const rulesObj: Record<string, string> = {}
    rules.forEach((r) => {
      rulesObj[r.originalKey] = r.abbreviation
    })
    setCookie('bib_custom_rules', JSON.stringify(rulesObj))
  } else {
    deleteCookie('bib_custom_rules')
  }
}

function loadRulesFromCookie() {
  const saved = getCookie('bib_custom_rules')
  if (saved) {
    try {
      const rulesObj = JSON.parse(saved) as Record<string, string>
      Object.entries(rulesObj).forEach(([journal, abbr]) => {
        addCustomRule(journal, abbr)
      })
    } catch (e) {
      console.error('Failed to parse saved rules cookie:', e)
    }
  }
}

function renderRulesList() {
  rulesList.innerHTML = ''
  const rules = getCustomRules()

  if (rules.length === 0) {
    rulesList.innerHTML =
      '<div class="empty-rules" style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 1.5rem 0;">No custom rules defined yet. Add one!</div>'
    return
  }

  rules.forEach((rule) => {
    const item = document.createElement('div')
    item.className = 'rule-item'

    const textSpan = document.createElement('span')
    textSpan.className = 'rule-item-text'
    textSpan.innerHTML = `<strong>${escapeHtml(rule.originalKey)}</strong> <span class="rule-item-arrow">&rarr;</span> <code>${escapeHtml(rule.abbreviation)}</code>`
    item.appendChild(textSpan)

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'rule-item-delete'
    deleteBtn.title = 'Delete rule'
    deleteBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"/>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      </svg>
    `

    deleteBtn.addEventListener('click', () => {
      deleteCustomRule(rule.originalKey)
      persistRulesToCookie()
      renderRulesList()
      if (bibInput.value.trim().length > 0) {
        runConversion()
      }
    })

    item.appendChild(deleteBtn)
    rulesList.appendChild(item)
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Initialize App
async function init() {
  try {
    if (dbStatus) {
      dbStatus.textContent = 'Loading database...'
      dbStatus.className = 'db-badge loading'
    }

    const source = dbSourceSelect.value as 'ncbi' | 'iso' | 'iso-ncbi'
    setDatabaseSource(source)
    if (source === 'iso-ncbi') {
      await loadDatabase('iso', './iso-abbreviations.json')
      await loadDatabase('ncbi', './ncbi-abbreviations.json')
    } else {
      const url = source === 'iso' ? './iso-abbreviations.json' : './ncbi-abbreviations.json'
      await loadDatabase(source, url)
    }

    databaseLoaded = true
    if (dbStatus) {
      dbStatus.textContent = 'Database Ready'
      dbStatus.className = 'db-badge ready'
    }

    loadRulesFromCookie()
    renderRulesList()
    checkConvertState()
  } catch (error) {
    console.error('Failed to load journal abbreviation database:', error)
    if (dbStatus) {
      dbStatus.textContent = 'Error loading database'
      dbStatus.className = 'db-badge loading'
    }
  }
}

// Enable/Disable convert button based on state
function checkConvertState() {
  const hasInput = bibInput.value.trim().length > 0
  convertBtn.disabled = !databaseLoaded || !hasInput

  if (hasInput) {
    uploadCta.classList.add('hidden')
  } else {
    uploadCta.classList.remove('hidden')
  }
}

// File Reading Handler
function handleFile(file: File) {
  if (!file) return

  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
  currentFileName = `${baseName}-abbreviated.bib`

  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    bibInput.value = text
    checkConvertState()
  }
  reader.readAsText(file)
}

// Drag & Drop Listeners
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault()
  dropzone.classList.add('dragover')
})

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover')
})

dropzone.addEventListener('drop', (e) => {
  e.preventDefault()
  dropzone.classList.remove('dragover')
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    handleFile(files[0])
  }
})

// Input Change Listeners
bibInput.addEventListener('input', checkConvertState)

// File Upload Button Clicks
uploadBtn.addEventListener('click', () => fileInput.click())
ctaUploadBtn.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', () => {
  const files = fileInput.files
  if (files && files.length > 0) {
    handleFile(files[0])
  }
})

// Clear Button
clearBtn.addEventListener('click', () => {
  bibInput.value = ''
  convertedContent = ''
  fileInput.value = ''
  currentFileName = 'references-abbreviated.bib'
  activeMatches = []
  totalFieldsCount = 0
  checkConvertState()
  resetStats()

  outputView.innerHTML = ''
  outputView.appendChild(diffPlaceholder)
  copyBtn.disabled = true
  downloadBtn.disabled = true
  updateUnificationSection()
})

// Reset Stats View
function resetStats() {
  statTotal.textContent = '-'
  statMatches.textContent = '-'
  statFuzzy.textContent = '-'
  statUnmatched.textContent = '-'
}

// Config strictness toggle handler
strictnessRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked && radio.value === 'fuzzy') {
      thresholdContainer.style.display = 'flex'
    } else {
      thresholdContainer.style.display = 'none'
    }
    // Auto-reconvert if input exists to make UX dynamic
    if (bibInput.value.trim().length > 0) {
      runConversion()
    }
  })
})

// Slider value label update & auto-reconvert
thresholdSlider.addEventListener('input', () => {
  thresholdValue.textContent = thresholdSlider.value
})
thresholdSlider.addEventListener('change', () => {
  if (bibInput.value.trim().length > 0) {
    runConversion()
  }
})

// Database source change handler
dbSourceSelect.addEventListener('change', async () => {
  const source = dbSourceSelect.value as 'ncbi' | 'iso' | 'iso-ncbi'

  if (dbStatus) {
    dbStatus.textContent = 'Loading database...'
    dbStatus.className = 'db-badge loading'
  }
  databaseLoaded = false
  checkConvertState()

  try {
    setDatabaseSource(source)
    if (source === 'iso-ncbi') {
      if (!isDatabaseLoaded('iso')) {
        await loadDatabase('iso', './iso-abbreviations.json')
      }
      if (!isDatabaseLoaded('ncbi')) {
        await loadDatabase('ncbi', './ncbi-abbreviations.json')
      }
    } else {
      const url = source === 'iso' ? './iso-abbreviations.json' : './ncbi-abbreviations.json'
      if (!isDatabaseLoaded(source)) {
        await loadDatabase(source, url)
      }
    }
    databaseLoaded = true
    if (dbStatus) {
      dbStatus.textContent = 'Database Ready'
      dbStatus.className = 'db-badge ready'
    }
    checkConvertState()

    if (bibInput.value.trim().length > 0) {
      runConversion()
    }
  } catch (error) {
    console.error('Failed to load journal abbreviation database:', error)
    if (dbStatus) {
      dbStatus.textContent = 'Error loading database'
      dbStatus.className = 'db-badge loading'
    }
  }
})

// Style change auto-reconvert
abbrStyleSelect.addEventListener('change', () => {
  if (bibInput.value.trim().length > 0) {
    runConversion()
  }
})

// Target fields auto-reconvert
;[targetJournal, targetBooktitle].forEach((checkbox) => {
  checkbox.addEventListener('change', () => {
    if (bibInput.value.trim().length > 0) {
      runConversion()
    }
  })
})

// Main Conversion Routine
function runConversion() {
  if (!databaseLoaded) return

  const content = bibInput.value
  const fields = findJournalFields(content)

  // Get settings
  let strictness: 'strict' | 'normal' | 'fuzzy' = 'normal'
  for (const r of strictnessRadios) {
    if (r.checked) {
      strictness = r.value as 'strict' | 'normal' | 'fuzzy'
      break
    }
  }

  const threshold = parseFloat(thresholdSlider.value)
  const checkJournal = targetJournal.checked
  const checkBooktitle = targetBooktitle.checked
  const styleVal = abbrStyleSelect.value as 'wos' | 'iso' | 'title-dotless'

  // Filter matches according to checkbox selection
  const filteredFields = fields.filter((f) => {
    if (f.name === 'journal' && checkJournal) return true
    if (f.name === 'booktitle' && checkBooktitle) return true
    return false
  })

  totalFieldsCount = filteredFields.length
  activeMatches = []

  for (const match of filteredFields) {
    const rawCandidates = findAbbreviationCandidates(match.value, strictness, threshold)

    // Format and deduplicate candidates based on styled value
    const formattedCandidates: MatchResult[] = []
    const seen = new Set<string>()

    for (const cand of rawCandidates) {
      if (cand.matchType === 'none' || cand.matchType === 'custom') {
        formattedCandidates.push(cand)
        continue
      }
      // For already-abbreviated inputs, use the full journal name from the DB as the
      // originalJournal hint so formatAbbreviation can correctly decide which tokens get dots.
      const hintJournal =
        cand.matchType === 'abbreviated' ? (cand.originalKey ?? match.value) : match.value
      const formattedAbbr = formatAbbreviation(cand.abbreviation, styleVal, hintJournal)
      if (!seen.has(formattedAbbr)) {
        seen.add(formattedAbbr)
        formattedCandidates.push({
          ...cand,
          abbreviation: formattedAbbr,
        })
      }
    }

    if (formattedCandidates.length > 0) {
      activeMatches.push({
        match,
        candidates: formattedCandidates,
        selectedIndex: 0,
      })
    }
  }

  updateConversionOutput()
  renderDiffView()
  updateUnificationSection()

  copyBtn.disabled = false
  downloadBtn.disabled = false
}

// Recalculates converted BibTeX string and statistics based on current activeMatches selections
function updateConversionOutput() {
  const content = bibInput.value

  const replacements = activeMatches
    .filter((item) => {
      const chosen = item.candidates[item.selectedIndex]
      return chosen.abbreviation !== item.match.value
    })
    .map((item) => {
      const chosen = item.candidates[item.selectedIndex]
      return {
        match: item.match,
        newValue: chosen.abbreviation,
      }
    })

  convertedContent = applyReplacements(content, replacements)

  // Update Stats
  let exactNormalCount = 0
  let fuzzyCount = 0

  activeMatches.forEach((item) => {
    const chosen = item.candidates[item.selectedIndex]
    if (chosen.matchType === 'abbreviated' || chosen.matchType === 'custom') {
      exactNormalCount++
    } else if (chosen.abbreviation !== item.match.value) {
      if (chosen.matchType === 'exact' || chosen.matchType === 'normal') {
        exactNormalCount++
      } else if (chosen.matchType === 'fuzzy') {
        fuzzyCount++
      }
    }
  })

  const unmatchedCount = totalFieldsCount - exactNormalCount - fuzzyCount

  statTotal.textContent = totalFieldsCount.toString()
  statMatches.textContent = exactNormalCount.toString()
  statFuzzy.textContent = fuzzyCount.toString()
  statUnmatched.textContent = unmatchedCount.toString()
}

// Renders visual modifications in the results view
function renderDiffView() {
  outputView.innerHTML = ''

  if (totalFieldsCount === 0) {
    const noChanges = document.createElement('div')
    noChanges.className = 'diff-placeholder'
    noChanges.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <p>No journal or booktitle fields found in the input.</p>
    `
    outputView.appendChild(noChanges)
    return
  }

  const diffList = document.createElement('div')
  diffList.style.display = 'flex'
  diffList.style.flexDirection = 'column'
  diffList.style.gap = '0.4rem'

  activeMatches.forEach((item) => {
    const container = document.createElement('div')
    container.style.border = '1px solid rgba(255,255,255,0.05)'
    container.style.borderRadius = '6px'
    container.style.padding = '0.35rem'
    container.style.background = 'rgba(255,255,255,0.01)'

    const closeChar = item.match.quoteChar === '{' ? '}' : item.match.quoteChar === '"' ? '"' : ''
    const chosen = item.candidates[item.selectedIndex]
    const isChanged = chosen.abbreviation !== item.match.value

    if (isChanged) {
      // Removed line (original title)
      const removedLine = document.createElement('div')
      removedLine.className = 'diff-line removed'
      removedLine.textContent = `- ${item.match.name} = ${item.match.quoteChar}${item.match.value}${closeChar}`
      container.appendChild(removedLine)

      // Added line container (abbreviated selection)
      const addedLine = document.createElement('div')
      const isFuzzy = chosen.matchType === 'fuzzy'
      const isCustom = chosen.matchType === 'custom'
      const isAbbreviated = chosen.matchType === 'abbreviated'
      addedLine.className = `diff-line ${isFuzzy ? 'fuzzy-added' : isCustom ? 'custom-added' : isAbbreviated ? 'abbreviated-added' : 'added'}`

      // Prefix
      const prefix = document.createElement('span')
      prefix.textContent = `+ ${item.match.name} = ${item.match.quoteChar}`
      addedLine.appendChild(prefix)

      // Render interactive select if there are multiple abbreviation choices
      if (item.candidates.length > 1) {
        const select = document.createElement('select')
        select.style.background = 'rgba(0, 0, 0, 0.4)'
        select.style.color = 'inherit'
        select.style.border = '1px solid rgba(255,255,255,0.2)'
        select.style.borderRadius = '4px'
        select.style.padding = '0.05rem 0.25rem'
        select.style.fontFamily = 'inherit'
        select.style.fontSize = 'inherit'
        select.style.cursor = 'pointer'
        select.style.outline = 'none'

        item.candidates.forEach((cand, cIdx) => {
          const option = document.createElement('option')
          option.value = cIdx.toString()
          option.selected = cIdx === item.selectedIndex

          let label = cand.abbreviation
          if (cand.matchType === 'abbreviated') {
            label += ' (already abbreviated)'
          } else if (cand.matchType === 'custom') {
            label += ' (custom rule)'
          } else if (cand.confidence && cand.confidence < 1.0) {
            label += ` (${Math.round(cand.confidence * 100)}% match)`
          } else {
            label += ` (${cand.matchType})`
          }
          option.textContent = label
          select.appendChild(option)
        })

        select.addEventListener('change', () => {
          item.selectedIndex = parseInt(select.value)
          updateConversionOutput()

          // Re-apply style class for fuzzy or normal coloring
          const currentChosen = item.candidates[item.selectedIndex]
          const isFuzzy = currentChosen.matchType === 'fuzzy'
          const isCustom = currentChosen.matchType === 'custom'
          const isAbbreviatedChosen = currentChosen.matchType === 'abbreviated'
          addedLine.className = `diff-line ${isFuzzy ? 'fuzzy-added' : isCustom ? 'custom-added' : isAbbreviatedChosen ? 'abbreviated-added' : 'added'}`
        })

        addedLine.appendChild(select)
      } else {
        // Static text if only 1 option
        const valueSpan = document.createElement('span')
        valueSpan.style.fontWeight = 'bold'
        valueSpan.textContent = chosen.abbreviation
        addedLine.appendChild(valueSpan)

        const suffix = document.createElement('span')
        suffix.style.opacity = '0.7'
        suffix.style.fontSize = '0.75rem'
        suffix.style.marginLeft = '0.5rem'

        if (chosen.matchType === 'custom') {
          suffix.textContent = '(custom rule)'
        } else if (chosen.matchType === 'abbreviated') {
          suffix.textContent = '(already abbreviated)'
        } else if (chosen.confidence && chosen.confidence < 1.0) {
          suffix.textContent = `(${Math.round(chosen.confidence * 100)}% Match)`
        } else {
          suffix.textContent = `(${chosen.matchType} match)`
        }
        addedLine.appendChild(suffix)
      }

      // Closing quote/brace
      const closeQuote = document.createElement('span')
      closeQuote.textContent = closeChar
      addedLine.appendChild(closeQuote)

      container.appendChild(addedLine)
    } else {
      // Render unchanged line (neutral styling)
      const unchangedLine = document.createElement('div')
      unchangedLine.className = 'diff-line unchanged'
      unchangedLine.style.paddingLeft = '0.5rem'

      const prefix = document.createElement('span')
      prefix.textContent = `  ${item.match.name} = ${item.match.quoteChar}`
      unchangedLine.appendChild(prefix)

      // Render the value
      const valueSpan = document.createElement('span')
      valueSpan.style.fontWeight = '500'
      valueSpan.textContent = chosen.abbreviation
      unchangedLine.appendChild(valueSpan)

      // Closing quote/brace
      const closeQuote = document.createElement('span')
      closeQuote.textContent = closeChar
      unchangedLine.appendChild(closeQuote)

      // Add status badge
      const statusBadge = document.createElement('span')
      statusBadge.style.opacity = '0.5'
      statusBadge.style.fontSize = '0.75rem'
      statusBadge.style.marginLeft = '0.8rem'
      statusBadge.style.fontStyle = 'italic'
      statusBadge.textContent =
        chosen.matchType === 'none' ? '(no match found)' : '(already abbreviated)'
      unchangedLine.appendChild(statusBadge)

      container.appendChild(unchangedLine)
    }
    diffList.appendChild(container)
  })

  outputView.appendChild(diffList)
}

// Convert Button Click
convertBtn.addEventListener('click', runConversion)

interface GroupEntry {
  match: BibFieldMatch
  selectedAbbr: string
  matchType: string
  candidates: MatchResult[]
  activeMatchIndex: number
}

interface InconsistencyGroup {
  canonicalName: string
  entries: GroupEntry[]
}

function updateUnificationSection() {
  inconsistenciesList.innerHTML = ''

  if (totalFieldsCount === 0) {
    inconsistenciesList.innerHTML = `
      <div class="empty-inconsistencies" style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.8rem; padding: 2rem 0; text-align: center;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted);">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <p>Convert references to scan for inconsistencies.</p>
      </div>
    `
    inconsistencyBadge.style.display = 'none'
    unifyAllBtn.disabled = true
    return
  }

  const groups = new Map<string, InconsistencyGroup>()

  activeMatches.forEach((item, idx) => {
    const chosen = item.candidates[item.selectedIndex]
    let canonicalName = ''
    if (chosen.matchType !== 'none' && chosen.originalKey) {
      canonicalName = chosen.originalKey
    } else {
      canonicalName = normalizeString(item.match.value)
    }

    const key = canonicalName.toUpperCase()
    if (!groups.has(key)) {
      groups.set(key, {
        canonicalName: chosen.originalKey || item.match.value,
        entries: [],
      })
    }

    groups.get(key)!.entries.push({
      match: item.match,
      selectedAbbr: chosen.abbreviation,
      matchType: chosen.matchType,
      candidates: item.candidates,
      activeMatchIndex: idx,
    })
  })

  const issues: {
    type: 'missing' | 'inconsistent_output' | 'mixed_input' | 'already_abbreviated'
    group: InconsistencyGroup
  }[] = []

  groups.forEach((group) => {
    const uniqueRawValues = new Set(group.entries.map((e) => e.match.value.trim()))
    const uniqueResolvedAbbrs = new Set(group.entries.map((e) => e.selectedAbbr))
    const allNone = group.entries.every((e) => e.matchType === 'none')
    const allAbbreviated = group.entries.every((e) => e.matchType === 'abbreviated')

    if (allAbbreviated) {
      issues.push({
        type: 'already_abbreviated',
        group,
      })
    } else if (allNone) {
      issues.push({
        type: 'missing',
        group,
      })
    } else if (uniqueResolvedAbbrs.size > 1) {
      issues.push({
        type: 'inconsistent_output',
        group,
      })
    } else if (uniqueRawValues.size > 1) {
      issues.push({
        type: 'mixed_input',
        group,
      })
    }
  })

  if (issues.length === 0) {
    inconsistenciesList.innerHTML = `
      <div class="empty-inconsistencies" style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: var(--success); font-size: 0.85rem; padding: 2rem 0; text-align: center; font-weight: 500;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--success);">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p>No inconsistencies detected! All journal names are unified.</p>
      </div>
    `
    inconsistencyBadge.style.display = 'none'
    unifyAllBtn.disabled = true
    return
  }

  const hasUnifiableIssues = issues.some((iss) => iss.type === 'inconsistent_output')
  unifyAllBtn.disabled = !hasUnifiableIssues

  const actionableIssues = issues.filter((iss) => iss.type !== 'already_abbreviated')
  inconsistencyBadge.textContent = `${actionableIssues.length}`
  inconsistencyBadge.style.display = actionableIssues.length > 0 ? 'inline-block' : 'none'

  issues.forEach((issue) => {
    const card = document.createElement('div')
    card.className = `issue-card issue-${issue.type}`

    const cardHeader = document.createElement('div')
    cardHeader.className = 'issue-card-header'

    const badge = document.createElement('span')
    badge.className = `issue-badge badge-${issue.type}`
    if (issue.type === 'missing') {
      badge.textContent = 'Missing Abbreviation'
    } else if (issue.type === 'inconsistent_output') {
      badge.textContent = 'Inconsistent Output'
    } else if (issue.type === 'already_abbreviated') {
      badge.textContent = 'Already Abbreviated'
    } else {
      badge.textContent = 'Mixed Input Formats'
    }
    cardHeader.appendChild(badge)

    const titleSpan = document.createElement('span')
    titleSpan.className = 'issue-journal-title'
    titleSpan.textContent = issue.group.canonicalName
    cardHeader.appendChild(titleSpan)

    card.appendChild(cardHeader)

    const cardBody = document.createElement('div')
    cardBody.className = 'issue-card-body'

    if (issue.type === 'missing') {
      const p = document.createElement('p')
      p.className = 'issue-message'
      p.textContent = `This journal was not found in the database. Provide a custom abbreviation to resolve this.`
      cardBody.appendChild(p)

      const actionRow = document.createElement('div')
      actionRow.className = 'issue-action-row'

      const input = document.createElement('input')
      input.type = 'text'
      input.placeholder = 'Abbreviation (e.g. J. Unknown Phys.)'
      input.className = 'issue-input'
      actionRow.appendChild(input)

      const btn = document.createElement('button')
      btn.className = 'btn btn-primary btn-sm'
      btn.textContent = 'Save'
      btn.addEventListener('click', () => {
        const val = input.value.trim()
        if (!val) return
        addCustomRule(issue.group.canonicalName, val)
        persistRulesToCookie()
        renderRulesList()
        runConversion()
      })
      actionRow.appendChild(btn)

      cardBody.appendChild(actionRow)
    } else if (issue.type === 'inconsistent_output') {
      const p = document.createElement('p')
      p.className = 'issue-message'
      p.textContent = `Multiple entries of this journal have different resolved abbreviations. Select the correct abbreviation to unify them.`
      cardBody.appendChild(p)

      const actionRow = document.createElement('div')
      actionRow.className = 'issue-action-row'

      const select = document.createElement('select')
      select.className = 'issue-select'

      const uniqueAbbrs = Array.from(new Set(issue.group.entries.map((e) => e.selectedAbbr)))
      uniqueAbbrs.forEach((abbr) => {
        const opt = document.createElement('option')
        opt.value = abbr
        opt.textContent = abbr
        select.appendChild(opt)
      })

      actionRow.appendChild(select)

      const btn = document.createElement('button')
      btn.className = 'btn btn-primary btn-sm'
      btn.textContent = 'Unify'
      btn.addEventListener('click', () => {
        const val = select.value
        addCustomRule(issue.group.canonicalName, val)
        persistRulesToCookie()
        renderRulesList()
        runConversion()
      })
      actionRow.appendChild(btn)

      cardBody.appendChild(actionRow)
    } else if (issue.type === 'mixed_input') {
      const p = document.createElement('p')
      p.className = 'issue-message'

      const rawList = Array.from(
        new Set(issue.group.entries.map((e) => `"${e.match.value}"`)),
      ).join(', ')
      p.textContent = `The input uses multiple formats for this journal: ${rawList}. They will all be unified to "${issue.group.entries[0].selectedAbbr}" in the converted output.`
      cardBody.appendChild(p)

      const actionRow = document.createElement('div')
      actionRow.className = 'issue-action-row'

      const infoSpan = document.createElement('span')
      infoSpan.style.fontSize = '0.75rem'
      infoSpan.style.color = 'var(--text-secondary)'
      infoSpan.textContent = 'No action needed (unified automatically)'
      actionRow.appendChild(infoSpan)

      const btn = document.createElement('button')
      btn.className = 'btn btn-secondary btn-sm'
      btn.textContent = 'Customize'
      btn.addEventListener('click', () => {
        tabCustomRules.click()
        customJournalInput.value = issue.group.canonicalName
        customAbbrInput.value = issue.group.entries[0].selectedAbbr
        customAbbrInput.focus()
      })
      actionRow.appendChild(btn)

      cardBody.appendChild(actionRow)
    } else if (issue.type === 'already_abbreviated') {
      const p = document.createElement('p')
      p.className = 'issue-message'
      const matched = issue.group.entries[0]
      p.textContent = `This journal is already abbreviated. It was matched to "${matched.selectedAbbr}" from the full name "${matched.candidates[0]?.originalKey ?? issue.group.canonicalName}".`
      cardBody.appendChild(p)

      const actionRow = document.createElement('div')
      actionRow.className = 'issue-action-row'

      const infoSpan = document.createElement('span')
      infoSpan.style.fontSize = '0.75rem'
      infoSpan.style.color = 'var(--text-secondary)'
      infoSpan.textContent = 'No action needed — left unchanged in output'
      actionRow.appendChild(infoSpan)

      const btn = document.createElement('button')
      btn.className = 'btn btn-secondary btn-sm'
      btn.textContent = 'Override'
      btn.addEventListener('click', () => {
        tabCustomRules.click()
        customJournalInput.value = issue.group.canonicalName
        customAbbrInput.value = matched.selectedAbbr
        customAbbrInput.focus()
      })
      actionRow.appendChild(btn)

      cardBody.appendChild(actionRow)
    }

    card.appendChild(cardBody)
    inconsistenciesList.appendChild(card)
  })
}

// Rules Panel Header Collapsible Toggle
rulesPanelHeader.addEventListener('click', () => {
  const isCollapsed = rulesPanel.classList.toggle('collapsed')
  if (isCollapsed) {
    rulesPanelContent.style.display = 'none'
    toggleRulesBtn.style.transform = 'rotate(0deg)'
  } else {
    rulesPanelContent.style.display = 'block'
    toggleRulesBtn.style.transform = 'rotate(180deg)'
  }
})

// Tab Switching Listener
const tabButtons = [tabCustomRules, tabUnification]
tabButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (rulesPanel.classList.contains('collapsed')) {
      rulesPanel.classList.remove('collapsed')
      rulesPanelContent.style.display = 'block'
      toggleRulesBtn.style.transform = 'rotate(180deg)'
    }

    tabButtons.forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')

    const targetTabId = btn.getAttribute('data-tab')
    document.querySelectorAll('.tab-content').forEach((content) => {
      const el = content as HTMLDivElement
      if (el.id === targetTabId) {
        el.style.display = 'block'
      } else {
        el.style.display = 'none'
      }
    })
  })
})

// Add Rule Action
addRuleBtn.addEventListener('click', () => {
  const journal = customJournalInput.value.trim()
  const abbr = customAbbrInput.value.trim()

  if (!journal || !abbr) {
    alert('Please fill out both the Journal Name and the Custom Abbreviation.')
    return
  }

  addCustomRule(journal, abbr)
  persistRulesToCookie()
  renderRulesList()

  customJournalInput.value = ''
  customAbbrInput.value = ''

  if (bibInput.value.trim().length > 0) {
    runConversion()
  }
})

// Persistent Cookie Checkbox Listener
cookiePersistCheckbox.addEventListener('change', () => {
  persistRulesToCookie()
})

// Unify All Button Action
unifyAllBtn.addEventListener('click', () => {
  const groups = new Map<string, InconsistencyGroup>()

  activeMatches.forEach((item, idx) => {
    const chosen = item.candidates[item.selectedIndex]
    let canonicalName = ''
    if (chosen.matchType !== 'none' && chosen.originalKey) {
      canonicalName = chosen.originalKey
    } else {
      canonicalName = normalizeString(item.match.value)
    }

    const key = canonicalName.toUpperCase()
    if (!groups.has(key)) {
      groups.set(key, {
        canonicalName: chosen.originalKey || item.match.value,
        entries: [],
      })
    }

    groups.get(key)!.entries.push({
      match: item.match,
      selectedAbbr: chosen.abbreviation,
      matchType: chosen.matchType,
      candidates: item.candidates,
      activeMatchIndex: idx,
    })
  })

  let unifiedCount = 0
  groups.forEach((group) => {
    const uniqueResolvedAbbrs = new Set(group.entries.map((e) => e.selectedAbbr))
    if (uniqueResolvedAbbrs.size > 1) {
      const counts: Record<string, number> = {}
      let maxCount = 0
      let mostCommon = ''

      group.entries.forEach((e) => {
        counts[e.selectedAbbr] = (counts[e.selectedAbbr] || 0) + 1
        if (counts[e.selectedAbbr] > maxCount) {
          maxCount = counts[e.selectedAbbr]
          mostCommon = e.selectedAbbr
        }
      })

      if (mostCommon) {
        addCustomRule(group.canonicalName, mostCommon)
        unifiedCount++
      }
    }
  })

  if (unifiedCount > 0) {
    persistRulesToCookie()
    renderRulesList()
    runConversion()
  }
})

// Convert Button Click
convertBtn.addEventListener('click', runConversion)

// Copy to Clipboard Action
copyBtn.addEventListener('click', async () => {
  if (!convertedContent) return
  try {
    await navigator.clipboard.writeText(convertedContent)
    const originalText = copyBtn.textContent
    copyBtn.textContent = 'Copied!'
    copyBtn.style.borderColor = 'var(--success)'
    setTimeout(() => {
      copyBtn.textContent = originalText
      copyBtn.style.borderColor = 'var(--border-color)'
    }, 2000)
  } catch (err) {
    console.error('Failed to copy text:', err)
  }
})

// Download Action
downloadBtn.addEventListener('click', () => {
  if (!convertedContent) return
  const blob = new Blob([convertedContent], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = currentFileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
})

// Start the app
init()
