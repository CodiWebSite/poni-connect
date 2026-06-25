import { useState } from 'react';
import SocialLayout from '@/components/layout/SocialLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Globe, Trash2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const Communities = () => {
  const { canManageHR, isSuperAdmin } = useUserRole();
  const canCreate = canManageHR || isSuperAdmin;
  const [search, setSearch] = useState('');

  return (
    <SocialLayout title="Comunități" description="Spații tematice de colaborare">
      <Tabs defaultValue="active" className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 gap-6">
            <TabsTrigger
              value="active"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 pb-2"
            >
              Comunități active
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 pb-2"
            >
              Comunități arhivate
            </TabsTrigger>
            {canCreate && (
              <TabsTrigger
                value="requests"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 pb-2"
              >
                Cereri
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Caută"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64 rounded-xl"
              />
            </div>
            <Button
              className="rounded-xl"
              disabled={!canCreate}
              onClick={() =>
                toast.info('Crearea comunităților va fi disponibilă într-o iterație viitoare')
              }
              title={canCreate ? '' : 'Doar admin / HR pot crea comunități'}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Creează comunitate
            </Button>
          </div>
        </div>

        <TabsContent value="active" className="space-y-8 mt-0">
          <section>
            <h2 className="font-display font-bold text-xl mb-4">Comunitățile tale (1)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <CommunityCard
                slug="it"
                name="IT"
                posts={0}
                events={0}
                members={1}
                canDelete={canCreate}
              />
            </div>
          </section>

          <section>
            <h2 className="font-display font-bold text-xl mb-4">Alte comunități (0)</h2>
            <p className="text-sm text-muted-foreground">Nu există alte comunități disponibile.</p>
          </section>
        </TabsContent>

        <TabsContent value="archived" className="mt-0">
          <p className="text-sm text-muted-foreground">Nicio comunitate arhivată.</p>
        </TabsContent>

        {canCreate && (
          <TabsContent value="requests" className="mt-0">
            <p className="text-sm text-muted-foreground">Nu există cereri în așteptare.</p>
          </TabsContent>
        )}
      </Tabs>
    </SocialLayout>
  );
};

interface CommunityCardProps {
  slug: string;
  name: string;
  posts: number;
  events: number;
  members: number;
  canDelete: boolean;
}

const CommunityCard = ({ slug, name, posts, events, members, canDelete }: CommunityCardProps) => (
  <Card className="p-5 rounded-2xl border-border hover:border-primary/40 transition-colors">
    <div className="flex items-start justify-between mb-3">
      <h3 className="font-bold text-lg">{name}</h3>
      <Badge variant="secondary" className="rounded-full font-normal">
        <Globe className="w-3 h-3 mr-1" />
        Public
      </Badge>
    </div>
    <p className="text-xs text-muted-foreground mb-3">
      {posts} postări · {events} evenimente
    </p>
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
        CC
      </div>
      <span className="text-xs text-muted-foreground">{members} membru</span>
    </div>
    <div className="flex items-center gap-2">
      <Link to={`/social/comunitati/${slug}`} className="flex-1">
        <Button className="w-full rounded-xl" size="sm">
          Vezi comunitatea
        </Button>
      </Link>
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive rounded-xl"
          onClick={() => toast.info('Ștergerea va fi disponibilă într-o iterație viitoare')}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  </Card>
);

export default Communities;
