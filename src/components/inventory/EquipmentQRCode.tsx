import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, QrCode } from 'lucide-react';

interface EquipmentQRCodeProps {
  item: {
    id: string;
    name: string;
    inventory_number?: string;
    serial_number?: string;
  };
}

const EquipmentQRCode = ({ item }: EquipmentQRCodeProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const publicUrl = `${window.location.origin}/echipament/${item.id}`;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>QR - ${item.inventory_number || item.name}</title>
      <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; font-family: sans-serif; }
        .container { text-align: center; padding: 20px; }
        .label { font-size: 14px; font-weight: bold; margin-top: 12px; }
        .sub { font-size: 11px; color: #666; margin-top: 4px; }
      </style></head><body>
        <div class="container">
          ${content.innerHTML}
          <div class="label">${item.name}</div>
          ${item.inventory_number ? `<div class="sub">Nr. inv: ${item.inventory_number}</div>` : ''}
        </div>
      </body></html>
    `);
    w.document.close();
    w.onload = () => { w.print(); w.close(); };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="w-5 h-5 text-primary" />
          QR Code — {item.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div ref={printRef} className="bg-white p-4 rounded-lg">
          <QRCodeSVG value={publicUrl} size={200} level="M" />
        </div>
        <p className="text-xs text-muted-foreground font-mono break-all max-w-sm text-center">{publicUrl}</p>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Printează etichetă QR
        </Button>
      </CardContent>
    </Card>
  );
};

export default EquipmentQRCode;
