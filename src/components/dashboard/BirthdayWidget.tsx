import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Cake, PartyPopper, Gift } from 'lucide-react';
import { format, isSameDay, isSameMonth, addDays, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';

interface ProfileWithBirthday {
  user_id: string;
  full_name: string;
  birth_date: string;
  department: string | null;
}

const BirthdayWidget = () => {
  const [todayBirthdays, setTodayBirthdays] = useState<ProfileWithBirthday[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<ProfileWithBirthday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBirthdays();
  }, []);

  const fetchBirthdays = async () => {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, birth_date, department')
      .not('birth_date', 'is', null);

    if (error) {
      console.error('Error fetching birthdays:', error);
      setLoading(false);
      return;
    }

    const today = new Date();
    const todayList: ProfileWithBirthday[] = [];
    const upcomingList: ProfileWithBirthday[] = [];

    profiles?.forEach((profile) => {
      if (!profile.birth_date) return;
      
      const birthDate = parseISO(profile.birth_date);
      const thisYearBirthday = new Date(
        today.getFullYear(),
        birthDate.getMonth(),
        birthDate.getDate()
      );

      // If birthday already passed this year, check next year
      if (thisYearBirthday < today && !isSameDay(thisYearBirthday, today)) {
        thisYearBirthday.setFullYear(today.getFullYear() + 1);
      }

      // Check if today
      if (isSameDay(thisYearBirthday, today)) {
        todayList.push(profile as ProfileWithBirthday);
      } 
      // Check if in next 14 days
      else {
        const daysUntil = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil > 0 && daysUntil <= 14) {
          upcomingList.push({ ...profile, _daysUntil: daysUntil } as any);
        }
      }
    });

    // Sort upcoming by date
    upcomingList.sort((a: any, b: any) => a._daysUntil - b._daysUntil);

    setTodayBirthdays(todayList);
    setUpcomingBirthdays(upcomingList.slice(0, 5));
    setLoading(false);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatBirthday = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(new Date(new Date().getFullYear(), date.getMonth(), date.getDate()), 'd MMMM', { locale: ro });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Cake className="w-5 h-5 text-pink-500" />
            Zile de Naștere
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasBirthdays = todayBirthdays.length > 0 || upcomingBirthdays.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Cake className="w-5 h-5 text-pink-500" />
          Zile de Naștere
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today's birthdays */}
        {todayBirthdays.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-pink-600 dark:text-pink-400">
              <PartyPopper className="w-4 h-4" />
              Astăzi sărbătoresc:
            </div>
            <div className="space-y-2">
              {todayBirthdays.map((person) => (
                <div
                  key={person.user_id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20"
                >
                  <Avatar className="w-10 h-10 border-2 border-pink-500">
                    <AvatarFallback className="bg-pink-500 text-white text-sm">
                      {getInitials(person.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{person.full_name}</p>
                    {person.department && (
                      <p className="text-xs text-muted-foreground truncate">{person.department}</p>
                    )}
                  </div>
                  <Gift className="w-5 h-5 text-pink-500 animate-bounce" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming birthdays */}
        {upcomingBirthdays.length > 0 && (
          <div className="space-y-2">
            {todayBirthdays.length > 0 && (
              <div className="text-sm font-medium text-muted-foreground">În curând:</div>
            )}
            <div className="space-y-1.5">
              {upcomingBirthdays.map((person) => (
                <div
                  key={person.user_id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(person.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{person.full_name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatBirthday(person.birth_date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No birthdays message */}
        {!hasBirthdays && (
          <div className="text-center py-4 text-muted-foreground">
            <Cake className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nu sunt zile de naștere în următoarele 2 săptămâni</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BirthdayWidget;
