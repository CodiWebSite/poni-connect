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

export function parseInventoryXls(file: ArrayBuffer): InventoryParseResult {
  const wb = XLSX.read(file, { type: 'array' });
  const errors: string[] = [];
  const equipment: ParsedEquipment[] = [];
  const software: ParsedSoftware[] = [];

  // Sheet 1: inventar_echipamente
  const eqSheet = wb.Sheets[wb.SheetNames[0]];
  if (eqSheet) {
    const rows: any[][] = XLSX.utils.sheet_to_json(eqSheet, { header: 1, defval: '' });
    // Find header row
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i].map((c: any) => str(c).toLowerCase());
      if (row.some(c => c.includes('inventar') || c.includes('nr. inventar'))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1 && rows.length > 1) headerIdx = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c: any) => str(c) === '')) continue;
      const invNum = str(r[5]);
      if (!invNum) { errors.push(`Sheet1 rând ${i + 1}: Nr. inventar lipsă, ignorat`); continue; }
      equipment.push({
        building: str(r[0]),
        floor: num(r[1]),
        room: str(r[2]),
        equipment_type: str(r[3]),
        brand_model: str(r[4]),
        inventory_number: invNum,
        serial_number: str(r[6]),
        status: str(r[7]),
        notes: str(r[8]),
      });
    }
  } else {
    errors.push('Sheet-ul de echipamente nu a fost găsit.');
  }

  // Sheet 2: Software_calculatoare
  const swSheet = wb.Sheets[wb.SheetNames[1]];
  if (swSheet) {
    const rows: any[][] = XLSX.utils.sheet_to_json(swSheet, { header: 1, defval: '' });
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i].map((c: any) => str(c).toLowerCase());
      if (row.some(c => c.includes('inventar') || c.includes('nr. inventar'))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1 && rows.length > 1) headerIdx = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c: any) => str(c) === '')) continue;
      const invNum = str(r[4]);
      if (!invNum) continue;
      software.push({
        building: str(r[0]),
        floor: num(r[1]),
        room: str(r[2]),
        activity_type: str(r[3]),
        inventory_number: invNum,
        pc_name: str(r[5]),
        os: str(r[6]),
        license_year: num(r[7]),
        license_type: str(r[8]),
        antivirus: str(r[9]),
        antivirus_year: num(r[10]),
        installed_apps: str(r[11]),
        licensed_count: str(r[12]),
        notes: str(r[13]),
      });
    }
  }

  return { equipment, software, errors };
}

export { mapStatus, mapCategory };
