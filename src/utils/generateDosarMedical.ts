import jsPDF from 'jspdf';
import type { MedicalCabinetConfig } from './generateFisaAptitudine';
import { DEFAULT_MEDICAL_CONFIG } from './generateFisaAptitudine';

export interface DosarMedicalParams {
  lastName: string;
  firstName: string;
  cnp: string;
  position: string;
  department: string;
  address: string;
  employmentDate: string;
  config?: MedicalCabinetConfig;
  dosarNumber?: string;
  // Optional supplementary data
  professionalTraining?: string;
  professionalRoute?: string;
  workHistory?: { post: string; period: string; occupation: string; noxe: string }[];
  currentActivities?: string;
  professionalDiseases?: boolean;
  professionalDiseasesDetails?: string;
  workAccidents?: boolean;
  workAccidentsDetails?: string;
  familyDoctor?: string;
  heredoCollateral?: string;
  personalPhysiological?: string;
  personalPathological?: string;
  smoking?: string;
  alcohol?: string;
}

const M = { left: 15, right: 15, top: 15, bottom: 15 };
const PW = 210;
const CW = PW - M.left - M.right;

function parseCNP(cnp: string) {
  if (!cnp || cnp.length < 7) return { sex: '', birthDate: '', age: '' };
  const s = cnp[0];
  const sex = ['1', '3', '5', '7'].includes(s) ? 'M' : (['2', '4', '6', '8'].includes(s) ? 'F' : '');
  let century = '19';
  if (['5', '6'].includes(s)) century = '20';
  if (['3', '4'].includes(s)) century = '18';
  const yy = cnp.substring(1, 3);
  const mm = cnp.substring(3, 5);
  const dd = cnp.substring(5, 7);
  const birthYear = parseInt(century + yy);
  const birthDate = `${dd}.${mm}.${century}${yy}`;
  const now = new Date();
  let age = now.getFullYear() - birthYear;
  const bMonth = parseInt(mm);
  const bDay = parseInt(dd);
  if (now.getMonth() + 1 < bMonth || (now.getMonth() + 1 === bMonth && now.getDate() < bDay)) age--;
  return { sex, birthDate, age: age.toString() };
}

function ln(doc: jsPDF, y: number, x1: number = M.left, x2: number = PW - M.right) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
}

function field(doc: jsPDF, label: string, value: string, x: number, y: number, valueOffset: number = 0) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'bold');
  doc.text(value || '___________________________', x + (valueOffset || doc.getTextWidth(label) + 2), y);
  doc.setFont('helvetica', 'normal');
}

function sectionTitle(doc: jsPDF, text: string, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(text, M.left, y);
  doc.setFont('helvetica', 'normal');
  return y + 5;
}

function emptyLines(doc: jsPDF, y: number, count: number, lineSpacing = 6): number {
  for (let i = 0; i < count; i++) {
    y += lineSpacing;
    doc.setDrawColor(180);
    doc.setLineWidth(0.15);
    doc.line(M.left, y, PW - M.right, y);
  }
  doc.setDrawColor(0);
  return y + 3;
}

function checkboxLine(doc: jsPDF, label: string, checked: boolean | undefined, x: number, y: number, size = 3) {
  doc.rect(x, y - size + 0.5, size, size);
  if (checked) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('X', x + 0.5, y);
    doc.setFont('helvetica', 'normal');
  }
  doc.setFontSize(8);
  doc.text(label, x + size + 2, y);
}

