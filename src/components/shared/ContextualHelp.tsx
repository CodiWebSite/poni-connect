import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface ContextualHelpProps {
  title: string;
  content: string;
  steps?: string[];
  guideLink?: boolean;
}

const ContextualHelp = ({ title, content, steps, guideLink = true }: ContextualHelpProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="bottom" align="end">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{title}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{content}</p>
          {steps && steps.length > 0 && (
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
          {guideLink && (
            <Link
              to="/ghid"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium mt-1"
            >
              Vezi ghidul complet →
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ContextualHelp;
