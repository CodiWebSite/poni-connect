import jsPDF from 'jspdf';

export interface MedicalCabinetConfig {
  medicalUnitName: string;
  cabinetAddress: string;
  cabinetPhone: string;
  doctorName: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
}

export const DEFAULT_MEDICAL_CONFIG: MedicalCabinetConfig = {
  medicalUnitName: 'S.C. ______________________ S.R.L.',
  cabinetAddress: '______________________________',
  cabinetPhone: '__________________________',
  doctorName: '',
  companyName: 'INSTITUTUL DE CHIMIE MACROMOLECULARĂ "PETRU PONI"',
  companyAddress: 'Aleea Grigore Ghica Vodă, nr. 41A, 700487 IAȘI',
  companyPhone: 'Tel: 0232-217454, Fax: 0232-211299',
};

export interface FisaAptitudineParams {
  lastName: string;
  firstName: string;
  cnp: string;
  position: string;
  department: string;
  consultationType: 'angajare' | 'periodic' | 'reluare' | 'urgenta' | 'altele';
  medicalFitness: 'apt' | 'apt_conditionat' | 'inapt_temporar' | 'inapt';
  recommendations?: string;
  consultationDate: string;
  nextExamDate?: string;
  doctorName?: string;
  fisaNumber?: string;
  config?: MedicalCabinetConfig;
}

const COPY_HEIGHT = 93; // mm per copy
const PAGE_W = 210;
const MARGIN_LEFT = 8;
const MARGIN_RIGHT = 8;
const CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;

function drawCheckbox(doc: jsPDF, x: number, y: number, checked: boolean, size = 3) {
  doc.rect(x, y, size, size);
  if (checked) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('X', x + 0.4, y + size - 0.3);
    doc.setFont('helvetica', 'normal');
  }
}

