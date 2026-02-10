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
} from 'docx';
import { saveAs } from 'file-saver';

interface LeaveDocxParams {
  employeeName: string;
  employeePosition: string;
  department: string;
  workingDays: number;
  year: number;
  startDate: string; // yyyy-MM-dd
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

export async function generateLeaveDocx(params: LeaveDocxParams) {
  const {
    employeeName,
    employeePosition,
    department,
    workingDays,
    year,
    startDate,
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

  // Format start date
  const [sy, sm, sd] = startDate.split('-');
  const formattedStartDate = `${sd}.${sm}.${sy}`;

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

  // Calculate remaining leave days
  const totalDays = totalLeaveDays ?? 0;
  const used = usedLeaveDays ?? 0;
  const carryover = carryoverDays ?? 0;
  const totalAvailable = totalDays + carryover;

  const headerChildren: (TextRun | ImageRun)[] = [];

  // Logo + text in header paragraph
  if (logoData.length > 0) {
    headerChildren.push(
      new ImageRun({
        data: logoData,
        transformation: { width: 60, height: 60 },
        type: 'jpg',
      })
    );
    headerChildren.push(
      new TextRun({ text: '   ', size: 22, font: 'Times New Roman' })
    );
  }

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
          // Header with logo and institution name on same line
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
              ...(logoData.length > 0 ? [
                new ImageRun({
                  data: logoData,
                  transformation: { width: 55, height: 55 },
                  type: 'jpg',
                }),
                new TextRun({ text: '  ', size: 22, font: 'Times New Roman' }),
              ] : []),
              new TextRun({
                text: 'ACADEMIA ROMÂNĂ',
                bold: true,
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
              new TextRun({
                text: 'INSTITUTUL DE CHIMIE MACROMOLECULARĂ "PETRU PONI"',
                bold: true,
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Aleea Grigore Ghica Vodă, nr. 41A, 700487 IAȘI, ROMANIA',
                size: 18,
                font: 'Times New Roman',
              }),
            ],
          }),

          // Annexa reference
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Anexa 11.2.-P.O. ICMPP-SRUS',
                bold: true,
                size: 20,
                font: 'Times New Roman',
              }),
            ],
          }),

          // Approval section - Aprobat/Sef compartiment LEFT, Se aproba/DIRECTOR RIGHT
          new Paragraph({
            spacing: { after: 0 },
            children: [
              new TextRun({ text: 'Aprobat,', size: 22, font: 'Times New Roman' }),
              new TextRun({ text: '\t\t\t\t\t\t\t' }),
              new TextRun({ text: 'Se aprobă,', size: 22, font: 'Times New Roman' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 400 },
            children: [
              new TextRun({ text: 'Șef compartiment', bold: true, size: 22, font: 'Times New Roman' }),
              new TextRun({ text: '\t\t\t\t\t\t\t' }),
              new TextRun({ text: 'DIRECTOR', bold: true, size: 22, font: 'Times New Roman' }),
            ],
          }),

          // Signature placeholders for approvers
          ...(isApproved
            ? [
                new Paragraph({
                  spacing: { after: 200 },
                  children: [
                    new TextRun({ text: '(semnat electronic)', italics: true, size: 18, font: 'Times New Roman' }),
                    new TextRun({ text: '\t\t\t\t\t\t' }),
                    new TextRun({ text: '(semnat electronic)', italics: true, size: 18, font: 'Times New Roman' }),
                  ],
                }),
              ]
            : [new Paragraph({ spacing: { after: 200 }, children: [] })]),

          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 400 },
            children: [
              new TextRun({ text: 'Cerere concediu odihnă', bold: true, size: 28, font: 'Times New Roman' }),
            ],
          }),

          // Salutation
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: 'Doamnă/Domnule Director,', size: 24, font: 'Times New Roman' }),
            ],
          }),

          // Body paragraph
          new Paragraph({
            spacing: { after: 100, line: 360 },
            children: [
              new TextRun({ text: `\tSubsemnatul/a, `, size: 24, font: 'Times New Roman' }),
              new TextRun({ text: employeeName, bold: true, size: 24, font: 'Times New Roman', underline: { type: UnderlineType.SINGLE } }),
              new TextRun({ text: `, `, size: 24, font: 'Times New Roman' }),
              new TextRun({ text: employeePosition, bold: true, size: 24, font: 'Times New Roman', underline: { type: UnderlineType.SINGLE } }),
              new TextRun({ text: ` în cadrul `, size: 24, font: 'Times New Roman' }),
              new TextRun({ text: department, bold: true, size: 24, font: 'Times New Roman', underline: { type: UnderlineType.SINGLE } }),
              new TextRun({ text: `, vă rog să-mi aprobați efectuarea unui număr de `, size: 24, font: 'Times New Roman' }),
              new TextRun({ text: `${workingDays}`, bold: true, size: 24, font: 'Times New Roman', underline: { type: UnderlineType.SINGLE } }),
              new TextRun({ text: ` zile de concediu de odihnă aferente anului `, size: 24, font: 'Times New Roman' }),
              new TextRun({ text: `${year}`, bold: true, size: 24, font: 'Times New Roman', underline: { type: UnderlineType.SINGLE } }),
              new TextRun({ text: `, începând cu data de `, size: 24, font: 'Times New Roman' }),
              new TextRun({ text: formattedStartDate, bold: true, size: 24, font: 'Times New Roman', underline: { type: UnderlineType.SINGLE } }),
              new TextRun({ text: '.', size: 24, font: 'Times New Roman' }),
            ],
          }),

          // Replacement paragraph
          new Paragraph({
            spacing: { after: 200, line: 360 },
            children: [
              new TextRun({ text: `\tÎn această perioadă voi fi înlocuit/ă de dl./d-na `, size: 24, font: 'Times New Roman' }),
              new TextRun({ text: replacementName, bold: true, size: 24, font: 'Times New Roman', underline: { type: UnderlineType.SINGLE } }),
              new TextRun({ text: `, `, size: 24, font: 'Times New Roman' }),
              new TextRun({
                text: replacementPosition || '_______________',
                bold: !!replacementPosition,
                size: 24,
                font: 'Times New Roman',
                underline: replacementPosition ? { type: UnderlineType.SINGLE } : undefined,
              }),
              new TextRun({ text: '.', size: 24, font: 'Times New Roman' }),
            ],
          }),

          // Signature block - employee
          new Paragraph({
            spacing: { before: 400, after: 100 },
            children: [
              new TextRun({ text: `Cu mulțumiri, `, size: 24, font: 'Times New Roman' }),
              new TextRun({ text: employeeName, bold: true, size: 24, font: 'Times New Roman' }),
            ],
          }),

          // Date and signature image
          new Paragraph({
            spacing: { after: 50 },
            children: [
              new TextRun({ text: requestDate, size: 24, font: 'Times New Roman' }),
            ],
          }),

          // Employee signature image or placeholder
          ...(signatureData
            ? [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 200 },
                  children: [
                    new ImageRun({
                      data: signatureData,
                      transformation: { width: 150, height: 60 },
                      type: 'png',
                    }),
                  ],
                }),
              ]
            : [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 200 },
                  children: [
                    new TextRun({ text: '(semnătura electronică)', italics: true, size: 20, font: 'Times New Roman' }),
                  ],
                }),
              ]),

          // SRUS section with auto-filled data
          new Paragraph({
            spacing: { before: 400 },
            children: [
              new TextRun({ text: 'Propunem să aprobați,', size: 22, font: 'Times New Roman' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: `La această dată dl./d-na `, size: 22, font: 'Times New Roman' }),
              new TextRun({ text: employeeName, bold: true, size: 22, font: 'Times New Roman' }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `are dreptul la ${totalAvailable > 0 ? totalAvailable : '_____'} zile concediu de odihnă, din care`,
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${totalDays > 0 ? totalDays : '_______'} aferente anului ${year} și ${carryover > 0 ? carryover : '______'} aferente anului ${carryoverFromYear || '_______'}.`,
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: srusOfficerName || '___________________',
                bold: !!srusOfficerName,
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '(numele salariatului de la SRUS)',
                italics: true,
                size: 18,
                font: 'Times New Roman',
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
