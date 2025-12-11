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
  // Leave balance info
  totalLeaveDays?: number;
  remainingLeaveDays?: number;
  previousYearRemainingDays?: number;
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

        // HR paragraph with leave balance
        new Paragraph({
          children: [
            new TextRun({ text: '        La această dată dl./d-na ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.employeeName || '________________________', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' are dreptul la ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.totalLeaveDays?.toString() || '______', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' zile concediu de odihnă, din care ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.remainingLeaveDays?.toString() || '______', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' aferente anului ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.year || '______', size: 22, font: 'Times New Roman', bold: true }),
            new TextRun({ text: ' şi ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.previousYearRemainingDays?.toString() || '0', size: 22, font: 'Times New Roman', bold: true }),
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
  specifications?: string;
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
  directorName?: string;
  departmentHeadName?: string;
  cfpName?: string;
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
  
  // Calculate total with TVA (19%)
  const totalFaraTVA = data.items.reduce((sum, item) => sum + (item.quantity * item.estimatedPrice), 0);
  const totalCuTVA = totalFaraTVA * 1.19;

  // Create items table rows
  const itemRows = data.items.map((item, index) => {
    const priceWithVAT = item.estimatedPrice * 1.19;
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: (index + 1).toString(), size: 20, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })],
          width: { size: 6, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [
            new Paragraph({ children: [new TextRun({ text: item.name, size: 20, font: 'Times New Roman' })] }),
            ...(item.specifications ? [new Paragraph({ children: [new TextRun({ text: item.specifications, size: 16, font: 'Times New Roman', italics: true })] })] : [])
          ],
          width: { size: 34, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.unit, size: 20, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })],
          width: { size: 8, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.quantity.toString(), size: 20, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })],
          width: { size: 8, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.estimatedPrice.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), size: 20, font: 'Times New Roman' })], alignment: AlignmentType.RIGHT })],
          width: { size: 22, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: priceWithVAT.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), size: 20, font: 'Times New Roman' })], alignment: AlignmentType.RIGHT })],
          width: { size: 22, type: WidthType.PERCENTAGE }
        })
      ]
    });
  });

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
        // Code APR 002 - right aligned
        new Paragraph({
          children: [new TextRun({ text: 'Cod APR 002', size: 18, font: 'Times New Roman' })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 100 }
        }),

        // Institution Header
        new Paragraph({
          children: [new TextRun({ text: 'INSTITUTUL DE CHIMIE MACROMOLECULARĂ "PETRU PONI" IAȘI', bold: true, size: 24, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Compartiment Achiziții Publice', size: 20, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 }
        }),

        // Registration Number
        new Paragraph({
          children: [new TextRun({ text: `Nr. ${data.requestNumber}/${currentDate}`, size: 22, font: 'Times New Roman' })],
          spacing: { after: 300 }
        }),

        // APROBAT title
        new Paragraph({
          children: [new TextRun({ text: 'APROBAT:', bold: true, size: 24, underline: {}, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),

        // Three Column Approval Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'DIRECTOR,', size: 20, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER })],
                  width: { size: 33, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'ȘEF LABORATOR,', size: 20, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER })],
                  width: { size: 33, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'VIZAT,', size: 20, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER })],
                  width: { size: 34, type: WidthType.PERCENTAGE }
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: data.directorName || 'Dr. Valeria Harabagiu', size: 20, font: 'Times New Roman' })], alignment: AlignmentType.CENTER }),
                    ...(data.status === 'approved' ? [new Paragraph({ children: [new TextRun({ text: '✓ APROBAT', size: 18, font: 'Times New Roman', bold: true, color: '008000' })], alignment: AlignmentType.CENTER })] : [])
                  ],
                  width: { size: 33, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: data.departmentHeadName || data.approverName || '________________________', size: 20, font: 'Times New Roman' })], alignment: AlignmentType.CENTER }),
                    ...(data.approverSignature ? [
                      new Paragraph({ children: [new TextRun({ text: '✓ SEMNAT', size: 18, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER }),
                      ...(data.approverSignedAt ? [new Paragraph({ children: [new TextRun({ text: formatDate(data.approverSignedAt), size: 16, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })] : [])
                    ] : [])
                  ],
                  width: { size: 33, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: data.cfpName || 'Ec. Angelica - Elena Sacaleanu', size: 20, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })],
                  width: { size: 34, type: WidthType.PERCENTAGE }
                })
              ]
            })
          ]
        }),

        new Paragraph({ text: '', spacing: { after: 300 } }),

        // Title - REFERAT
        new Paragraph({
          children: [new TextRun({ text: 'REFERAT', bold: true, size: 32, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 }
        }),

        // Body intro
        new Paragraph({
          children: [
            new TextRun({ text: '        Subsemnat/a, ', size: 22, font: 'Times New Roman' }),
            new TextRun({ text: data.requesterName, size: 22, font: 'Times New Roman', bold: true }),
            ...(data.position ? [
              new TextRun({ text: ', având funcția de ', size: 22, font: 'Times New Roman' }),
              new TextRun({ text: data.position, size: 22, font: 'Times New Roman', bold: true })
            ] : []),
            new TextRun({ text: ', vă rog să binevoiți a aproba fondurile necesare achiziționării următoarelor produse:', size: 22, font: 'Times New Roman' })
          ],
          spacing: { line: 360, after: 200 }
        }),

        // Items table header row
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Nr. crt.', size: 18, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: 'E0E0E0' }, width: { size: 6, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Denumire și caracteristici tehnice', size: 18, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: 'E0E0E0' }, width: { size: 34, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'U/M', size: 18, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: 'E0E0E0' }, width: { size: 8, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Cant.', size: 18, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: 'E0E0E0' }, width: { size: 8, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Preț unitar fără TVA (lei)', size: 18, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: 'E0E0E0' }, width: { size: 22, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Preț unitar cu TVA (lei)', size: 18, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: 'E0E0E0' }, width: { size: 22, type: WidthType.PERCENTAGE } })
              ]
            }),
            // Column number row
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '(1)', size: 16, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })], width: { size: 6, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '(2)', size: 16, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })], width: { size: 34, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '(3)', size: 16, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })], width: { size: 8, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '(4)', size: 16, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })], width: { size: 8, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '(5)', size: 16, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })], width: { size: 22, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '(6)', size: 16, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })], width: { size: 22, type: WidthType.PERCENTAGE } })
              ]
            }),
            ...itemRows
          ]
        }),

        new Paragraph({ text: '', spacing: { after: 200 } }),

        // Totals - both without and with TVA
        new Paragraph({
          children: [new TextRun({ text: `TOTAL fără TVA: ${totalFaraTVA.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`, size: 22, font: 'Times New Roman', bold: true })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [new TextRun({ text: `TOTAL cu TVA (19%): ${totalCuTVA.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`, size: 22, font: 'Times New Roman', bold: true })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 200 }
        }),

        // Financing source
        new Paragraph({
          children: [new TextRun({ text: `Finanțarea se va face din ${data.budgetSource || 'venituri institut'}.`, size: 22, font: 'Times New Roman' })],
          spacing: { after: 200 }
        }),

        // Date
        new Paragraph({
          children: [new TextRun({ text: `Data: ${currentDate}`, size: 22, font: 'Times New Roman' })],
          spacing: { after: 300 }
        }),

        // Solicitant signature - right aligned
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [],
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  width: { size: 60, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: 'Solicitant,', size: 20, font: 'Times New Roman' })], alignment: AlignmentType.CENTER }),
                    new Paragraph({ text: '' }),
                    new Paragraph({ children: [new TextRun({ text: data.employeeSignature ? '✓ SEMNAT ELECTRONIC' : '________________________', size: 20, font: 'Times New Roman', bold: !!data.employeeSignature })], alignment: AlignmentType.CENTER }),
                    new Paragraph({ children: [new TextRun({ text: data.requesterName, size: 22, font: 'Times New Roman', bold: true })], alignment: AlignmentType.CENTER }),
                    ...(data.employeeSignedAt ? [new Paragraph({ children: [new TextRun({ text: formatDate(data.employeeSignedAt), size: 18, font: 'Times New Roman' })], alignment: AlignmentType.CENTER })] : [])
                  ],
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  width: { size: 40, type: WidthType.PERCENTAGE }
                })
              ]
            })
          ]
        }),

        // Status (only if approved or rejected)
        ...(data.status === 'approved' || data.status === 'rejected' ? [
          new Paragraph({ text: '', spacing: { after: 300 } }),
          new Paragraph({
            children: [new TextRun({ text: '─'.repeat(80), size: 18, font: 'Times New Roman' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ 
                text: data.status === 'approved' ? 'STATUS: APROBAT' : 'STATUS: RESPINS', 
                bold: true, 
                size: 28, 
                font: 'Times New Roman',
                color: data.status === 'approved' ? '008000' : 'FF0000'
              })
            ],
            alignment: AlignmentType.CENTER
          })
        ] : [])
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Referat_${data.requestNumber.replace(/[\/\s]+/g, '_')}_${formatDate(new Date().toISOString())}.docx`);
};