// ═══════════════════════════════════════
// PAGE 1: COVER
// ═══════════════════════════════════════
function drawCover(doc: jsPDF, p: DosarMedicalParams) {
  const cfg = p.config || DEFAULT_MEDICAL_CONFIG;
  let y = M.top;

  doc.setFontSize(8);
  doc.text('Unitatea medicală:', M.left, y);
  doc.setFont('helvetica', 'bold');
  doc.text(cfg.medicalUnitName, M.left + 28, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  doc.text('Cabinet de medicina muncii', M.left, y);
  y += 5;
  doc.text(`Adresa: ${cfg.cabinetAddress}`, M.left, y);
  y += 5;
  doc.text(`Telefon/Fax: ${cfg.cabinetPhone}`, M.left, y);
  y += 15;

  // Big title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DOSAR MEDICAL', PW / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.text(`nr. ${p.dosarNumber || '________'}`, PW / 2, y, { align: 'center' });
  y += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const fieldLine = (label: string, value: string, yPos: number) => {
    doc.text(label, M.left + 20, yPos);
    doc.setFont('helvetica', 'bold');
    const valX = M.left + 75;
    doc.text(value || '___________________________________________', valX, yPos);
    doc.setFont('helvetica', 'normal');
    return yPos + 10;
  };

  y = fieldLine('Numele și Prenumele:', `${p.lastName.toUpperCase()} ${p.firstName.toUpperCase()}`, y);
  y = fieldLine('Societatea Comercială:', cfg.companyName, y);
  y = fieldLine('Legitimația / Marca:', '', y);
  y = fieldLine('C.N.P.:', p.cnp, y);

  const addressVal = p.address || '';
  y = fieldLine('Domiciliul:', addressVal, y);

  y += 20;
  doc.setFontSize(7);
  doc.text('Dosarul medical este un act confidențial. Nu va fi reținut de angajator.', PW / 2, y, { align: 'center' });
  y += 5;
  doc.text('Se va completa de către medicul de medicina muncii.', PW / 2, y, { align: 'center' });
}

// ═══════════════════════════════════════
// PAGE 2: LEGAL PAGE
// ═══════════════════════════════════════
function drawLegalPage(doc: jsPDF) {
  let y = M.top;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const lines = [
    'DOSARUL MEDICAL se completează în temeiul prevederilor:',
    '',
    '• Ordinul Ministrului Sănătății și Familiei nr. 933/2002 privind aprobarea Normelor',
    '  de supraveghere a sănătății lucrătorilor și reintegrarea în muncă a personalului',
    '  medical',
    '• H.G. nr. 355/2007 privind supravegherea sănătății lucrătorilor',
    '• H.G. nr. 1169/2011 pentru modificarea și completarea H.G. nr. 355/2007',
    '• Legea nr. 319/2006 - Legea securității și sănătății în muncă',
    '• H.G. nr. 1425/2006 Norme Metodologice de aplicare a Legii nr. 319/2006 Art. 32',
    '',
    'DOSARUL MEDICAL este un act confidențial de medicină a muncii și conține toate',
    'datele medicale ale angajatului pe întreaga sa perioadă de activitate.',
    '',
    'Dosarul medical se păstrează de către medicul de medicina muncii pe întreaga',
    'perioadă a activității angajatului și nu va fi reținut de angajator.',
    '',
    'La schimbarea locului de muncă, dosarul medical va fi transmis medicului de',
    'medicina muncii care asigură asistența medicală a noului angajator.',
    '',
    'La încetarea activității, dosarul medical se arhivează de către medicul de medicina',
    'muncii, conform legislației în vigoare.',
    '',
    'Orice informație medicală este confidențială. Accesul la dosarul medical se face',
    'numai cu acordul angajatului sau la cererea instanțelor judecătorești.',
  ];

  lines.forEach(line => {
    doc.text(line, M.left, y);
    y += 5;
  });
}

// ═══════════════════════════════════════
// PAGE 3: PERSONAL DATA + WORK HISTORY (Anexa nr.4)
// ═══════════════════════════════════════
function drawPersonalDataPage(doc: jsPDF, p: DosarMedicalParams) {
  const { sex, birthDate, age } = parseCNP(p.cnp);
  let y = M.top;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Anexa nr. 4', PW - M.right, y, { align: 'right' });
  y += 8;

  doc.setFontSize(10);
  doc.text('DOSARUL MEDICAL - Date personale', PW / 2, y, { align: 'center' });
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  // Personal data fields
  const halfW = CW / 2;
  field(doc, 'Numele:', p.lastName.toUpperCase(), M.left, y, 16);
  field(doc, 'Prenumele:', p.firstName.toUpperCase(), M.left + halfW, y, 20);
  y += 7;
  field(doc, 'Sex:', sex, M.left, y, 10);
  field(doc, 'Vârsta:', age, M.left + 30, y, 14);
  field(doc, 'Data nașterii:', birthDate, M.left + 65, y, 26);
  y += 7;
  field(doc, 'C.N.P.:', p.cnp, M.left, y, 14);
  y += 7;
  field(doc, 'Domiciliul:', p.address || '', M.left, y, 20);
  y += 7;
  field(doc, 'Ocupația / Funcția:', p.position || '', M.left, y, 35);
  y += 7;
  field(doc, 'Locul de muncă:', p.department || '', M.left, y, 30);
  y += 10;
  ln(doc, y);
  y += 5;

  // Professional training
  y = sectionTitle(doc, 'Formarea profesională:', y);
  doc.setFontSize(8);
  if (p.professionalTraining) {
    doc.text(p.professionalTraining, M.left, y);
    y += 6;
  } else {
    y = emptyLines(doc, y, 2);
  }

  // Professional route
  y = sectionTitle(doc, 'Ruta profesională:', y);
  if (p.professionalRoute) {
    doc.text(p.professionalRoute, M.left, y);
    y += 6;
  } else {
    y = emptyLines(doc, y, 2);
  }

  // Work history table
  y = sectionTitle(doc, 'Locuri de muncă anterioare:', y);
  
  const cols = [
    { label: 'Nr.', w: 10 },
    { label: 'Post / Loc de muncă', w: 50 },
    { label: 'Perioada', w: 30 },
    { label: 'Ocupația', w: 40 },
    { label: 'Noxe profesionale', w: 50 },
  ];
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  let cx = M.left;
  const tableY = y;
  cols.forEach(c => {
    doc.rect(cx, tableY - 4, c.w, 7);
    doc.text(c.label, cx + 1, tableY);
    cx += c.w;
  });
  doc.setFont('helvetica', 'normal');
  y = tableY + 3;

  const rows = p.workHistory && p.workHistory.length > 0 ? p.workHistory : Array(5).fill({ post: '', period: '', occupation: '', noxe: '' });
  rows.forEach((row, i) => {
    y += 5;
    cx = M.left;
    cols.forEach((c, ci) => {
      doc.rect(cx, y - 4, c.w, 6);
      const val = ci === 0 ? (i + 1).toString() : ci === 1 ? row.post : ci === 2 ? row.period : ci === 3 ? row.occupation : row.noxe;
      doc.text(val || '', cx + 1, y);
      cx += c.w;
    });
  });
  y += 8;

  // Current activities
  y = sectionTitle(doc, 'Activități la actualul loc de muncă / Noxe profesionale:', y);
  if (p.currentActivities) {
    doc.setFontSize(8);
    doc.text(p.currentActivities, M.left, y);
    y += 6;
  } else {
    y = emptyLines(doc, y, 2);
  }

  // Professional diseases
  y += 3;
  doc.setFontSize(8);
  doc.text('Boli profesionale:', M.left, y);
  checkboxLine(doc, 'DA', p.professionalDiseases === true, M.left + 35, y);
  checkboxLine(doc, 'NU', p.professionalDiseases === false, M.left + 55, y);
  y += 5;
  if (p.professionalDiseasesDetails) {
    doc.text(p.professionalDiseasesDetails, M.left + 10, y);
  }
  y = emptyLines(doc, y, 1);
}

// ═══════════════════════════════════════
// PAGE 4: ANTECEDENTS, HABITS, DECLARATION
// ═══════════════════════════════════════
function drawAntecedentsPage(doc: jsPDF, p: DosarMedicalParams) {
  let y = M.top;

  // Work accidents
  doc.setFontSize(8);
  doc.text('Accidente de muncă:', M.left, y);
  checkboxLine(doc, 'DA', p.workAccidents === true, M.left + 35, y);
  checkboxLine(doc, 'NU', p.workAccidents === false, M.left + 55, y);
  y += 5;
  if (p.workAccidentsDetails) {
    doc.text(p.workAccidentsDetails, M.left + 10, y);
  }
  y = emptyLines(doc, y, 1);
  y += 3;

  // Family doctor
  field(doc, 'Medic de familie:', p.familyDoctor || '', M.left, y, 32);
  y += 10;
  ln(doc, y);
  y += 5;

  // Declaration
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Declarație pe propria răspundere', PW / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text('Subsemnatul(a) declar pe propria răspundere că datele de mai sus sunt corecte.', M.left, y);
  y += 5;
  doc.text('Semnătura: ______________________          Data: ___/___/______', M.left, y);
  y += 12;
  ln(doc, y);
  y += 5;

  // Heredocolateral antecedents
  y = sectionTitle(doc, 'Antecedente heredocolaterale:', y);
  doc.setFontSize(8);
  if (p.heredoCollateral) {
    doc.text(p.heredoCollateral, M.left, y);
    y += 6;
  } else {
    y = emptyLines(doc, y, 3);
  }

  // Personal physiological antecedents
  y = sectionTitle(doc, 'Antecedente personale fiziologice:', y);
  if (p.personalPhysiological) {
    doc.setFontSize(8);
    doc.text(p.personalPhysiological, M.left, y);
    y += 6;
  } else {
    y = emptyLines(doc, y, 3);
  }

  // Personal pathological antecedents
  y = sectionTitle(doc, 'Antecedente personale patologice:', y);
  if (p.personalPathological) {
    doc.setFontSize(8);
    doc.text(p.personalPathological, M.left, y);
    y += 6;
  } else {
    y = emptyLines(doc, y, 3);
  }

  // Habits
  y += 3;
  doc.setFontSize(8);
  field(doc, 'Fumat:', p.smoking || '', M.left, y, 14);
  y += 7;
  field(doc, 'Consum alcool:', p.alcohol || '', M.left, y, 28);
}

// ═══════════════════════════════════════
// PAGE 5: CLINICAL EXAM AT HIRE
// ═══════════════════════════════════════
function drawClinicalExamPage(doc: jsPDF, title: string) {
  let y = M.top;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, PW / 2, y, { align: 'center' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  // Biometric data
  y = sectionTitle(doc, 'Date biometrice:', y);
  doc.setFontSize(8);
  doc.text('Talie: ______ cm          Greutate: ______ kg          IMC: ______          Obezitate: DA / NU', M.left, y);
  y += 8;
  ln(doc, y);
  y += 5;

  // Clinical exam - systems
  y = sectionTitle(doc, 'Examen clinic pe aparate și sisteme:', y);
  
  const systems = [
    '1. Tegumente și mucoase',
    '2. Țesut celular subcutanat',
    '3. Sistem ganglionar',
    '4. Aparat locomotor',
    '5. Aparat respirator',
    '6. Aparat cardiovascular (TA: ___/___ mmHg, AV: ___ /min)',
    '7. Aparat digestiv',
    '8. Aparat urogenital',
    '9. S.N.C. și analizatori (Vizus: OD ___ OS ___ ; Audiometrie: ___)',
    '10. Sistem endocrin',
  ];

  systems.forEach(sys => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(sys, M.left, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
    y = emptyLines(doc, y, 2, 5);
    y += 2;

    // Check if we need a new page
    if (y > 270) {
      doc.addPage();
      y = M.top;
    }
  });

  return y;
}

// ═══════════════════════════════════════
// PAGE 6: CONCLUSIONS + VERDICT
// ═══════════════════════════════════════
function drawConclusionsPage(doc: jsPDF, y: number, examType: string) {
  if (y > 200) {
    doc.addPage();
    y = M.top;
  }

  // Optional exams
  y = sectionTitle(doc, 'Examene clinice și paraclinice suplimentare:', y);
  doc.setFontSize(7);
  doc.text('VDRL/RPA: _______________     Glicemie: _______________     Hemoleucogramă: _______________', M.left, y);
  y += 5;
  doc.text('Examen radiologic: _______________     EKG: _______________     Altele: _______________', M.left, y);
  y += 5;
  y = emptyLines(doc, y, 2);

  // Conclusions
  y += 3;
  y = sectionTitle(doc, 'Concluzii în urma examinării:', y);
  doc.setFontSize(8);
  checkboxLine(doc, 'Sănătos clinic', undefined, M.left, y);
  checkboxLine(doc, 'Diagnostic:', undefined, M.left + 50, y);
  y += 5;
  y = emptyLines(doc, y, 2);

  // Medical verdict
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AVIZ MEDICAL:', M.left, y);
  y += 5;
  doc.setFontSize(8);

  const verdicts = ['APT', 'APT CONDIȚIONAT', 'INAPT TEMPORAR', 'INAPT'];
  doc.setFont('helvetica', 'normal');
  doc.text('Recomandări:', M.left + CW / 2 + 5, y - 3);

  verdicts.forEach((v, i) => {
    y += 6;
    checkboxLine(doc, v, undefined, M.left + 5, y);
    doc.setDrawColor(180);
    doc.setLineWidth(0.15);
    doc.line(M.left + CW / 2 + 5, y, PW - M.right, y);
    doc.setDrawColor(0);
  });
  y += 10;

  // Footer
  doc.setFontSize(8);
  doc.text('Data: ___/___/______', M.left, y);
  doc.text('Medic de medicina muncii: ______________________', M.left + CW / 2 - 10, y);
  y += 6;
  doc.text('(semnătura și parafa)', M.left + CW / 2 - 10, y);
  y += 8;
  doc.text('Data următorului examen medical: ___/___/______', M.left, y);

  return y;
}

// ═══════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════
export function generateDosarMedical(params: DosarMedicalParams) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');

  // Page 1: Cover
  drawCover(doc, params);

  // Page 2: Legal
  doc.addPage();
  drawLegalPage(doc);

  // Page 3: Personal data + work history
  doc.addPage();
  drawPersonalDataPage(doc, params);

  // Page 4: Antecedents
  doc.addPage();
  drawAntecedentsPage(doc, params);

  // Page 5-6: Clinical exam at hire
  doc.addPage();
  const y = drawClinicalExamPage(doc, 'EXAMEN MEDICAL LA ANGAJARE');
  drawConclusionsPage(doc, y, 'angajare');

  // Page 7-8: Periodic clinical exam
  doc.addPage();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  let py = M.top;
  doc.text('Simptome actuale:', M.left, py);
  py = emptyLines(doc, py + 2, 2);
  doc.text('Reactualizare anamneză (boli, internări, tratamente de la ultima examinare):', M.left, py);
  py = emptyLines(doc, py + 2, 2);
  doc.text('Simptome la locul de muncă:', M.left, py);
  py = emptyLines(doc, py + 2, 2);
  py += 3;

  const py2 = drawClinicalExamPage(doc, 'EXAMEN MEDICAL PERIODIC');
  drawConclusionsPage(doc, py2, 'periodic');

  const fileName = `Dosar_Medical_${params.lastName}_${params.firstName}.pdf`;
  doc.save(fileName);
}
