// ─── Guide Data: Centru de Ajutor ICMPP ───

export type CategoryId = 'start' | 'roles' | 'modules' | 'workflows' | 'faq';

export interface GuideSection {
  title: string;
  paragraphs: string[];
  steps?: string[];
  tip?: string;
}

export interface GuideArticle {
  id: string;
  title: string;
  category: CategoryId;
  iconName: string;
  summary: string;
  roles?: string[];
  tags: string[];
  moduleLink?: string;
  relatedIds?: string[];
  sections: GuideSection[];
  irisPrompts?: string[];
}

export interface GuideCategory {
  id: CategoryId;
  label: string;
  iconName: string;
  description: string;
}

export const categories: GuideCategory[] = [
  { id: 'start', label: 'Începe de aici', iconName: 'Rocket', description: 'Primii pași pe platformă' },
  { id: 'roles', label: 'Ghid pe Rol', iconName: 'Users', description: 'Ce poți face în funcție de rolul tău' },
  { id: 'modules', label: 'Module Platformă', iconName: 'LayoutGrid', description: 'Documentație pentru fiecare modul' },
  { id: 'workflows', label: 'Fluxuri și Reguli', iconName: 'GitBranch', description: 'Cum funcționează aprobările și rutările' },
  { id: 'faq', label: 'Întrebări Frecvente', iconName: 'HelpCircle', description: 'Răspunsuri rapide la probleme comune' },
];

export const quickLinks = [
  { id: 'first-leave', label: 'Cum depun o cerere de concediu' },
  { id: 'update-profile', label: 'Cum îmi actualizez profilul' },
  { id: 'view-documents', label: 'Cum văd documentele mele' },
  { id: 'flow-leave', label: 'Cum funcționează aprobările' },
  { id: 'contact-it', label: 'Cum contactez suportul IT' },
  { id: 'check-notifications', label: 'Cum îmi verific notificările' },
];

// ═══════════════════════════════════════════════
// ARTICLES
// ═══════════════════════════════════════════════

