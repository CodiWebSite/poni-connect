import { useEffect, useState } from 'react';
import SocialLayout from '@/components/layout/SocialLayout';
import { Card } from '@/components/ui/card';
import { Info, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PostFeed from '@/components/social/PostFeed';

interface CommunityMini {
  id: string;
  name: string;
  slug: string;
  member_count: number;
}

const SocialFeed = () => {
  const [communities, setCommunities] = useState<CommunityMini[]>([]);

  useEffect(() => {
    (async () => {
      const [comRes, memRes] = await Promise.all([
        supabase
          .from('communities')
          .select('id, name, slug')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('community_members').select('community_id'),
      ]);
      const counts = new Map<string, number>();
      (memRes.data ?? []).forEach((r: any) =>
        counts.set(r.community_id, (counts.get(r.community_id) ?? 0) + 1),
      );
      setCommunities(
        (comRes.data ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          member_count: counts.get(c.id) ?? 0,
        })),
      );
    })();
  }, []);

  return (
    <SocialLayout title="Feed" description="Ultimele noutăți din intranet">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <PostFeed
            communityId={null}
            canPost
            emptyHint="Nicio postare încă în feed. Fii primul care împărtășește ceva!"
          />
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-display font-bold text-lg mb-3">Comunități</h3>
            {communities.length === 0 ? (
              <EmptyCard title="Nicio comunitate creată." small />
            ) : (
              <div className="space-y-2">
                {communities.map((c) => (
                  <Link
                    key={c.id}
                    to={`/social/comunitati/${c.slug}`}
                    className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.member_count} {c.member_count === 1 ? 'membru' : 'membri'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SocialLayout>
  );
};

const EmptyCard = ({ title, small = false }: { title: string; small?: boolean }) => (
  <Card
    className={`flex flex-col items-center justify-center text-center border border-border bg-card rounded-2xl ${
      small ? 'py-10 px-6' : 'py-20 px-8'
    }`}
  >
    <div className="w-10 h-10 rounded-full border-2 border-primary/40 flex items-center justify-center mb-3">
      <Info className="w-5 h-5 text-primary/60" />
    </div>
    <p className={`text-muted-foreground ${small ? 'text-xs' : 'text-sm'}`}>{title}</p>
  </Card>
);

export default SocialFeed;
