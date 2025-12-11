import { format } from 'date-fns';

interface LeaveRequestDocumentProps {
  employeeName: string;
  position: string;
  department: string;
  numberOfDays: number;
  year: string;
  startDate: string;
  replacementName?: string;
  replacementPosition?: string;
  employeeSignature?: string | null;
  employeeSignedAt?: string | null;
  departmentHeadSignature?: string | null;
  departmentHeadSignedAt?: string | null;
  directorApproved?: boolean;
  hrOfficerName?: string;
  remainingDays?: number;
  remainingDaysCurrentYear?: number;
  remainingDaysPreviousYear?: number;
}

export function LeaveRequestDocument({
  employeeName,
  position,
  department,
  numberOfDays,
  year,
  startDate,
  replacementName,
  replacementPosition,
  employeeSignature,
  employeeSignedAt,
  departmentHeadSignature,
  departmentHeadSignedAt,
  directorApproved,
  hrOfficerName,
  remainingDays,
  remainingDaysCurrentYear,
  remainingDaysPreviousYear
}: LeaveRequestDocumentProps) {
  const currentDate = format(new Date(), 'dd.MM.yyyy');
  const formattedStartDate = startDate ? format(new Date(startDate), 'dd.MM.yyyy') : '____________';

  return (
    <div className="bg-white p-8 rounded-lg border shadow-sm text-black print:shadow-none print:border-none" style={{ fontFamily: 'Times New Roman, serif' }}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-3">
          <img 
            src="/logo-academia.png" 
            alt="Academia Română" 
            className="h-20 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        <p className="text-sm font-bold tracking-wide">ACADEMIA ROMÂNĂ</p>
        <p className="text-base font-bold mt-1">INSTITUTUL DE CHIMIE MACROMOLECULARĂ "PETRU PONI"</p>
        <p className="text-xs text-gray-600 mt-1">Aleea Grigore Ghica Voda, nr. 41A, 700487 IAȘI, ROMANIA</p>
      </div>

      {/* Anexa - right aligned */}
      <div className="text-right text-xs mb-6">
        <p className="italic">Anexa 11.2.-P.O. ICMPP-SRUS</p>
      </div>

      {/* Approval Section - two columns */}
      <div className="flex justify-between mb-8 px-4">
        <div className="text-center">
          <p className="text-sm mb-1">Se aprobă,</p>
          <p className="text-xs text-gray-600 mb-2">Aprobat, DIRECTOR</p>
          <div className="w-36 h-20 border-b-2 border-gray-400 flex items-end justify-center pb-1">
            {directorApproved && (
              <span className="text-green-700 text-sm font-semibold">✓ APROBAT</span>
            )}
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm mb-3">Șef compartiment</p>
          <div className="w-44 h-24 border-2 border-gray-300 rounded flex items-center justify-center overflow-hidden bg-gray-50">
            {departmentHeadSignature ? (
              <img src={departmentHeadSignature} alt="Semnătură șef" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-gray-400 text-xs italic">Așteaptă semnătură</span>
            )}
          </div>
          {departmentHeadSignedAt && (
            <p className="text-xs text-gray-500 mt-1">
              {format(new Date(departmentHeadSignedAt), 'dd.MM.yyyy HH:mm')}
            </p>
          )}
        </div>
      </div>

      {/* Title */}
      <h1 className="text-center text-xl font-bold mb-8 underline">Cerere concediu odihnă</h1>

      {/* Body */}
      <div className="space-y-6 text-sm leading-7 px-4">
        <p className="text-base">Doamnă/Domnule Director,</p>
        
        <p className="text-justify indent-8">
          Subsemnatul/a, <span className="font-semibold border-b border-black px-1">{employeeName || '________________________'}</span> în <span className="font-semibold border-b border-black px-1">{position || '________________________'}</span> cadrul <span className="font-semibold border-b border-black px-1">{department || '________________________'}</span> vă rog să-mi aprobaţi efectuarea unui număr de <span className="font-semibold border-b border-black px-1">{numberOfDays || '______'}</span> zile de concediu de odihnă aferente anului <span className="font-semibold border-b border-black px-1">{year || '______'}</span> începând cu data de <span className="font-semibold border-b border-black px-1">{formattedStartDate}</span>.
        </p>

        {(replacementName || replacementPosition) && (
          <p className="text-justify indent-8">
            În această perioadă voi fi înlocuit/ă de dl./d-na <span className="font-semibold border-b border-black px-1">{replacementName || '________________________'}</span> <span className="font-semibold border-b border-black px-1">{replacementPosition || '________________________'}</span>.
          </p>
        )}

        <p className="mt-6">Cu mulţumiri,</p>
      </div>

      {/* Employee Signature */}
      <div className="mt-8 flex justify-between items-end px-4">
        <div>
          <p className="text-sm font-semibold border-b border-black px-1 inline-block">{employeeName || '________________________'}</p>
        </div>
        <div className="text-center">
          <div className="w-44 h-24 border-2 border-gray-300 rounded flex items-center justify-center overflow-hidden bg-gray-50 mb-1">
            {employeeSignature ? (
              <img src={employeeSignature} alt="Semnătură angajat" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-gray-400 text-xs italic">Semnătura angajat</span>
            )}
          </div>
          <p className="text-xs">
            ({employeeSignedAt ? format(new Date(employeeSignedAt), 'dd.MM.yyyy') : currentDate}) (semnătura)
          </p>
        </div>
      </div>

      {/* HR Section */}
      <div className="mt-12 pt-6 border-t-2 border-dashed border-gray-400 px-4">
        <h2 className="font-bold text-base mb-4">Propunem să aprobaţi,</h2>
        
        <p className="text-justify text-sm leading-7">
          La această dată dl./d-na <span className="font-semibold border-b border-black px-1">{employeeName || '________________________'}</span> are dreptul la <span className="font-semibold border-b border-black px-1">{remainingDays ?? '______'}</span> zile concediu de odihnă, din care <span className="font-semibold border-b border-black px-1">{remainingDaysCurrentYear ?? '______'}</span> aferente anului <span className="font-semibold border-b border-black px-1">{year || '______'}</span> şi <span className="font-semibold border-b border-black px-1">{remainingDaysPreviousYear ?? '______'}</span> aferente anului <span className="font-semibold border-b border-black px-1">{parseInt(year || new Date().getFullYear().toString()) - 1}</span>.
        </p>

        <div className="flex justify-between items-end mt-8">
          <div>
            <p className="text-xs text-gray-600 mb-1">___________________</p>
            <p className="text-xs italic">(numele salariatului de la SRUS)</p>
            {hrOfficerName && <p className="mt-1 font-semibold text-sm">{hrOfficerName}</p>}
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600 mb-1">_______________</p>
            <p className="text-xs italic">(semnătura)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
