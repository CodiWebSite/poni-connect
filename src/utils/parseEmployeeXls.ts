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
  cnp?: string;
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
 * Check if a header value (possibly from a multi-row merged cell) represents 
 * the total leave days column. The header may be split across rows like:
 *   Row 1: "Nr. zile"
 *   Row 2: "CO"  
 *   Row 3: "cuvenite"
 * So we need to match individual parts too.
 */
function isTotalLeaveHeader(val: string): boolean {
  // Full text match: "Nr. zile CO cuvenite", "Zile CO cuvenite", "zile cuvenite", "CO cuvenite"
  if (val.includes('cuvenite') && (val.includes('zile') || val.includes('co') || val.includes('c.o'))) return true;
  // "Nr. zile CO" standalone
  if (/^nr\.?\s*zile\s*c\.?o\.?$/.test(val)) return true;
  // Just "cuvenite" alone (from a split multi-row header)
  if (val.trim() === 'cuvenite') return true;
  return false;
}

/**
 * Collect the full header text for a column by reading across multiple rows.
 * This handles merged/split headers where "Nr. zile" / "CO" / "cuvenite" are on separate rows.
 */
function getMultiRowHeaderText(sheet: XLSX.WorkSheet, col: number, startRow: number, endRow: number): string {
  const parts: string[] = [];
  for (let r = startRow; r <= endRow; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: col })];
    if (cell) {
      const val = String(cell.v || '').trim();
      if (val) parts.push(val);
    }
  }
  return parts.join(' ');
}

/**
 * Check if a header value represents a SUMMARY used leave days column
 * e.g. "Total zile CO efectuat" - this is the grand total, not an individual month
 */
function isSummaryUsedLeaveHeader(val: string): boolean {
  if (val.includes('cuvenite')) return false;
  // "Total zile CO efectuat" or "CO efectuat" as a summary column
  if (val.includes('efectuat') && (val.includes('co') || val.includes('c.o') || val.includes('zile'))) return true;
  // "Total zile CO" without "cuvenite" - likely a summary
  if (val.includes('total') && (val.includes('zile co') || val.includes('zile c.o'))) return true;
  return false;
}

/**
 * Check if a header value represents a "remaining days" column
 * e.g. "Diferenta ramasa"
 */
function isRemainingLeaveHeader(val: string): boolean {
  if (val.includes('diferenta') && val.includes('ramasa')) return true;
  if (val.includes('rest') && val.includes('co')) return true;
  if (val === 'ramasa' || val === 'ramase') return true;
  return false;
}

/**
 * Check if a header value represents an individual monthly used leave column
 * e.g. "Nr. zile CO" for a specific month - NOT a summary/total column
 */
