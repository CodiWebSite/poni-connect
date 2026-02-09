import * as XLSX from 'xlsx';

export interface ParsedEmployee {
  firstName: string;
  lastName: string;
  fullName: string;
  cnp: string;
  position: string;
  department: string;
  totalLeaveDays: number;
  usedLeaveDays: number;
  email: string;
  emailMatched: boolean;
}

interface EmailEntry {
  name: string;
  email: string;
}

/**
 * Remove diacritics for fuzzy name matching
 */
function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize a name for comparison: lowercase, no diacritics, no extra spaces, 
 * split hyphens into separate words, remove punctuation
 */
function normalizeName(name: string): string {
  return removeDiacritics(name)
    .toLowerCase()
    .replace(/[-–—]/g, ' ')  // hyphens to spaces
    .replace(/[.,;:'"()]/g, '') // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get all meaningful name tokens (split by space, min 2 chars)
 */
function getNameTokens(name: string): string[] {
  return normalizeName(name)
    .split(' ')
    .filter(t => t.length >= 2);
}

/**
 * Find a header row in a sheet and return column indices
 */
/**
 * Check if a header value represents the total leave days column
 */
function isTotalLeaveHeader(val: string): boolean {
  // "Nr. zile CO cuvenite", "Zile CO cuvenite", "zile cuvenite", "CO cuvenite"
  if (val.includes('cuvenite') && (val.includes('zile') || val.includes('co') || val.includes('c.o'))) return true;
  // "Nr. zile CO" standalone (exactly, not part of a longer phrase)
  if (/^nr\.?\s*zile\s*c\.?o\.?$/.test(val)) return true;
  return false;
}

/**
 * Check if a header value represents a used leave days column
 */
function isUsedLeaveHeader(val: string): boolean {
  if (val.includes('cuvenite')) return false;
  if (val.includes('concediu platite')) return false; // "Zile concediu platite in avans"
  if ((val.includes('nr') && val.includes('zile') && (val.includes('co') || val.includes('c.o'))) ||
      (val.includes('zile co') || val.includes('zile c.o'))) {
    return true;
  }
  return false;
}

/**
 * Find a header row in a sheet and return column indices
 */
function findHeaderRow(sheet: XLSX.WorkSheet): { headerRow: number; columns: Record<string, number> } | null {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  
  for (let r = range.s.r; r <= Math.min(range.e.r, 15); r++) {
    const columns: Record<string, number> = {};
    let foundName = false;
    let foundCNP = false;
    
    // Log all cells in this row for debugging
    const rowCells: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        rowCells.push(`[${c}]="${String(cell.v || '').trim()}"`);
      }
    }
    
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const raw = String(cell.v || '').trim();
      const val = removeDiacritics(raw).toLowerCase();
      
      if (val.includes('nume') && (val.includes('prenume') || val.includes('si'))) {
        columns['name'] = c;
        foundName = true;
      } else if (val === 'cnp' || val.includes('c.n.p')) {
        columns['cnp'] = c;
        foundCNP = true;
      } else if (val.includes('functia') || val.includes('functie')) {
        columns['function'] = c;
      } else if (val.includes('grad') || val.includes('treapta')) {
        columns['grade'] = c;
      } else if (isTotalLeaveHeader(val)) {
        columns['totalLeave'] = c;
        console.log(`  Found totalLeave column at [${c}]: "${raw}"`);
      }
    }
    
    if (foundName && foundCNP) {
      console.log(`Header row ${r}: name=[${columns['name']}] cnp=[${columns['cnp']}] func=[${columns['function']}] grade=[${columns['grade']}] totalLeave=[${columns['totalLeave']}]`);
      if (rowCells.length > 0) {
        console.log(`  Row ${r} cells: ${rowCells.join(', ')}`);
      }
      
      // If totalLeave not found on header row, search nearby rows (merged cells scenario)
      if (columns['totalLeave'] === undefined) {
        console.log(`  Searching nearby rows for totalLeave column...`);
        for (let searchR = Math.max(range.s.r, r - 2); searchR <= Math.min(range.e.r, r + 3); searchR++) {
          if (searchR === r) continue;
          const nearbyRowCells: string[] = [];
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({ r: searchR, c })];
            if (!cell) continue;
            const raw = String(cell.v || '').trim();
            const val = removeDiacritics(raw).toLowerCase();
            nearbyRowCells.push(`[${c}]="${raw}"`);
            
            if (isTotalLeaveHeader(val) && columns['totalLeave'] === undefined) {
              columns['totalLeave'] = c;
              console.log(`  Found totalLeave on row ${searchR} at [${c}]: "${raw}"`);
            }
          }
          if (nearbyRowCells.length > 0) {
            console.log(`  Nearby row ${searchR}: ${nearbyRowCells.join(', ')}`);
          }
        }
      }
      
      // After finding totalLeave, find used leave columns after it
      if (columns['totalLeave'] !== undefined) {
        const usedLeaveCols: number[] = [];
        const searchRows = [r];
        for (let sr = Math.max(range.s.r, r - 2); sr <= Math.min(range.e.r, r + 3); sr++) {
          if (sr !== r) searchRows.push(sr);
        }
        
        for (let c = columns['totalLeave'] + 1; c <= range.e.c; c++) {
          for (const sr of searchRows) {
            const cell = sheet[XLSX.utils.encode_cell({ r: sr, c })];
            if (!cell) continue;
            const raw = String(cell.v || '').trim();
            const val = removeDiacritics(raw).toLowerCase();
            if (isUsedLeaveHeader(val)) {
              usedLeaveCols.push(c);
              console.log(`  Found usedLeave column at [${c}] (row ${sr}): "${raw}"`);
              break;
            }
          }
        }
        console.log(`  Total usedLeave columns found: ${usedLeaveCols.length}`);
        columns['usedLeaveCols'] = -1;
        return { headerRow: r, columns: { ...columns, _usedLeaveCols: JSON.stringify(usedLeaveCols) } as unknown as Record<string, number> };
      }
      
      console.log(`  WARNING: No totalLeave column found even after searching nearby rows`);
      return { headerRow: r, columns };
    }
  }
  
  console.log('WARNING: No header row found in sheet!');
  return null;
}

