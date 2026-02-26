import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  Packer,
  UnderlineType,
  convertMillimetersToTwip,
  ImageRun,
  TabStopType,
  TabStopPosition,
  BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';

interface LeaveDocxParams {
  employeeName: string;
  employeePosition: string;
  department: string;
  workingDays: number;
  year: number;
  startDate: string; // yyyy-MM-dd
  endDate?: string; // yyyy-MM-dd
  replacementName: string;
  replacementPosition: string;
  requestDate: string; // dd.MM.yyyy
  requestNumber: string;
  isApproved: boolean;
  employeeSignature?: string | null;
  totalLeaveDays?: number;
  usedLeaveDays?: number;
  carryoverDays?: number;
  carryoverFromYear?: number;
  srusOfficerName?: string;
  approvalDate?: string; // dd.MM.yyyy - date when dept head approved
}

async function fetchImageAsUint8Array(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

function base64ToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

const FONT = 'Times New Roman';
const SIZE = 24; // 12pt
const SIZE_SMALL = 18; // 9pt
const SIZE_HEADER = 20; // 10pt
const RIGHT_TAB = TabStopPosition.MAX;

function underlinedField(value: string | undefined | null, fallback: string): TextRun[] {
  if (value) {
    return [new TextRun({ text: value, bold: true, size: SIZE, font: FONT, underline: { type: UnderlineType.SINGLE } })];
  }
  return [new TextRun({ text: fallback, size: SIZE, font: FONT })];
}

export async function generateLeaveDocx(params: LeaveDocxParams) {
  const {
    employeeName, employeePosition, department, workingDays, year,
    startDate, endDate, replacementName, replacementPosition,
    requestDate, requestNumber, isApproved, employeeSignature,
    totalLeaveDays, usedLeaveDays, carryoverDays, carryoverFromYear, srusOfficerName,
    approvalDate,
  } = params;

  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = endDate ? formatDate(endDate) : '';

  // Fetch logo
  let logoData: Uint8Array;
  try { logoData = await fetchImageAsUint8Array('/logo_doc.jpg'); } catch { logoData = new Uint8Array(0); }

  // Parse signature
  let signatureData: Uint8Array | null = null;
  if (employeeSignature) {
    try {
      signatureData = employeeSignature.startsWith('data:')
        ? base64ToUint8Array(employeeSignature)
        : await fetchImageAsUint8Array(employeeSignature);
    } catch { signatureData = null; }
  }

  const totalDays = totalLeaveDays ?? 0;
  const carryover = carryoverDays ?? 0;
  const totalAvailable = totalDays + carryover;

  const periodText = formattedEndDate
    ? `${formattedStartDate} - ${formattedEndDate}`
    : formattedStartDate;

  const t = (text: string, opts: Partial<{ bold: boolean; italics: boolean; size: number; underline: any }> = {}) =>
    new TextRun({ text, font: FONT, size: opts.size ?? SIZE, bold: opts.bold, italics: opts.italics, underline: opts.underline });

  const tab = () => new TextRun({ text: '\t', font: FONT });
  const empty = (after = 0) => new Paragraph({ spacing: { after }, children: [] });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertMillimetersToTwip(20),
            right: convertMillimetersToTwip(20),
            bottom: convertMillimetersToTwip(20),
            left: convertMillimetersToTwip(25),
          },
        },
      },
      children: [
        // ══════ HEADER: Logo + Institution ══════
        new Paragraph({
          spacing: { after: 0 },
          children: [
            ...(logoData.length > 0 ? [
              new ImageRun({ data: logoData, transformation: { width: 55, height: 55 }, type: 'jpg' }),
              t('   '),
            ] : []),
            t('ACADEMIA ROMÂNĂ', { bold: true, size: 22 }),
          ],
        }),
        new Paragraph({
          spacing: { after: 0 },
          indent: { left: convertMillimetersToTwip(18) },
          children: [t('INSTITUTUL DE CHIMIE MACROMOLECULARĂ "PETRU PONI"', { bold: true, size: SIZE_HEADER })],
        }),
        new Paragraph({
          spacing: { after: 200 },
          indent: { left: convertMillimetersToTwip(18) },
          children: [t('Aleea Grigore Ghica Vodă, nr. 41A, 700487 IAȘI, ROMANIA', { size: SIZE_SMALL })],
        }),

        // ══════ ANEXA left ══════
        new Paragraph({
          spacing: { after: 200 },
          children: [t('Anexa 11.2.-P.O. ICMPP-SRUS', { bold: true, size: SIZE_HEADER })],
        }),

        // ══════ "Se aprobă," right-aligned ══════
        new Paragraph({
          spacing: { after: 200 },
          alignment: AlignmentType.RIGHT,
          children: [t('Se aprobă,')],
        }),

        // ══════ "Aprobat," left + "DIRECTOR" right ══════
        new Paragraph({
          spacing: { after: 0 },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
          children: [
            t('Aprobat,'),
            tab(),
            t('DIRECTOR', { bold: true }),
          ],
        }),
        new Paragraph({
          spacing: { after: 0 },
          children: [t('Șef compartiment', { bold: true })],
        }),

        // Approval date (if approved)
        ...(approvalDate ? [
          new Paragraph({
            spacing: { after: 0 },
            children: [t(`Data: ${approvalDate}`, { size: SIZE_SMALL })],
          }),
        ] : []),

        // Signature line for department head
        new Paragraph({
          spacing: { after: 300 },
          children: [t('________________')],
        }),

        // ══════ TITLE ══════
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
          children: [t('Cerere concediu odihnă', { bold: true })],
        }),

        // ══════ SALUTATION ══════
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [t('Doamnă/Domnule Director,', { italics: true })],
        }),

        // ══════ BODY: Subsemnatul/a, _name_, _position_ în cadrul _department_ ══════
        new Paragraph({
          spacing: { after: 0, line: 360 },
          children: [
            t('\tSubsemnatul/a, '),
            ...underlinedField(employeeName, '_____________________________'),
            t(', '),
            ...underlinedField(employeePosition, '________________________'),
            t(' în'),
          ],
        }),
        new Paragraph({
          spacing: { after: 100, line: 360 },
          children: [
            t('cadrul '),
            ...underlinedField(department, '_______________________________________________________________________'),
            t(','),
          ],
        }),

        // vă rog ... zile de concediu de odihnă aferente
        new Paragraph({
          spacing: { after: 0, line: 360 },
          children: [
            t('vă rog să-mi aprobați efectuarea unui număr de '),
            t(`${workingDays}`, { bold: true, underline: { type: UnderlineType.SINGLE } }),
            t(' zile de  concediu de odihnă aferente'),
          ],
        }),

        // anului __year__, începând cu data de __period__.
        new Paragraph({
          spacing: { after: 200, line: 360 },
          children: [
            t('anului '),
            t(`${year}`, { bold: true, underline: { type: UnderlineType.SINGLE } }),
            t(', începând cu data de '),
            t(periodText, { bold: true, underline: { type: UnderlineType.SINGLE } }),
            t('.'),
          ],
        }),

        // ══════ REPLACEMENT ══════
        // În această perioadă voi fi înlocuit/ă de dl./d-na __name__, __position__.
        new Paragraph({
          spacing: { after: 0, line: 360 },
          children: [
            t('\tÎn această perioadă voi fi înlocuit/ă de dl./d-na '),
            ...underlinedField(replacementName, '_____________________________'),
            t(','),
          ],
        }),
        new Paragraph({
          spacing: { after: 200, line: 360 },
          children: [
            ...underlinedField(replacementPosition, '_____________________________'),
            t('.'),
          ],
        }),

        // ══════ CLOSING ══════
        // Cu mulțumiri,                    __name__
        new Paragraph({
          spacing: { before: 100, after: 100 },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
          children: [
            t('Cu mulțumiri,'),
            tab(),
            ...underlinedField(employeeName, '____________________________'),
          ],
        }),

        // Data          Semnătura
        new Paragraph({
          spacing: { after: 0 },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
          children: [
            ...(signatureData ? [
              t(requestDate),
              tab(),
              new ImageRun({ data: signatureData, transformation: { width: 120, height: 45 }, type: 'png' }),
            ] : [
              t(requestDate || '___________________'),
              tab(),
              t('___________________'),
            ]),
          ],
        }),

        // ══════ SRUS SECTION (right-indented block) ══════
        empty(400),

        new Paragraph({
          spacing: { after: 50 },
          indent: { left: convertMillimetersToTwip(80) },
          children: [t('Propunem să aprobați,', { size: 22 })],
        }),
        new Paragraph({
          spacing: { after: 50 },
          indent: { left: convertMillimetersToTwip(80) },
          children: [
            t('La această dată dl./d-na ', { size: 22 }),
            t(employeeName || '_________________________', { bold: !!employeeName, size: 22 }),
          ],
        }),
        new Paragraph({
          spacing: { after: 50 },
          indent: { left: convertMillimetersToTwip(80) },
          children: [
            t('are dreptul la ', { size: 22 }),
            t(totalAvailable > 0 ? `${totalAvailable}` : '_____', { bold: totalAvailable > 0, size: 22 }),
            t(' zile concediu de odihnă, din care', { size: 22 }),
          ],
        }),
        new Paragraph({
          spacing: { after: 50 },
          indent: { left: convertMillimetersToTwip(80) },
          children: [
            t(totalDays > 0 ? `${totalDays}` : '_______', { bold: totalDays > 0, size: 22 }),
            t(` aferente anului `, { size: 22 }),
            t(`${year}`, { bold: true, size: 22 }),
            t(' și ', { size: 22 }),
            t(carryover > 0 ? `${carryover}` : '______', { bold: carryover > 0, size: 22 }),
            t(' aferente anului', { size: 22 }),
          ],
        }),
        new Paragraph({
          spacing: { after: 100 },
          indent: { left: convertMillimetersToTwip(80) },
          children: [
            t(carryoverFromYear ? `${carryoverFromYear}` : '_______', { bold: !!carryoverFromYear, size: 22 }),
            t('.', { size: 22 }),
          ],
        }),
        empty(50),
        new Paragraph({
          spacing: { after: 0 },
          indent: { left: convertMillimetersToTwip(80) },
          children: [t(srusOfficerName || '___________________', { bold: !!srusOfficerName, size: 22 })],
        }),
        new Paragraph({
          spacing: { before: 50 },
          indent: { left: convertMillimetersToTwip(80) },
          children: [t('___________________', { size: 22 })],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Cerere_Concediu_${requestNumber}.docx`);
}
