import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

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
    <div className="bg-white p-6 rounded-lg border shadow-sm text-black font-serif text-sm leading-relaxed">
      {/* Header */}
      <div className="text-center mb-6">
        <img 
          src="/logo-academia.png" 
          alt="Academia Română" 
          className="h-16 mx-auto mb-2"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <p className="text-xs font-bold">ACADEMIA ROMÂNĂ</p>
        <p className="text-sm font-bold mt-1">INSTITUTUL DE CHIMIE MACROMOLECULARĂ "PETRU PONI"</p>
        <p className="text-xs text-gray-600">Aleea Grigore Ghica Voda, nr. 41A, 700487 IAȘI, ROMANIA</p>
      </div>

      {/* Anexa */}
      <div className="text-right text-xs mb-4">
        <p className="font-semibold">Anexa 11.2.-P.O. ICMPP-SRUS</p>
      </div>

      {/* Approval Section */}
      <div className="flex justify-between mb-8">
        <div className="text-center">
          <p className="font-semibold mb-2">Se aprobă,</p>
          <p className="text-xs text-gray-600">Aprobat, DIRECTOR</p>
          <div className="w-32 h-16 border-b border-dashed border-gray-400 mt-2 flex items-end justify-center">
            {directorApproved && <span className="text-green-600 text-xs mb-1">✓ Aprobat</span>}
          </div>
        </div>
        <div className="text-center">
          <p className="font-semibold mb-2">Șef compartiment</p>
          <div className="w-40 h-20 border rounded flex items-center justify-center overflow-hidden">
            {departmentHeadSignature ? (
              <img src={departmentHeadSignature} alt="Semnătură șef" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-gray-400 text-xs">Nesemnat</span>
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
      <h1 className="text-center text-lg font-bold mb-6">Cerere concediu odihnă</h1>

      {/* Body */}
      <div className="space-y-4">
        <p>Doamnă/Domnule Director,</p>
        
        <p className="text-justify">
          Subsemnatul/a, <strong className="underline">{employeeName || '________________________'}</strong> în{' '}
          <strong className="underline">{position || '________________________'}</strong> cadrul{' '}
          <strong className="underline">{department || '________________________'}</strong> vă rog să-mi aprobaţi 
          efectuarea unui număr de <strong className="underline">{numberOfDays || '______'}</strong> zile de concediu 
          de odihnă aferente anului <strong className="underline">{year || '______'}</strong> începând cu data de{' '}
          <strong className="underline">{formattedStartDate}</strong>.
        </p>

        {(replacementName || replacementPosition) && (
          <p className="text-justify">
            În această perioadă voi fi înlocuit/ă de dl./d-na{' '}
            <strong className="underline">{replacementName || '________________________'}</strong>{' '}
            <strong className="underline">{replacementPosition || '________________________'}</strong>.
          </p>
        )}

        <p>Cu mulţumiri,</p>
      </div>

      {/* Employee Signature */}
      <div className="mt-8 flex justify-between items-end">
        <div>
          <p className="font-semibold">{employeeName || '________________________'}</p>
        </div>
        <div className="text-center">
          <div className="w-40 h-20 border rounded flex items-center justify-center overflow-hidden mb-1">
            {employeeSignature ? (
              <img src={employeeSignature} alt="Semnătură angajat" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-gray-400 text-xs">Semnătura angajat</span>
            )}
          </div>
          <p className="text-xs">
            ({employeeSignedAt ? format(new Date(employeeSignedAt), 'dd.MM.yyyy') : currentDate})
          </p>
        </div>
      </div>

      {/* HR Section */}
      <div className="mt-10 pt-6 border-t border-dashed">
        <h2 className="font-bold mb-4">Propunem să aprobaţi,</h2>
        
        <p className="text-justify mb-4">
          La această dată dl./d-na <strong className="underline">{employeeName || '________________________'}</strong> are 
          dreptul la <strong className="underline">{remainingDays ?? '______'}</strong> zile concediu de odihnă, 
          din care <strong className="underline">{remainingDaysCurrentYear ?? '______'}</strong> aferente 
          anului <strong className="underline">{year || '______'}</strong> şi{' '}
          <strong className="underline">{remainingDaysPreviousYear ?? '______'}</strong> aferente 
          anului <strong className="underline">{parseInt(year || new Date().getFullYear().toString()) - 1}</strong>.
        </p>

        <div className="flex justify-between items-end mt-6">
          <div>
            <p className="text-xs text-gray-600">___________________</p>
            <p className="text-xs">(numele salariatului de la SRUS)</p>
            <p className="mt-1 font-semibold">{hrOfficerName || ''}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">_______________</p>
            <p className="text-xs">(semnătura)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
