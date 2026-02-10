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
  TableRow as DocxTableRow,
  TableCell,
  WidthType,
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
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};

export async function generateLeaveDocx(params: LeaveDocxParams) {
  const {
    employeeName,
    employeePosition,
    department,
    workingDays,
    year,
    startDate,
    endDate,
    replacementName,
    replacementPosition,
    requestDate,
    requestNumber,
    isApproved,
    employeeSignature,
    totalLeaveDays,
    usedLeaveDays,
    carryoverDays,
    carryoverFromYear,
    srusOfficerName,
  } = params;

  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = endDate ? formatDate(endDate) : '';

  // Fetch logo image
  let logoData: Uint8Array;
  try {
    logoData = await fetchImageAsUint8Array('/logo_doc.jpg');
  } catch {
    logoData = new Uint8Array(0);
  }

  // Parse employee signature if available
  let signatureData: Uint8Array | null = null;
  if (employeeSignature) {
    try {
      if (employeeSignature.startsWith('data:')) {
        signatureData = base64ToUint8Array(employeeSignature);
      } else {
        signatureData = await fetchImageAsUint8Array(employeeSignature);
      }
    } catch {
      signatureData = null;
    }
  }

  // Calculate leave balance
  const totalDays = totalLeaveDays ?? 0;
  const carryover = carryoverDays ?? 0;
  const totalAvailable = totalDays + carryover;

  // Period text
  const periodText = formattedEndDate
    ? `${formattedStartDate} - ${formattedEndDate}`
    : formattedStartDate;

  // Right tab at ~14cm from left margin
  const RIGHT_TAB = TabStopPosition.MAX;

  const doc = new Document({
    sections: [
      {
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
          // ═══════════ HEADER ═══════════
          // Logo + ACADEMIA ROMÂNĂ on same line
          new Paragraph({
            spacing: { after: 0 },
            children: [
              ...(logoData.length > 0
                ? [
                    new ImageRun({
                      data: logoData,
                      transformation: { width: 55, height: 55 },
                      type: 'jpg',
                    }),
                    new TextRun({ text: '   ', size: 22, font: FONT }),
                  ]
                : []),
              new TextRun({
                text: 'ACADEMIA ROMÂNĂ',
                bold: true,
                size: 22,
                font: FONT,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 0 },
            indent: { left: convertMillimetersToTwip(18) },
            children: [
              new TextRun({
                text: 'INSTITUTUL DE CHIMIE MACROMOLECULARĂ "PETRU PONI"',
                bold: true,
                size: 20,
                font: FONT,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            indent: { left: convertMillimetersToTwip(18) },
            children: [
              new TextRun({
                text: 'Aleea Grigore Ghica Vodă, nr. 41A, 700487 IAȘI, ROMANIA',
                size: 18,
                font: FONT,
              }),
            ],
          }),

          // ═══════════ ANEXA - LEFT ALIGNED ═══════════
          new Paragraph({
            spacing: { after: 200 },
            tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
            children: [
              new TextRun({
                text: 'Anexa 11.2.-P.O. ICMPP-SRUS',
                bold: true,
                size: 20,
                font: FONT,
              }),
              new TextRun({ text: '\t', font: FONT }),
              new TextRun({
                text: 'Se aprobă,',
                size: 22,
                font: FONT,
              }),
            ],
          }),

          // ═══════════ APPROVAL ROW ═══════════
          new Paragraph({
            spacing: { after: 0 },
            tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
            children: [
              new TextRun({ text: 'Aprobat,', size: 22, font: FONT }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
            children: [
              new TextRun({ text: 'Șef compartiment', bold: true, size: 22, font: FONT }),
              new TextRun({ text: '\t', font: FONT }),
              new TextRun({ text: 'DIRECTOR', bold: true, size: 26, font: FONT }),
            ],
          }),

          // Signature placeholders for approvers
          ...(isApproved
            ? [
                new Paragraph({
                  spacing: { after: 200 },
                  tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
                  children: [
                    new TextRun({ text: '_______________', size: 20, font: FONT }),
                    new TextRun({ text: '\t', font: FONT }),
                    new TextRun({ text: '_______________', size: 20, font: FONT }),
                  ],
                }),
              ]
            : [
                new Paragraph({
                  spacing: { after: 200 },
                  tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
                  children: [
                    new TextRun({ text: '_______________', size: 20, font: FONT }),
                    new TextRun({ text: '\t', font: FONT }),
                    new TextRun({ text: '_______________', size: 20, font: FONT }),
                  ],
                }),
              ]),

          // ═══════════ TITLE ═══════════
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 200 },
            children: [
              new TextRun({
                text: 'Cerere concediu odihnă',
                bold: true,
                size: 28,
                font: FONT,
              }),
            ],
          }),

          // ═══════════ SALUTATION ═══════════
          new Paragraph({
            spacing: { after: 200 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Doamnă/Domnule Director,',
                italics: true,
                size: 24,
                font: FONT,
              }),
            ],
          }),

          // ═══════════ BODY ═══════════
          new Paragraph({
            spacing: { after: 100, line: 360 },
            children: [
              new TextRun({ text: '\tSubsemnatul/a, ', size: 24, font: FONT }),
              new TextRun({
                text: employeeName || '______________________________',
                bold: !!employeeName,
                size: 24,
                font: FONT,
                underline: employeeName ? { type: UnderlineType.SINGLE } : undefined,
              }),
              new TextRun({ text: ', ', size: 24, font: FONT }),
              new TextRun({
                text: employeePosition || '_______________',
                bold: !!employeePosition,
                size: 24,
                font: FONT,
                underline: employeePosition ? { type: UnderlineType.SINGLE } : undefined,
              }),
              new TextRun({ text: ', în', size: 24, font: FONT }),
            ],
          }),
          // (numele si prenumele) / (functia) labels
          new Paragraph({
            spacing: { after: 0 },
            children: [
              new TextRun({ text: '\t\t\t', font: FONT }),
              new TextRun({ text: '(numele și prenumele)', italics: true, size: 18, font: FONT }),
              new TextRun({ text: '\t\t\t\t', font: FONT }),
              new TextRun({ text: '(funcția)', italics: true, size: 18, font: FONT }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100, line: 360 },
            children: [
              new TextRun({ text: 'cadrul ', size: 24, font: FONT }),
              new TextRun({
                text: department || '______________________________',
                bold: !!department,
                size: 24,
                font: FONT,
                underline: department ? { type: UnderlineType.SINGLE } : undefined,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: '\t\t', font: FONT }),
              new TextRun({ text: '(compartimentul)', italics: true, size: 18, font: FONT }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100, line: 360 },
            children: [
              new TextRun({
                text: 'vă rog să-mi aprobați efectuarea unui număr de ',
                size: 24,
                font: FONT,
              }),
              new TextRun({
                text: `${workingDays}`,
                bold: true,
                size: 24,
                font: FONT,
                underline: { type: UnderlineType.SINGLE },
              }),
              new TextRun({
                text: ' zile de concediu de odihnă aferente',
                size: 24,
                font: FONT,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100, line: 360 },
            children: [
              new TextRun({ text: 'anului ', size: 24, font: FONT }),
              new TextRun({
                text: `${year}`,
                bold: true,
                size: 24,
                font: FONT,
                underline: { type: UnderlineType.SINGLE },
              }),
              new TextRun({
                text: ', începând cu data de ',
                size: 24,
                font: FONT,
              }),
              new TextRun({
                text: periodText,
                bold: true,
                size: 24,
                font: FONT,
                underline: { type: UnderlineType.SINGLE },
              }),
              new TextRun({ text: '.', size: 24, font: FONT }),
            ],
          }),

          // ═══════════ REPLACEMENT ═══════════
          new Paragraph({
            spacing: { after: 50, line: 360 },
            children: [
              new TextRun({
                text: '\tÎn această perioadă voi fi înlocuit/ă de dl./d-na ',
                size: 24,
                font: FONT,
              }),
              new TextRun({
                text: replacementName || '______________________________',
                bold: !!replacementName,
                size: 24,
                font: FONT,
                underline: replacementName ? { type: UnderlineType.SINGLE } : undefined,
              }),
              new TextRun({ text: ',', size: 24, font: FONT }),
            ],
          }),
          // (numele si prenumele) label
          new Paragraph({
            spacing: { after: 0 },
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: '(numele și prenumele)', italics: true, size: 18, font: FONT }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: replacementPosition || '______________________________',
                bold: !!replacementPosition,
                size: 24,
                font: FONT,
                underline: replacementPosition ? { type: UnderlineType.SINGLE } : undefined,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: '\t', font: FONT }),
              new TextRun({ text: '(funcția)', italics: true, size: 18, font: FONT }),
            ],
          }),

          // ═══════════ SIGNATURE SECTION ═══════════
          new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({ text: '\tCu mulțumiri,', size: 24, font: FONT }),
            ],
          }),

          // Date left, Name + signature right
          new Paragraph({
            spacing: { after: 50 },
            tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
            children: [
              new TextRun({ text: '______________________________', size: 24, font: FONT }),
              new TextRun({ text: '\t', font: FONT }),
              new TextRun({
                text: employeeName || '______________________________',
                bold: !!employeeName,
                size: 24,
                font: FONT,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 50 },
            tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
            children: [
              new TextRun({ text: '(data)', italics: true, size: 18, font: FONT }),
              new TextRun({ text: '\t', font: FONT }),
              new TextRun({ text: '(semnătura)', italics: true, size: 18, font: FONT }),
            ],
          }),

          // Actual date value & signature image if available
          ...(signatureData
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
                  children: [
                    new TextRun({ text: requestDate, size: 22, font: FONT }),
                    new TextRun({ text: '\t', font: FONT }),
                    new ImageRun({
                      data: signatureData,
                      transformation: { width: 130, height: 50 },
                      type: 'png',
                    }),
                  ],
                }),
              ]
            : [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [
                    new TextRun({ text: requestDate, size: 22, font: FONT }),
                  ],
                }),
              ]),

          // ═══════════ SRUS SECTION (right-aligned block) ═══════════
          new Paragraph({ spacing: { before: 400 }, children: [] }),

          // Use right-indented paragraphs to simulate the SRUS box
          new Paragraph({
            spacing: { after: 50 },
            indent: { left: convertMillimetersToTwip(80) },
            children: [
              new TextRun({ text: 'Propunem să aprobați,', size: 22, font: FONT }),
            ],
          }),
          new Paragraph({
            spacing: { after: 50 },
            indent: { left: convertMillimetersToTwip(80) },
            children: [
              new TextRun({ text: 'La această dată dl./d-na ', size: 22, font: FONT }),
              new TextRun({
                text: employeeName || '_______________',
                bold: !!employeeName,
                size: 22,
                font: FONT,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 50 },
            indent: { left: convertMillimetersToTwip(80) },
            children: [
              new TextRun({
                text: `are dreptul la `,
                size: 22,
                font: FONT,
              }),
              new TextRun({
                text: totalAvailable > 0 ? `${totalAvailable}` : '_____',
                bold: totalAvailable > 0,
                size: 22,
                font: FONT,
              }),
              new TextRun({
                text: ' zile concediu de odihnă, din care',
                size: 22,
                font: FONT,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 50 },
            indent: { left: convertMillimetersToTwip(80) },
            children: [
              new TextRun({
                text: totalDays > 0 ? `${totalDays}` : '_______',
                bold: totalDays > 0,
                size: 22,
                font: FONT,
              }),
              new TextRun({
                text: ` aferente anului ${year} și `,
                size: 22,
                font: FONT,
              }),
              new TextRun({
                text: carryover > 0 ? `${carryover}` : '______',
                bold: carryover > 0,
                size: 22,
                font: FONT,
              }),
              new TextRun({
                text: ` aferente anului`,
                size: 22,
                font: FONT,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: convertMillimetersToTwip(80) },
            children: [
              new TextRun({
                text: carryoverFromYear ? `${carryoverFromYear}` : '_______',
                bold: !!carryoverFromYear,
                size: 22,
                font: FONT,
              }),
              new TextRun({ text: '.', size: 22, font: FONT }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 0 },
            indent: { left: convertMillimetersToTwip(80) },
            children: [
              new TextRun({
                text: srusOfficerName || '______________________________',
                bold: !!srusOfficerName,
                size: 22,
                font: FONT,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 0 },
            indent: { left: convertMillimetersToTwip(80) },
            children: [
              new TextRun({
                text: '(numele salariatului de la SRUS)',
                italics: true,
                size: 18,
                font: FONT,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100 },
            indent: { left: convertMillimetersToTwip(80) },
            children: [
              new TextRun({ text: '______________________________', size: 22, font: FONT }),
            ],
          }),
          new Paragraph({
            indent: { left: convertMillimetersToTwip(80) },
            children: [
              new TextRun({
                text: '(semnătura)',
                italics: true,
                size: 18,
                font: FONT,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Cerere_Concediu_${requestNumber}.docx`);
}
