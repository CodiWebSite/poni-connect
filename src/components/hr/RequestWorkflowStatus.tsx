import { CheckCircle2, Clock, XCircle, PenTool, FileCheck } from 'lucide-react';

interface WorkflowStep {
  id: string;
  label: string;
  completed: boolean;
  current: boolean;
  rejected?: boolean;
  timestamp?: string;
}

interface RequestWorkflowStatusProps {
  employeeSigned: boolean;
  employeeSignedAt?: string | null;
  departmentHeadSigned: boolean;
  departmentHeadSignedAt?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  compact?: boolean;
}

const RequestWorkflowStatus = ({
  employeeSigned,
  employeeSignedAt,
  departmentHeadSigned,
  departmentHeadSignedAt,
  status,
  compact = false
}: RequestWorkflowStatusProps) => {
  const steps: WorkflowStep[] = [
    {
      id: 'create',
      label: 'Creat',
      completed: true,
      current: false
    },
    {
      id: 'employee-sign',
      label: 'Semnătură Angajat',
      completed: employeeSigned,
      current: !employeeSigned,
      timestamp: employeeSignedAt || undefined
    },
    {
      id: 'dept-head-sign',
      label: 'Semnătură Șef',
      completed: departmentHeadSigned,
      current: employeeSigned && !departmentHeadSigned && status === 'pending',
      timestamp: departmentHeadSignedAt || undefined
    },
    {
      id: 'decision',
      label: status === 'approved' ? 'Aprobat' : status === 'rejected' ? 'Respins' : 'Decizie',
      completed: status !== 'pending',
      current: departmentHeadSigned && status === 'pending',
      rejected: status === 'rejected'
    }
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`w-2 h-2 rounded-full ${
                step.rejected 
                  ? 'bg-destructive' 
                  : step.completed 
                    ? 'bg-green-500' 
                    : step.current 
                      ? 'bg-amber-500 animate-pulse' 
                      : 'bg-muted'
              }`}
              title={step.label}
            />
            {index < steps.length - 1 && (
              <div className={`w-4 h-0.5 ${step.completed ? 'bg-green-500' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Progress line */}
      <div className="absolute top-5 left-5 right-5 h-0.5 bg-muted" />
      <div 
        className="absolute top-5 left-5 h-0.5 bg-green-500 transition-all duration-500"
        style={{ 
          width: `${(steps.filter(s => s.completed).length - 1) / (steps.length - 1) * 100}%`
        }}
      />
      
      {/* Steps */}
      <div className="relative flex justify-between">
        {steps.map((step) => {
          const Icon = step.rejected 
            ? XCircle 
            : step.completed 
              ? CheckCircle2 
              : step.current 
                ? Clock 
                : step.id === 'employee-sign' || step.id === 'dept-head-sign' 
                  ? PenTool 
                  : FileCheck;
          
          return (
            <div key={step.id} className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  step.rejected
                    ? 'bg-destructive text-destructive-foreground'
                    : step.completed
                      ? 'bg-green-500 text-white'
                      : step.current
                        ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className={`mt-2 text-xs text-center max-w-[80px] ${
                step.current ? 'font-medium' : 'text-muted-foreground'
              }`}>
                {step.label}
              </span>
              {step.timestamp && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(step.timestamp).toLocaleDateString('ro-RO')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RequestWorkflowStatus;