function isIndividualUsedLeaveHeader(val: string): boolean {
  if (val.includes('cuvenite')) return false;
  if (val.includes('concediu platite')) return false;
  if (val.includes('efectuat')) return false; // This is a summary column
  if (val.includes('total') && !val.includes('nr')) return false; // "Total zile CO" is a summary
  if (val.includes('diferenta') || val.includes('ramasa') || val.includes('rest')) return false;
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
      
      // If totalLeave not found on header row, use multi-row header detection
      // Headers like "Nr. zile" / "CO" / "cuvenite" split across 3 rows in the same column
      if (columns['totalLeave'] === undefined) {
        console.log(`  Searching multi-row headers for totalLeave column...`);
        const headerStartRow = Math.max(range.s.r, r - 3);
        const headerEndRow = Math.min(range.e.r, r + 3);
        
        // Log nearby rows for debugging
        for (let searchR = headerStartRow; searchR <= headerEndRow; searchR++) {
          if (searchR === r) continue;
          const nearbyRowCells: string[] = [];
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({ r: searchR, c })];
            if (cell) nearbyRowCells.push(`[${c}]="${String(cell.v || '').trim()}"`);
          }
          if (nearbyRowCells.length > 0) {
            console.log(`  Row ${searchR}: ${nearbyRowCells.join(', ')}`);
          }
        }
        
        // For each column, combine text from all header rows and check
        for (let c = range.s.c; c <= range.e.c; c++) {
          const combinedRaw = getMultiRowHeaderText(sheet, c, headerStartRow, headerEndRow);
          const combinedVal = removeDiacritics(combinedRaw).toLowerCase();
          if (combinedVal.includes('cuvenite') && (combinedVal.includes('zile') || combinedVal.includes('co'))) {
            columns['totalLeave'] = c;
            console.log(`  Found totalLeave via multi-row at [${c}]: combined="${combinedRaw}"`);
            break;
          }
        }
      }
      
      // After finding totalLeave, find used leave columns after it using multi-row combined headers
      // We distinguish between:
      //   1. Summary "CO efectuat" column (grand total of used leave)
      //   2. "Diferenta ramasa" column (remaining days)
      //   3. Individual monthly "Nr. zile CO" columns
      if (columns['totalLeave'] !== undefined) {
        const individualUsedLeaveCols: number[] = [];
        let summaryUsedLeaveCol: number | undefined;
        let remainingLeaveCol: number | undefined;
        const headerStartRow = Math.max(range.s.r, r - 3);
        const headerEndRow = Math.min(range.e.r, r + 3);
        
        for (let c = columns['totalLeave'] + 1; c <= range.e.c; c++) {
          // Combine text from all header rows for this column
          const combinedRaw = getMultiRowHeaderText(sheet, c, headerStartRow, headerEndRow);
          const combinedVal = removeDiacritics(combinedRaw).toLowerCase();
          
          if (isRemainingLeaveHeader(combinedVal)) {
            remainingLeaveCol = c;
            console.log(`  Found remainingLeave column at [${c}]: combined="${combinedRaw}"`);
          } else if (isSummaryUsedLeaveHeader(combinedVal)) {
            summaryUsedLeaveCol = c;
            console.log(`  Found SUMMARY usedLeave column at [${c}]: combined="${combinedRaw}"`);
          } else if (isIndividualUsedLeaveHeader(combinedVal)) {
            individualUsedLeaveCols.push(c);
            console.log(`  Found individual usedLeave column at [${c}]: combined="${combinedRaw}"`);
          }
        }
        
        // Strategy: prefer summary/remaining columns over summing individual months
        // This prevents double-counting when both individual AND summary columns exist
        const leaveStrategy = summaryUsedLeaveCol !== undefined ? 'summary' 
          : remainingLeaveCol !== undefined ? 'remaining'
          : individualUsedLeaveCols.length > 0 ? 'sum_individual'
          : 'none';
        
        console.log(`  Leave strategy: ${leaveStrategy} (summary=${summaryUsedLeaveCol}, remaining=${remainingLeaveCol}, individual=${individualUsedLeaveCols.length} cols)`);
        
        columns['usedLeaveCols'] = -1;
        const leaveInfo = {
          strategy: leaveStrategy,
          summaryCol: summaryUsedLeaveCol,
          remainingCol: remainingLeaveCol,
          individualCols: individualUsedLeaveCols,
        };
        return { headerRow: r, columns: { ...columns, _leaveInfo: JSON.stringify(leaveInfo) } as unknown as Record<string, number> };
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
  
  // Search first 15 rows for department info - check all columns
  for (let r = range.s.r; r <= Math.min(range.e.r, 15); r++) {
    for (let c = range.s.c; c <= Math.min(range.e.c, 10); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const val = String(cell.v || '').trim();
      if (!val || val.length < 5) continue;
      
      // Look for patterns like "Laborator X - ...", "Lab X", "SRUS", "Serviciul", etc.
      if (val.match(/^Laborator\s*\d/i) || val.match(/^Lab\s*\d/i)) {
        console.log(`  Department found at row ${r}, col ${c}: "${val}"`);
        return val;
      }
      if (val.match(/^SRUS/i) || val.match(/^Serviciul/i) || val.match(/^Compartiment/i) || 
          val.match(/^Audit/i) || val.match(/^Centrul/i) || val.match(/^Directia/i) ||
          val.match(/^Sectia/i) || val.match(/^Biroul/i)) {
        console.log(`  Department found at row ${r}, col ${c}: "${val}"`);
        return val;
      }
      // Generic pattern: long text with " - " that looks like a department description
      if (val.includes(' - ') && val.length > 15 && !val.toLowerCase().includes('nume') && !val.toLowerCase().includes('cnp')) {
        console.log(`  Department found (long desc) at row ${r}, col ${c}: "${val}"`);
        return val;
      }
    }
  }
  
  // Fall back to sheet name
  console.log(`  Department: using sheet name "${sheetName}"`);
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
    
    // Parse leave info (new strategy-based approach)
    const leaveInfoRaw = (columns as Record<string, unknown>)['_leaveInfo'];
    const leaveInfo: { 
      strategy: string; 
      summaryCol?: number; 
      remainingCol?: number; 
      individualCols: number[];
    } = leaveInfoRaw 
      ? JSON.parse(String(leaveInfoRaw)) 
      : { strategy: 'none', individualCols: [] };
    
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
      
      // Calculate used leave days using the best available strategy
      let usedLeaveDays = 0;
      
      const readCellNumber = (row: number, col: number): number => {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
        if (!cell) return 0;
        if (typeof cell.v === 'number') return cell.v;
        const parsed = parseInt(String(cell.v), 10);
        return isNaN(parsed) ? 0 : parsed;
      };
      
      if (leaveInfo.strategy === 'summary' && leaveInfo.summaryCol !== undefined) {
        // Best: use the summary "CO efectuat" column directly
        usedLeaveDays = readCellNumber(r, leaveInfo.summaryCol);
      } else if (leaveInfo.strategy === 'remaining' && leaveInfo.remainingCol !== undefined) {
        // Second best: compute from "Diferenta ramasa" column
        const remaining = readCellNumber(r, leaveInfo.remainingCol);
        usedLeaveDays = Math.max(0, totalLeaveDays - remaining);
      } else if (leaveInfo.strategy === 'sum_individual') {
        // Fallback: sum individual monthly CO columns (no summary available)
        for (const col of leaveInfo.individualCols) {
          usedLeaveDays += readCellNumber(r, col);
        }
      }
      
      if (sheetEmployeeCount < 3) {
        console.log(`    usedLeaveDays=${usedLeaveDays} (strategy=${leaveInfo.strategy})`);
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
 * Detect header row in email file and return column indices for name/email/cnp
 */
function detectEmailFileHeaders(values: unknown[]): { nameCol: number; firstNameCol: number; lastNameCol: number; emailCol: number; cnpCol: number } | null {
  let emailCol = -1;
  let nameCol = -1;
  let firstNameCol = -1;
  let lastNameCol = -1;
  let cnpCol = -1;

  for (let i = 0; i < values.length; i++) {
    const raw = String(values[i] || '').trim();
    const val = removeDiacritics(raw).toLowerCase();
    
    if (val.includes('email') || val.includes('e-mail') || val === 'mail' || val.includes('adresa email') || val.includes('adresa de email') || val.includes('adresa mail')) {
      emailCol = i;
    } else if (val === 'cnp' || val === 'c.n.p' || val === 'c.n.p.' || val.includes('cod numeric personal')) {
      cnpCol = i;
    } else if (val.includes('nume') && (val.includes('prenume') || val.includes('si') || val.includes('complet'))) {
      nameCol = i;
    } else if ((val === 'nume' || val === 'name' || val === 'last_name' || val === 'last name' || val === 'numele') && nameCol === -1) {
      lastNameCol = i;
    } else if (val === 'prenume' || val === 'prenumele' || val === 'first_name' || val === 'first name' || val === 'prename') {
      firstNameCol = i;
    }
  }

  if (emailCol === -1) return null;
  
  // We need at least an email column and some name info
  if (nameCol !== -1 || (firstNameCol !== -1 && lastNameCol !== -1) || lastNameCol !== -1 || firstNameCol !== -1) {
    return { nameCol, firstNameCol, lastNameCol, emailCol, cnpCol };
  }

  return null;
}

/**
 * Extract name from a row given column mapping
 */
function extractNameFromRow(values: unknown[], cols: { nameCol: number; firstNameCol: number; lastNameCol: number }): string {
  if (cols.nameCol !== -1) {
    return String(values[cols.nameCol] || '').trim();
  }
  
  // Combine last name + first name (NUME PRENUME)
  const parts: string[] = [];
  if (cols.lastNameCol !== -1) {
    const ln = String(values[cols.lastNameCol] || '').trim();
    if (ln) parts.push(ln);
  }
  if (cols.firstNameCol !== -1) {
    const fn = String(values[cols.firstNameCol] || '').trim();
    if (fn) parts.push(fn);
  }
  return parts.join(' ');
}

/**
 * Extract CNP from a row - look for a 13-digit number
 */
function extractCnpFromRow(values: unknown[], cnpCol: number): string {
  if (cnpCol !== -1 && cnpCol < values.length) {
    const val = String(values[cnpCol] || '').trim();
    if (/^\d{13}$/.test(val)) return val;
  }
  // Fallback: scan all cells for a 13-digit number
  for (const val of values) {
    const str = String(val || '').trim();
    if (/^\d{13}$/.test(str)) return str;
  }
  return '';
}

/**
 * Extract email from a row - find the cell containing @
 */
function extractEmailFromRow(values: unknown[], emailCol: number): string {
  if (emailCol !== -1) {
    const val = String(values[emailCol] || '').trim();
    if (val.includes('@')) return val.toLowerCase();
  }
  for (const val of values) {
    const str = String(val || '').trim();
    if (str.includes('@')) return str.toLowerCase();
  }
  return '';
}

/**
 * Heuristic: from a row of values, guess name, email, and cnp without header info
 */
function guessNameEmailCnp(values: unknown[]): { name: string; email: string; cnp: string } {
  let email = '';
  let cnp = '';
  const textCandidates: { value: string; index: number }[] = [];

  for (let i = 0; i < values.length; i++) {
    const str = String(values[i] || '').trim();
    if (!str) continue;
    
    if (str.includes('@') && !email) {
      email = str.toLowerCase();
    } else if (/^\d{13}$/.test(str) && !cnp) {
      cnp = str;
    } else if (str.length > 2 && !str.includes('@') && isNaN(Number(str))) {
      textCandidates.push({ value: str, index: i });
    }
  }

  let name = '';
  if (textCandidates.length > 0) {
    const fullNameCandidate = textCandidates.find(c => c.value.includes(' '));
    if (fullNameCandidate) {
      name = fullNameCandidate.value;
    } else if (textCandidates.length >= 2) {
      name = textCandidates.map(c => c.value).join(' ');
    } else {
      name = textCandidates[0].value;
    }
  }

  return { name, email, cnp };
}

/**
 * Parse email file (CSV or XLS) and return name-email-cnp entries
 */
export function parseEmailFile(workbook: XLSX.WorkBook): EmailEntry[] {
  const entries: EmailEntry[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) continue;
    
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    if (data.length === 0) continue;

    // Try to detect headers in first 5 rows
    let headerCols: ReturnType<typeof detectEmailFileHeaders> = null;
    let dataStartRow = 0;
    
    for (let r = 0; r < Math.min(data.length, 5); r++) {
      const row = data[r];
      if (!Array.isArray(row)) continue;
      headerCols = detectEmailFileHeaders(row);
      if (headerCols) {
        dataStartRow = r + 1;
        console.log(`Email file: detected headers at row ${r}: nameCol=${headerCols.nameCol}, firstNameCol=${headerCols.firstNameCol}, lastNameCol=${headerCols.lastNameCol}, emailCol=${headerCols.emailCol}, cnpCol=${headerCols.cnpCol}`);
        break;
      }
    }
    
    if (!headerCols) {
      console.log('Email file: no headers detected, using heuristic parsing');
    }

    for (let r = dataStartRow; r < data.length; r++) {
      const row = data[r];
      if (!Array.isArray(row) || row.length < 2) continue;
      
      let name: string;
      let email: string;
      let cnp: string;
      
      if (headerCols) {
        name = extractNameFromRow(row, headerCols);
        email = extractEmailFromRow(row, headerCols.emailCol);
        cnp = extractCnpFromRow(row, headerCols.cnpCol);
      } else {
        ({ name, email, cnp } = guessNameEmailCnp(row));
      }
      
      if (email && (name.length > 1 || cnp)) {
        entries.push({ name, email, cnp: cnp || undefined });
      }
    }
    
    console.log(`Email file sheet "${sheetName}": ${entries.length} entries parsed`);
    if (entries.length > 0) {
      const withCnp = entries.filter(e => e.cnp).length;
      console.log(`  ${withCnp}/${entries.length} entries have CNP`);
      console.log('Sample entries:', entries.slice(0, 5).map(e => `"${e.name}" cnp=${e.cnp || 'N/A'} -> ${e.email}`));
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
  if (lines.length === 0) return entries;
  
  const firstLineParts = lines[0].split(';').map(p => p.trim());
  const headerCols = detectEmailFileHeaders(firstLineParts);
  
  let dataStartLine = 0;
  if (headerCols) {
    dataStartLine = 1;
    console.log(`CSV: detected headers: nameCol=${headerCols.nameCol}, firstNameCol=${headerCols.firstNameCol}, lastNameCol=${headerCols.lastNameCol}, emailCol=${headerCols.emailCol}, cnpCol=${headerCols.cnpCol}`);
  } else {
    console.log('CSV: no headers detected, using heuristic parsing');
  }
  
  for (let i = dataStartLine; i < lines.length; i++) {
    const parts = lines[i].split(';').map(p => p.trim());
    if (parts.length < 2) continue;
    
    let name: string;
    let email: string;
    let cnp: string;
    
    if (headerCols) {
      name = extractNameFromRow(parts, headerCols);
      email = extractEmailFromRow(parts, headerCols.emailCol);
      cnp = extractCnpFromRow(parts, headerCols.cnpCol);
    } else {
      ({ name, email, cnp } = guessNameEmailCnp(parts));
    }
    
    if (email && (name.length > 1 || cnp)) {
      entries.push({ name, email, cnp: cnp || undefined });
    }
  }
  
  console.log(`CSV parsed: ${entries.length} entries`);
  if (entries.length > 0) {
    console.log('Sample CSV entries:', entries.slice(0, 5).map(e => `"${e.name}" cnp=${e.cnp || 'N/A'} -> ${e.email}`));
  }
  
  return entries;
}

/**
 * Match employees with emails - PRIMARY: by CNP (exact), FALLBACK: by name (fuzzy)
 */
export function matchEmails(employees: ParsedEmployee[], emailEntries: EmailEntry[]): ParsedEmployee[] {
  console.log(`Matching ${employees.length} employees with ${emailEntries.length} email entries`);
  
  // Build CNP lookup map for O(1) matching
  const cnpToEmail = new Map<string, EmailEntry>();
  for (const entry of emailEntries) {
    if (entry.cnp) {
      cnpToEmail.set(entry.cnp, entry);
    }
  }
  console.log(`  CNP lookup: ${cnpToEmail.size} entries with CNP`);
  
  const normalizedEmails = emailEntries.map(e => ({
    ...e,
    normalizedName: normalizeName(e.name),
    tokens: getNameTokens(e.name),
  }));
  
  let matchedByCnp = 0;
  let matchedByName = 0;
  let unmatchedNames: string[] = [];
  
  const result = employees.map(emp => {
    // === PRIORITY 1: Match by CNP (exact, 100% reliable) ===
    if (emp.cnp) {
      const cnpMatch = cnpToEmail.get(emp.cnp);
      if (cnpMatch) {
        matchedByCnp++;
        return { ...emp, email: cnpMatch.email, emailMatched: true };
      }
    }
    
    // === PRIORITY 2: Fuzzy name matching (fallback) ===
    const empNormalized = normalizeName(emp.fullName);
    const empTokens = getNameTokens(emp.fullName);
    
    // 2a. Exact normalized match
    let match = normalizedEmails.find(e => e.normalizedName === empNormalized);
    
    // 2b. All tokens match (handles different order)
    if (!match) {
      match = normalizedEmails.find(e => {
        if (e.tokens.length !== empTokens.length) return false;
        const sorted1 = [...e.tokens].sort();
        const sorted2 = [...empTokens].sort();
        return sorted1.every((t, i) => t === sorted2[i]);
      });
    }
    
    // 2c. Containment match
    if (!match) {
      match = normalizedEmails.find(e => {
        const shorter = e.tokens.length <= empTokens.length ? e.tokens : empTokens;
        const longer = e.tokens.length <= empTokens.length ? empTokens : e.tokens;
        return shorter.length >= 2 && shorter.every(t => longer.includes(t));
      });
    }
    
    // 2d. High overlap (≥2 tokens, ≥60%)
    if (!match && empTokens.length >= 2) {
      match = normalizedEmails.find(e => {
        if (e.tokens.length < 2) return false;
        const commonTokens = empTokens.filter(t => e.tokens.includes(t));
        const minLen = Math.min(empTokens.length, e.tokens.length);
        return commonTokens.length >= 2 && commonTokens.length >= minLen * 0.6;
      });
    }
    
    if (match) {
      matchedByName++;
      return { ...emp, email: match.email, emailMatched: true };
    }
    
    unmatchedNames.push(emp.fullName);
    return emp;
  });
  
  const totalMatched = matchedByCnp + matchedByName;
  console.log(`Matched: ${totalMatched}/${employees.length} (${matchedByCnp} by CNP, ${matchedByName} by name)`);
  if (unmatchedNames.length > 0 && unmatchedNames.length <= 20) {
    console.log('Unmatched names:', unmatchedNames);
  } else if (unmatchedNames.length > 20) {
    console.log(`${unmatchedNames.length} unmatched. First 10:`, unmatchedNames.slice(0, 10));
  }
  
  return result;
}
