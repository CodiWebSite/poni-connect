import { Document, Packer, Paragraph, TextRun, AlignmentType, TabStopType, TabStopPosition } from 'docx';
import { saveAs } from 'file-saver';
import { differenceInYears, differenceInMonths, parseISO, format } from 'date-fns';
import { ro } from 'date-fns/locale';

export type CertificateType = 'salariat' | 'venit' | 'vechime';

export interface EmployeeData {
  full_name: string;
  first_name: string;
  last_name: string;
  cnp: string;
  department: string | null;
  position: string | null;
  grade: string | null;
  employment_date: string;
  contract_type: string | null;
  // CI data
  ci_series?: string | null;
  ci_number?: string | null;
  ci_issued_by?: string | null;
  ci_issued_date?: string | null;
  // Address data
  address_street?: string | null;
  address_number?: string | null;
  address_block?: string | null;
  address_floor?: string | null;
  address_apartment?: string | null;
  address_city?: string | null;
  address_county?: string | null;
}

const FONT = 'Times New Roman';
const INSTITUTION_FULL = 'INSTITUTUL DE CHIMIE MACROMOLECULARĂ „PETRU PONI" IAȘI';
const INSTITUTION_NAME = 'Institutul de Chimie Macromoleculară „Petru Poni" Iași';
const INSTITUTION_ADDRESS = 'Aleea Grigore Ghica Vodă, nr. 41A';
const INSTITUTION_PHONE = 'Telefon: 0332-880.220 / 0332-880.050';
const INSTITUTION_EMAIL = 'Email: pponi@icmpp.ro';
const INSTITUTION_CF = 'CF 4541750';
const DEPARTMENT_LABEL = 'Serviciul Resurse Umane Salarizare';

function buildHeader(): Paragraph[] {
  return [
    // Institution name
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: INSTITUTION_FULL, bold: true, size: 24, font: FONT }),
      ],
    }),
    // Address
    new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: INSTITUTION_ADDRESS, size: 20, font: FONT })],
    }),
    // Phone
    new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: INSTITUTION_PHONE, size: 20, font: FONT })],
    }),
    // Email + CF
    new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: INSTITUTION_EMAIL, size: 20, font: FONT })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: INSTITUTION_CF, size: 20, font: FONT })],
    }),
    // Department
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: DEPARTMENT_LABEL, bold: true, italics: true, size: 24, font: FONT, color: '1F4E79' })],
    }),
    // Registration number / date
    new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: `Nr. _______ / ${format(new Date(), 'dd.MM.yyyy')}`, size: 22, font: FONT })],
    }),
  ];
}

function buildTitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 400 },
    children: [new TextRun({ text, bold: true, size: 28, font: FONT, underline: { type: 'single' } })],
  });
}

function buildSignatureSalariat(): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 600 }, children: [] }),
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: 'Reprezentant legal angajator/ Director,', size: 22, font: FONT }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: 'Șef Serviciu Resurse Umane Salarizare,', size: 22, font: FONT }),
      ],
    }),
    new Paragraph({ spacing: { before: 400 }, children: [] }),
    new Paragraph({
      children: [
        new TextRun({ text: '   Dr. ec. Ovidiu-Dragoș TOFAN', size: 22, font: FONT }),
      ],
    }),
  ];
}

function buildSignatureDirector(): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 600 }, children: [] }),
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: 'Director,', bold: true, size: 24, font: FONT }),
        new TextRun({ text: '\tȘef Serviciu Resurse Umane Salarizare,', bold: true, size: 24, font: FONT }),
      ],
    }),
    new Paragraph({
      spacing: { before: 600 },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: '___________________________', size: 22, font: FONT }),
        new TextRun({ text: '\tDr. ec. Ovidiu-Dragoș TOFAN', size: 22, font: FONT }),
      ],
    }),
  ];
}

function getGenderPrefix(cnp: string): { dl: string; angajat: string; } {
  const firstDigit = cnp?.[0];
  if (firstDigit === '2' || firstDigit === '4' || firstDigit === '6') {
    return { dl: 'doamna', angajat: 'angajată' };
  }
  return { dl: 'domnul', angajat: 'angajat' };
}

function buildCIText(emp: EmployeeData): string {
  const parts: string[] = [];
  if (emp.ci_series && emp.ci_number) {
    parts.push(`act de identitate ${emp.ci_series}, nr. ${emp.ci_number}`);
  }
  if (emp.ci_issued_by) {
    parts.push(`eliberat de ${emp.ci_issued_by}`);
  }
  if (emp.ci_issued_date) {
    parts.push(`la data de ${format(parseISO(emp.ci_issued_date), 'dd.MM.yyyy')}`);
  }
  return parts.length > 0 ? ', ' + parts.join(', ') : '';
}

function buildAddressText(emp: EmployeeData): string {
  const parts: string[] = [];
  if (emp.address_city) parts.push(`cu domiciliul în ${emp.address_city}`);
  if (emp.address_street) parts.push(emp.address_street);
  if (emp.address_number) parts.push(`nr. ${emp.address_number}`);
  if (emp.address_block) parts.push(`bl ${emp.address_block}`);
  if (emp.address_floor) parts.push(`et. ${emp.address_floor}`);
  if (emp.address_apartment) parts.push(`ap ${emp.address_apartment}`);
  if (emp.address_county) parts.push(`județul ${emp.address_county}`);
  return parts.length > 0 ? ', ' + parts.join(', ') : '';
}

