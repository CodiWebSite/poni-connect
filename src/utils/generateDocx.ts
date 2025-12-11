import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

interface LeaveRequestData {
  employeeName: string;
  department: string;
  position: string;
  numberOfDays: number;
  year: string;
  startDate: string;
  endDate: string;
  replacementName?: string;
  replacementPosition?: string;
  employeeSignature?: string;
  departmentHeadSignature?: string;
  status: string;
}

export const generateLeaveRequestDocx = async (data: LeaveRequestData) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Header
        new Paragraph({
          children: [
            new TextRun({
              text: 'INSTITUTUL DE CHIMIE MACROMOLECULARĂ',
              bold: true,
              size: 28
            })
          ],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: '"PETRU PONI" IAȘI',
              bold: true,
              size: 28
            })
          ],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Aleea Grigore Ghica Vodă nr. 41A, 700487 Iași, România',
              size: 20
            })
          ],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Tel: +40 232 217454; Fax: +40 232 211299',
              size: 20
            })
          ],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Title
        new Paragraph({
          children: [
            new TextRun({
              text: 'CERERE CONCEDIU DE ODIHNĂ',
              bold: true,
              size: 32
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),

        new Paragraph({ text: '' }),

        // Body
        new Paragraph({
          children: [
            new TextRun({ text: 'Subsemnatul(a) ', size: 24 }),
            new TextRun({ text: data.employeeName, bold: true, size: 24 }),
            new TextRun({ text: ', având funcția de ', size: 24 }),
            new TextRun({ text: data.position, bold: true, size: 24 }),
            new TextRun({ text: ' în cadrul ', size: 24 }),
            new TextRun({ text: data.department, bold: true, size: 24 }),
            new TextRun({ text: ', vă rog să-mi aprobați efectuarea concediului de odihnă pe anul ', size: 24 }),
            new TextRun({ text: data.year, bold: true, size: 24 }),
            new TextRun({ text: ' în număr de ', size: 24 }),
            new TextRun({ text: data.numberOfDays.toString(), bold: true, size: 24 }),
            new TextRun({ text: ' zile lucrătoare, în perioada ', size: 24 }),
            new TextRun({ text: `${formatDate(data.startDate)} - ${formatDate(data.endDate)}`, bold: true, size: 24 }),
            new TextRun({ text: '.', size: 24 })
          ],
          spacing: { line: 360, after: 200 }
        }),

        new Paragraph({ text: '' }),

        // Replacement info if provided
        ...(data.replacementName ? [
          new Paragraph({
            children: [
              new TextRun({ text: 'În perioada absenței mele, atribuțiile vor fi preluate de ', size: 24 }),
              new TextRun({ text: data.replacementName, bold: true, size: 24 }),
              new TextRun({ text: data.replacementPosition ? `, ${data.replacementPosition}` : '', size: 24 }),
              new TextRun({ text: '.', size: 24 })
            ],
            spacing: { line: 360, after: 200 }
          })
        ] : []),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Date and signatures
        new Paragraph({
          children: [
            new TextRun({ text: `Data: ${formatDate(new Date().toISOString())}`, size: 24 })
          ],
          spacing: { after: 400 }
        }),

        new Paragraph({ text: '' }),

        // Signature section
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
                      children: [new TextRun({ text: 'Semnătura angajat:', size: 24 })],
                      alignment: AlignmentType.LEFT
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: data.employeeSignature ? '✓ Semnat electronic' : '________________', size: 24 })],
                      alignment: AlignmentType.LEFT
                    })
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE }
                  }
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: 'Aprobat Șef Compartiment:', size: 24 })],
                      alignment: AlignmentType.RIGHT
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: data.departmentHeadSignature ? '✓ Aprobat' : '________________', size: 24 })],
                      alignment: AlignmentType.RIGHT
                    })
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE }
                  }
                })
              ]
            })
          ]
        }),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Status
        ...(data.status === 'approved' ? [
          new Paragraph({
            children: [
              new TextRun({ text: 'STATUS: APROBAT', bold: true, size: 28, color: '008000' })
            ],
            alignment: AlignmentType.CENTER
          })
        ] : data.status === 'rejected' ? [
          new Paragraph({
            children: [
              new TextRun({ text: 'STATUS: RESPINS', bold: true, size: 28, color: 'FF0000' })
            ],
            alignment: AlignmentType.CENTER
          })
        ] : [
          new Paragraph({
            children: [
              new TextRun({ text: 'STATUS: ÎN AȘTEPTARE', bold: true, size: 28, color: 'FFA500' })
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
        const isHeader = line.includes('INSTITUT') || line.includes('ADEVERINȚĂ') || line.includes('ORDIN') || line.includes('CERERE');
        const isBold = line.startsWith('-') || line.includes(':');
        
        return new Paragraph({
          children: [
            new TextRun({
              text: line,
              bold: isHeader || isBold,
              size: isHeader ? 28 : 24
            })
          ],
          alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { line: 360, after: 100 }
        });
      })
    }]
  });

  const blob = await Packer.toBlob(doc);
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  saveAs(blob, `${documentType}_${employeeName.replace(/\s+/g, '_')}_${formatDate(new Date().toISOString())}.docx`);
};
