import * as XLSX from 'xlsx';

export interface ParsedEquipment {
  building: string;
  floor: number | null;
  room: string;
  equipment_type: string;
  brand_model: string;
  inventory_number: string;
  serial_number: string;
  status: string;
  notes: string;
}

export interface ParsedSoftware {
  building: string;
  floor: number | null;
  room: string;
  activity_type: string;
  inventory_number: string;
  pc_name: string;
  os: string;
  license_year: number | null;
  license_type: string;
  antivirus: string;
  antivirus_year: number | null;
  installed_apps: string;
  licensed_count: string;
  notes: string;
}

export interface InventoryParseResult {
  equipment: ParsedEquipment[];
  software: ParsedSoftware[];
  errors: string[];
}

const str = (v: any): string => (v == null ? '' : String(v).trim());
const num = (v: any): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

const mapStatus = (raw: string): string => {
  const s = raw.toLowerCase();
  if (s.includes('funcțional') || s.includes('functional') || s.includes('bun') || s.includes('activ')) return 'available';
  if (s.includes('repara') || s.includes('defect')) return 'in_repair';
  if (s.includes('dezafecta') || s.includes('casat')) return 'decommissioned';
  return 'available';
};

const mapCategory = (raw: string): string => {
  const s = raw.toLowerCase();
  if (s.includes('laptop')) return 'laptop';
  if (s.includes('calculator') || s.includes('pc') || s.includes('unitate') || s.includes('desktop')) return 'pc';
  if (s.includes('monitor') || s.includes('display')) return 'monitor';
  if (s.includes('imprimant') || s.includes('printer') || s.includes('multifunc')) return 'imprimanta';
  if (s.includes('telefon')) return 'telefon';
  if (s.includes('ups')) return 'ups';
  if (s.includes('switch') || s.includes('router') || s.includes('server')) return 'retea';
  if (s.includes('scanner') || s.includes('scaner')) return 'scanner';
  return 'altele';
};

// Find sheet by partial name match (case-insensitive)
function findSheet(wb: XLSX.WorkBook, ...keywords: string[]): XLSX.WorkSheet | null {
  for (const name of wb.SheetNames) {
    const lower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase().replace(/[^a-z0-9]/g, ''))) return wb.Sheets[name];
    }
  }
  return null;
}

// Find header row and build column index map
function findHeaderMap(rows: any[][], searchTerms: string[]): { headerIdx: number; colMap: Record<string, number> } {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row) continue;
    const cells = row.map((c: any) => str(c).toLowerCase());
    // Check if this row contains at least 3 of our search terms
    let matches = 0;
    const colMap: Record<string, number> = {};
    for (const term of searchTerms) {
      const termLower = term.toLowerCase();
      const idx = cells.findIndex(c => c.includes(termLower));
      if (idx >= 0) {
        colMap[term] = idx;
        matches++;
      }
    }
    if (matches >= 3) return { headerIdx: i, colMap };
  }
  return { headerIdx: 0, colMap: {} };
}

