import { ExternalLink, FileText, Globe, Mail } from 'lucide-react';

const links = [
  { 
    icon: Globe, 
    label: 'Website ICMPP', 
    url: 'https://www.icmpp.ro',
    color: 'bg-primary/10 text-primary'
  },
  { 
    icon: Mail, 
    label: 'Webmail', 
    url: 'https://mail.icmpp.ro',
    color: 'bg-accent/10 text-accent'
  },
  { 
    icon: FileText, 
    label: 'Actualizări Intranet-Noutăți', 
    url: '#',
    color: 'bg-info/10 text-info'
  },
];

const QuickLinks = () => {
  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <h3 className="font-semibold text-foreground mb-4">Linkuri rapide</h3>
      <div className="space-y-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors group"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${link.color}`}>
              <link.icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-foreground flex-1">{link.label}</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>
    </div>
  );
};

export default QuickLinks;