function richParagraph(runs: TextRun[], opts?: { spacing?: number; indent?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] }): Paragraph {
  return new Paragraph({
    alignment: opts?.alignment ?? AlignmentType.JUSTIFIED,
    spacing: { after: opts?.spacing ?? 160 },
    indent: opts?.indent !== undefined ? { firstLine: opts.indent } : { firstLine: 720 },
    children: runs,
  });
}

function r(text: string, bold = false): TextRun {
  return new TextRun({ text, size: 24, font: FONT, bold });
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

function buildPurpose(purpose?: string): Paragraph[] {
  if (!purpose) return [];
  return [richParagraph([r(`Prezenta adeverință se eliberează spre a-i servi la: ${purpose}.`)], { spacing: 200 })];
}

// ============= ADEVERINȚĂ DE SALARIAT =============
function buildSalariatContent(emp: EmployeeData, purpose?: string): Paragraph[] {
  const { dl, angajat } = getGenderPrefix(emp.cnp);
  const ciText = buildCIText(emp);
  const addrText = buildAddressText(emp);

  return [
    ...buildHeader(),
    buildTitle('ADEVERINȚĂ DE SALARIAT'),
    richParagraph([
      r('Prin prezenta se certifică faptul că '),
      r(`${dl} `, false),
      r(`${emp.last_name.toUpperCase()} ${emp.first_name.toUpperCase()}`, true),
      r(', CNP '),
      r(emp.cnp, true),
      r(ciText),
      r(addrText),
      r(`, `),
      r(`este ${angajat} la ${INSTITUTION_NAME}.`, true),
    ]),
    richParagraph([
      r(`Funcția deținută: ${emp.position || '___________'}`),
      r(emp.grade ? `, gradul ${emp.grade}` : ''),
      r(`.`),
    ]),
    richParagraph([
      r(`Departamentul: ${emp.department || '___________'}.`),
    ]),
    richParagraph([
      r(`Încadrare pe bază de ${getContractText(emp)}, ` +
        `începând cu data de ${format(parseISO(emp.employment_date), 'dd.MM.yyyy')}.`),
    ]),
    ...buildPurpose(purpose),
    richParagraph([r('Prezenta adeverință s-a eliberat în conformitate cu prevederile legale în vigoare.')]),
    ...buildSignatureSalariat(),
  ];
}

// ============= ADEVERINȚĂ DE VENIT =============
function buildVenitContent(emp: EmployeeData, purpose?: string): Paragraph[] {
  const { dl, angajat } = getGenderPrefix(emp.cnp);
  const startDate = format(parseISO(emp.employment_date), 'dd.MM.yyyy');
  const ciText = buildCIText(emp);
  const addrText = buildAddressText(emp);

  return [
    ...buildHeader(),
    buildTitle('ADEVERINȚĂ DE VENIT'),
    richParagraph([
      r('Se adeverește prin prezenta că '),
      r(`${dl} `, false),
      r(`${emp.last_name.toUpperCase()} ${emp.first_name.toUpperCase()}`, true),
      r(', CNP '),
      r(emp.cnp, true),
      r(ciText),
      r(addrText),
      r(`, este ${angajat} al/a ${INSTITUTION_NAME} `),
      r(`începând cu data de ${startDate}, `),
      r(`în funcția de ${emp.position || '___________'}`),
      r(emp.grade ? `, gradul ${emp.grade}` : ''),
      r(`, în cadrul ${emp.department || '___________'}, `),
      r(`cu ${getContractText(emp)}.`),
    ]),
    richParagraph([
      r('Venitul brut lunar realizat de salariat/ă este de _______________ lei, ' +
        'iar venitul net lunar este de _______________ lei.'),
    ]),
    richParagraph([
      r('Salariatul/a nu are/are reținerile salariale prin: popriri, pensii alimentare sau ' +
        'alte obligații de plată în cuantum de _______________ lei/lună.'),
    ]),
    ...buildPurpose(purpose),
    richParagraph([r('Prezenta adeverință s-a eliberat în conformitate cu prevederile legale în vigoare.')]),
    ...buildSignatureDirector(),
  ];
}

// ============= ADEVERINȚĂ DE VECHIME =============
function buildVechimeContent(emp: EmployeeData, purpose?: string): Paragraph[] {
  const { dl } = getGenderPrefix(emp.cnp);
  const startDate = format(parseISO(emp.employment_date), 'dd.MM.yyyy');
  const seniority = getSeniorityText(emp);
  const ciText = buildCIText(emp);
  const addrText = buildAddressText(emp);

  return [
    ...buildHeader(),
    buildTitle('ADEVERINȚĂ DE VECHIME ÎN MUNCĂ'),
    richParagraph([
      r('Se adeverește prin prezenta că '),
      r(`${dl} `, false),
      r(`${emp.last_name.toUpperCase()} ${emp.first_name.toUpperCase()}`, true),
      r(', CNP '),
      r(emp.cnp, true),
      r(ciText),
      r(addrText),
      r(`, a fost/este angajat/ă al/a ${INSTITUTION_NAME}, `),
      r(`în funcția de ${emp.position || '___________'}`),
      r(emp.grade ? `, gradul ${emp.grade}` : ''),
      r(`, în cadrul ${emp.department || '___________'}.`),
    ]),
    richParagraph([
      r(`Activitatea în cadrul instituției a început la data de ${startDate}, ` +
        `cumulând o vechime de ${seniority} la data eliberării prezentei adeverințe.`),
    ]),
    richParagraph([r(`Încadrarea s-a realizat în baza unui ${getContractText(emp)}.`)]),
    ...buildPurpose(purpose),
    richParagraph([r('Prezenta adeverință s-a eliberat în conformitate cu prevederile legale în vigoare.')]),
    ...buildSignatureDirector(),
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
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1417 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `${filename}.docx`);
}