/**
 * Extract department name from sheet content or sheet name
 */
function extractDepartment(sheet: XLSX.WorkSheet, sheetName: string): string {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  
  // Search first 10 rows for department info
  for (let r = range.s.r; r <= Math.min(range.e.r, 10); r++) {
    for (let c = range.s.c; c <= Math.min(range.e.c, 10); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const val = String(cell.v || '').trim();
      
      // Look for patterns like "Laborator X - ..." or "SRUS" etc.
      if (val.match(/^Laborator/i) || val.match(/^Lab\s*\d/i)) {
        return val;
      }
      if (val.match(/^SRUS/i) || val.match(/^Serviciul/i) || val.match(/^Compartiment/i) || val.match(/^Audit/i)) {
        return val;
      }
    }
  }
  
  // Fall back to sheet name
  return sheetName;
}

/**
 * Split a full name into first name and last name
 * Romanian convention: typically "LASTNAME FIRSTNAME" in uppercase
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) {
    return { firstName: parts[0] || '', lastName: '' };
  }
  
  // Convention: first part is last name, rest is first name
  // But handle compound last names (e.g., "AL-MATARNEH MARIA-CRISTINA")
  const lastName = parts[0];
  const firstName = parts.slice(1).join(' ');
  
  return { firstName, lastName };
}

/**
 * Parse all sheets from an XLS workbook
 */