export const articles: GuideArticle[] = [

  // ─── ÎNCEPE DE AICI ───────────────────────────

  {
    id: 'welcome',
    title: 'Bine ați venit pe platforma ICMPP',
    category: 'start',
    iconName: 'Home',
    summary: 'Prezentare generală a platformei și a funcționalităților disponibile.',
    tags: ['început', 'bine ați venit', 'prezentare', 'general'],
    relatedIds: ['first-leave', 'update-profile', 'mod-dashboard'],
    irisPrompts: ['Ce pot face pe platformă?', 'Care sunt modulele disponibile?'],
    sections: [
      {
        title: 'Ce este platforma ICMPP?',
        paragraphs: [
          'Platforma ICMPP Intranet este sistemul digital intern al Institutului de Chimie Macromoleculară „Petru Poni". Aceasta centralizează gestionarea concediilor, comunicarea internă, documentele, activitățile recreative și alte procese administrative.',
          'Accesul se face cu contul instituțional. Fiecare utilizator vede modulele și datele relevante pentru rolul său.',
        ],
      },
      {
        title: 'Ce puteți face',
        paragraphs: ['Pe platformă puteți:'],
        steps: [
          'Depune și urmări cereri de concediu de odihnă',
          'Vizualiza profilul personal, soldul de zile și documentele',
          'Comunica cu colegii prin mesageria internă',
          'Descărca formulare oficiale ale instituției',
          'Rezerva săli de ședință și spații comune',
          'Participa la activități recreative organizate de institut',
          'Consulta anunțurile oficiale ale conducerii',
        ],
      },
      {
        title: 'Primii pași',
        paragraphs: ['După autentificare, sunteți direcționat pe Dashboard – pagina principală. De acolo accesați rapid profilul, calendarul și formularele. Meniul din stânga (sidebar) conține toate secțiunile platformei.'],
        tip: 'La prima conectare, un tur interactiv vă va ghida prin funcționalitățile principale. Puteți relua turul oricând din Setări.',
      },
    ],
  },

  {
    id: 'first-leave',
    title: 'Cum depun o cerere de concediu',
    category: 'start',
    iconName: 'FileText',
    summary: 'Pașii pentru depunerea unei cereri de concediu de odihnă.',
    tags: ['concediu', 'cerere', 'depunere', 'odihnă', 'zile'],
    moduleLink: '/leave-request',
    relatedIds: ['flow-leave', 'mod-leave-request', 'faq-pending'],
    irisPrompts: ['Vreau să depun o cerere de concediu', 'Câte zile de concediu mai am?'],
    sections: [
      {
        title: 'Cum funcționează',
        paragraphs: ['Cererea de concediu se depune electronic și parcurge un flux de aprobare în două etape: Șef Departament → Ofițer SRUS (HR).'],
      },
      {
        title: 'Pașii principali',
        paragraphs: [],
        steps: [
          'Din meniu, accesați „Cerere Concediu" → tab „Cerere Nouă".',
          'Selectați data de început și data de sfârșit din calendar.',
          'Sistemul calculează automat zilele lucrătoare (exclude weekend-urile și sărbătorile).',
          'Completați numele și funcția persoanei care vă înlocuiește.',
          'Desenați semnătura electronică în câmpul dedicat.',
          'Apăsați „Trimite cererea". Cererea primește un număr unic (ex: CO-2026-0001).',
          'Urmăriți statusul din tab-ul „Cererile Mele".',
        ],
      },
      {
        title: 'Ce trebuie să știi',
        paragraphs: [
          'Sistemul verifică dacă aveți suficiente zile disponibile. Dacă soldul este insuficient, primiți un avertisment.',
          'După aprobarea completă, puteți descărca cererea ca document Word (.docx) cu toate semnăturile.',
        ],
        tip: 'Cererile în status „Ciornă" pot fi editate sau șterse. După trimitere, nu mai pot fi modificate.',
      },
    ],
  },

  {
    id: 'update-profile',
    title: 'Cum îmi actualizez profilul',
    category: 'start',
    iconName: 'UserCircle',
    summary: 'Ce date puteți modifica și cum funcționează pagina de profil.',
    tags: ['profil', 'date personale', 'avatar', 'telefon'],
    moduleLink: '/my-profile',
    relatedIds: ['mod-profile', 'mod-settings'],
    irisPrompts: ['Cum îmi schimb avatarul?', 'Unde îmi văd datele personale?'],
    sections: [
      {
        title: 'Ce puteți modifica',
        paragraphs: [
          'Din pagina „Profilul Meu" puteți vizualiza toate datele dvs. personale și profesionale. Avatarul poate fi schimbat trecând mouse-ul peste poza de profil.',
          'Din „Setări" puteți modifica numele afișat, telefonul și parola.',
        ],
      },
      {
        title: 'Date gestionate de HR',
        paragraphs: ['Datele de identitate (CNP, CI), departamentul, funcția și data angajării sunt gestionate exclusiv de compartimentul HR. Dacă observați o eroare, puteți solicita o corectare direct din profil.'],
        tip: 'Apăsați „Solicită corectare" din profilul dvs. pentru a trimite o cerere de corecție către HR.',
      },
    ],
  },

  {
    id: 'view-documents',
    title: 'Cum văd documentele mele',
    category: 'start',
    iconName: 'FolderDown',
    summary: 'Unde găsiți documentele personale și formularele oficiale.',
    tags: ['documente', 'formulare', 'descărcare', 'fișiere'],
    moduleLink: '/my-profile',
    relatedIds: ['mod-forms', 'mod-profile'],
    sections: [
      {
        title: 'Documente personale',
        paragraphs: ['Documentele asociate profilului dvs. (contracte, adeverințe etc.) se găsesc în secțiunea „Documente" din pagina „Profilul Meu". Apăsați butonul de descărcare pentru a salva un document.'],
      },
      {
        title: 'Formulare oficiale',
        paragraphs: ['Modelele oficiale de formulare (cereri, declarații, fișe laborator) sunt disponibile în secțiunea „Formulare" din meniu, organizate pe categorii. Apăsați pe orice formular pentru a-l descărca.'],
      },
    ],
  },

  {
    id: 'contact-it',
    title: 'Cum contactez suportul IT',
    category: 'start',
    iconName: 'Headset',
    summary: 'Trimiteți un tichet HelpDesk pentru probleme tehnice.',
    tags: ['helpdesk', 'suport', 'IT', 'tichet', 'problemă', 'contact'],
    relatedIds: ['faq-no-access', 'faq-no-page'],
    irisPrompts: ['Vreau să deschid un tichet IT', 'Am o problemă tehnică'],
    sections: [
      {
        title: 'Cum funcționează',
        paragraphs: ['În partea de jos a meniului (sidebar) găsiți butonul „Contact IT". Apăsați-l pentru a deschide formularul de HelpDesk.'],
      },
      {
        title: 'Pași',
        paragraphs: [],
        steps: [
          'Apăsați „Contact IT" din sidebar.',
          'Completați subiectul și descrierea problemei.',
          'Apăsați „Trimite".',
          'Echipa IT primește tichetul și vă va contacta.',
        ],
        tip: 'Descrieți problema cât mai detaliat – includeți ce pagină, ce acțiune ați încercat și ce mesaj de eroare ați primit.',
      },
    ],
  },

  {
    id: 'check-notifications',
    title: 'Cum îmi verific notificările',
    category: 'start',
    iconName: 'Bell',
    summary: 'Cum funcționează sistemul de notificări al platformei.',
    tags: ['notificări', 'clopoțel', 'alerte', 'mesaje'],
    relatedIds: ['mod-dashboard'],
    sections: [
      {
        title: 'Unde le găsiți',
        paragraphs: [
          'Notificările apar ca un badge roșu pe iconița clopoțelului din bara de sus a platformei. Cifra indică numărul de notificări necitite.',
          'Apăsați pe clopoțel pentru a vedea lista. Apăsați pe o notificare pentru detalii.',
        ],
      },
      {
        title: 'Ce notificări primiți',
        paragraphs: ['Cereri de concediu aprobate sau respinse, mesaje noi în chat, anunțuri noi, alerte de expirare documente și cereri de aprobare (pentru șefi).'],
        tip: 'Puteți marca notificările ca citite individual sau pe toate deodată.',
      },
    ],
  },

  // ─── GHID PE ROL ──────────────────────────────

  {
    id: 'role-employee',
    title: 'Ghid pentru Angajat',
    category: 'roles',
    iconName: 'User',
    summary: 'Ce poate face un angajat pe platformă și ce module sunt disponibile.',
    roles: ['user'],
    tags: ['angajat', 'user', 'rol', 'acces'],
    relatedIds: ['first-leave', 'update-profile', 'mod-dashboard', 'mod-profile'],
    irisPrompts: ['Ce pot face eu pe platformă?', 'Ce pagini am disponibile?'],
    sections: [
      {
        title: 'Ce puteți vedea',
        paragraphs: ['Ca angajat, aveți acces la: Dashboard, Profilul Meu, Calendar Concedii (departamentul propriu), Formulare, Cerere Concediu, Anunțuri, Mesagerie, Programări Săli, Activități Recreative, Setări și Ghid Platformă.'],
      },
      {
        title: 'Ce puteți face',
        paragraphs: [],
        steps: [
          'Depuneți cereri de concediu de odihnă.',
          'Vizualizați soldul de zile, documentele și istoricul.',
          'Comunicați cu colegii prin mesagerie.',
          'Descărcați formulare oficiale.',
          'Rezervați săli de ședință.',
          'Participați la activități recreative.',
          'Solicitați corectarea datelor personale.',
        ],
      },
      {
        title: 'Ce nu puteți face',
        paragraphs: ['Nu aveți acces la modulele administrative: Gestiune HR, Administrare, Inventar IT, Salarizare, Medicină Muncii, Changelog. Nu puteți aproba cereri, modifica datele altor angajați sau gestiona conturi.'],
      },
    ],
  },

  {
    id: 'role-dept-head',
    title: 'Ghid pentru Șef Departament',
    category: 'roles',
    iconName: 'UserCheck',
    summary: 'Responsabilitățile și funcționalitățile disponibile pentru șefii de departament.',
    roles: ['sef'],
    tags: ['șef', 'departament', 'aprobare', 'echipă'],
    relatedIds: ['flow-leave', 'mod-leave-request', 'role-employee'],
    moduleLink: '/leave-request',
    irisPrompts: ['Ce cereri am de aprobat?', 'Cum deleghez aprobarea?'],
    sections: [
      {
        title: 'Ce faceți în plus față de un angajat',
        paragraphs: ['Șefii de departament au toate funcționalitățile unui angajat plus acces la aprobarea cererilor de concediu și vizualizarea echipei.'],
      },
      {
        title: 'Responsabilități',
        paragraphs: [],
        steps: [
          'Aprobați sau respingeți cererile de concediu ale angajaților din departament.',
          'Semnați electronic cererile aprobate.',
          'Vizualizați echipa în pagina „Echipa Mea".',
          'Delegați dreptul de aprobare când sunteți indisponibil.',
          'Urmăriți istoricul aprobărilor în tab-ul „Centralizator".',
        ],
      },
      {
        title: 'Ce vedeți în plus',
        paragraphs: ['Badge pe meniu cu numărul cererilor în așteptare. Tab „De Aprobat" în Cerere Concediu. Tab „Centralizator" cu istoricul deciziilor. Tab „Înlocuitor" pentru delegare. Pagina „Echipa Mea".'],
        tip: 'Semnătura electronică este obligatorie pentru aprobare. Desenați-o cu mouse-ul sau pe ecranul tactil.',
      },
    ],
  },

  {
    id: 'role-hr',
    title: 'Ghid pentru HR (SRUS)',
    category: 'roles',
    iconName: 'ClipboardList',
    summary: 'Funcționalitățile complete pentru personalul HR/SRUS.',
    roles: ['hr', 'sef_srus'],
    tags: ['hr', 'srus', 'resurse umane', 'angajați', 'gestiune'],
    relatedIds: ['mod-hr', 'flow-leave', 'mod-leave-request'],
    moduleLink: '/hr-management',
    irisPrompts: ['Ce pot face în modulul HR?', 'Cum import angajați?'],
    sections: [
      {
        title: 'Ce puteți face',
        paragraphs: ['HR-ul gestionează integral datele angajaților, concediile, documentele și rapoartele. Modulul principal este „Gestiune HR".'],
      },
      {
        title: 'Funcționalități cheie',
        paragraphs: [],
        steps: [
          'Gestionarea tabelului de angajați cu toate datele personale și profesionale.',
          'Import/export date din fișiere Excel.',
          'Configurarea aprobatorilor de concediu (individual sau pe departament).',
          'Validarea finală a cererilor de concediu (etapa SRUS).',
          'Acordarea zilelor bonus și gestionarea reporturilor.',
          'Procesarea cererilor de adeverințe și corecții de date.',
          'Monitorizarea documentelor expirate (CI, fișe medicale).',
        ],
      },
      {
        title: 'Module relevante',
        paragraphs: ['Gestiune HR, Cerere Concediu (tab „Centralizare HR"), Calendar Concedii (toate departamentele), Echipa Mea, Medicină Muncii.'],
      },
    ],
  },

  {
    id: 'role-super-admin',
    title: 'Ghid pentru Super Admin',
    category: 'roles',
    iconName: 'Shield',
    summary: 'Control total al platformei – conturi, roluri, setări și monitorizare.',
    roles: ['super_admin'],
    tags: ['super admin', 'administrator', 'control', 'setări', 'conturi'],
    relatedIds: ['mod-admin', 'mod-inventory', 'flow-account'],
    moduleLink: '/admin',
    irisPrompts: ['Ce pot face ca Super Admin?', 'Cum creez un cont nou?'],
    sections: [
      {
        title: 'Ce înseamnă Super Admin',
        paragraphs: ['Super Admin este singurul rol cu acces total și permanent la toate modulele și funcționalitățile platformei. Nu există un rol generic „admin" – doar super_admin deține control complet.'],
      },
      {
        title: 'Responsabilități',
        paragraphs: [],
        steps: [
          'Gestionarea conturilor de utilizatori (creare, invitare, ștergere).',
          'Atribuirea și modificarea rolurilor.',
          'Configurarea setărilor platformei (mentenanță, mesaje, module).',
          'Gestionarea regulilor de acces (matrice de acces, fluxuri de aprobare, rutări cereri, notificări).',
          'Monitorizarea stării sistemului și a jurnalului de audit.',
          'Administrarea echipamentelor IT (Inventar IT).',
          'Vizualizarea feedback-ului IRIS și a statisticilor de adopție.',
          'Gestionarea publicatorilor de anunțuri și evenimente.',
        ],
      },
      {
        title: 'Module exclusive',
        paragraphs: ['Administrare (Centrul de Control), Inventar IT, Changelog, Stare Sistem, IRIS Feedback. Super Admin vede și toate modulele celorlalte roluri.'],
      },
    ],
  },

  {
    id: 'role-medical',
    title: 'Ghid pentru Medic Medicină Muncii',
    category: 'roles',
    iconName: 'Activity',
    summary: 'Gestionarea dosarelor medicale și a examenelor periodice.',
    roles: ['medic_medicina_muncii'],
    tags: ['medic', 'medicina muncii', 'fișe', 'examene', 'aptitudine'],
    relatedIds: ['mod-medical'],
    moduleLink: '/medicina-muncii',
    sections: [
      {
        title: 'Ce puteți face',
        paragraphs: [],
        steps: [
          'Vizualizați și editați dosarele medicale ale angajaților.',
          'Înregistrați consultații (de angajare, periodice, de control).',
          'Programați examene medicale obligatorii.',
          'Monitorizați valabilitatea fișelor de aptitudine.',
          'Atașați documente medicale (fișe, analize).',
          'Completați dosarul medical complet (antecedente, traseu profesional).',
        ],
      },
      {
        title: 'Dashboard dedicat',
        paragraphs: ['Pe Dashboard vedeți alerte specifice: fișe expirate, fișe care expiră în curând și statistici medicale.'],
      },
    ],
  },

  {
    id: 'role-operational',
    title: 'Ghid pentru roluri operaționale',
    category: 'roles',
    iconName: 'Briefcase',
    summary: 'Ce văd și ce fac rolurile specializate: Bibliotecar, Salarizare, Secretariat, Achiziții etc.',
    roles: ['bibliotecar', 'salarizare', 'secretariat', 'achizitii', 'contabilitate', 'oficiu_juridic', 'compartiment_comunicare'],
    tags: ['bibliotecar', 'salarizare', 'secretariat', 'achiziții', 'contabilitate', 'juridic', 'comunicare'],
    relatedIds: ['mod-library', 'mod-payroll'],
    sections: [
      {
        title: 'Ce înseamnă un rol operațional',
        paragraphs: ['Rolurile operaționale (Bibliotecar, Salarizare, Secretariat etc.) oferă acces la module specifice funcției, pe lângă funcționalitățile standard de angajat.'],
      },
      {
        title: 'Accesul pe rol',
        paragraphs: [
          '• Bibliotecar – acces la modulul Bibliotecă (catalogul de cărți și reviste).',
          '• Salarizare – acces la modulul Salarizare.',
          '• Secretariat – acces la module de documente și corespondență.',
          '• Achiziții – acces la procesele de achiziții.',
          '• Contabilitate – acces la operațiuni financiare.',
          '• Oficiu Juridic – consiliere juridică.',
          '• Compartiment Comunicare – relații publice.',
        ],
      },
      {
        title: 'Dashboard adaptat',
        paragraphs: ['Fiecare rol operațional vede un dashboard simplificat cu acces rapid la modulele relevante și notificările specifice.'],
      },
    ],
  },

  // ─── GHID PE MODULE ───────────────────────────

  {
    id: 'mod-dashboard',
    title: 'Dashboard',
    category: 'modules',
    iconName: 'Home',
    summary: 'Pagina principală cu statistici, acțiuni rapide și informații relevante.',
    tags: ['dashboard', 'pagina principală', 'acțiuni rapide', 'statistici'],
    moduleLink: '/',
    relatedIds: ['welcome', 'check-notifications'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Dashboard-ul este pagina principală a platformei, afișată la autentificare. Conținutul este adaptat rolului dvs.'],
      },
      {
        title: 'Ce conține',
        paragraphs: [
          '• Acțiuni rapide – Profilul Meu, Calendar Concedii, Formulare.',
          '• Sold concediu – inel de progres vizual cu zilele utilizate/disponibile.',
          '• Calendar personal – evenimentele lunii și zilele de concediu.',
          '• Widget meteo – temperatura curentă în Iași.',
          '• Utilizatori online – câți colegi sunt activi.',
          '• Anunțuri recente – ultimele comunicări oficiale.',
          '• Istoric activitate – ultimele dvs. acțiuni pe platformă.',
        ],
      },
      {
        title: 'Cine are acces',
        paragraphs: ['Toți utilizatorii autentificați. Rolurile administrative (super_admin, HR, sef_srus) văd și widget-uri suplimentare cu statistici de adopție și alerte.'],
      },
    ],
  },

  {
    id: 'mod-profile',
    title: 'Profilul Meu',
    category: 'modules',
    iconName: 'UserCircle',
    summary: 'Date personale, sold concediu, documente și istoric.',
    tags: ['profil', 'date personale', 'sold', 'documente', 'avatar'],
    moduleLink: '/my-profile',
    relatedIds: ['update-profile', 'view-documents', 'first-leave'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Pagina completă a profilului dvs. cu toate informațiile personale și profesionale.'],
      },
      {
        title: 'Secțiuni disponibile',
        paragraphs: [
          '• Header – nume, funcție, departament, email, telefon, avatar.',
          '• Sold concediu – zile disponibile, utilizate, total, report, bonus.',
          '• Date de identitate – CNP, CI, adresă (gestionate de HR).',
          '• Informații profesionale – departament, funcție, grad, data angajării.',
          '• Aprobator concediu – cine vă aprobă cererile.',
          '• Documente – documentele asociate profilului dvs.',
          '• Istoric concedii – toate cererile cu statusul fiecăreia.',
          '• Solicită corectare – formular pentru semnalarea erorilor în date.',
        ],
      },
      {
        title: 'Acțiuni posibile',
        paragraphs: ['Schimbarea avatarului (max 2MB, JPG/PNG), vizualizarea și descărcarea documentelor, solicitarea de corectări.'],
      },
    ],
  },

  {
    id: 'mod-leave-request',
    title: 'Cerere Concediu',
    category: 'modules',
    iconName: 'FileText',
    summary: 'Depunerea, urmărirea și aprobarea cererilor de concediu.',
    tags: ['concediu', 'cerere', 'aprobare', 'semnătură', 'docx'],
    moduleLink: '/leave-request',
    relatedIds: ['first-leave', 'flow-leave', 'flow-leave-statuses'],
    irisPrompts: ['Vreau să depun concediu', 'Care e statusul cererii mele?'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Modulul central pentru gestionarea concediilor de odihnă – depunere, urmărire și aprobare.'],
      },
      {
        title: 'Tab-uri disponibile',
        paragraphs: [
          '• Cerere Nouă – completarea și trimiterea unei cereri noi.',
          '• Cererile Mele – lista tuturor cererilor dvs. cu statusul curent.',
          '• De Aprobat – (doar șefi/aprobatori) cererile care necesită aprobarea dvs.',
          '• Centralizator – (șefi/HR) istoricul complet al aprobărilor.',
          '• Înlocuitor – (șefi) delegarea temporară a dreptului de aprobare.',
          '• Centralizare HR – (doar HR) toate cererile din institut.',
        ],
      },
      {
        title: 'Cine are acces',
        paragraphs: ['Toți angajații pot depune cereri. Șefii de departament și aprobatorii desemnați pot aproba. HR-ul validează final și vede toate cererile.'],
      },
    ],
  },

  {
    id: 'mod-leave-calendar',
    title: 'Calendar Concedii',
    category: 'modules',
    iconName: 'Calendar',
    summary: 'Vizualizarea concediilor colegilor într-un tabel lunar.',
    tags: ['calendar', 'concedii', 'departament', 'tabel', 'lunar'],
    moduleLink: '/leave-calendar',
    relatedIds: ['mod-leave-request', 'flow-leave'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Calendarul afișează concediile tuturor colegilor din departament într-un format vizual lunar.'],
      },
      {
        title: 'Cum funcționează',
        paragraphs: [
          'Pe desktop: tabel lunar cu un rând per angajat și o coloană per zi. Zilele de concediu sunt colorate conform tipului. Weekend-urile = gri, sărbătorile = roșu deschis, ziua de azi = evidențiată.',
          'Pe mobil: carduri per angajat cu perioadele de concediu listate.',
        ],
      },
      {
        title: 'Cine are acces',
        paragraphs: ['Angajații văd doar departamentul propriu. HR-ul și super_admin văd toate departamentele.'],
        tip: 'Navigați cu săgețile ← → între luni. Butonul „Azi" revine la luna curentă.',
      },
    ],
  },

  {
    id: 'mod-forms',
    title: 'Formulare',
    category: 'modules',
    iconName: 'FolderDown',
    summary: 'Modele oficiale de formulare descărcabile ale instituției.',
    tags: ['formulare', 'modele', 'descărcare', 'cereri', 'declarații', 'laborator'],
    moduleLink: '/formulare',
    relatedIds: ['view-documents'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Secțiunea cu toate modelele oficiale de formulare ale instituției, organizate pe categorii.'],
      },
      {
        title: 'Categorii disponibile',
        paragraphs: [
          '• Resurse Umane – cerere concediu, declarația persoanelor întreținute.',
          '• Declarații – declarație de avere, interese, contribuabil.',
          '• Deplasări – documente deplasări interne/externe, deconturi.',
          '• Laborator – fișe de solicitare analize (Digestor, DSC, AAS, TOC etc.).',
          '• Achiziții – referat produse.',
        ],
      },
      {
        title: 'Cine are acces',
        paragraphs: ['Toți angajații autentificați. Apăsați pe orice formular pentru descărcare automată.'],
      },
    ],
  },

  {
    id: 'mod-announcements',
    title: 'Anunțuri',
    category: 'modules',
    iconName: 'Megaphone',
    summary: 'Comunicări oficiale ale instituției cu atașamente și prioritizare.',
    tags: ['anunțuri', 'comunicări', 'oficial', 'pinned', 'atașamente'],
    moduleLink: '/announcements',
    relatedIds: ['mod-dashboard'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Pagina centralizează toate comunicările oficiale ale instituției.'],
      },
      {
        title: 'Funcționalități',
        paragraphs: [
          '• Anunțurile pot fi fixate (pinned) – apar mereu primele.',
          '• Fiecare anunț poate conține atașamente și link-uri.',
          '• Prioritizare vizuală: anunțurile urgente sunt evidențiate.',
          '• Publicatorii desemnați pot crea, edita și șterge anunțuri.',
        ],
      },
      {
        title: 'Cine are acces',
        paragraphs: ['Toți angajații pot vizualiza. Publicarea este restricționată la super_admin și utilizatorii adăugați ca publicatori de anunțuri.'],
      },
    ],
  },

  {
    id: 'mod-chat',
    title: 'Mesagerie (Chat)',
    category: 'modules',
    iconName: 'MessageCircle',
    summary: 'Chat intern cu suport pentru fișiere, reacții, căutare și status online.',
    tags: ['chat', 'mesagerie', 'mesaje', 'fișiere', 'online', 'reacții'],
    moduleLink: '/chat',
    relatedIds: ['check-notifications'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Sistemul de mesagerie internă pentru comunicare rapidă între colegi.'],
      },
      {
        title: 'Funcționalități',
        paragraphs: [
          '• Conversații directe cu orice coleg, organizate pe departamente.',
          '• Trimitere de imagini, video și documente (max 400 MB per fișier).',
          '• Status mesaje: ✓ trimis, ✓✓ livrat, ✓✓ albastru citit.',
          '• Reacții cu emoji pe mesaje.',
          '• Căutare în conversație cu evidențiere.',
          '• Status online/offline în timp real.',
          '• Notificări sonore la mesaje noi.',
          '• Panou „Media partajate" cu fișierele schimbate.',
        ],
      },
      {
        title: 'Cine are acces',
        paragraphs: ['Toți angajații autentificați.'],
        tip: 'Pe mobil, conversația se deschide pe ecran complet. Apăsați săgeata din stânga pentru a reveni la lista de conversații.',
      },
    ],
  },

  {
    id: 'mod-room-bookings',
    title: 'Programări Săli',
    category: 'modules',
    iconName: 'DoorOpen',
    summary: 'Rezervarea sălilor de ședință și spațiilor comune ale institutului.',
    tags: ['săli', 'programări', 'rezervare', 'ședință'],
    moduleLink: '/room-bookings',
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Modulul permite rezervarea sălilor de ședință și a spațiilor comune.'],
      },
      {
        title: 'Cum funcționează',
        paragraphs: [
          '• Vizualizare calendar – toate rezervările existente.',
          '• Rezervare nouă – selectați sala, data, intervalul orar și titlul.',
          '• Verificare disponibilitate – sistemul previne suprapunerile.',
          '• Puteți anula propriile rezervări. Administratorii gestionează toate.',
        ],
        tip: 'Rezervați cu cel puțin o zi înainte pentru a evita conflictele.',
      },
    ],
  },

  {
    id: 'mod-activities',
    title: 'Activități Recreative',
    category: 'modules',
    iconName: 'PartyPopper',
    summary: 'Evenimente sociale, sportive și culturale organizate de institut.',
    tags: ['activități', 'recreative', 'evenimente', 'sport', 'cultură', 'participare'],
    moduleLink: '/activitati',
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Secțiunea pentru activitățile sociale, sportive și culturale ale institutului.'],
      },
      {
        title: 'Funcționalități',
        paragraphs: [
          '• Lista activităților cu dată, locație și descriere.',
          '• Categorii: sport, cultură, social etc.',
          '• Confirmare/refuz participare la fiecare activitate.',
          '• Limită de participanți pentru unele activități.',
          '• Organizatorii desemnați pot crea și gestiona activități.',
        ],
      },
    ],
  },

  {
    id: 'mod-library',
    title: 'Bibliotecă',
    category: 'modules',
    iconName: 'BookOpen',
    summary: 'Catalogul de cărți și reviste al institutului.',
    tags: ['bibliotecă', 'cărți', 'reviste', 'împrumut', 'catalog'],
    moduleLink: '/library',
    roles: ['bibliotecar', 'super_admin'],
    relatedIds: ['role-operational'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Modulul Bibliotecă permite gestionarea catalogului de cărți și reviste.'],
      },
      {
        title: 'Funcționalități',
        paragraphs: [
          '• Căutare după titlu, autor sau cotă.',
          '• Status disponibilitate (disponibilă / împrumutată).',
          '• Înregistrare împrumuturi și returnări.',
          '• Istoric complet al fiecărui exemplar.',
        ],
      },
      {
        title: 'Cine are acces',
        paragraphs: ['Rolul bibliotecar și super_admin.'],
      },
    ],
  },

  {
    id: 'mod-medical',
    title: 'Medicină Muncii',
    category: 'modules',
    iconName: 'Activity',
    summary: 'Dosarele medicale, consultațiile și examenele obligatorii.',
    tags: ['medicină', 'muncii', 'fișe', 'aptitudine', 'consultații', 'examene'],
    moduleLink: '/medicina-muncii',
    roles: ['medic_medicina_muncii', 'hr', 'sef_srus', 'super_admin'],
    relatedIds: ['role-medical'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Modulul pentru gestionarea dosarelor medicale ale angajaților.'],
      },
      {
        title: 'Funcționalități',
        paragraphs: [
          '• Fișe medicale cu aptitudine, restricții și condiții cronice.',
          '• Consultații periodice, de angajare și de control.',
          '• Programarea examenelor medicale obligatorii.',
          '• Alertă automată la expirarea fișelor de aptitudine.',
          '• Atașare documente medicale.',
          '• Dosar medical complet (antecedente, traseu profesional).',
        ],
      },
      {
        title: 'Cine are acces',
        paragraphs: ['medic_medicina_muncii, hr, sef_srus, super_admin.'],
      },
    ],
  },

  {
    id: 'mod-archive',
    title: 'Arhivă Online',
    category: 'modules',
    iconName: 'Archive',
    summary: 'Documente instituționale arhivate conform nomenclatorului.',
    tags: ['arhivă', 'documente', 'nomenclator', 'retenție', 'scanări'],
    moduleLink: '/arhiva',
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Arhiva centralizează documentele instituționale conform nomenclatorului de arhivare.'],
      },
      {
        title: 'Funcționalități',
        paragraphs: [
          '• Categorii de nomenclator cu termen de retenție.',
          '• Asociere pe departamente.',
          '• Număr de înregistrare unic.',
          '• Fișiere digitale atașate (PDF, scanări).',
          '• Jurnal de acces pentru audit.',
        ],
      },
    ],
  },

  {
    id: 'mod-hr',
    title: 'Gestiune HR',
    category: 'modules',
    iconName: 'ClipboardList',
    summary: 'Centrul profesionist de administrare a personalului.',
    tags: ['hr', 'gestiune', 'angajați', 'import', 'export', 'aprobatori', 'dosare'],
    moduleLink: '/hr-management',
    roles: ['hr', 'sef_srus', 'super_admin'],
    relatedIds: ['role-hr'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Modulul central pentru gestionarea integrală a personalului.'],
      },
      {
        title: 'Zone funcționale',
        paragraphs: [
          '• Dashboard HR – KPI-uri, alerte prioritare.',
          '• Employee Hub – tabelul angajaților cu dosarul digital complet.',
          '• Ciclu de viață – onboarding, schimbare funcție, arhivare.',
          '• Calitate date – audit automat pentru inconsistențe.',
          '• Documente & Expirări – monitorizare CI, fișe medicale.',
          '• Cereri HR – inbox pentru adeverințe și corecții.',
          '• Aprobatori – configurare aprobatori per angajat sau departament.',
          '• Concedii – înregistrare manuală, zile bonus, reporturi.',
        ],
      },
      {
        title: 'Cine are acces',
        paragraphs: ['hr, sef_srus, super_admin.'],
      },
    ],
  },

  {
    id: 'mod-payroll',
    title: 'Salarizare',
    category: 'modules',
    iconName: 'Banknote',
    summary: 'Date salariale protejate pentru personalul autorizat.',
    tags: ['salarizare', 'salarii', 'date salariale'],
    moduleLink: '/salarizare',
    roles: ['salarizare', 'super_admin'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Modulul de Salarizare centralizează informațiile salariale ale angajaților.'],
      },
      {
        title: 'Cine are acces',
        paragraphs: ['Exclusiv rolul salarizare și super_admin. Datele sunt protejate și nu sunt vizibile altor utilizatori.'],
      },
    ],
  },

  {
    id: 'mod-inventory',
    title: 'Inventar IT',
    category: 'modules',
    iconName: 'Package',
    summary: 'Registrul echipamentelor IT cu software, locații și coduri QR.',
    tags: ['inventar', 'echipamente', 'IT', 'QR', 'software', 'asignare'],
    moduleLink: '/inventory',
    roles: ['super_admin'],
    relatedIds: ['role-super-admin'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Registrul complet al echipamentelor IT ale instituției.'],
      },
      {
        title: 'Funcționalități',
        paragraphs: [
          '• Catalogul echipamentelor – număr inventar, serie, model, categorie.',
          '• Asignare la angajați cu dată și locație (clădire, etaj, cameră).',
          '• Evidență software – SO, licențe, aplicații instalate.',
          '• Generare cod QR pentru identificare rapidă.',
          '• Istoric transferuri și modificări.',
          '• Import în lot din fișiere Excel.',
        ],
      },
    ],
  },

  {
    id: 'mod-settings',
    title: 'Setări',
    category: 'modules',
    iconName: 'Settings',
    summary: 'Personalizare temă, actualizare date și schimbare parolă.',
    tags: ['setări', 'temă', 'parolă', 'profil', 'aspect'],
    moduleLink: '/settings',
    relatedIds: ['update-profile'],
    sections: [
      {
        title: 'Ce conține',
        paragraphs: [
          '• Profilul meu – modificare nume, telefon.',
          '• Aspect (Temă) – luminos, întunecat sau automat (sistem).',
          '• Schimbare parolă – parolă nouă (minim 6 caractere).',
          '• Tour de prezentare – reporniți ghidul interactiv.',
        ],
      },
    ],
  },

  {
    id: 'mod-admin',
    title: 'Administrare (Centru de Control)',
    category: 'modules',
    iconName: 'Shield',
    summary: 'Gestionarea conturilor, rolurilor, setărilor și monitorizarea platformei.',
    tags: ['admin', 'administrare', 'conturi', 'roluri', 'setări', 'audit'],
    moduleLink: '/admin',
    roles: ['super_admin'],
    relatedIds: ['role-super-admin', 'flow-account'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['Centrul de Control al platformei – accesibil exclusiv super_admin.'],
      },
      {
        title: 'Tab-uri disponibile',
        paragraphs: [
          '• Setări Aplicație – mentenanță, mesaj homepage, module beta.',
          '• Conturi & Invitații – gestionare cereri de cont, invitații, creare manuală.',
          '• Utilizatori – vizualizarea și modificarea rolurilor tuturor utilizatorilor.',
          '• Pre-atribuire Roluri – setarea rolului înainte de înregistrare.',
          '• HelpDesk – vizualizare și rezolvare tichete suport.',
          '• Jurnal Audit – log-ul complet al acțiunilor din sistem.',
          '• Autentificări – log-ul conectărilor (IP, device, status).',
          '• Reguli Acces – matrice de acces, fluxuri aprobare, rutări, notificări.',
          '• Publicatori Anunțuri/Evenimente – desemnare utilizatori cu drept de publicare.',
          '• IRIS Feedback – evaluările și conversațiile cu asistentul AI.',
        ],
      },
    ],
  },

  {
    id: 'mod-iris',
    title: 'IRIS – Asistentul AI',
    category: 'modules',
    iconName: 'Sparkles',
    summary: 'Asistent inteligent pentru întrebări, acțiuni rapide și ghidare pe platformă.',
    tags: ['iris', 'AI', 'asistent', 'inteligent', 'chat', 'ajutor'],
    relatedIds: ['contact-it'],
    irisPrompts: ['Ce poți face pentru mine?', 'Ajută-mă să depun o cerere'],
    sections: [
      {
        title: 'Ce este',
        paragraphs: ['IRIS (Inteligență pentru Resurse Interne și Suport) este asistentul AI integrat în platformă, accesibil prin butonul plutitor din colțul din dreapta-jos.'],
      },
      {
        title: 'Ce poate face',
        paragraphs: [
          '• Răspunde la întrebări despre funcționalitățile platformei.',
          '• Verifică soldul de concediu.',
          '• Informează despre statusul cererilor.',
          '• Ghidează prin procese (depunere cereri, rezervări etc.).',
          '• Oferă sugestii contextuale bazate pe pagina curentă.',
          '• Poate iniția acțiuni (cerere concediu, tichet HelpDesk) cu confirmarea dvs.',
        ],
      },
      {
        title: 'Feedback',
        paragraphs: ['La închiderea conversației, puteți oferi un rating cu stele (1-5) și un comentariu. Feedback-ul ajută la îmbunătățirea continuă a asistentului.'],
        tip: 'Folosiți acțiunile rapide (butoanele de sub bara de input) pentru acces direct la cele mai comune funcționalități.',
      },
    ],
  },

  // ─── FLUXURI ȘI REGULI ────────────────────────

  {
    id: 'flow-leave',
    title: 'Fluxul de aprobare a concediului',
    category: 'workflows',
    iconName: 'GitBranch',
    summary: 'Cum parcurge o cerere de concediu etapele de aprobare.',
    tags: ['flux', 'aprobare', 'concediu', 'șef', 'srus', 'semnătură'],
    relatedIds: ['first-leave', 'mod-leave-request', 'flow-leave-statuses'],
    irisPrompts: ['Cum funcționează aprobarea concediului?', 'Cine îmi aprobă cererea?'],
    sections: [
      {
        title: 'Etapele fluxului',
        paragraphs: ['Cererea de concediu de odihnă parcurge obligatoriu 2 etape de aprobare:'],
        steps: [
          'Angajatul completează și trimite cererea (cu semnătură electronică).',
          'Cererea ajunge la Șeful de Departament (sau aprobatorul desemnat).',
          'Șeful aprobă (cu semnătură) sau respinge (cu motivul).',
          'Dacă este aprobată, cererea merge la Ofițerul SRUS (HR).',
          'SRUS validează final – cererea devine „Aprobată" și zilele se deduc din sold.',
        ],
      },
      {
        title: 'Notificări',
        paragraphs: ['Angajatul primește notificări la fiecare schimbare de status. Aprobatorul vede un badge pe meniu cu cererile în așteptare.'],
      },
      {
        title: 'Delegare',
        paragraphs: ['Șefii pot delega dreptul de aprobare unui coleg pe o perioadă definită (ex: în timpul propriului concediu). Delegarea se configurează din tab-ul „Înlocuitor".'],
      },
    ],
  },

  {
    id: 'flow-account',
    title: 'Fluxul cererii de cont',
    category: 'workflows',
    iconName: 'UserPlus',
    summary: 'Cum se creează un cont nou pe platformă.',
    tags: ['cont', 'creare', 'cerere', 'înregistrare', 'aprobare cont'],
    relatedIds: ['mod-admin', 'role-super-admin'],
    sections: [
      {
        title: 'Variante de creare cont',
        paragraphs: [
          '• Cerere de cont – utilizatorul completează formularul de pe pagina de autentificare. Cererea ajunge la Super Admin care o aprobă sau respinge.',
          '• Invitație – Super Admin trimite o invitație pe email. Destinatarul primește un link de activare.',
          '• Creare manuală – Super Admin creează contul direct din Centrul de Control.',
        ],
      },
      {
        title: 'Pre-atribuire roluri',
        paragraphs: ['Super Admin poate configura rolul unui angajat înainte ca acesta să-și creeze contul. La înregistrare, rolul se aplică automat.'],
      },
    ],
  },

  {
    id: 'flow-routing',
    title: 'Rutarea cererilor',
    category: 'workflows',
    iconName: 'Route',
    summary: 'Către cine ajung diferitele tipuri de cereri din platformă.',
    tags: ['rutare', 'cereri', 'destinatar', 'flux'],
    relatedIds: ['flow-leave', 'flow-account'],
    sections: [
      {
        title: 'Tipuri de cereri și destinatari',
        paragraphs: [
          '• Cerere concediu odihnă → Șef Departament → SRUS (HR).',
          '• Cerere creare cont → Super Admin.',
          '• Cerere adeverință (salariat, vechime, venit) → HR.',
          '• Cerere corecție date personale → HR.',
          '• Tichet HelpDesk → Super Admin / Echipa IT.',
          '• Cerere delegație / demisie → HR.',
        ],
      },
      {
        title: 'Configurare',
        paragraphs: ['Super Admin poate configura rutarea din Centrul de Control → tab „Reguli Acces" → Rutare Cereri.'],
      },
    ],
  },

  {
    id: 'flow-notifications',
    title: 'Reguli de notificare',
    category: 'workflows',
    iconName: 'Bell',
    summary: 'Ce notificări generează platforma și pentru cine.',
    tags: ['notificări', 'alerte', 'email', 'reguli'],
    relatedIds: ['check-notifications'],
    sections: [
      {
        title: 'Notificări automate',
        paragraphs: [
          '• Cerere concediu trimisă – notificare către aprobator.',
          '• Cerere aprobată/respinsă – notificare către angajat.',
          '• Mesaj nou în chat – sunet de notificare + badge.',
          '• Anunț nou publicat – notificare către toți angajații.',
          '• Document expirat (CI, fișă medicală) – alertă HR și angajat.',
          '• Tichet HelpDesk – notificare către echipa IT.',
        ],
      },
      {
        title: 'Configurare',
        paragraphs: ['Super Admin poate configura regulile de notificare din Centrul de Control → Reguli Acces → Reguli Notificare.'],
      },
    ],
  },

  {
    id: 'flow-leave-statuses',
    title: 'Statusurile cererilor de concediu',
    category: 'workflows',
    iconName: 'ListChecks',
    summary: 'Ce înseamnă fiecare status al unei cereri de concediu.',
    tags: ['status', 'concediu', 'cerere', 'pending', 'aprobat', 'respins'],
    relatedIds: ['flow-leave', 'first-leave', 'faq-pending'],
    sections: [
      {
        title: 'Lista statusurilor',
        paragraphs: [
          '• Ciornă – cererea nu a fost încă trimisă. Poate fi editată sau ștearsă.',
          '• Așteptare Șef Departament – cererea a fost trimisă și așteaptă aprobarea șefului.',
          '• Așteptare SRUS – cererea a fost aprobată de șef și așteaptă validarea HR.',
          '• Aprobată – cererea a fost aprobată complet. Zilele au fost deduse din sold.',
          '• Respinsă – cererea a fost refuzată. Motivul este vizibil în detaliile cererii.',
        ],
      },
    ],
  },

  {
    id: 'flow-roles-access',
    title: 'Roluri și vizibilitate',
    category: 'workflows',
    iconName: 'Eye',
    summary: 'Ce module vede fiecare rol și cum funcționează accesul.',
    tags: ['roluri', 'vizibilitate', 'acces', 'permisiuni', 'matrice'],
    relatedIds: ['role-employee', 'role-super-admin'],
    sections: [
      {
        title: 'Principii de acces',
        paragraphs: [
          'Fiecare pagină/modul din platformă este protejat printr-o matrice de acces configurabilă. Super Admin controlează ce roluri văd ce pagini.',
          'super_admin este singurul rol cu bypass global – vede tot, indiferent de matrice.',
          'Rolul generic „admin" nu mai există. Toate privilegiile administrative sunt sub super_admin.',
        ],
      },
      {
        title: 'Roluri personalizate',
        paragraphs: ['Pe lângă rolurile de bază, Super Admin poate crea roluri personalizate (ex: Responsabil Proiecte) cu permisiuni specifice în matricea de acces. Drepturile sunt cumulative.'],
      },
      {
        title: 'Ierarhia principală',
        paragraphs: [
          '• super_admin – acces total permanent.',
          '• director_institut / director_adjunct / secretar_stiintific – conducere.',
          '• sef_srus – HR + aprobări finale concedii.',
          '• sef – aprobări concedii departament.',
          '• hr – gestiune angajați.',
          '• Roluri operaționale (bibliotecar, salarizare etc.) – acces specific.',
          '• user – angajat standard.',
        ],
      },
    ],
  },

  {
    id: 'flow-delegation',
    title: 'Delegarea aprobării',
    category: 'workflows',
    iconName: 'UserCheck',
    summary: 'Cum delegați dreptul de aprobare a concediilor când sunteți indisponibil.',
    tags: ['delegare', 'înlocuitor', 'aprobare', 'concediu', 'temporar'],
    relatedIds: ['flow-leave', 'role-dept-head'],
    moduleLink: '/leave-request',
    sections: [
      {
        title: 'Cum funcționează',
        paragraphs: ['Când sunteți indisponibil, puteți transfera temporar dreptul de aprobare către un coleg.'],
        steps: [
          'Accesați „Cerere Concediu" → tab „Înlocuitor".',
          'Selectați colegul care va prelua aprobarea.',
          'Setați perioada (data de început și sfârșit).',
          'Opțional, adăugați un motiv.',
          'Apăsați „Activează delegarea".',
        ],
      },
      {
        title: 'Ce trebuie să știi',
        paragraphs: ['Delegatul vede cererile departamentului dvs. pe durata setată. Delegarea expiră automat. Puteți anula manual oricând.'],
      },
    ],
  },

  // ─── ÎNTREBĂRI FRECVENTE ──────────────────────

  {
    id: 'faq-no-page',
    title: 'De ce nu văd o anumită pagină?',
    category: 'faq',
    iconName: 'EyeOff',
    summary: 'Paginile sunt vizibile doar pentru rolurile autorizate.',
    tags: ['acces', 'pagină', 'lipsă', 'nu văd', 'vizibilitate'],
    relatedIds: ['flow-roles-access', 'contact-it'],
    sections: [
      {
        title: 'Cauza',
        paragraphs: ['Fiecare pagină din platformă este configurată cu o matrice de acces. Dacă rolul dvs. nu include acea pagină, ea nu apare în meniu.'],
      },
      {
        title: 'Ce puteți face',
        paragraphs: ['Verificați cu Super Admin dacă rolul dvs. trebuie să aibă acces la acea pagină. Dacă aveți un rol personalizat, permisiunile sunt cumulative cu rolul principal.'],
      },
    ],
  },

  {
    id: 'faq-no-access',
    title: 'De ce nu am acces la un modul?',
    category: 'faq',
    iconName: 'Lock',
    summary: 'Accesul la module este restricționat pe bază de rol.',
    tags: ['acces', 'modul', 'restricție', 'rol'],
    relatedIds: ['flow-roles-access', 'faq-no-page'],
    sections: [
      {
        title: 'Explicație',
        paragraphs: [
          'Platforma restricționează accesul pe bază de rol. Module precum Gestiune HR, Inventar IT sau Salarizare sunt accesibile doar rolurilor dedicate.',
          'Contactați Super Admin sau echipa IT dacă considerați că aveți nevoie de acces suplimentar.',
        ],
      },
    ],
  },

  {
    id: 'faq-pending',
    title: 'De ce cererea mea e în așteptare?',
    category: 'faq',
    iconName: 'Clock',
    summary: 'Cererea parcurge etapele obligatorii de aprobare.',
    tags: ['cerere', 'așteptare', 'pending', 'aprobare', 'status'],
    relatedIds: ['flow-leave', 'flow-leave-statuses'],
    sections: [
      {
        title: 'Explicație',
        paragraphs: [
          'Cererea de concediu parcurge 2 etape obligatorii: 1. Aprobarea de către Șeful de Departament. 2. Validarea finală de către SRUS.',
          'Dacă cererea rămâne mult timp în așteptare, este posibil ca aprobatorul să nu fi vizualizat-o încă. Puteți verifica cine vă este aprobator din profilul dvs.',
        ],
      },
    ],
  },

  {
    id: 'faq-approver',
    title: 'Cine îmi aprobă cererea?',
    category: 'faq',
    iconName: 'UserCheck',
    summary: 'Aprobatorul poate fi individual sau la nivel de departament.',
    tags: ['aprobator', 'cerere', 'cine', 'aprobare'],
    relatedIds: ['flow-leave', 'mod-profile'],
    sections: [
      {
        title: 'Răspuns',
        paragraphs: [
          'Aprobatorul dvs. este vizibil în secțiunea „Aprobator Concediu" din profilul dvs.',
          'Poate fi un aprobator individual (desemnat special pentru dvs.) sau la nivel de departament (pentru tot departamentul).',
          'Dacă nu vedeți niciun aprobator, contactați HR.',
        ],
      },
    ],
  },

  {
    id: 'faq-leave-days',
    title: 'Unde văd zilele de concediu?',
    category: 'faq',
    iconName: 'Calendar',
    summary: 'Soldul de concediu este afișat pe Dashboard și în Profil.',
    tags: ['zile', 'concediu', 'sold', 'disponibil', 'utilizat'],
    relatedIds: ['mod-profile', 'mod-dashboard'],
    sections: [
      {
        title: 'Răspuns',
        paragraphs: [
          'Soldul de zile este vizibil în două locuri: 1. Pe Dashboard – inelul de progres din cardul de concediu. 2. În Profilul Meu – secțiunea detaliată cu zile disponibile, utilizate, total, report și bonus.',
        ],
      },
    ],
  },

  {
    id: 'faq-documents',
    title: 'Cum verific documentele mele?',
    category: 'faq',
    iconName: 'FileSearch',
    summary: 'Documentele personale sunt disponibile în profilul dvs.',
    tags: ['documente', 'verificare', 'descărcare', 'profil'],
    relatedIds: ['view-documents', 'mod-profile'],
    sections: [
      {
        title: 'Răspuns',
        paragraphs: ['Accesați „Profilul Meu" → secțiunea „Documente". De acolo puteți vizualiza și descărca documentele asociate profilului dvs. (contracte, adeverințe etc.).'],
      },
    ],
  },

  {
    id: 'faq-account-request',
    title: 'Cui se trimite o cerere de cont?',
    category: 'faq',
    iconName: 'UserPlus',
    summary: 'Cererile de cont ajung la Super Admin pentru aprobare.',
    tags: ['cont', 'cerere', 'înregistrare', 'aprobare'],
    relatedIds: ['flow-account'],
    sections: [
      {
        title: 'Răspuns',
        paragraphs: ['Cererile de creare cont (din formularul de pe pagina de autentificare) ajung la Super Admin. Acesta le aprobă sau respinge din Centrul de Control → tab „Conturi".'],
      },
    ],
  },

  {
    id: 'faq-super-admin',
    title: 'Ce face Super Admin?',
    category: 'faq',
    iconName: 'Shield',
    summary: 'Super Admin are control total asupra platformei.',
    tags: ['super admin', 'administrator', 'control', 'rol'],
    relatedIds: ['role-super-admin'],
    sections: [
      {
        title: 'Răspuns',
        paragraphs: [
          'Super Admin este singurul rol cu acces total și permanent la platforma ICMPP. Gestionează conturile, rolurile, setările, regulile de acces, echipamentele și monitorizează starea sistemului.',
          'Rolul generic „admin" nu mai există. Toate privilegiile administrative sunt centralizate sub super_admin.',
        ],
      },
    ],
  },

  {
    id: 'faq-activities',
    title: 'Cum funcționează activitățile recreative?',
    category: 'faq',
    iconName: 'PartyPopper',
    summary: 'Participarea la evenimente organizate de institut.',
    tags: ['activități', 'recreative', 'participare', 'evenimente'],
    relatedIds: ['mod-activities'],
    sections: [
      {
        title: 'Răspuns',
        paragraphs: ['Accesați „Activități Recreative" din meniu. Vedeți lista evenimentelor cu data, locația și descrierea. Puteți confirma sau refuza participarea. Unele activități au un număr limitat de locuri.'],
      },
    ],
  },
];

// ═══════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════

export function searchArticles(query: string): GuideArticle[] {
  if (!query.trim()) return articles;
  const q = query.toLowerCase().trim();
  return articles.filter(a =>
    a.title.toLowerCase().includes(q) ||
    a.summary.toLowerCase().includes(q) ||
    a.tags.some(t => t.toLowerCase().includes(q)) ||
    a.sections.some(s =>
      s.title.toLowerCase().includes(q) ||
      s.paragraphs.some(p => p.toLowerCase().includes(q)) ||
      (s.steps && s.steps.some(st => st.toLowerCase().includes(q)))
    )
  );
}

export function getArticlesByCategory(cat: CategoryId): GuideArticle[] {
  return articles.filter(a => a.category === cat);
}

export function getArticleById(id: string): GuideArticle | undefined {
  return articles.find(a => a.id === id);
}

export function getRelatedArticles(article: GuideArticle): GuideArticle[] {
  if (!article.relatedIds) return [];
  return article.relatedIds
    .map(id => articles.find(a => a.id === id))
    .filter(Boolean) as GuideArticle[];
}

export function getArticlesForRole(role: string): GuideArticle[] {
  return articles.filter(a => !a.roles || a.roles.length === 0 || a.roles.includes(role));
}
