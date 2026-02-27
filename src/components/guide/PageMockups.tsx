import { Home, UserCircle, Calendar, FileText, FolderDown, Settings, HelpCircle, Bell, Search, Moon, Menu, ChevronRight, CheckSquare, Download, Edit, Eye } from 'lucide-react';

// Reusable mini-mockup wrapper
const MockupFrame = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border-2 border-border/60 bg-card overflow-hidden shadow-sm my-4 print:break-inside-avoid">
    <div className="bg-muted/50 border-b px-3 py-1.5 flex items-center gap-2">
      <div className="flex gap-1">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-400/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
      </div>
      <span className="text-[10px] text-muted-foreground font-medium ml-1">{title}</span>
    </div>
    <div className="p-3">{children}</div>
  </div>
);

// ─── SIDEBAR MOCKUP ───
export const SidebarMockup = () => (
  <MockupFrame title="Meniul principal (Sidebar)">
    <div className="flex gap-3">
      {/* Sidebar */}
      <div className="w-44 bg-muted/30 rounded-lg p-2 space-y-1 shrink-0 border border-border/40">
        <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold text-primary mb-2">
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
            <span className="text-[8px] font-bold text-primary">IC</span>
          </div>
          ICMPP Intranet
        </div>
        {[
          { icon: Home, label: 'Dashboard', active: true },
          { icon: UserCircle, label: 'Profilul Meu', active: false },
          { icon: Calendar, label: 'Calendar Concedii', active: false },
          { icon: FolderDown, label: 'Formulare', active: false },
          { icon: FileText, label: 'Cerere Concediu', active: false, badge: '2' },
          { icon: Settings, label: 'Setări', active: false },
          { icon: HelpCircle, label: 'Ghid Platformă', active: false },
        ].map(({ icon: Icon, label, active, badge }) => (
          <div key={label} className={`flex items-center gap-2 px-2 py-1.5 rounded text-[10px] ${active ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground'}`}>
            <Icon className="w-3 h-3 shrink-0" />
            <span className="truncate">{label}</span>
            {badge && <span className="ml-auto w-4 h-4 rounded-full bg-destructive text-white text-[8px] flex items-center justify-center">{badge}</span>}
          </div>
        ))}
      </div>
      {/* Content area */}
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 bg-muted rounded" />
        <div className="h-2 w-40 bg-muted/60 rounded" />
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 rounded-lg border border-border/40 bg-muted/20" />
          ))}
        </div>
      </div>
    </div>
    <p className="text-[10px] text-muted-foreground mt-2 italic">← Meniul din stânga. Badge-ul roșu „2" indică cereri de aprobat.</p>
  </MockupFrame>
);

// ─── HEADER MOCKUP ───
export const HeaderMockup = () => (
  <MockupFrame title="Bara de sus (Header)">
    <div className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2 border border-border/40">
      <div className="flex items-center gap-2">
        <Menu className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold">Dashboard</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 rounded text-[9px] text-muted-foreground">
          <Search className="w-3 h-3" /> Căutare... <kbd className="text-[8px] border rounded px-0.5 ml-1">Ctrl+K</kbd>
        </div>
        <div className="relative">
          <Bell className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-destructive text-white text-[7px] flex items-center justify-center">3</span>
        </div>
        <Moon className="w-3.5 h-3.5 text-muted-foreground" />
        <div className="w-5 h-5 rounded-full bg-primary/30" />
      </div>
    </div>
    <div className="flex gap-6 mt-2 text-[9px] text-muted-foreground">
      <span>← <strong>Căutare</strong>: Ctrl+K</span>
      <span>← <strong>Notificări</strong>: cifra roșie</span>
      <span>← <strong>Temă</strong>: soare/lună</span>
      <span>← <strong>Avatar</strong>: acces profil</span>
    </div>
  </MockupFrame>
);

