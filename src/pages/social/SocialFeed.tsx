import SocialLayout from '@/components/layout/SocialLayout';
import { Card } from '@/components/ui/card';
import { Info, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const SocialFeed = () => {
  return (
    <SocialLayout title="Feed" description="Ultimele noutăți din intranet">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Main feed */}
        <div className="space-y-4">
          <EmptyCard
            title="În acest moment nu există nicio noutate în feed-ul tău"
          />
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          <div>
            <h3 className="font-display font-bold text-lg mb-3">Comunități</h3>
            <Link
              to="/social/comunitati/it"
              className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-base">IT</p>
                  <p className="text-xs text-muted-foreground mt-0.5">0 postări · 0 evenimente</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>
          </div>

          <div>
            <h3 className="font-display font-bold text-lg mb-3">Evenimente viitoare</h3>
            <EmptyCard title="În acest moment nu există evenimente" small />
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
