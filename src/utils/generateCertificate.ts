import { Document, Packer, Paragraph, TextRun, AlignmentType, TabStopType, TabStopPosition } from 'docx';
import { saveAs } from 'file-saver';
import { differenceInYears, differenceInMonths, parseISO, format } from 'date-fns';
import { ro } from 'date-fns/locale';

export type CertificateType = 'salariat' | 'venit' | 'vechime';

interface EmployeeData {
  full_name: string;
  first_name: string;
  last_name: string;
  cnp: string;
  department: string | null;
  position: string | null;
  grade: string | null;
  employment_date: string;
  contract_type: string | null;
}

const INSTITUTION_NAME = 'Institutul de Chimie Macromoleculară „Petru Poni"';
const INSTITUTION_SHORT = 'ICMPP';
const INSTITUTION_ADDRESS = 'Aleea Grigore Ghica Vodă nr. 41A, 700487 Iași';

function buildHeader(): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: INSTITUTION_NAME, bold: true, size: 24, font: 'Times New Roman' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: INSTITUTION_ADDRESS, size: 20, font: 'Times New Roman', color: '555555' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: `Nr. _______ / ${format(new Date(), 'dd.MM.yyyy')}`, size: 22, font: 'Times New Roman' })],
    }),
  ];
}

function buildTitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 400 },
    children: [new TextRun({ text, bold: true, size: 32, font: 'Times New Roman' })],
  });
}

function bodyParagraph(text: string, opts?: { spacing?: number; indent?: number }): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: opts?.spacing ?? 160 },
    indent: opts?.indent !== undefined ? { firstLine: opts.indent } : { firstLine: 720 },
    children: [new TextRun({ text, size: 24, font: 'Times New Roman' })],
  });
}

function getSeniorityText(emp: EmployeeData): string {
  const now = new Date();
  const start = parseISO(emp.employment_date);
  const years = differenceInYears(now, start);
  const months = differenceInMonths(now, start) % 12;
  return `${years} ani și ${months} luni`;
}

function getContractText(emp: EmployeeData): string {
  return emp.contract_type === 'determinat'
    ? 'contract individual de muncă pe durată determinată'
    : 'contract individual de muncă pe durată nedeterminată';
}

function buildSignature(): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 600 }, children: [] }),
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: 'Director,', bold: true, size: 24, font: 'Times New Roman' }),
        new TextRun({ text: '\tȘef Serviciu Resurse Umane,', bold: true, size: 24, font: 'Times New Roman' }),
      ],
    }),
    new Paragraph({
      spacing: { before: 600 },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: '___________________________', size: 22, font: 'Times New Roman' }),
        new TextRun({ text: '\t___________________________', size: 22, font: 'Times New Roman' }),
      ],
    }),
  ];
}

function buildPurpose(purpose?: string): Paragraph[] {
  if (!purpose) return [];
  return [
    bodyParagraph(`Prezenta adeverință se eliberează spre a-i servi la: ${purpose}.`, { spacing: 200 }),
  ];
}

function buildSalariatContent(emp: EmployeeData, purpose?: string): Paragraph[] {
  const startDate = format(parseISO(emp.employment_date), 'dd.MM.yyyy');
  return [
    ...buildHeader(),
    buildTitle('ADEVERINȚĂ'),
    bodyParagraph(
      `Se adeverește prin prezenta că dl./dna. ${emp.full_name}, CNP ${emp.cnp}, ` +
      `este angajat/ă al/a ${INSTITUTION_NAME}, ` +
      `având funcția de ${emp.position || '___________'}` +
      `${emp.grade ? `, gradul ${emp.grade}` : ''}, ` +
      `în cadrul ${emp.department || '___________'}.`
    ),
    bodyParagraph(
      `Angajatul/a desfășoară activitate în baza unui ${getContractText(emp)}, ` +
      `începând cu data de ${startDate}.`
    ),
    ...buildPurpose(purpose),
    bodyParagraph('Prezenta adeverință s-a eliberat în conformitate cu dispozițiile legale în vigoare.'),
    ...buildSignature(),
  ];
}

function buildVenitContent(emp: EmployeeData, purpose?: string): Paragraph[] {
  const startDate = format(parseISO(emp.employment_date), 'dd.MM.yyyy');
  return [
    ...buildHeader(),
    buildTitle('ADEVERINȚĂ DE VENIT'),
    bodyParagraph(
      `Se adeverește prin prezenta că dl./dna. ${emp.full_name}, CNP ${emp.cnp}, ` +
      `este angajat/ă al/a ${INSTITUTION_NAME} ` +
      `începând cu data de ${startDate}, ` +
      `în funcția de ${emp.position || '___________'}` +
      `${emp.grade ? `, gradul ${emp.grade}` : ''}, ` +
      `în cadrul ${emp.department || '___________'}, ` +
      `cu ${getContractText(emp)}.`
    ),
    bodyParagraph(
      'Venitul brut lunar realizat de salariat/ă este de _______________ lei, ' +
      'iar venitul net lunar este de _______________ lei.'
    ),
    bodyParagraph(
      'Salariatul/a nu are/are reținerile salariale prin: popriri, pensii alimentare sau ' +
      'alte obligații de plată în cuantum de _______________ lei/lună.'
    ),
    ...buildPurpose(purpose),
    bodyParagraph('Prezenta adeverință s-a eliberat în conformitate cu dispozițiile legale în vigoare.'),
    ...buildSignature(),
  ];
}

function buildVechimeContent(emp: EmployeeData, purpose?: string): Paragraph[] {
  const startDate = format(parseISO(emp.employment_date), 'dd.MM.yyyy');
  const seniority = getSeniorityText(emp);
  return [
    ...buildHeader(),
    buildTitle('ADEVERINȚĂ DE VECHIME ÎN MUNCĂ'),
    bodyParagraph(
      `Se adeverește prin prezenta că dl./dna. ${emp.full_name}, CNP ${emp.cnp}, ` +
      `a fost/este angajat/ă al/a ${INSTITUTION_NAME}, ` +
      `în funcția de ${emp.position || '___________'}` +
      `${emp.grade ? `, gradul ${emp.grade}` : ''}, ` +
      `în cadrul ${emp.department || '___________'}.`
    ),
    bodyParagraph(
      `Activitatea în cadrul instituției a început la data de ${startDate}, ` +
      `cumulând o vechime de ${seniority} la data eliberării prezentei adeverințe.`
    ),
    bodyParagraph(
      `Încadrarea s-a realizat în baza unui ${getContractText(emp)}.`
    ),
    ...buildPurpose(purpose),
    bodyParagraph('Prezenta adeverință s-a eliberat în conformitate cu dispozițiile legale în vigoare.'),
    ...buildSignature(),
  ];
}

export async function generateCertificateDocx(emp: EmployeeData, type: CertificateType, purpose?: string) {
  let children: Paragraph[];
  let filename: string;

  switch (type) {
    case 'salariat':
      children = buildSalariatContent(emp, purpose);
      filename = `Adeverinta_Salariat_${emp.last_name}_${emp.first_name}`;
      break;
    case 'venit':
      children = buildVenitContent(emp, purpose);
      filename = `Adeverinta_Venit_${emp.last_name}_${emp.first_name}`;
      break;
    case 'vechime':
      children = buildVechimeContent(emp, purpose);
      filename = `Adeverinta_Vechime_${emp.last_name}_${emp.first_name}`;
      break;
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1417 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `${filename}.docx`);
}