function drawSingleCopy(doc: jsPDF, params: FisaAptitudineParams, offsetY: number) {
  const cfg = params.config || DEFAULT_MEDICAL_CONFIG;
  const left = MARGIN_LEFT;
  let y = offsetY + 3;

  const fontSize = (s: number) => doc.setFontSize(s);
  const bold = () => doc.setFont('helvetica', 'bold');
  const normal = () => doc.setFont('helvetica', 'normal');

  // ─── HEADER ───
  fontSize(7);
  normal();
  doc.text('Unitatea medicală:', left, y);
  bold();
  doc.text(cfg.medicalUnitName, left + 24, y);
  normal();
  y += 3;
  doc.text('Cabinet de medicina muncii', left, y);
  y += 3;
  doc.text(`Adresa: ${cfg.cabinetAddress}`, left, y);
  doc.text(`Telefon/Fax: ${cfg.cabinetPhone}`, left + CONTENT_W / 2, y);
  y += 4;

  // ─── CHECKBOXES FOR TYPE ───
  fontSize(6.5);
  const types: { label: string; key: string }[] = [
    { label: 'Angajare', key: 'angajare' },
    { label: 'Control periodic', key: 'periodic' },
    { label: 'Adaptare', key: 'adaptare' },
    { label: 'Reluare a muncii', key: 'reluare' },
    { label: 'Supraveghere specială', key: 'supraveghere' },
    { label: 'Altele', key: 'altele' },
  ];

  let cx = left;
  types.forEach(t => {
    const checked = t.key === params.consultationType || 
      (t.key === 'supraveghere' && params.consultationType === 'urgenta');
    drawCheckbox(doc, cx, y - 2.2, checked, 2.5);
    normal();
    doc.text(t.label, cx + 3.2, y);
    cx += doc.getTextWidth(t.label) + 7;
  });
  y += 4;

  // ─── TITLE ───
  fontSize(8);
  bold();
  doc.text('Medicina muncii - FIȘĂ DE APTITUDINE', PAGE_W / 2, y, { align: 'center' });
  y += 3;
  fontSize(7);
  normal();
  const nrText = params.fisaNumber ? `nr. ${params.fisaNumber}` : 'nr. ____/____';
  doc.text(nrText, PAGE_W / 2, y, { align: 'center' });
  y += 2.5;
  fontSize(5.5);
  doc.text('(Un exemplar la angajator, un exemplar la salariat, un exemplar rămâne la medicul de medicina muncii)', PAGE_W / 2, y, { align: 'center' });
  y += 3.5;

  // ─── COMPANY ───
  fontSize(6.5);
  normal();
  doc.text('Societatea:', left, y);
  bold();
  doc.text(cfg.companyName, left + 16, y);
  normal();
  y += 3;
  doc.text(`Adresa: ${cfg.companyAddress}`, left, y);
  doc.text(cfg.companyPhone, left + CONTENT_W / 2 + 10, y);
  y += 4;

  // ─── EMPLOYEE DATA BOX ───
  const boxY = y;
  const boxH = 14;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(left, boxY, CONTENT_W, boxH);

  y = boxY + 3;
  fontSize(7);
  normal();
  doc.text('Nume:', left + 2, y);
  bold();
  doc.text(params.lastName.toUpperCase(), left + 14, y);
  normal();
  doc.text('Prenume:', left + CONTENT_W / 2, y);
  bold();
  doc.text(params.firstName.toUpperCase(), left + CONTENT_W / 2 + 16, y);
  y += 3.5;

  normal();
  doc.text('CNP:', left + 2, y);
  bold();
  doc.text(params.cnp || '_____________', left + 10, y);
  normal();
  doc.text('Ocupație/funcție:', left + CONTENT_W / 2, y);
  bold();
  doc.text(params.position || '_______________', left + CONTENT_W / 2 + 25, y);
  y += 3.5;

  normal();
  doc.text('Post și locul de muncă:', left + 2, y);
  bold();
  doc.text(params.department || '_______________', left + 35, y);

  y = boxY + boxH + 3;

  // ─── MEDICAL VERDICT ───
  fontSize(7);
  bold();
  doc.text('AVIZ MEDICAL:', left, y);
  normal();
  doc.text('Recomandări:', left + CONTENT_W / 2 + 5, y);
  y += 4;

  const verdicts: { label: string; key: string }[] = [
    { label: 'APT', key: 'apt' },
    { label: 'APT CONDIȚIONAT', key: 'apt_conditionat' },
    { label: 'INAPT TEMPORAR', key: 'inapt_temporar' },
    { label: 'INAPT', key: 'inapt' },
  ];

  const recLines = (params.recommendations || '').split('\n');

  verdicts.forEach((v, i) => {
    const checked = v.key === params.medicalFitness;
    drawCheckbox(doc, left + 2, y - 2.2, checked, 2.5);
    fontSize(6.5);
    if (checked) bold(); else normal();
    doc.text(v.label, left + 6, y);
    
    // Recommendation line on the right
    normal();
    fontSize(6.5);
    const recLine = recLines[i] || (i === 0 ? '___________________________' : '___________________________');
    doc.text(recLine, left + CONTENT_W / 2 + 5, y);
    y += 3.5;
  });

  y += 1;

  // ─── FOOTER ───
  fontSize(6.5);
  normal();
  doc.text(`Data: ${params.consultationDate}`, left, y);
  doc.text('Medic de medicina muncii:', left + CONTENT_W / 2 - 10, y);
  y += 3;
  doc.text('', left, y);
  bold();
  doc.text(params.doctorName || cfg.doctorName || '________________________', left + CONTENT_W / 2 - 10, y);
  normal();
  y += 3;
  doc.text('(semnătura și parafa)', left + CONTENT_W / 2 - 10, y);
  y += 3.5;
  doc.text(`Data următorului examen medical: ${params.nextExamDate || '___/___/______'}`, left, y);
}

export function generateFisaAptitudine(params: FisaAptitudineParams) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');

  // Draw 3 copies
  for (let i = 0; i < 3; i++) {
    const offsetY = i * COPY_HEIGHT + 4;
    drawSingleCopy(doc, params, offsetY);

    // Dotted separator line between copies
    if (i < 2) {
      const lineY = (i + 1) * COPY_HEIGHT + 4;
      doc.setDrawColor(100);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(MARGIN_LEFT, lineY, PAGE_W - MARGIN_RIGHT, lineY);
      doc.setLineDashPattern([], 0);
      doc.setDrawColor(0);
    }
  }

  const fileName = `Fisa_Aptitudine_${params.lastName}_${params.firstName}.pdf`;
  doc.save(fileName);
}