// ─── DASHBOARD MOCKUP ───
export const DashboardMockup = () => (
  <MockupFrame title="Dashboard – Pagina principală">
    <div className="space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Zile disponibile', value: '18', color: 'text-emerald-600' },
          { label: 'Zile utilizate', value: '3', color: 'text-amber-600' },
          { label: 'Total drept', value: '21', color: 'text-primary' },
        ].map(c => (
          <div key={c.label} className="rounded-lg border border-border/40 bg-muted/10 p-2 text-center">
            <div className={`text-sm font-bold ${c.color}`}>{c.value}</div>
            <div className="text-[9px] text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>
      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2">
        {['Profilul Meu', 'Calendar', 'Formulare'].map(a => (
          <div key={a} className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-center">
            <div className="text-[9px] font-medium text-primary">{a}</div>
            <ChevronRight className="w-3 h-3 mx-auto text-primary/50 mt-0.5" />
          </div>
        ))}
      </div>
      {/* Calendar mini */}
      <div className="rounded-lg border border-border/40 bg-muted/10 p-2">
        <div className="text-[9px] font-medium mb-1">Calendar personal</div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className={`h-4 rounded text-[7px] flex items-center justify-center ${i === 5 || i === 6 || i === 12 || i === 13 ? 'bg-muted/50 text-muted-foreground/50' : i === 3 ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground'}`}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
    <p className="text-[10px] text-muted-foreground mt-2 italic">Cardurile de sus arată soldul, cele din mijloc acces rapid, jos calendarul personal.</p>
  </MockupFrame>
);

// ─── PROFILE MOCKUP ───
export const ProfileMockup = () => (
  <MockupFrame title="Profilul Meu">
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 p-2 rounded-lg border border-border/40 bg-muted/10">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center relative">
          <UserCircle className="w-6 h-6 text-primary/60" />
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
        </div>
        <div>
          <div className="text-xs font-semibold">Popescu Ion</div>
          <div className="text-[9px] text-muted-foreground">Cercetător | Lab. Polimeri Naturali</div>
        </div>
      </div>
      {/* Leave balance */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-1.5 text-center">
          <div className="text-xs font-bold text-emerald-600">18</div>
          <div className="text-[8px] text-muted-foreground">Disponibil</div>
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-1.5 text-center">
          <div className="text-xs font-bold text-amber-600">3</div>
          <div className="text-[8px] text-muted-foreground">Utilizat</div>
        </div>
        <div className="rounded border border-border bg-muted/10 p-1.5 text-center">
          <div className="text-xs font-bold">21</div>
          <div className="text-[8px] text-muted-foreground">Total</div>
        </div>
      </div>
      {/* Sections */}
      <div className="space-y-1.5">
        {['🪪 Date de Identitate', '💼 Info Profesionale', '👤 Aprobator Concediu', '📄 Documente', '📝 Istoric Concedii'].map(s => (
          <div key={s} className="flex items-center justify-between px-2 py-1.5 rounded border border-border/40 bg-muted/10 text-[9px]">
            <span>{s}</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </div>
        ))}
      </div>
    </div>
    <p className="text-[10px] text-muted-foreground mt-2 italic">Avatar cu punct verde = activ. Solduri concediu colorate. Secțiuni expandabile mai jos.</p>
  </MockupFrame>
);

// ─── LEAVE REQUEST MOCKUP ───
export const LeaveRequestMockup = () => (
  <MockupFrame title="Cerere de Concediu">
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/40 pb-1">
        {['Cerere Nouă', 'Cererile Mele', 'De Aprobat'].map((t, i) => (
          <div key={t} className={`px-2 py-1 rounded-t text-[9px] ${i === 0 ? 'bg-primary/10 text-primary font-semibold border-b-2 border-primary' : 'text-muted-foreground'}`}>
            {t}
            {t === 'De Aprobat' && <span className="ml-1 w-3 h-3 inline-flex items-center justify-center rounded-full bg-destructive text-white text-[7px]">2</span>}
          </div>
        ))}
      </div>
      {/* Form */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[8px] text-muted-foreground mb-0.5">Data început</div>
            <div className="px-2 py-1 rounded border border-border/40 bg-muted/10 text-[9px]">📅 01.03.2026</div>
          </div>
          <div>
            <div className="text-[8px] text-muted-foreground mb-0.5">Data sfârșit</div>
            <div className="px-2 py-1 rounded border border-border/40 bg-muted/10 text-[9px]">📅 05.03.2026</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-1.5 rounded bg-primary/5 border border-primary/20">
          <span className="text-[9px] font-medium text-primary">Zile lucrătoare calculate: 5</span>
        </div>
        <div>
          <div className="text-[8px] text-muted-foreground mb-0.5">Înlocuitor</div>
          <div className="px-2 py-1 rounded border border-border/40 bg-muted/10 text-[9px]">Ionescu Maria – Cercetător</div>
        </div>
        <div>
          <div className="text-[8px] text-muted-foreground mb-0.5">Semnătura electronică</div>
          <div className="h-10 rounded border border-dashed border-primary/30 bg-primary/5 flex items-center justify-center">
            <Edit className="w-3 h-3 text-primary/40" />
            <span className="text-[8px] text-primary/40 ml-1">Desenați aici</span>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="px-3 py-1.5 rounded bg-primary text-white text-[9px] font-medium">
            Trimite cererea
          </div>
        </div>
      </div>
    </div>
    <p className="text-[10px] text-muted-foreground mt-2 italic">Tab-urile de sus. Formular cu date, zile calculate automat, înlocuitor și semnătură.</p>
  </MockupFrame>
);

// ─── LEAVE CALENDAR MOCKUP ───
export const LeaveCalendarMockup = () => (
  <MockupFrame title="Calendar Concedii">
    <div className="space-y-2">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold">Martie 2026</span>
        <div className="flex gap-1">
          <div className="w-5 h-5 rounded border border-border/40 flex items-center justify-center text-[10px]">{'<'}</div>
          <div className="px-2 h-5 rounded bg-primary/10 flex items-center justify-center text-[9px] text-primary font-medium">Azi</div>
          <div className="w-5 h-5 rounded border border-border/40 flex items-center justify-center text-[10px]">{'>'}</div>
        </div>
      </div>
      {/* Grid */}
      <div className="border border-border/40 rounded overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-8 bg-muted/30">
          <div className="text-[7px] text-muted-foreground p-1 border-r border-border/20">Angajat</div>
          {['L1', 'M2', 'M3', 'J4', 'V5', 'S6', 'D7'].map((d, i) => (
            <div key={d} className={`text-[7px] text-center p-1 ${i >= 5 ? 'bg-muted/50 text-muted-foreground/50' : i === 2 ? 'bg-primary/10 font-bold text-primary' : 'text-muted-foreground'}`}>
              {d}
            </div>
          ))}
        </div>
        {/* Rows */}
        {[
          { name: 'Popescu I.', days: [false, true, true, true, false, false, false] },
          { name: 'Ionescu M.', days: [false, false, false, false, false, false, false] },
          { name: 'Dumitrescu A.', days: [true, true, true, true, true, false, false] },
        ].map(row => (
          <div key={row.name} className="grid grid-cols-8 border-t border-border/20">
            <div className="text-[7px] p-1 border-r border-border/20 truncate">{row.name}</div>
            {row.days.map((d, i) => (
              <div key={i} className={`h-5 ${i >= 5 ? 'bg-muted/30' : d ? 'bg-sky-400/30' : ''} ${i === 2 ? 'ring-1 ring-inset ring-primary/30' : ''}`} />
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex gap-3 text-[8px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-sky-400/30" /> CO</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-muted/50" /> Weekend</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm ring-1 ring-primary/30" /> Azi</span>
      </div>
    </div>
    <p className="text-[10px] text-muted-foreground mt-2 italic">Rând per angajat, coloană per zi. Albastru = concediu, gri = weekend, chenar = azi.</p>
  </MockupFrame>
);

// ─── FORMS PAGE MOCKUP ───
export const FormsMockup = () => (
  <MockupFrame title="Formulare și Modele">
    <div className="space-y-2">
      <div className="text-[10px] font-semibold">📁 Resurse Umane</div>
      {['Model cerere concediu.doc', 'Declarația persoanelor întreținute.doc'].map(f => (
        <div key={f} className="flex items-center justify-between px-2 py-1.5 rounded border border-border/40 bg-muted/10">
          <div className="flex items-center gap-2">
            <FileText className="w-3 h-3 text-primary" />
            <span className="text-[9px]">{f}</span>
          </div>
          <Download className="w-3 h-3 text-muted-foreground" />
        </div>
      ))}
      <div className="text-[10px] font-semibold mt-2">📁 Laborator</div>
      {['Fișă solicitare analize DSC.pdf', 'Fișe SPM.doc'].map(f => (
        <div key={f} className="flex items-center justify-between px-2 py-1.5 rounded border border-border/40 bg-muted/10">
          <div className="flex items-center gap-2">
            <FileText className="w-3 h-3 text-primary" />
            <span className="text-[9px]">{f}</span>
          </div>
          <Download className="w-3 h-3 text-muted-foreground" />
        </div>
      ))}
    </div>
    <p className="text-[10px] text-muted-foreground mt-2 italic">Click pe rând = descarcă automat. Organizate pe categorii.</p>
  </MockupFrame>
);

// ─── APPROVAL MOCKUP (for dept heads) ───
export const ApprovalMockup = () => (
  <MockupFrame title="Aprobare cereri (Șef departament)">
    <div className="space-y-2">
      {/* Pending request */}
      <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/10 p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-semibold">Popescu Ion – CO-2026-0015</div>
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-200/60 text-amber-800 dark:text-amber-200">Așteptare</span>
        </div>
        <div className="text-[8px] text-muted-foreground">01.03.2026 – 05.03.2026 (5 zile) | Înlocuitor: Ionescu M.</div>
        <div className="flex gap-1.5 mt-1">
          <div className="px-2 py-1 rounded bg-emerald-600 text-white text-[8px] font-medium flex items-center gap-1">
            <CheckSquare className="w-2.5 h-2.5" /> Aprobă
          </div>
          <div className="px-2 py-1 rounded bg-destructive text-white text-[8px] font-medium">Respinge</div>
          <div className="px-2 py-1 rounded border border-border/40 text-[8px] flex items-center gap-1">
            <Eye className="w-2.5 h-2.5" /> Detalii
          </div>
        </div>
      </div>
      {/* Signature */}
      <div>
        <div className="text-[8px] text-muted-foreground mb-0.5">Semnătura aprobatorului (obligatorie)</div>
        <div className="h-8 rounded border border-dashed border-primary/30 bg-primary/5 flex items-center justify-center">
          <Edit className="w-3 h-3 text-primary/40" />
        </div>
      </div>
    </div>
    <p className="text-[10px] text-muted-foreground mt-2 italic">Cererea în așteptare cu butoanele Aprobă/Respinge/Detalii și semnătura obligatorie.</p>
  </MockupFrame>
);

export { MockupFrame };
