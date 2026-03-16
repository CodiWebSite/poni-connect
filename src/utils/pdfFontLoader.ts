import jsPDF from 'jspdf';

let fontsLoaded = false;
let regularFontData: string | null = null;
let boldFontData: string | null = null;

async function loadFont(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function loadRobotoFonts(): Promise<void> {
  if (fontsLoaded) return;
  
  [regularFontData, boldFontData] = await Promise.all([
    loadFont('/fonts/Roboto-Regular.ttf'),
    loadFont('/fonts/Roboto-Bold.ttf'),
  ]);
  
  fontsLoaded = true;
}

export function applyRobotoFont(doc: jsPDF): void {
  if (!regularFontData || !boldFontData) {
    console.warn('Roboto fonts not loaded, using default font');
    return;
  }
  
  doc.addFileToVFS('Roboto-Regular.ttf', regularFontData);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  
  doc.addFileToVFS('Roboto-Bold.ttf', boldFontData);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  
  doc.setFont('Roboto', 'normal');
}
