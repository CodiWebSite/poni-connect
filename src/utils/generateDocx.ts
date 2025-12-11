import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, convertInchesToTwip } from 'docx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

interface LeaveRequestData {
  employeeName: string;
  department: string;
  position: string;
  numberOfDays: number;
  year: string;
  startDate: string;
  endDate?: string;
  replacementName?: string;
  replacementPosition?: string;
  employeeSignature?: string;
  employeeSignedAt?: string;
  departmentHeadSignature?: string;
  departmentHeadSignedAt?: string;
  status: string;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '____________';
  const date = new Date(dateStr);
  return format(date, 'dd.MM.yyyy');
};

export const generateLeaveRequestDocx = async (data: LeaveRequestData) => {
  const currentDate = format(new Date(), 'dd.MM.yyyy');
  const previousYear = (parseInt(data.year || new Date().getFullYear().toString()) - 1).toString();

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.5),
            bottom: convertInchesToTwip(0.5),
            left: convertInchesToTwip(0.75),
            right: convertInchesToTwip(0.75),
          }
        }
      },
      children: [
        // Header - ACADEMIA ROMÂNĂ
        new Paragraph({
          children: [
            new TextRun({
              text: 'ACADEMIA ROMÂNĂ',
              bold: true,
              size: 22,
              font: 'Times New Roman'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 }
        }),

        // INSTITUTUL
        new Paragraph({
          children: [
            new TextRun({
              text: 'INSTITUTUL DE CHIMIE MACROMOLECULARĂ "PETRU PONI"',
              bold: true,
              size: 24,
              font: 'Times New Roman'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 }
        }),

        // Address
        new Paragraph({
          children: [
            new TextRun({
              text: 'Aleea Grigore Ghica Voda, nr. 41A, 700487 IAȘI, ROMANIA',
              size: 18,
              font: 'Times New Roman'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),

        // Anexa - right aligned
        new Paragraph({
          children: [
            new TextRun({
              text: 'Anexa 11.2.-P.O. ICMPP-SRUS',
              italics: true,
              size: 18,
              font: 'Times New Roman'
            })
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 300 }
        }),

        // Approval section - table with two columns
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE }
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: 'Se aprobă,', size: 22, font: 'Times New Roman' })],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: 'Aprobat, DIRECTOR', size: 18, font: 'Times New Roman' })],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({ text: '' }),
                    new Paragraph({
                      children: [new TextRun({ text: '________________________', size: 22, font: 'Times New Roman' })],
                      alignment: AlignmentType.CENTER
                    })
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE }
                  },
                  width: { size: 50, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: 'Șef compartiment', size: 22, font: 'Times New Roman' })],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({ text: '' }),
                    new Paragraph({
                      children: [
                        new TextRun({ 
                          text: data.departmentHeadSignature ? '✓ SEMNAT' : '________________________', 
                          size: 22, 
                          font: 'Times New Roman',
                          bold: !!data.departmentHeadSignature
                        })
                      ],
                      alignment: AlignmentType.CENTER
                    }),
                    ...(data.departmentHeadSignedAt ? [
                      new Paragraph({
                        children: [new TextRun({ text: formatDate(data.departmentHeadSignedAt), size: 18, font: 'Times New Roman' })],
                        alignment: AlignmentType.CENTER
                      })
                    ] : [])
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE }
                  },
                  width: { size: 50, type: WidthType.PERCENTAGE }
                })
              ]
            })
          ]
        }),

        new Paragraph({ text: '', spacing: { after: 300 } }),

        // Title
        new Paragraph({
          children: [
            new TextRun({
              text: 'Cerere concediu odihnă',
              bold: true,
              size: 28,
              underline: {},
              font: 'Times New Roman'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),

        // Body - Doamnă/Domnule Director
        new Paragraph({
          children: [
            new TextRun({
              text: 'Doamnă/Domnule Director,',
              size: 24,
              font: 'Times New Roman'
            })
          ],
          spacing: { after: 200 }
        }),

        // Main paragraph
        new Paragraph({
          children: [
            new TextRun({ text: '        Subsemnatul/a, ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.employeeName || '________________________', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' în ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.position || '________________________', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' cadrul ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.department || '________________________', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' vă rog să-mi aprobaţi efectuarea unui număr de ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.numberOfDays?.toString() || '______', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' zile de concediu de odihnă aferente anului ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.year || '______', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' începând cu data de ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: formatDate(data.startDate), size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: '.', size: 22, font: 'Times New Roman' })
          ],
          spacing: { line: 360, after: 200 }
        }),

        // Replacement paragraph (if provided)
        ...(data.replacementName ? [
          new Paragraph({
            children: [
              new TextRun({ text: '        În această perioadă voi fi înlocuit/ă de dl./d-na ', size: 22, font: 'Times New Roman' }),
              new TextRun({ text: data.replacementName, size: 22, font: 'Times New Roman', bold: true }),
              new TextRun({ text: data.replacementPosition ? ` ${data.replacementPosition}` : '', size: 22, font: 'Times New Roman', bold: true }),
              new TextRun({ text: '.', size: 22, font: 'Times New Roman' })
            ],
            spacing: { line: 360, after: 200 }
          })
        ] : []),

        // Cu mulțumiri
        new Paragraph({
          children: [
            new TextRun({ text: 'Cu mulţumiri,', size: 22, font: 'Times New Roman' })
          ],
          spacing: { before: 300, after: 300 }
        }),

        // Employee signature section
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE }
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: data.employeeName || '________________________', size: 22, font: 'Times New Roman', bold: true })],
                      alignment: AlignmentType.LEFT
                    })
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE }
                  },
                  width: { size: 50, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ 
                          text: data.employeeSignature ? '✓ SEMNAT ELECTRONIC' : '________________________', 
                          size: 22, 
                          font: 'Times New Roman',
                          bold: !!data.employeeSignature
                        })
                      ],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: `(${data.employeeSignedAt ? formatDate(data.employeeSignedAt) : currentDate}) (semnătura)`, size: 18, font: 'Times New Roman' })],
                      alignment: AlignmentType.CENTER
                    })
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE }
                  },
                  width: { size: 50, type: WidthType.PERCENTAGE }
                })
              ]
            })
          ]
        }),

        new Paragraph({ text: '', spacing: { after: 400 } }),

        // HR Section - dashed border simulated with text
        new Paragraph({
          children: [
            new TextRun({ text: '─'.repeat(80), size: 18, font: 'Times New Roman' })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),

        new Paragraph({
          children: [
            new TextRun({ text: 'Propunem să aprobaţi,', bold: true, size: 24, font: 'Times New Roman' })
          ],
          spacing: { after: 200 }
        }),

        // HR paragraph
        new Paragraph({
          children: [
            new TextRun({ text: '        La această dată dl./d-na ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.employeeName || '________________________', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' are dreptul la ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: '______', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' zile concediu de odihnă, din care ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: '______', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' aferente anului ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.year || '______', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' şi ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: '______', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' aferente anului ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: previousYear, size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: '.', size: 22, font: 'Times New Roman' })
          ],
          spacing: { line: 360, after: 300 }
        }),

        // HR signature section
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE }
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: '___________________', size: 20, font: 'Times New Roman' })],
                      alignment: AlignmentType.LEFT
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: '(numele salariatului de la SRUS)', italics: true, size: 18, font: 'Times New Roman' })],
                      alignment: AlignmentType.LEFT
                    })
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE }
                  },
                  width: { size: 50, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: '_______________', size: 20, font: 'Times New Roman' })],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: '(semnătura)', italics: true, size: 18, font: 'Times New Roman' })],
                      alignment: AlignmentType.CENTER
                    })
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE }
                  },
                  width: { size: 50, type: WidthType.PERCENTAGE }
                })
              ]
            })
          ]
        }),

        // Status at the bottom
        new Paragraph({ text: '', spacing: { after: 300 } }),
        ...(data.status === 'approved' ? [
          new Paragraph({
            children: [
              new TextRun({ text: 'STATUS: APROBAT', bold: true, size: 28, font: 'Times New Roman', color: '008000' })
            ],
            alignment: AlignmentType.CENTER
          })
        ] : data.status === 'rejected' ? [
          new Paragraph({
            children: [
              new TextRun({ text: 'STATUS: RESPINS', bold: true, size: 28, font: 'Times New Roman', color: 'FF0000' })
            ],
            alignment: AlignmentType.CENTER
          })
        ] : [
          new Paragraph({
            children: [
              new TextRun({ text: 'STATUS: ÎN AȘTEPTARE', bold: true, size: 28, font: 'Times New Roman', color: 'FFA500' })
            ],
            alignment: AlignmentType.CENTER
          })
        ])
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Cerere_Concediu_${data.employeeName.replace(/\s+/g, '_')}_${formatDate(new Date().toISOString())}.docx`);
};

export const generateGenericDocx = async (content: string, documentType: string, employeeName: string) => {
  const lines = content.split('\n').filter(line => line.trim());
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: lines.map(line => {
        const isHeader = line.includes('INSTITUT') || line.includes('ADEVERINȚĂ') || line.includes('ORDIN') || line.includes('CERERE') || line.includes('ACADEMIA');
        const isBold = line.startsWith('-') || line.includes(':');
        
        return new Paragraph({
          children: [
            new TextRun({
              text: line,
              bold: isHeader || isBold,
              size: isHeader ? 28 : 22,
              font: 'Times New Roman'
            })
          ],
          alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { line: 360, after: 100 }
        });
      })
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${documentType}_${employeeName.replace(/\s+/g, '_')}_${formatDate(new Date().toISOString())}.docx`);
};
