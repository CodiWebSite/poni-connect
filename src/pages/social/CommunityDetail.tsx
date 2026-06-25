import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SocialLayout from '@/components/layout/SocialLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Globe,
  Settings as SettingsIcon,
  LogOut,
  Plus,
  Info,
  Search,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const CommunityDetail = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const [me, setMe] = useState<{ name: string; email: string; initials: string }>({
    name: '',
    email: '',
    initials: 'U',
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.full_name || user.email || '';
        setMe({
          name,
          email: user.email || '',
          initials: (name || user.email || 'U').substring(0, 2).toUpperCase(),
        });
      });
  }, [user]);

  const name = (slug || 'it').toUpperCase();

  return (
    <SocialLayout title={name} description="Comunitate">
      <Link
        to="/social/comunitati"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Înapoi la comunități
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Main */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display font-bold text-2xl">{name}</h1>
            <Button
              variant="secondary"
              className="rounded-xl"
              disabled
              title="Disponibil într-o iterație viitoare"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Postare nouă (în curând)
            </Button>
          </div>

          <Tabs defaultValue="feed">
            <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 gap-6 mb-6">
              <TabsTrigger
                value="feed"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 pb-2"
              >
                Feed
              </TabsTrigger>
              <TabsTrigger
                value="events"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 pb-2"
              >
                Evenimente
              </TabsTrigger>
              <TabsTrigger
                value="media"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 pb-2"
              >
                Media
              </TabsTrigger>
            </TabsList>

            <TabsContent value="feed" className="mt-0">
              <EmptyCard text="În acest moment nu există nicio postare în comunitate" />
            </TabsContent>
            <TabsContent value="events" className="mt-0">
              <EmptyCard text="În acest moment nu există evenimente" />
            </TabsContent>
            <TabsContent value="media" className="mt-0">
              <EmptyCard text="Niciun fișier încărcat" />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <Card className="p-5 rounded-2xl border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Despre</h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => toast.info('Iterație viitoare')}
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />
                  Ieșire
                </Button>
                <Button variant="ghost" size="icon" className="rounded-xl">
                  <SettingsIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary" className="rounded-full font-normal">
                <Globe className="w-3 h-3 mr-1" />
                Public
              </Badge>
              <span className="text-xs text-muted-foreground">0 postări · 0 evenimente</span>
            </div>

            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm">Membri (1)</p>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-primary hover:text-primary"
                onClick={() => toast.info('Iterație viitoare')}
              >
                Adaugă membri
              </Button>
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Caută membru" className="pl-9 rounded-xl" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                  {me.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{me.name}</p>
                    <Badge className="text-[9px] px-1.5 py-0 h-4 rounded-full">Admin</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{me.email}</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl h-7 w-7">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </SocialLayout>
  );
};

const EmptyCard = ({ text }: { text: string }) => (
  <Card className="flex flex-col items-center justify-center text-center border border-border bg-card rounded-2xl py-20 px-8">
    <div className="w-10 h-10 rounded-full border-2 border-primary/40 flex items-center justify-center mb-3">
      <Info className="w-5 h-5 text-primary/60" />
    </div>
    <p className="text-sm text-muted-foreground">{text}</p>
  </Card>
);

export default CommunityDetail;
