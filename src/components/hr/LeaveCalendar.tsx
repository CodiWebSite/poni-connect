import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Users
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWeekend, isSameDay, addMonths, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { ro } from 'date-fns/locale';

interface LeaveRequest {
  id: string;
  user_id: string;
  employee_name: string;
  department: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  number_of_days: number;
}

interface LeaveCalendarProps {
  requests: LeaveRequest[];
  departments: string[];
}

const LeaveCalendar = ({ requests, departments }: LeaveCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('approved');

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (filterDepartment !== 'all' && r.department !== filterDepartment) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      return true;
    });
  }, [requests, filterDepartment, filterStatus]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getRequestsForDay = (day: Date) => {
    return filteredRequests.filter(r => {
      const start = parseISO(r.start_date);
      const end = r.end_date ? parseISO(r.end_date) : start;
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });
  };

  const weekDays = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

  // Get the day of week for the first day (0 = Sunday, adjust to Monday-first)
  const firstDayOfWeek = monthStart.getDay();
  const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const statusColors: Record<string, string> = {
    approved: 'bg-green-500',
    pending: 'bg-amber-500',
    rejected: 'bg-destructive'
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            Calendar Concedii
          </CardTitle>
          
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Departament" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate</SelectItem>
                <SelectItem value="approved">Aprobate</SelectItem>
                <SelectItem value="pending">În așteptare</SelectItem>
                <SelectItem value="rejected">Respinse</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-lg font-semibold capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: ro })}
          </h3>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Week days header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for padding */}
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[80px] bg-muted/20 rounded-lg" />
          ))}
          
          {days.map(day => {
            const dayRequests = getRequestsForDay(day);
            const isToday = isSameDay(day, new Date());
            const weekend = isWeekend(day);
            
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[80px] p-1 rounded-lg border transition-colors ${
                  isToday 
                    ? 'border-primary bg-primary/5' 
                    : weekend 
                      ? 'border-transparent bg-muted/30' 
                      : 'border-border/50 bg-card hover:bg-muted/50'
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${weekend ? 'text-muted-foreground' : ''}`}>
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-0.5 overflow-hidden">
                  {dayRequests.slice(0, 3).map(req => (
                    <div
                      key={req.id}
                      className={`text-xs px-1 py-0.5 rounded truncate text-white ${statusColors[req.status]}`}
                      title={`${req.employee_name} - ${req.department}`}
                    >
                      {req.employee_name.split(' ')[0]}
                    </div>
                  ))}
                  {dayRequests.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{dayRequests.length - 3}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t">
          <span className="text-sm text-muted-foreground">Legendă:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-xs">Aprobat</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span className="text-xs">În așteptare</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-destructive" />
            <span className="text-xs">Respins</span>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {filteredRequests.filter(r => r.status === 'approved').length}
            </div>
            <div className="text-xs text-muted-foreground">Concedii aprobate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-500">
              {filteredRequests.filter(r => r.status === 'pending').length}
            </div>
            <div className="text-xs text-muted-foreground">În așteptare</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {new Set(filteredRequests.map(r => r.user_id)).size}
            </div>
            <div className="text-xs text-muted-foreground">Angajați</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {filteredRequests.reduce((sum, r) => sum + r.number_of_days, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Total zile</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeaveCalendar;
