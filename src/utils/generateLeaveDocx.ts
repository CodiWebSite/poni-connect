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
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
} from 'docx';
import { saveAs } from 'file-saver';
import stampImage from '@/assets/stamp-icmpp.png';

interface LeaveDocxParams {
  employeeName: string;
  employeePosition: string;
  employeeGrade?: string;
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
  srusSignature?: string | null;
  approvalDate?: string; // dd.MM.yyyy
  deptHeadSignature?: string | null;
  deptHeadName?: string;
  directorName?: string;
  directorApprovalDate?: string;
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
const SIZE = 22; // 11pt
const SIZE_SMALL = 18; // 9pt
const SIZE_HEADER = 18; // 9pt
const RIGHT_TAB = TabStopPosition.MAX;
const NOBORDER = { style: 'none' as any, size: 0, color: 'FFFFFF' };
const CELL_BORDERS = { top: NOBORDER, bottom: NOBORDER, left: NOBORDER, right: NOBORDER };

function underlinedField(value: string | undefined | null, fallback: string): TextRun[] {
  if (value) {
    return [new TextRun({ text: value, bold: true, size: SIZE, font: FONT, underline: { type: UnderlineType.SINGLE } })];
  }
  return [new TextRun({ text: fallback, size: SIZE, font: FONT })];
}

function parseSignatureData(signature: string | null | undefined): Promise<Uint8Array | null> {
  if (!signature) return Promise.resolve(null);
  try {
    if (signature.startsWith('data:')) {
      return Promise.resolve(base64ToUint8Array(signature));
    }
    return fetchImageAsUint8Array(signature);
  } catch {
    return Promise.resolve(null);
  }
}

const t = (text: string, opts: Partial<{ bold: boolean; italics: boolean; size: number; underline: any }> = {}) =>
  new TextRun({ text, font: FONT, size: opts.size ?? SIZE, bold: opts.bold, italics: opts.italics, underline: opts.underline });

const tab = () => new TextRun({ text: '\t', font: FONT });
const empty = (after = 0) => new Paragraph({ spacing: { after }, children: [] });

export async function generateLeaveDocx(params: LeaveDocxParams) {
  const {
    employeeName, employeePosition, employeeGrade, department, workingDays, year,
    startDate, endDate, replacementName, replacementPosition,
    requestDate, requestNumber, isApproved, employeeSignature,
    totalLeaveDays, usedLeaveDays, carryoverDays, carryoverFromYear, srusOfficerName, srusSignature,
    approvalDate, deptHeadSignature, deptHeadName,
    directorName, directorApprovalDate,
  } = params;

  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = endDate ? formatDate(endDate) : '';

  // Fetch logo, stamp, and signatures in parallel
  let logoData: Uint8Array;
  try { logoData = await fetchImageAsUint8Array('/logo_doc.jpg'); } catch { logoData = new Uint8Array(0); }

  let stampData: Uint8Array;
  try { stampData = await fetchImageAsUint8Array(stampImage); } catch { stampData = new Uint8Array(0); }

  const [signatureData, deptHeadSigData, srusSigData] = await Promise.all([
    parseSignatureData(employeeSignature),
    parseSignatureData(deptHeadSignature),
    parseSignatureData(srusSignature),
  ]);

  const totalDays = totalLeaveDays ?? 0;
  const carryover = carryoverDays ?? 0;
  const totalAvailable = totalDays + carryover;

  const periodText = formattedEndDate
    ? `${formattedStartDate} - ${formattedEndDate}`
    : formattedStartDate;

  // ════════════════════════════════════════════════════
  // Build approval section as invisible table (2 columns)
  // Left: Aprobat, / Șef compartiment / stamp+sig / date
  // Right: DIRECTOR / name / stamp / date
  // ════════════════════════════════════════════════════

  const leftApprovalChildren: Paragraph[] = [
    new Paragraph({ spacing: { after: 0 }, children: [t('Aprobat,', { size: SIZE_SMALL })] }),
    new Paragraph({ spacing: { after: 40 }, children: [t('Șef compartiment', { bold: true, size: SIZE_SMALL })] }),
  ];

  // Dept head name
  if (deptHeadName) {
    leftApprovalChildren.push(
      new Paragraph({ spacing: { after: 0 }, children: [t(deptHeadName, { bold: true, size: SIZE_SMALL })] })
    );
  }

  // Stamp + signature for dept head
  const leftSigElements: (TextRun | ImageRun)[] = [];
  if (stampData.length > 0) {
    leftSigElements.push(new ImageRun({ data: stampData, transformation: { width: 90, height: 90 }, type: 'png' }));
  }
  if (deptHeadSigData) {
    leftSigElements.push(new ImageRun({ data: deptHeadSigData, transformation: { width: 90, height: 35 }, type: 'png' }));
  }
  if (leftSigElements.length > 0) {
    leftApprovalChildren.push(new Paragraph({ spacing: { after: 0 }, children: leftSigElements }));
  } else {
    leftApprovalChildren.push(new Paragraph({ spacing: { after: 0 }, children: [t('________________')] }));
  }

  if (approvalDate) {
    leftApprovalChildren.push(
      new Paragraph({ spacing: { after: 0 }, children: [t(`Data: ${approvalDate}`, { size: SIZE_SMALL })] })
    );
  }

  // Right column: DIRECTOR
  const rightApprovalChildren: Paragraph[] = [
    new Paragraph({ spacing: { after: 40 }, alignment: AlignmentType.RIGHT, children: [t('DIRECTOR', { bold: true, size: SIZE_SMALL })] }),
  ];

  if (directorName) {
    rightApprovalChildren.push(
      new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.RIGHT, children: [t(directorName, { bold: true, size: SIZE_SMALL })] })
    );
  }

  // Director stamp
  if (stampData.length > 0) {
    rightApprovalChildren.push(
      new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.RIGHT, children: [
        new ImageRun({ data: stampData, transformation: { width: 90, height: 90 }, type: 'png' }),
      ]})
    );
  } else {
    rightApprovalChildren.push(
      new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.RIGHT, children: [t('________________')] })
    );
  }

  if (directorApprovalDate) {
    rightApprovalChildren.push(
      new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.RIGHT, children: [t(`Data: ${directorApprovalDate}`, { size: SIZE_SMALL })] })
    );
  }

  const approvalTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            verticalAlign: VerticalAlign.TOP,
            children: leftApprovalChildren,
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            verticalAlign: VerticalAlign.TOP,
            children: rightApprovalChildren,
          }),
        ],
      }),
    ],
  });

  // ════════════════════════════════════════════════════
  // SRUS section (bottom right, indented)
  // ════════════════════════════════════════════════════
  const srusIndent = convertMillimetersToTwip(75);
  const S = 20; // size for SRUS text

  const srusSection: Paragraph[] = [
    new Paragraph({
      spacing: { after: 50 },
      indent: { left: srusIndent },
      children: [t('Propunem să aprobați,', { size: S })],
    }),
    new Paragraph({
      spacing: { after: 50 },
      indent: { left: srusIndent },
      children: [
        t('La această dată dl./d-na ', { size: S }),
        t(employeeName || '_________________________', { bold: !!employeeName, size: S }),
      ],
    }),
    new Paragraph({
      spacing: { after: 50 },
      indent: { left: srusIndent },
      children: [
        t('are dreptul la ', { size: S }),
        t(`${totalAvailable}`, { bold: true, size: S }),
        t(' zile concediu de odihnă, din care', { size: S }),
      ],
    }),
    new Paragraph({
      spacing: { after: 50 },
      indent: { left: srusIndent },
      children: [
        t(`${totalDays}`, { bold: true, size: S }),
        t(' aferente anului ', { size: S }),
        t(`${year}`, { bold: true, size: S }),
        t(' și ', { size: S }),
        t(`${carryover}`, { bold: true, size: S }),
        t(' aferente anului', { size: S }),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      indent: { left: srusIndent },
      children: [
        t(carryoverFromYear ? `${carryoverFromYear}` : '_______', { bold: !!carryoverFromYear, size: S }),
        t('.', { size: S }),
      ],
    }),
  ];

  // SRUS signature area: name left, line right (using table)
  const srusSignatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            children: [empty(0)],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            children: [
              new Paragraph({ spacing: { after: 0 }, children: [t(srusOfficerName || '___________________', { bold: !!srusOfficerName, size: S })] }),
              new Paragraph({ spacing: { after: 0 }, children: [t('(numele salariatului de la SRUS)', { size: 16, italics: true })] }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            children: [
              new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.RIGHT, children: [t('___________________', { size: S })] }),
              empty(0),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ width: { size: 55, type: WidthType.PERCENTAGE }, borders: CELL_BORDERS, children: [empty(0)] }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            children: [
              ...(srusSigData ? [
                new Paragraph({ spacing: { after: 0 }, children: [new ImageRun({ data: srusSigData, transformation: { width: 100, height: 40 }, type: 'png' })] }),
              ] : [
                new Paragraph({ spacing: { after: 0 }, children: [t('___________________', { size: S })] }),
              ]),
              new Paragraph({ spacing: { after: 0 }, children: [t('(semnătura)', { size: 14, italics: true })] }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            children: [
              new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.RIGHT, children: [t('___________________', { size: S })] }),
              empty(0),
            ],
          }),
        ],
      }),
    ],
  });

  // ════════════════════════════════════════════════════
  // Build document
  // ════════════════════════════════════════════════════
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertMillimetersToTwip(12),
            right: convertMillimetersToTwip(15),
            bottom: convertMillimetersToTwip(10),
            left: convertMillimetersToTwip(20),
          },
        },
      },
      children: [
        // ══════ HEADER ══════
        ...(logoData.length > 0 ? [
          new Paragraph({
            spacing: { after: 0 },
            children: [
              new ImageRun({ data: logoData, transformation: { width: 50, height: 50 }, type: 'jpg' }),
            ],
          }),
        ] : []),
        new Paragraph({
          spacing: { after: 0 },
          alignment: AlignmentType.CENTER,
          children: [t('ACADEMIA ROMÂNĂ', { bold: true, size: 22 })],
        }),
        new Paragraph({
          spacing: { after: 0 },
          alignment: AlignmentType.CENTER,
          children: [t('INSTITUTUL DE CHIMIE MACROMOLECULARĂ "PETRU PONI"', { bold: true, size: SIZE_HEADER })],
        }),
        new Paragraph({
          spacing: { after: 80 },
          alignment: AlignmentType.CENTER,
          children: [t('Aleea Grigore Ghica Vodă, nr. 41A, 700487 IAȘI, ROMANIA', { size: 16 })],
        }),

        // ══════ ANEXA ══════
        new Paragraph({
          spacing: { after: 80 },
          children: [t('Anexa 11.2.-P.O. ICMPP-SRUS', { bold: true, size: SIZE_HEADER })],
        }),

        // ══════ "Se aprobă," right ══════
        new Paragraph({
          spacing: { after: 80 },
          alignment: AlignmentType.RIGHT,
          children: [t('Se aprobă,')],
        }),

        // ══════ APPROVAL TABLE (Șef compartiment LEFT, DIRECTOR RIGHT) ══════
        approvalTable,

        empty(80),

        // ══════ TITLE ══════
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 40 },
          children: [t('Cerere concediu odihnă', { bold: true })],
        }),

        // ══════ SALUTATION ══════
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [t('Doamnă/Domnule Director,', { italics: true })],
        }),

        // ══════ BODY ══════
        new Paragraph({
          spacing: { after: 0, line: 300 },
          children: [
            t('\tSubsemnatul/a, '),
            ...underlinedField(employeeName, '_____________________________'),
            t(', '),
            ...underlinedField(employeePosition, '________________________'),
            ...(employeeGrade ? [t(', gradul/treapta '), ...underlinedField(employeeGrade, '')] : []),
            t(', în'),
          ],
        }),
        new Paragraph({
          spacing: { after: 0, line: 240 },
          alignment: AlignmentType.CENTER,
          children: [
            t('(numele și prenumele)', { size: 14, italics: true }),
            t('                              ', { size: 14 }),
            t('(funcția)', { size: 14, italics: true }),
          ],
        }),
        new Paragraph({
          spacing: { after: 0, line: 300 },
          children: [
            t('cadrul '),
            ...underlinedField(department, '_______________________________________________________________________'),
            t(','),
          ],
        }),
        new Paragraph({
          spacing: { after: 40, line: 240 },
          alignment: AlignmentType.CENTER,
          children: [t('(compartimentul)', { size: 14, italics: true })],
        }),

        new Paragraph({
          spacing: { after: 0, line: 300 },
          children: [
            t('vă rog să-mi aprobați efectuarea unui număr de '),
            t(`${workingDays}`, { bold: true, underline: { type: UnderlineType.SINGLE } }),
            t(' zile de  concediu de odihnă aferente'),
          ],
        }),

        new Paragraph({
          spacing: { after: 80, line: 300 },
          children: [
            t('anului '),
            t(`${year}`, { bold: true, underline: { type: UnderlineType.SINGLE } }),
            t(', începând cu data de '),
            t(periodText, { bold: true, underline: { type: UnderlineType.SINGLE } }),
            t('.'),
          ],
        }),

        // ══════ REPLACEMENT ══════
        new Paragraph({
          spacing: { after: 0, line: 300 },
          children: [
            t('\tÎn această perioadă voi fi înlocuit/ă de dl./d-na '),
            ...underlinedField(replacementName, '_____________________________'),
            t(','),
          ],
        }),
        new Paragraph({
          spacing: { after: 0, line: 240 },
          alignment: AlignmentType.CENTER,
          children: [t('(numele și prenumele)', { size: 14, italics: true })],
        }),
        new Paragraph({
          spacing: { after: 0, line: 300 },
          children: [
            ...underlinedField(replacementPosition, '_____________________________'),
            t('.'),
          ],
        }),
        new Paragraph({
          spacing: { after: 80, line: 240 },
          children: [t('(funcția)', { size: 14, italics: true })],
        }),

        // ══════ CLOSING ══════
        new Paragraph({
          spacing: { before: 40, after: 0 },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
          children: [
            t('\tCu mulțumiri,'),
            tab(),
            ...underlinedField(employeeName, '____________________________'),
          ],
        }),
        new Paragraph({
          spacing: { after: 40 },
          alignment: AlignmentType.RIGHT,
          children: [t('(numele și prenumele)', { size: 14, italics: true })],
        }),

        // Data          Semnătura
        new Paragraph({
          spacing: { after: 0 },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
          children: [
            ...(signatureData ? [
              t(`\t${requestDate}`),
              tab(),
              new ImageRun({ data: signatureData, transformation: { width: 120, height: 45 }, type: 'png' }),
            ] : [
              t(`\t${requestDate || '___________________'}`),
              tab(),
              t('___________________'),
            ]),
          ],
        }),
        new Paragraph({
          spacing: { after: 0 },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
          children: [
            t('\t(data)', { size: 14, italics: true }),
            tab(),
            t('(semnătura)', { size: 14, italics: true }),
          ],
        }),

        // ══════ SRUS SECTION ══════
        empty(100),
        ...srusSection,
        srusSignatureTable,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Cerere_Concediu_${requestNumber}.docx`);
}
