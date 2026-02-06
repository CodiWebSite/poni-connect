import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, convertInchesToTwip } from 'docx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

interface ProcurementItem {
  name: string;
  specifications?: string;
  unit: string;
  quantity: number;
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
  directorName?: string;
  departmentHeadName?: string;
  cfpName?: string;
  status: string;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '____________';
  const date = new Date(dateStr);
  return format(date, 'dd.MM.yyyy');
};

export const generateProcurementDocx = async (data: ProcurementRequestData) => {
  const currentDate = formatDate(data.createdAt);
  
  const totalFaraTVA = data.items.reduce((sum, item) => sum + (item.quantity * item.estimatedPrice), 0);
  const totalCuTVA = totalFaraTVA * 1.19;

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
        new Paragraph({
          children: [new TextRun({ text: 'Cod APR 002', size: 18, font: 'Times New Roman' })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 100 }
        }),
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
        new Paragraph({
          children: [new TextRun({ text: `Nr. ${data.requestNumber}/${currentDate}`, size: 22, font: 'Times New Roman' })],
          spacing: { after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'APROBAT:', bold: true, size: 24, underline: {}, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),
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
        new Paragraph({
          children: [new TextRun({ text: 'REFERAT', bold: true, size: 32, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 }
        }),
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
        new Paragraph({
          children: [new TextRun({ text: `Finanțarea se va face din ${data.budgetSource || 'venituri institut'}.`, size: 22, font: 'Times New Roman' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: `Data: ${currentDate}`, size: 22, font: 'Times New Roman' })],
          spacing: { after: 300 }
        }),
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