export function parseEmployeeWorkbook(workbook: XLSX.WorkBook): ParsedEmployee[] {
  const employees: ParsedEmployee[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) continue;
    
    console.log(`\n=== Processing sheet: "${sheetName}" ===`);
    const department = extractDepartment(sheet, sheetName);
    console.log(`  Department: "${department}"`);
    const headerInfo = findHeaderRow(sheet);
    
    if (!headerInfo) {
      console.log(`  Skipping sheet - no header row found`);
      continue;
    }
    
    const { headerRow, columns } = headerInfo;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    // Parse used leave columns
    const usedLeaveColsRaw = (columns as Record<string, unknown>)['_usedLeaveCols'];
    const usedLeaveCols: number[] = usedLeaveColsRaw ? JSON.parse(String(usedLeaveColsRaw)) : [];
    
    let sheetEmployeeCount = 0;
    
    // Read data rows after header
    for (let r = headerRow + 1; r <= range.e.r; r++) {
      const nameCell = sheet[XLSX.utils.encode_cell({ r, c: columns['name'] })];
      const cnpCell = sheet[XLSX.utils.encode_cell({ r, c: columns['cnp'] })];
      
      if (!nameCell || !cnpCell) continue;
      
      const fullName = String(nameCell.v || '').trim();
      const cnp = String(cnpCell.v || '').trim();
      
      // Skip empty rows, headers, or non-data rows
      if (!fullName || !cnp || cnp.length < 13 || !/^\d{13}$/.test(cnp)) continue;
      
      // Skip if it looks like a header repeat
      if (fullName.toLowerCase().includes('nume') && fullName.toLowerCase().includes('prenume')) continue;
      
      const { firstName, lastName } = splitName(fullName);
      
      // Get position (function + grade)
      let position = '';
      if (columns['function'] !== undefined) {
        const funcCell = sheet[XLSX.utils.encode_cell({ r, c: columns['function'] })];
        if (funcCell) position = String(funcCell.v || '').trim();
      }
      if (columns['grade'] !== undefined) {
        const gradeCell = sheet[XLSX.utils.encode_cell({ r, c: columns['grade'] })];
        if (gradeCell) {
          const grade = String(gradeCell.v || '').trim();
          if (grade) position = position ? `${position} ${grade}` : grade;
        }
      }
      
      // Get total leave days
      let totalLeaveDays = 21;
      if (columns['totalLeave'] !== undefined) {
        const totalCell = sheet[XLSX.utils.encode_cell({ r, c: columns['totalLeave'] })];
        if (totalCell) {
          if (typeof totalCell.v === 'number') {
            totalLeaveDays = totalCell.v;
          } else {
            const parsed = parseInt(String(totalCell.v), 10);
            if (!isNaN(parsed)) totalLeaveDays = parsed;
          }
        }
        // Log first 3 employees per sheet for debugging
        if (sheetEmployeeCount < 3) {
          const totalCellRaw = totalCell ? `type=${typeof totalCell.v}, value=${totalCell.v}` : 'null';
          console.log(`  Employee "${fullName}": totalLeave col=${columns['totalLeave']}, cell=(${totalCellRaw}), result=${totalLeaveDays}`);
        }
      } else if (sheetEmployeeCount < 3) {
        console.log(`  Employee "${fullName}": NO totalLeave column detected, defaulting to ${totalLeaveDays}`);
      }
      
      // Calculate used leave days by summing all "Nr. zile CO" columns after the cuvenite column
      let usedLeaveDays = 0;
      for (const col of usedLeaveCols) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c: col })];
        if (cell) {
          if (typeof cell.v === 'number') {
            usedLeaveDays += cell.v;
          } else {
            const parsed = parseInt(String(cell.v), 10);
            if (!isNaN(parsed)) usedLeaveDays += parsed;
          }
        }
      }
      
      if (sheetEmployeeCount < 3) {
        console.log(`    usedLeaveDays=${usedLeaveDays} (from ${usedLeaveCols.length} columns)`);
      }
      
      sheetEmployeeCount++;
      
      employees.push({
        firstName,
        lastName,
        fullName,
        cnp,
        position,
        department,
        totalLeaveDays,
        usedLeaveDays,
        email: '',
        emailMatched: false,
      });
    }
    
    console.log(`  Sheet "${sheetName}": ${sheetEmployeeCount} employees parsed`);
  }
  
  console.log(`\nTotal employees parsed: ${employees.length}`);
  return employees;
}

/**
 * Parse email file (CSV or XLS) and return name-email pairs
 */
export function parseEmailFile(workbook: XLSX.WorkBook): EmailEntry[] {
  const entries: EmailEntry[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) continue;
    
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });
    
    for (const row of data) {
      const values = Object.values(row);
      if (values.length < 2) continue;
      
      // Find the email column (contains @)
      let email = '';
      let name = '';
      
      for (const val of values) {
        const str = String(val || '').trim();
        if (str.includes('@') && !email) {
          email = str.toLowerCase();
        } else if (str && !name && str.length > 2 && !str.includes('@')) {
          name = str;
        }
      }
      
      if (email && name) {
        entries.push({ name, email });
      }
    }
  }
  
  return entries;
}

