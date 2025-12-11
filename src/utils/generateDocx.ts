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

// Procurement Request Document Generation
interface ProcurementItem {
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
}

interface ProcurementRequestData {
  requestNumber: string;
  requesterName: string;
  department: string;
  position?: string;
  title: string;
  description: string;
  justification: string;
  category: string;
  urgency: string;
  items: ProcurementItem[];
  estimatedValue: number;
  currency: string;
  budgetSource?: string;
  createdAt: string;
  employeeSignature?: string;
  employeeSignedAt?: string;
  approverSignature?: string;
  approverSignedAt?: string;
  approverName?: string;
  status: string;
}

const categoryLabels: Record<string, string> = {
  consumabile_laborator: 'Consumabile Laborator',
  echipamente_it: 'Echipamente IT',
  birotica: 'Birotică',
  echipamente_cercetare: 'Echipamente Cercetare',
  servicii: 'Servicii',
  mobilier: 'Mobilier',
  altele: 'Altele'
};

const urgencyLabels: Record<string, string> = {
  normal: 'Normal',
  urgent: 'Urgent',
  foarte_urgent: 'Foarte Urgent'
};

export const generateProcurementDocx = async (data: ProcurementRequestData) => {
  const currentDate = formatDate(data.createdAt);

  // Create items table rows
  const itemRows = data.items.map((item, index) => 
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: (index + 1).toString(), size: 20, font: 'Times New Roman' })] })],
          width: { size: 5, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.name, size: 20, font: 'Times New Roman' })] })],
          width: { size: 35, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.quantity.toString(), size: 20, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })],
          width: { size: 10, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.unit, size: 20, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })],
          width: { size: 10, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.estimatedPrice.toLocaleString('ro-RO'), size: 20, font: 'Times New Roman' })], alignment: AlignmentType.RIGHT })],
          width: { size: 20, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: (item.quantity * item.estimatedPrice).toLocaleString('ro-RO'), size: 20, font: 'Times New Roman', bold: true })], alignment: AlignmentType.RIGHT })],
          width: { size: 20, type: WidthType.PERCENTAGE }
        })
      ]
    })
  );

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
        // Header
        new Paragraph({
          children: [new TextRun({ text: 'ACADEMIA ROMÂNĂ', bold: true, size: 22, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'INSTITUTUL DE CHIMIE MACROMOLECULARĂ "PETRU PONI"', bold: true, size: 24, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Aleea Grigore Ghica Voda, nr. 41A, 700487 IAȘI, ROMANIA', size: 18, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),

        // Document number and date
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: `Nr. înregistrare: ${data.requestNumber}`, size: 22, font: 'Times New Roman', bold: true })] })],
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  width: { size: 50, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: `Data: ${currentDate}`, size: 22, font: 'Times New Roman' })], alignment: AlignmentType.RIGHT })],
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  width: { size: 50, type: WidthType.PERCENTAGE }
                })
              ]
            })
          ]
        }),

        new Paragraph({ text: '', spacing: { after: 200 } }),

        // Title
        new Paragraph({
          children: [new TextRun({ text: 'REFERAT DE NECESITATE', bold: true, size: 32, underline: {}, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 }
        }),

        // Urgency
        new Paragraph({
          children: [
            new TextRun({ text: 'Urgență: ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: urgencyLabels[data.urgency] || data.urgency, size: 22, font: 'Times New Roman', bold: true })
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 200 }
        }),

        // Body intro
        new Paragraph({
          children: [new TextRun({ text: 'Către conducerea institutului,', size: 22, font: 'Times New Roman' })],
          spacing: { after: 200 }
        }),

        new Paragraph({
          children: [
            new TextRun({ text: '        Subsemnatul/a, ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.requesterName, size: 22, font: 'Times New Roman', bold: true }),
            ...(data.position ? [new TextRun({ text: `, în funcția de `, size: 22, font: 'Times New Roman' }), new TextRun({ text: data.position, size: 22, font: 'Times New Roman', bold: true })] : []),
            new TextRun({ text: ', din cadrul ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.department, size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ', solicit aprobarea achiziției următoarelor produse/servicii:', size: 22, font: 'Times New Roman' })
          ],
          spacing: { line: 360, after: 200 }
        }),

        // Title and description
        new Paragraph({
          children: [
            new TextRun({ text: 'Titlu: ', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: data.title, size: 22, font: 'Times New Roman' })
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Descriere: ', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: data.description, size: 22, font: 'Times New Roman' })
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Categorie: ', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: categoryLabels[data.category] || data.category, size: 22, font: 'Times New Roman' })
          ],
          spacing: { after: 200 }
        }),

        // Items table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Nr.', size: 20, font: 'Times New Roman', bold: true })] })], shading: { fill: 'E0E0E0' } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Denumire produs/serviciu', size: 20, font: 'Times New Roman', bold: true })] })], shading: { fill: 'E0E0E0' } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Cant.', size: 20, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: 'E0E0E0' } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'U.M.', size: 20, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: 'E0E0E0' } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Preț unit.', size: 20, font: 'Times New Roman', bold: true })], alignment: AlignmentType.RIGHT })], shading: { fill: 'E0E0E0' } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Total', size: 20, font: 'Times New Roman', bold: true })], alignment: AlignmentType.RIGHT })], shading: { fill: 'E0E0E0' } })
              ]
            }),
            ...itemRows,
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL ESTIMAT:', size: 20, font: 'Times New Roman', bold: true })], alignment: AlignmentType.RIGHT })], columnSpan: 5, shading: { fill: 'E0E0E0' } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${data.estimatedValue.toLocaleString('ro-RO')} ${data.currency}`, size: 20, font: 'Times New Roman', bold: true })], alignment: AlignmentType.RIGHT })], shading: { fill: 'E0E0E0' } })
              ]
            })
          ]
        }),

        new Paragraph({ text: '', spacing: { after: 200 } }),

        // Justification
        new Paragraph({
          children: [new TextRun({ text: 'Justificare / Necesitate:', size: 22, font: 'Times New Roman', bold: true })],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [new TextRun({ text: data.justification, size: 22, font: 'Times New Roman' })],
          spacing: { line: 360, after: 200 }
        }),

        // Budget source
        ...(data.budgetSource ? [
          new Paragraph({
            children: [
              new TextRun({ text: 'Sursa de finanțare: ', size: 22, font: 'Times New Roman', bold: true }),
              new TextRun({ text: data.budgetSource, size: 22, font: 'Times New Roman' })
            ],
            spacing: { after: 200 }
          })
        ] : []),

        new Paragraph({
          children: [new TextRun({ text: 'Vă mulțumesc,', size: 22, font: 'Times New Roman' })],
          spacing: { before: 200, after: 300 }
        }),

        // Signatures table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: 'Solicitant:', size: 20, font: 'Times New Roman' })] }),
                    new Paragraph({ children: [new TextRun({ text: data.requesterName, size: 22, font: 'Times New Roman', bold: true })] }),
                    new Paragraph({ children: [new TextRun({ text: data.department, size: 18, font: 'Times New Roman' })] }),
                    new Paragraph({ text: '' }),
                    new Paragraph({ children: [new TextRun({ text: data.employeeSignature ? '✓ SEMNAT ELECTRONIC' : '________________________', size: 20, font: 'Times New Roman', bold: !!data.employeeSignature })] }),
                    ...(data.employeeSignedAt ? [new Paragraph({ children: [new TextRun({ text: formatDate(data.employeeSignedAt), size: 18, font: 'Times New Roman' })] })] : [])
                  ],
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  width: { size: 50, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: 'Aprobat - Achiziții:', size: 20, font: 'Times New Roman' })], alignment: AlignmentType.CENTER }),
                    ...(data.approverName ? [new Paragraph({ children: [new TextRun({ text: data.approverName, size: 22, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER })] : []),
                    new Paragraph({ text: '' }),
                    new Paragraph({ children: [new TextRun({ text: data.approverSignature ? '✓ SEMNAT ELECTRONIC' : '________________________', size: 20, font: 'Times New Roman', bold: !!data.approverSignature })], alignment: AlignmentType.CENTER }),
                    ...(data.approverSignedAt ? [new Paragraph({ children: [new TextRun({ text: formatDate(data.approverSignedAt), size: 18, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })] : [])
                  ],
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  width: { size: 50, type: WidthType.PERCENTAGE }
                })
              ]
            })
          ]
        }),

        new Paragraph({ text: '', spacing: { after: 300 } }),

        // Status
        new Paragraph({
          children: [new TextRun({ text: '─'.repeat(80), size: 18, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ 
              text: data.status === 'approved' ? 'STATUS: APROBAT' : data.status === 'rejected' ? 'STATUS: RESPINS' : 'STATUS: ÎN AȘTEPTARE', 
              bold: true, 
              size: 28, 
              font: 'Times New Roman',
              color: data.status === 'approved' ? '008000' : data.status === 'rejected' ? 'FF0000' : 'FFA500'
            })
          ],
          alignment: AlignmentType.CENTER
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Referat_Necesitate_${data.requestNumber.replace(/\s+/g, '_')}_${formatDate(new Date().toISOString())}.docx`);
};
