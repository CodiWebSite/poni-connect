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

interface LeaveDocxParams {
  employeeName: string;
  employeePosition: string;
  employeeGrade?: string;
  department: string;
  workingDays: number;
  year: number;
  leaveSourceYear?: number;
  startDate: string;
  endDate?: string;
  replacementName: string;
  replacementPosition: string;
  requestDate: string;
  requestNumber: string;
  isApproved: boolean;
  employeeSignature?: string | null;
  totalLeaveDays?: number;
  usedLeaveDays?: number;
  carryoverDays?: number;
  carryoverInitialDays?: number;
  carryoverFromYear?: number;
  srusOfficerName?: string;
  srusSignature?: string | null;
  srusSignedAt?: string | null;
  srusIP?: string | null;
  approvalDate?: string;
  deptHeadSignature?: string | null;
  deptHeadName?: string;
  deptHeadIP?: string | null;
  deptHeadSignedAt?: string | null;
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
const BLUE_PEN = '1a3ba3';

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

const t = (text: string, opts: Partial<{ bold: boolean; italics: boolean; size: number; underline: any; color: string }> = {}) =>
  new TextRun({ text, font: FONT, size: opts.size ?? SIZE, bold: opts.bold, italics: opts.italics, underline: opts.underline, color: opts.color });

const tab = () => new TextRun({ text: '\t', font: FONT });
const empty = (after = 0) => new Paragraph({ spacing: { after }, children: [] });

export async function generateLeaveDocx(params: LeaveDocxParams) {
  const {
    employeeName, employeePosition, employeeGrade, department, workingDays, year, leaveSourceYear,
    startDate, endDate, replacementName, replacementPosition,
    requestDate, requestNumber, isApproved, employeeSignature,
    totalLeaveDays, usedLeaveDays, carryoverDays, carryoverInitialDays, carryoverFromYear, srusOfficerName, srusSignature,
    srusSignedAt, srusIP,
    approvalDate, deptHeadSignature, deptHeadName, deptHeadIP, deptHeadSignedAt,
    directorName, directorApprovalDate,
  } = params;

  // Determine which year to show: explicit leaveSourceYear, or derive from carryover info
  const displayYear = leaveSourceYear || (carryoverDays && carryoverDays > 0 && carryoverFromYear ? carryoverFromYear : year);

  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = endDate ? formatDate(endDate) : '';

  // Fetch logo and signatures in parallel (no more stamp)
  let logoData: Uint8Array;
  try { logoData = await fetchImageAsUint8Array('/logo_doc.jpg'); } catch { logoData = new Uint8Array(0); }

  const isDigitalSrus = srusSignature === 'digital';
  const isDigitalDeptHead = deptHeadSignature === 'digital';
  const [signatureData, deptHeadSigData, srusSigData] = await Promise.all([
    parseSignatureData(employeeSignature),
    isDigitalDeptHead ? Promise.resolve(null) : parseSignatureData(deptHeadSignature),
    isDigitalSrus ? Promise.resolve(null) : parseSignatureData(srusSignature),
  ]);

  const totalCurrentYear = totalLeaveDays ?? 0;
  const usedDays = usedLeaveDays ?? 0;
  const carryover = carryoverDays ?? 0;

  // SRUS trebuie să arate soldul de report dinaintea cererii curente (nu soldul rămas după cerere și nici totalul anual inițial).
  const carryoverBeforeRequest = carryover > 0 && workingDays > 0
    ? carryover + workingDays
    : carryover;

  // Show pre-leave current-year balance (before this request was deducted)
  let preLeaveCurrentUsed = usedDays;

  if (carryover > 0 && workingDays > 0) {
    // Request consumed carryover; current-year pool stays untouched
    preLeaveCurrentUsed = usedDays;
  } else {
    // Request consumed current-year pool
    preLeaveCurrentUsed = Math.max(0, usedDays - workingDays);
  }

  const remainingCurrentYear = totalCurrentYear - preLeaveCurrentUsed;
  const totalSold = remainingCurrentYear + carryoverBeforeRequest;

  const periodText = formattedEndDate
    ? `${formattedStartDate} - ${formattedEndDate}`
    : formattedStartDate;

  // ════════════════════════════════════════════════════
  // Left column: Aprobat, Șef compartiment, signature, date
  // ════════════════════════════════════════════════════
  const leftApprovalChildren: Paragraph[] = [
    new Paragraph({ spacing: { after: 0 }, children: [t('Aprobat,', { size: SIZE_SMALL })] }),
    new Paragraph({ spacing: { after: 40 }, children: [t('Șef compartiment', { bold: true, size: SIZE_SMALL })] }),
  ];

  if (deptHeadName) {
    leftApprovalChildren.push(
      new Paragraph({ spacing: { after: 0 }, children: [t(deptHeadName, { bold: true, size: SIZE_SMALL })] })
    );
  }

  if (isDigitalDeptHead && deptHeadIP) {
    const deptHeadFormattedDate = deptHeadSignedAt
      ? new Date(deptHeadSignedAt).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : (approvalDate || '');
    leftApprovalChildren.push(
      new Paragraph({ spacing: { after: 0 }, children: [
        t(`Semnat digital de ${deptHeadName || 'Șef compartiment'}`, { size: 16, italics: true, color: '1a3ba3' }),
      ]}),
      new Paragraph({ spacing: { after: 0 }, children: [
        t(`IP: ${deptHeadIP} | ${deptHeadFormattedDate}`, { size: 14, italics: true, color: '1a3ba3' }),
      ]})
    );
  } else if (deptHeadSigData) {
    leftApprovalChildren.push(
      new Paragraph({ spacing: { after: 0 }, children: [
        new ImageRun({ data: deptHeadSigData, transformation: { width: 130, height: 50 }, type: 'png' }),
      ]})
    );
  } else {
    leftApprovalChildren.push(new Paragraph({ spacing: { after: 0 }, children: [t('________________')] }));
  }

  if (approvalDate) {
    leftApprovalChildren.push(
      new Paragraph({ spacing: { after: 0 }, children: [t(`Data: ${approvalDate}`, { size: SIZE_SMALL })] })
    );
  }

  const approvalTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            verticalAlign: VerticalAlign.TOP,
            children: leftApprovalChildren,
          }),
        ],
      }),
    ],
  });

  // ════════════════════════════════════════════════════
  // SRUS section
  // ════════════════════════════════════════════════════
  const srusIndent = convertMillimetersToTwip(75);
  const S = 20;

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
        t(`${totalSold}`, { bold: true, size: S }),
        t(' zile concediu de odihnă, din care', { size: S }),
      ],
    }),
    new Paragraph({
      spacing: { after: 50 },
      indent: { left: srusIndent },
      children: [
        t(`${remainingCurrentYear}`, { bold: true, size: S }),
        t(' zile rămase aferente anului ', { size: S }),
        t(`${year}`, { bold: true, size: S }),
        t(' și ', { size: S }),
        t(`${carryoverBeforeRequest}`, { bold: true, size: S }),
        t(' zile rămase aferente anului', { size: S }),
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

  const srusSignatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 55, type: WidthType.PERCENTAGE }, borders: CELL_BORDERS, children: [empty(0)] }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            children: [
              new Paragraph({ spacing: { after: 0 }, children: [t(srusOfficerName || '___________________', { bold: !!srusOfficerName, size: S })] }),
              new Paragraph({ spacing: { after: 0 }, children: [t('(numele salariatului de la SRUS)', { size: 16, italics: true })] }),
            ],
          }),
          new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, borders: CELL_BORDERS, children: [empty(0)] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ width: { size: 55, type: WidthType.PERCENTAGE }, borders: CELL_BORDERS, children: [empty(0)] }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            children: [
              ...(isDigitalSrus && srusSignedAt ? [
                new Paragraph({ spacing: { after: 0 }, children: [
                  t('Semnat digital de ', { size: 16, italics: true, color: BLUE_PEN }),
                  t(srusOfficerName || '', { size: 16, bold: true, color: BLUE_PEN }),
                ] }),
                new Paragraph({ spacing: { after: 0 }, children: [
                  t(`IP: ${srusIP || 'N/A'} | ${new Date(srusSignedAt).toLocaleString('ro-RO')}`, { size: 14, italics: true, color: BLUE_PEN }),
                ] }),
              ] : srusSigData ? [
                new Paragraph({ spacing: { after: 0 }, children: [new ImageRun({ data: srusSigData, transformation: { width: 140, height: 55 }, type: 'png' })] }),
              ] : [
                new Paragraph({ spacing: { after: 0 }, children: [t('___________________', { size: S })] }),
              ]),
              new Paragraph({ spacing: { after: 0 }, children: [t('(semnătura)', { size: 14, italics: true })] }),
            ],
          }),
          new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, borders: CELL_BORDERS, children: [empty(0)] }),
        ],
      }),
    ],
  });

  // ════════════════════════════════════════════════════
  // Build document — balanced margins for centered look
  // ════════════════════════════════════════════════════
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertMillimetersToTwip(15),
            right: convertMillimetersToTwip(20),
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
            alignment: AlignmentType.CENTER,
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

        empty(80),

        // ══════ APPROVAL TABLE ══════
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
          indent: { left: convertMillimetersToTwip(15) },
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
          indent: { left: convertMillimetersToTwip(15) },
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
          indent: { left: convertMillimetersToTwip(15) },
          children: [
            t('vă rog să-mi aprobați efectuarea unui număr de '),
            t(`${workingDays}`, { bold: true, underline: { type: UnderlineType.SINGLE } }),
            t(' zile de  concediu de odihnă aferente'),
          ],
        }),

        new Paragraph({
          spacing: { after: 80, line: 300 },
          indent: { left: convertMillimetersToTwip(15) },
          children: [
            t('anului '),
            t(`${displayYear}`, { bold: true, underline: { type: UnderlineType.SINGLE } }),
            t(', începând cu data de '),
            t(periodText, { bold: true, underline: { type: UnderlineType.SINGLE } }),
            t('.'),
          ],
        }),

        // ══════ REPLACEMENT ══════
        new Paragraph({
          spacing: { after: 0, line: 300 },
          indent: { left: convertMillimetersToTwip(15) },
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
          indent: { left: convertMillimetersToTwip(15) },
          children: [
            ...underlinedField(replacementPosition, '_____________________________'),
            t('.'),
          ],
        }),
        new Paragraph({
          spacing: { after: 80, line: 240 },
          indent: { left: convertMillimetersToTwip(15) },
          children: [t('(funcția)', { size: 14, italics: true })],
        }),

        // ══════ CLOSING ══════
        new Paragraph({
          spacing: { before: 40, after: 0 },
          indent: { left: convertMillimetersToTwip(15) },
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
          indent: { left: convertMillimetersToTwip(15) },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
          children: [
            ...(signatureData ? [
              t(`\t${requestDate}`),
              tab(),
              new ImageRun({ data: signatureData, transformation: { width: 160, height: 60 }, type: 'png' }),
            ] : [
              t(`\t${requestDate || '___________________'}`),
              tab(),
              t('___________________'),
            ]),
          ],
        }),
        new Paragraph({
          spacing: { after: 0 },
          indent: { left: convertMillimetersToTwip(15) },
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
