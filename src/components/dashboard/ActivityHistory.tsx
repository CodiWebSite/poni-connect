import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  History, 
  FileText, 
  ShoppingCart, 
  Plane, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface ActivityItem {
  id: string;
  type: 'hr_request' | 'procurement' | 'document';
  title: string;
  status: string;
  createdAt: string;
  details?: string;
}

const ActivityHistory = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchActivities();
    }
  }, [user]);

  const fetchActivities = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch HR requests
      const { data: hrData } = await supabase
        .from('hr_requests')
        .select('id, request_type, status, created_at, details')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch procurement requests
      const { data: procurementData } = await supabase
        .from('procurement_requests')
        .select('id, title, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch uploaded documents
      const { data: documentsData } = await supabase
        .from('documents')
        .select('id, name, created_at')
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const allActivities: ActivityItem[] = [];

      // Map HR requests
      if (hrData) {
        hrData.forEach((hr) => {
          const details = hr.details as Record<string, unknown>;
          allActivities.push({
            id: hr.id,
            type: 'hr_request',
            title: getHRRequestTitle(hr.request_type),
            status: hr.status,
            createdAt: hr.created_at,
            details: details?.startDate as string || undefined,
          });
        });
      }

      // Map procurement requests
      if (procurementData) {
        procurementData.forEach((proc) => {
          allActivities.push({
            id: proc.id,
            type: 'procurement',
            title: proc.title,
            status: proc.status,
            createdAt: proc.created_at,
          });
        });
      }

      // Map documents
      if (documentsData) {
        documentsData.forEach((doc) => {
          allActivities.push({
            id: doc.id,
            type: 'document',
            title: doc.name,
            status: 'uploaded',
            createdAt: doc.created_at,
          });
        });
      }

      // Sort by date and take top 6
      allActivities.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setActivities(allActivities.slice(0, 6));
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHRRequestTitle = (type: string) => {
    const titles: Record<string, string> = {
      concediu: 'Cerere concediu',
      adeverinta: 'Cerere adeverință',
      delegatie: 'Cerere delegație',
      demisie: 'Cerere demisie',
    };
    return titles[type] || 'Cerere HR';
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'hr_request':
        return <Plane className="w-4 h-4" />;
      case 'procurement':
        return <ShoppingCart className="w-4 h-4" />;
      case 'document':
        return <FileText className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge variant="default" className="bg-success/10 text-success border-success/20 text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Aprobat
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="text-xs">
            <XCircle className="w-3 h-3 mr-1" />
            Respins
          </Badge>
        );
      case 'pending':
      case 'pending_department_head':
      case 'pending_director':
      case 'pending_procurement':
      case 'pending_cfp':
        return (
          <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20 text-xs">
            <Clock className="w-3 h-3 mr-1" />
            În așteptare
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="outline" className="text-xs">
            Ciornă
          </Badge>
        );
      case 'uploaded':
        return (
          <Badge variant="default" className="bg-info/10 text-info border-info/20 text-xs">
            Încărcat
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        );
    }
  };

  const getActivityLink = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'hr_request':
        return '/my-profile';
      case 'procurement':
        return '/procurement';
      case 'document':
        return '/documents';
      default:
        return '/';
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Activitate recentă
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Activitate recentă
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nu ai activitate recentă
          </p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <Link
                key={`${activity.type}-${activity.id}`}
                to={getActivityLink(activity)}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {activity.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(activity.createdAt), 'd MMM yyyy, HH:mm', { locale: ro })}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {getStatusBadge(activity.status)}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link to="/my-profile" className="flex items-center justify-center gap-1">
              Vezi profilul complet <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityHistory;
