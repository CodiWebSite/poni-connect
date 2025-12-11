import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface ProcurementItem {
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  specifications?: string;
}

interface ProcurementDocumentProps {
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
  employeeSignature?: string | null;
  employeeSignedAt?: string | null;
  approverSignature?: string | null;
  approverSignedAt?: string | null;
  approverName?: string | null;
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

export function ProcurementDocument({
  requestNumber,
  requesterName,
  department,
  position,
  title,
  description,
  justification,
  category,
  urgency,
  items,
  estimatedValue,
  currency,
  budgetSource,
  createdAt,
  employeeSignature,
  employeeSignedAt,
  approverSignature,
  approverSignedAt,
  approverName,
  status
}: ProcurementDocumentProps) {
  const currentDate = format(new Date(createdAt), 'dd.MM.yyyy');

  return (
    <div className="bg-white p-4 sm:p-8 rounded-lg border shadow-sm text-black print:shadow-none print:border-none overflow-x-auto" style={{ fontFamily: 'Times New Roman, serif' }}>
      {/* Header */}
      <div className="text-center mb-4 sm:mb-6">
        <div className="flex justify-center mb-2 sm:mb-3">
          <img 
            src="/logo-academia.png" 
            alt="Academia Română" 
            className="h-14 sm:h-20 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        <p className="text-xs sm:text-sm font-bold tracking-wide">ACADEMIA ROMÂNĂ</p>
        <p className="text-sm sm:text-base font-bold mt-1">INSTITUTUL DE CHIMIE MACROMOLECULARĂ "PETRU PONI"</p>
        <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Aleea Grigore Ghica Voda, nr. 41A, 700487 IAȘI, ROMANIA</p>
      </div>

      {/* Document Number and Date */}
      <div className="flex justify-between mb-4 sm:mb-6 text-xs sm:text-sm">
        <div>
          <p>Nr. înregistrare: <span className="font-bold">{requestNumber}</span></p>
        </div>
        <div>
          <p>Data: <span className="font-bold">{currentDate}</span></p>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-center text-lg sm:text-xl font-bold mb-6 sm:mb-8 underline">
        REFERAT DE NECESITATE
      </h1>

      {/* Approval Section */}
      <div className="flex flex-col sm:flex-row justify-between mb-6 sm:mb-8 px-2 sm:px-4 gap-4 sm:gap-0">
        <div className="text-center">
          <p className="text-xs sm:text-sm mb-1">Aprobat,</p>
          <p className="text-[10px] sm:text-xs text-gray-600 mb-2">Compartiment Achiziții-Contabilitate</p>
          <div className="w-36 sm:w-44 h-20 sm:h-24 border-2 border-gray-300 rounded flex items-center justify-center overflow-hidden bg-gray-50 mx-auto">
            {approverSignature ? (
              <img src={approverSignature} alt="Semnătură aprobare" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-gray-400 text-[10px] sm:text-xs italic">Așteaptă semnătură</span>
            )}
          </div>
          {approverName && (
            <p className="text-[10px] sm:text-xs font-medium mt-1">{approverName}</p>
          )}
          {approverSignedAt && (
            <p className="text-[10px] sm:text-xs text-gray-500">
              {format(new Date(approverSignedAt), 'dd.MM.yyyy HH:mm')}
            </p>
          )}
        </div>
        <div className="text-center">
          <p className="text-xs sm:text-sm mb-1">Urgență:</p>
          <p className={`text-sm sm:text-base font-bold ${urgency === 'foarte_urgent' ? 'text-red-600' : urgency === 'urgent' ? 'text-amber-600' : 'text-gray-600'}`}>
            {urgencyLabels[urgency]}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 sm:space-y-6 text-xs sm:text-sm leading-6 sm:leading-7 px-2 sm:px-4">
        <p className="text-sm sm:text-base">Către conducerea institutului,</p>
        
        <p className="text-justify indent-4 sm:indent-8">
          Subsemnatul/a, <span className="font-semibold border-b border-black px-1">{requesterName || '________________________'}</span>, 
          {position && <> în funcția de <span className="font-semibold border-b border-black px-1">{position}</span>,</>} 
          din cadrul <span className="font-semibold border-b border-black px-1">{department || '________________________'}</span>, 
          solicit aprobarea achiziției următoarelor produse/servicii:
        </p>

        {/* Title and Description */}
        <div className="bg-gray-50 p-3 rounded border">
          <p className="font-semibold mb-2">Titlu: {title}</p>
          <p className="text-gray-700">Descriere: {description}</p>
        </div>

        {/* Category */}
        <p>
          <span className="font-medium">Categorie:</span> {categoryLabels[category] || category}
        </p>

        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-400 text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 p-2 text-left">Nr.</th>
                <th className="border border-gray-400 p-2 text-left">Denumire produs/serviciu</th>
                <th className="border border-gray-400 p-2 text-center">Cantitate</th>
                <th className="border border-gray-400 p-2 text-center">U.M.</th>
                <th className="border border-gray-400 p-2 text-right">Preț unitar</th>
                <th className="border border-gray-400 p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="border border-gray-400 p-2">{index + 1}</td>
                  <td className="border border-gray-400 p-2">{item.name}</td>
                  <td className="border border-gray-400 p-2 text-center">{item.quantity}</td>
                  <td className="border border-gray-400 p-2 text-center">{item.unit}</td>
                  <td className="border border-gray-400 p-2 text-right">{item.estimatedPrice.toLocaleString('ro-RO')}</td>
                  <td className="border border-gray-400 p-2 text-right font-medium">
                    {(item.quantity * item.estimatedPrice).toLocaleString('ro-RO')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={5} className="border border-gray-400 p-2 text-right">TOTAL ESTIMAT:</td>
                <td className="border border-gray-400 p-2 text-right">{estimatedValue.toLocaleString('ro-RO')} {currency}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Justification */}
        <div>
          <p className="font-semibold mb-2">Justificare / Necesitate:</p>
          <p className="text-justify bg-gray-50 p-3 rounded border">{justification}</p>
        </div>

        {/* Budget Source */}
        {budgetSource && (
          <p>
            <span className="font-medium">Sursa de finanțare:</span> {budgetSource}
          </p>
        )}

        <p className="mt-6">Vă mulțumesc,</p>
      </div>

      {/* Employee Signature */}
      <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-between items-start sm:items-end px-2 sm:px-4 gap-4 sm:gap-0">
        <div>
          <p className="text-xs sm:text-sm mb-1">Solicitant:</p>
          <p className="font-semibold border-b border-black px-1 inline-block">{requesterName || '________________________'}</p>
          <p className="text-[10px] sm:text-xs text-gray-600 mt-1">{department}</p>
        </div>
        <div className="text-center">
          <div className="w-36 sm:w-44 h-20 sm:h-24 border-2 border-gray-300 rounded flex items-center justify-center overflow-hidden bg-gray-50 mb-1">
            {employeeSignature ? (
              <img src={employeeSignature} alt="Semnătură solicitant" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-gray-400 text-[10px] sm:text-xs italic">Semnătura solicitant</span>
            )}
          </div>
          <p className="text-[10px] sm:text-xs">
            ({employeeSignedAt ? format(new Date(employeeSignedAt), 'dd.MM.yyyy') : '____________'}) (semnătura)
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="mt-8 pt-4 border-t-2 border-dashed border-gray-400 text-center">
        {status === 'approved' && (
          <p className="text-lg font-bold text-green-600">✓ APROBAT</p>
        )}
        {status === 'rejected' && (
          <p className="text-lg font-bold text-red-600">✗ RESPINS</p>
        )}
        {status !== 'approved' && status !== 'rejected' && (
          <p className="text-lg font-bold text-amber-600">⏳ ÎN AȘTEPTARE</p>
        )}
      </div>
    </div>
  );
}