/**
 * Parse a CSV string with ; separator for email matching
 */
export function parseEmailCsv(content: string): EmailEntry[] {
  const entries: EmailEntry[] = [];
  const lines = content.trim().split('\n');
  
  for (const line of lines) {
    const parts = line.split(';').map(p => p.trim());
    if (parts.length < 2) continue;
    
    // Find name and email
    let email = '';
    let name = '';
    for (const part of parts) {
      if (part.includes('@')) email = part.toLowerCase();
      else if (part.length > 2 && !name) name = part;
    }
    
    if (email && name) {
      entries.push({ name, email });
    }
  }
  
  return entries;
}

/**
 * Match employees with emails by fuzzy name comparison
 */
export function matchEmails(employees: ParsedEmployee[], emailEntries: EmailEntry[]): ParsedEmployee[] {
  console.log(`Matching ${employees.length} employees with ${emailEntries.length} email entries`);
  
  const normalizedEmails = emailEntries.map(e => ({
    ...e,
    normalizedName: normalizeName(e.name),
    tokens: getNameTokens(e.name),
  }));
  
  let matchedCount = 0;
  let unmatchedNames: string[] = [];
  
  const result = employees.map(emp => {
    const empNormalized = normalizeName(emp.fullName);
    const empTokens = getNameTokens(emp.fullName);
    
    // 1. Exact normalized match
    let match = normalizedEmails.find(e => e.normalizedName === empNormalized);
    
    // 2. All tokens match (handles different order: "POPESCU ION" vs "ION POPESCU")
    if (!match) {
      match = normalizedEmails.find(e => {
        if (e.tokens.length !== empTokens.length) return false;
        const sorted1 = [...e.tokens].sort();
        const sorted2 = [...empTokens].sort();
        return sorted1.every((t, i) => t === sorted2[i]);
      });
    }
    
    // 3. Containment match: all tokens from the shorter name exist in the longer name
    if (!match) {
      match = normalizedEmails.find(e => {
        const shorter = e.tokens.length <= empTokens.length ? e.tokens : empTokens;
        const longer = e.tokens.length <= empTokens.length ? empTokens : e.tokens;
        return shorter.every(t => longer.includes(t));
      });
    }
    
    // 4. High overlap: at least 2 tokens match AND that's >= 60% of the shorter name's tokens
    if (!match && empTokens.length >= 2) {
      match = normalizedEmails.find(e => {
        if (e.tokens.length < 2) return false;
        const commonTokens = empTokens.filter(t => e.tokens.includes(t));
        const minLen = Math.min(empTokens.length, e.tokens.length);
        return commonTokens.length >= 2 && commonTokens.length >= minLen * 0.6;
      });
    }
    
    // 5. Substring match: one name contains the other
    if (!match) {
      match = normalizedEmails.find(e => {
        return e.normalizedName.includes(empNormalized) || empNormalized.includes(e.normalizedName);
      });
    }
    
    if (match) {
      matchedCount++;
      return { ...emp, email: match.email, emailMatched: true };
    }
    
    unmatchedNames.push(emp.fullName);
    return emp;
  });
  
  console.log(`Matched: ${matchedCount}/${employees.length}`);
  if (unmatchedNames.length > 0 && unmatchedNames.length <= 20) {
    console.log('Unmatched names:', unmatchedNames);
  } else if (unmatchedNames.length > 20) {
    console.log(`${unmatchedNames.length} unmatched. First 10:`, unmatchedNames.slice(0, 10));
  }
  
  // Also log first 5 email entries for debugging format
  if (unmatchedNames.length > 0) {
    console.log('Sample email entries:', normalizedEmails.slice(0, 5).map(e => `"${e.normalizedName}" -> ${e.email}`));
    console.log('Sample employee names:', employees.slice(0, 5).map(e => `"${normalizeName(e.fullName)}"`));
  }
  
  return result;
}
