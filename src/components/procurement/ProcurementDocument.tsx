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
  directorName?: string;
  departmentHeadName?: string;
  cfpName?: string;
  status: string;
}

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
  directorName = 'Dr. Valeria Harabagiu',
  departmentHeadName,
  cfpName = 'Ec. Angelica - Elena Sacaleanu',
  status
}: ProcurementDocumentProps) {
  const currentDate = format(new Date(createdAt), 'dd.MM.yyyy');

  // Calculate total with TVA (19%)
  const totalFaraTVA = items.reduce((sum, item) => sum + (item.quantity * item.estimatedPrice), 0);
  const totalCuTVA = totalFaraTVA * 1.19;

  return (
    <div className="bg-white p-4 sm:p-8 rounded-lg border shadow-sm text-black print:shadow-none print:border-none overflow-x-auto" style={{ fontFamily: 'Times New Roman, serif' }}>
      {/* Header with Code */}
      <div className="flex justify-end mb-2">
        <span className="text-xs border border-gray-400 px-2 py-1">Cod APR 002</span>
      </div>

      {/* Institution Header */}
      <div className="text-center mb-2">
        <p className="text-sm sm:text-base font-bold">INSTITUTUL DE CHIMIE MACROMOLECULARĂ "PETRU PONI" IAȘI</p>
        <p className="text-xs sm:text-sm">Compartiment Achiziții Publice</p>
      </div>

      {/* Registration Number */}
      <div className="mb-4 sm:mb-6">
        <p className="text-xs sm:text-sm">
          Nr. <span className="font-bold">{requestNumber}</span>/<span className="font-bold">{currentDate}</span>
        </p>
      </div>

      {/* Approval Section - APROBAT */}
      <div className="text-center mb-4">
        <p className="text-sm sm:text-base font-bold underline mb-4">APROBAT:</p>
      </div>

      {/* Three Column Approval Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr>
              <th className="border border-gray-400 p-2 text-center w-1/3">DIRECTOR,</th>
              <th className="border border-gray-400 p-2 text-center w-1/3">ȘEF LABORATOR,</th>
              <th className="border border-gray-400 p-2 text-center w-1/3">VIZAT,</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 p-2 text-center h-20">
                <p className="text-xs sm:text-sm">{directorName}</p>
                {status === 'approved' && (
                  <p className="text-green-600 font-bold text-xs mt-2">✓ APROBAT</p>
                )}
              </td>
              <td className="border border-gray-400 p-2 text-center h-20">
                <p className="text-xs sm:text-sm">{departmentHeadName || '________________________'}</p>
                {approverSignature && (
                  <div className="flex flex-col items-center mt-1">
                    <img src={approverSignature} alt="Semnătură" className="max-h-12 object-contain" />
                    {approverSignedAt && (
                      <p className="text-[10px] text-gray-500">
                        {format(new Date(approverSignedAt), 'dd.MM.yyyy')}
                      </p>
                    )}
                  </div>
                )}
              </td>
              <td className="border border-gray-400 p-2 text-center h-20">
                <p className="text-xs sm:text-sm">{cfpName}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Title */}
      <h1 className="text-center text-lg sm:text-xl font-bold mb-6 sm:mb-8">
        REFERAT
      </h1>

      {/* Body */}
      <div className="space-y-4 sm:space-y-6 text-xs sm:text-sm leading-6 sm:leading-7 px-2 sm:px-4">
        <p className="text-justify indent-4 sm:indent-8">
          Subsemnat/a, <span className="font-semibold">{requesterName || '________________________'}</span>
          {position && <>, având funcția de <span className="font-semibold">{position}</span></>}, 
          vă rog să binevoiți a aproba fondurile necesare achiziționării următoarelor produse:
        </p>

        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-400 text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 p-2 text-center">Nr. crt.</th>
                <th className="border border-gray-400 p-2 text-left">Denumire și caracteristici tehnice</th>
                <th className="border border-gray-400 p-2 text-center">U/M</th>
                <th className="border border-gray-400 p-2 text-center">Cant.</th>
                <th className="border border-gray-400 p-2 text-right">Preț unitar fără TVA (lei)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50">
                <td className="border border-gray-400 p-1 text-center text-[10px]">(1)</td>
                <td className="border border-gray-400 p-1 text-center text-[10px]">(2)</td>
                <td className="border border-gray-400 p-1 text-center text-[10px]">(3)</td>
                <td className="border border-gray-400 p-1 text-center text-[10px]">(4)</td>
                <td className="border border-gray-400 p-1 text-center text-[10px]">(6)</td>
              </tr>
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="border border-gray-400 p-2 text-center">{index + 1}</td>
                  <td className="border border-gray-400 p-2">
                    {item.name}
                    {item.specifications && (
                      <span className="text-gray-600 text-[10px] block">{item.specifications}</span>
                    )}
                  </td>
                  <td className="border border-gray-400 p-2 text-center">{item.unit}</td>
                  <td className="border border-gray-400 p-2 text-center">{item.quantity}</td>
                  <td className="border border-gray-400 p-2 text-right">{item.estimatedPrice.toLocaleString('ro-RO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total cu TVA */}
        <div className="text-right font-bold text-sm sm:text-base">
          <p>TOTAL cu TVA: {totalCuTVA.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei</p>
        </div>

        {/* Financing Source */}
        <p className="mt-4">
          Finanțarea se va face din {budgetSource || 'venituri institut'}.
        </p>

        {/* Date */}
        <p className="mt-4">
          Data: <span className="font-semibold">{currentDate}</span>
        </p>
      </div>

      {/* Employee Signature */}
      <div className="mt-6 sm:mt-8 flex flex-col items-end px-2 sm:px-4">
        <div className="text-center">
          <p className="text-xs sm:text-sm mb-1">Solicitant,</p>
          <div className="w-36 sm:w-44 h-20 sm:h-24 border-2 border-gray-300 rounded flex items-center justify-center overflow-hidden bg-gray-50 mb-1">
            {employeeSignature ? (
              <img src={employeeSignature} alt="Semnătură solicitant" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-gray-400 text-[10px] sm:text-xs italic">Semnătura solicitant</span>
            )}
          </div>
          <p className="font-semibold text-xs sm:text-sm">{requesterName}</p>
          {employeeSignedAt && (
            <p className="text-[10px] sm:text-xs text-gray-500">
              {format(new Date(employeeSignedAt), 'dd.MM.yyyy')}
            </p>
          )}
        </div>
      </div>

      {/* Status */}
      {(status === 'approved' || status === 'rejected') && (
        <div className="mt-8 pt-4 border-t-2 border-dashed border-gray-400 text-center">
          {status === 'approved' && (
            <p className="text-lg font-bold text-green-600">✓ APROBAT</p>
          )}
          {status === 'rejected' && (
            <p className="text-lg font-bold text-red-600">✗ RESPINS</p>
          )}
        </div>
      )}
    </div>
  );
}
