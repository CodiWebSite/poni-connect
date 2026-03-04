// Centralized leave/absence type definitions
// Based on institutional legend (pontaj)

export interface LeaveTypeConfig {
  key: string;
  label: string;
  description: string;
  color: string;       // tailwind text color
  colorDark: string;   // tailwind dark text color
  bg: string;          // tailwind bg with opacity
  bgSolid: string;     // tailwind solid bg for calendar cells
  deductible: boolean; // whether it deducts from leave balance
}

export const LEAVE_TYPES: LeaveTypeConfig[] = [
  { key: 'co',  label: 'CO',  description: 'Concediu de odihnă',          color: 'text-sky-700',     colorDark: 'dark:text-sky-300',     bg: 'bg-sky-500/20',     bgSolid: 'bg-sky-100 dark:bg-sky-900/40',       deductible: true },
  { key: 'cm',  label: 'CM',  description: 'Concediu medical',            color: 'text-rose-700',    colorDark: 'dark:text-rose-300',    bg: 'bg-rose-500/20',    bgSolid: 'bg-rose-100 dark:bg-rose-900/40',     deductible: false },
  { key: 'cfp', label: 'CFP', description: 'Concediu fără plată',         color: 'text-amber-700',   colorDark: 'dark:text-amber-300',   bg: 'bg-amber-500/20',   bgSolid: 'bg-amber-100 dark:bg-amber-900/40',   deductible: false },
  { key: 'ccc', label: 'CCC', description: 'Concediu creștere copil',     color: 'text-purple-700',  colorDark: 'dark:text-purple-300',  bg: 'bg-purple-500/20',  bgSolid: 'bg-purple-100 dark:bg-purple-900/40', deductible: false },
  { key: 'ev',  label: 'EV',  description: 'Eveniment deosebit',          color: 'text-emerald-700', colorDark: 'dark:text-emerald-300', bg: 'bg-emerald-500/20', bgSolid: 'bg-emerald-100 dark:bg-emerald-900/40', deductible: false },
  { key: 'md',  label: 'MD',  description: 'Muncă la domiciliu',          color: 'text-teal-700',    colorDark: 'dark:text-teal-300',    bg: 'bg-teal-500/20',    bgSolid: 'bg-teal-100 dark:bg-teal-900/40',     deductible: false },
  { key: 'i',   label: 'I',   description: 'Învoiri și concedii fără salariu', color: 'text-orange-700', colorDark: 'dark:text-orange-300', bg: 'bg-orange-500/20', bgSolid: 'bg-orange-100 dark:bg-orange-900/40', deductible: false },
  { key: 'prb', label: 'PRB', description: 'Program redus boală',         color: 'text-red-700',     colorDark: 'dark:text-red-300',     bg: 'bg-red-500/20',     bgSolid: 'bg-red-100 dark:bg-red-900/40',       deductible: false },
  { key: 'l',   label: 'L',   description: 'Zile libere plătite',         color: 'text-cyan-700',    colorDark: 'dark:text-cyan-300',    bg: 'bg-cyan-500/20',    bgSolid: 'bg-cyan-100 dark:bg-cyan-900/40',     deductible: false },
  { key: 'n',   label: 'N',   description: 'Ore de noapte',               color: 'text-indigo-700',  colorDark: 'dark:text-indigo-300',  bg: 'bg-indigo-500/20',  bgSolid: 'bg-indigo-100 dark:bg-indigo-900/40', deductible: false },
  { key: 'm',   label: 'M',   description: 'Maternitate',                 color: 'text-pink-700',    colorDark: 'dark:text-pink-300',    bg: 'bg-pink-500/20',    bgSolid: 'bg-pink-100 dark:bg-pink-900/40',     deductible: false },
  { key: 'cs',  label: 'CS',  description: 'Contract suspendat',          color: 'text-slate-700',   colorDark: 'dark:text-slate-300',   bg: 'bg-slate-500/20',   bgSolid: 'bg-slate-100 dark:bg-slate-900/40',   deductible: false },
  { key: 'd',   label: 'D',   description: 'Ore deplasare',               color: 'text-lime-700',    colorDark: 'dark:text-lime-300',    bg: 'bg-lime-500/20',    bgSolid: 'bg-lime-100 dark:bg-lime-900/40',     deductible: false },
  { key: 'cd',  label: 'CD',  description: 'Condiții muncă',              color: 'text-yellow-700',  colorDark: 'dark:text-yellow-300',  bg: 'bg-yellow-500/20',  bgSolid: 'bg-yellow-100 dark:bg-yellow-900/40', deductible: false },
  { key: 'nm',  label: 'Nm',  description: 'Absențe nemotivate',          color: 'text-red-800',     colorDark: 'dark:text-red-200',     bg: 'bg-red-600/20',     bgSolid: 'bg-red-200 dark:bg-red-900/40',       deductible: false },
  { key: 'prm', label: 'PRM', description: 'Program redus maternitate',   color: 'text-fuchsia-700', colorDark: 'dark:text-fuchsia-300', bg: 'bg-fuchsia-500/20', bgSolid: 'bg-fuchsia-100 dark:bg-fuchsia-900/40', deductible: false },
];

// Build lookup maps for quick access
export const LEAVE_TYPE_MAP: Record<string, LeaveTypeConfig> = {};
for (const lt of LEAVE_TYPES) {
  LEAVE_TYPE_MAP[lt.key] = lt;
}
// Legacy aliases
LEAVE_TYPE_MAP['bo'] = LEAVE_TYPE_MAP['cm'];
LEAVE_TYPE_MAP['concediu_odihna'] = LEAVE_TYPE_MAP['co'];
LEAVE_TYPE_MAP['concediu_medical'] = LEAVE_TYPE_MAP['cm'];
LEAVE_TYPE_MAP['concediu_fara_plata'] = LEAVE_TYPE_MAP['cfp'];
LEAVE_TYPE_MAP['concediu_crestere_copil'] = LEAVE_TYPE_MAP['ccc'];
LEAVE_TYPE_MAP['eveniment'] = LEAVE_TYPE_MAP['ev'];

export function getLeaveStyle(leaveType?: string) {
  if (!leaveType) return LEAVE_TYPE_MAP['co'];
  return LEAVE_TYPE_MAP[leaveType.toLowerCase().trim()] || LEAVE_TYPE_MAP['co'];
}

export const NON_DEDUCTIBLE_TYPES = LEAVE_TYPES.filter(t => !t.deductible).map(t => t.key);
