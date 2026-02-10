import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  Header,
  TabStopPosition,
  TabStopType,
  Packer,
  HeadingLevel,
  UnderlineType,
  convertMillimetersToTwip,
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
  } = params;

  // Format start date
  const [sy, sm, sd] = startDate.split('-');
  const formattedStartDate = `${sd}.${sm}.${sy}`;

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
          // Header - Institution
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
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

          // Approval section - two columns
          new Paragraph({
            spacing: { after: 0 },
            children: [
              new TextRun({
                text: 'Se aprobă,',
                size: 22,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: '\t\t\t\t\t\t\t',
              }),
              new TextRun({
                text: 'Aprobat,',
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: 'DIRECTOR',
                bold: true,
                size: 22,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: '\t\t\t\t\t\t\t',
              }),
              new TextRun({
                text: 'Șef compartiment',
                bold: true,
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),

          // If approved, show signatures placeholder text
          ...(isApproved
            ? [
                new Paragraph({
                  spacing: { after: 200 },
                  children: [
                    new TextRun({
                      text: '(semnat electronic)',
                      italics: true,
                      size: 18,
                      font: 'Times New Roman',
                    }),
                    new TextRun({
                      text: '\t\t\t\t\t\t',
                    }),
                    new TextRun({
                      text: '(semnat electronic)',
                      italics: true,
                      size: 18,
                      font: 'Times New Roman',
                    }),
                  ],
                }),
              ]
            : [
                new Paragraph({ spacing: { after: 200 }, children: [] }),
              ]),

          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 400 },
            children: [
              new TextRun({
                text: 'Cerere concediu odihnă',
                bold: true,
                size: 28,
                font: 'Times New Roman',
              }),
            ],
          }),

          // Salutation
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Doamnă/Domnule Director,',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          // Body paragraph 1
          new Paragraph({
            spacing: { after: 100, line: 360 },
            children: [
              new TextRun({
                text: `\tSubsemnatul/a, `,
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: employeeName,
                bold: true,
                size: 24,
                font: 'Times New Roman',
                underline: { type: UnderlineType.SINGLE },
              }),
              new TextRun({
                text: `, `,
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: employeePosition,
                bold: true,
                size: 24,
                font: 'Times New Roman',
                underline: { type: UnderlineType.SINGLE },
              }),
              new TextRun({
                text: ` în cadrul `,
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: department,
                bold: true,
                size: 24,
                font: 'Times New Roman',
                underline: { type: UnderlineType.SINGLE },
              }),
              new TextRun({
                text: `, vă rog să-mi aprobați efectuarea unui număr de `,
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: `${workingDays}`,
                bold: true,
                size: 24,
                font: 'Times New Roman',
                underline: { type: UnderlineType.SINGLE },
              }),
              new TextRun({
                text: ` zile de concediu de odihnă aferente anului `,
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: `${year}`,
                bold: true,
                size: 24,
                font: 'Times New Roman',
                underline: { type: UnderlineType.SINGLE },
              }),
              new TextRun({
                text: `, începând cu data de `,
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: formattedStartDate,
                bold: true,
                size: 24,
                font: 'Times New Roman',
                underline: { type: UnderlineType.SINGLE },
              }),
              new TextRun({
                text: '.',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          // Replacement paragraph
          new Paragraph({
            spacing: { after: 200, line: 360 },
            children: [
              new TextRun({
                text: `\tÎn această perioadă voi fi înlocuit/ă de dl./d-na `,
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: replacementName,
                bold: true,
                size: 24,
                font: 'Times New Roman',
                underline: { type: UnderlineType.SINGLE },
              }),
              new TextRun({
                text: `, `,
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: replacementPosition || '_______________',
                bold: !!replacementPosition,
                size: 24,
                font: 'Times New Roman',
                underline: replacementPosition ? { type: UnderlineType.SINGLE } : undefined,
              }),
              new TextRun({
                text: '.',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          // Signature block
          new Paragraph({
            spacing: { before: 400, after: 100 },
            children: [
              new TextRun({
                text: `Cu mulțumiri, `,
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: employeeName,
                bold: true,
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          new Paragraph({
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: requestDate,
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: '\t\t\t\t\t\t',
              }),
              new TextRun({
                text: '(semnătura electronică)',
                italics: true,
                size: 20,
                font: 'Times New Roman',
              }),
            ],
          }),

          // SRUS section
          new Paragraph({
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: 'Propunem să aprobați,',
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: `La această dată dl./d-na `,
                size: 22,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: employeeName,
                bold: true,
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `are dreptul la _____ zile concediu de odihnă, din care`,
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `_______ aferente anului ${year} și ______ aferente anului _______.`,
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: '___________________',
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