export function parseInventoryXls(file: ArrayBuffer): InventoryParseResult {
  const wb = XLSX.read(file, { type: 'array' });
  const errors: string[] = [];
  const equipment: ParsedEquipment[] = [];
  const software: ParsedSoftware[] = [];

  // ─── Sheet 1: Inventar Echipamente ───
  const eqSheet = findSheet(wb, 'inventar', 'echipamente') || wb.Sheets[wb.SheetNames[0]];
  if (eqSheet) {
    const rows: any[][] = XLSX.utils.sheet_to_json(eqSheet, { header: 1, defval: '' });
    
    const eqTerms = ['cladire', 'clădire', 'etaj', 'incapere', 'încăpere', 'tip', 'brand', 'model', 'inventar', 'serie', 'status', 'observat'];
    const { headerIdx, colMap } = findHeaderMap(rows, eqTerms);
    
    // Resolve column indices — fallback to positional if header detection fails
    const col = {
      building: colMap['cladire'] ?? colMap['clădire'] ?? 0,
      floor: colMap['etaj'] ?? 1,
      room: colMap['incapere'] ?? colMap['încăpere'] ?? 2,
      type: colMap['tip'] ?? 3,
      brand: colMap['brand'] ?? colMap['model'] ?? 4,
      inventory: colMap['inventar'] ?? 5,
      serial: colMap['serie'] ?? 6,
      status: colMap['status'] ?? 7,
      notes: colMap['observat'] ?? 8,
    };

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c: any) => str(c) === '')) continue;
      const invNum = str(r[col.inventory]);
      if (!invNum || invNum === '0') {
        // Try to still import if there's a name/type
        const name = str(r[col.brand]) || str(r[col.type]);
        if (!name) continue;
      }
      equipment.push({
        building: str(r[col.building]),
        floor: num(r[col.floor]),
        room: str(r[col.room]),
        equipment_type: str(r[col.type]),
        brand_model: str(r[col.brand]),
        inventory_number: str(r[col.inventory]),
        serial_number: str(r[col.serial]),
        status: str(r[col.status]),
        notes: str(r[col.notes]),
      });
    }
    if (equipment.length === 0) {
      errors.push(`Sheet echipamente: nu s-au găsit date valide (${rows.length} rânduri citite).`);
    }
  } else {
    errors.push('Sheet-ul de echipamente nu a fost găsit. Sheet-uri disponibile: ' + wb.SheetNames.join(', '));
  }

  // ─── Sheet 2: Software Calculatoare ───
  const swSheet = findSheet(wb, 'software', 'calculatoare') || (wb.SheetNames.length > 1 ? wb.Sheets[wb.SheetNames[1]] : null);
  if (swSheet) {
    const rows: any[][] = XLSX.utils.sheet_to_json(swSheet, { header: 1, defval: '' });

    const swTerms = ['cladire', 'clădire', 'etaj', 'incapere', 'încăpere', 'activitate', 'inventar', 'nume pc', 'operare', 'licen', 'antivirus', 'aplicat', 'observat'];
    const { headerIdx, colMap } = findHeaderMap(rows, swTerms);

    const col = {
      building: colMap['cladire'] ?? colMap['clădire'] ?? 0,
      floor: colMap['etaj'] ?? 1,
      room: colMap['incapere'] ?? colMap['încăpere'] ?? 2,
      activity: colMap['activitate'] ?? 3,
      inventory: colMap['inventar'] ?? 4,
      pcName: colMap['nume pc'] ?? 5,
      os: colMap['operare'] ?? 6,
      licenseYear: 7, // "An licență" - positional fallback
      licenseType: colMap['licen'] != null && colMap['licen'] !== 7 ? colMap['licen'] : 8,
      antivirus: colMap['antivirus'] ?? 9,
      antivirusYear: 10,
      apps: colMap['aplicat'] ?? 11,
      licensed: 12,
      notes: colMap['observat'] ?? 13,
    };

    // Fix: if 'licen' matched "An licență" at col 7, license_type should be next col
    if (colMap['licen'] === 7) {
      col.licenseYear = 7;
      col.licenseType = 8;
    }

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c: any) => str(c) === '')) continue;
      const invNum = str(r[col.inventory]);
      if (!invNum) continue;
      software.push({
        building: str(r[col.building]),
        floor: num(r[col.floor]),
        room: str(r[col.room]),
        activity_type: str(r[col.activity]),
        inventory_number: invNum,
        pc_name: str(r[col.pcName]),
        os: str(r[col.os]),
        license_year: num(r[col.licenseYear]),
        license_type: str(r[col.licenseType]),
        antivirus: str(r[col.antivirus]),
        antivirus_year: num(r[col.antivirusYear]),
        installed_apps: str(r[col.apps]),
        licensed_count: str(r[col.licensed]),
        notes: str(r[col.notes]),
      });
    }
    if (software.length === 0 && rows.length > 1) {
      errors.push(`Sheet software: nu s-au găsit date valide (${rows.length} rânduri citite).`);
    }
  }

  return { equipment, software, errors };
}

export { mapStatus, mapCategory };
