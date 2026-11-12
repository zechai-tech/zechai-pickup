'use client';

export interface PdfTableSection {
  title?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  hasTotalRow?: boolean;
}

export interface GenerateAnalyticsPdfOptions {
  tabLabel: string;
  dateRangeLabel: string;
  outletLabel: string;
  generatedAtIST: string;
  filename: string;
  kpis?: Array<{ label: string; value: string }>;
  sections: PdfTableSection[];
  landscape?: boolean;
}

let cachedFontRegBase64: string | null = null;
let cachedFontBoldBase64: string | null = null;
let cachedLogoDataUrl: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadDejaVuFonts() {
  if (!cachedFontRegBase64) {
    const res = await fetch('/fonts/DejaVuSans.ttf');
    if (res.ok) {
      cachedFontRegBase64 = arrayBufferToBase64(await res.arrayBuffer());
    }
  }
  if (!cachedFontBoldBase64) {
    const res = await fetch('/fonts/DejaVuSans-Bold.ttf');
    if (res.ok) {
      cachedFontBoldBase64 = arrayBufferToBase64(await res.arrayBuffer());
    }
  }
  return { reg: cachedFontRegBase64, bold: cachedFontBoldBase64 };
}

async function loadLogoPng(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    const loaded = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = '/assets/logo-orange.v1.webp';
    });
    if (!loaded || !img.naturalWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    cachedLogoDataUrl = dataUrl;
    return dataUrl;
  } catch {
    return null;
  }
}

export async function generateAnalyticsPdf(opts: GenerateAnalyticsPdfOptions): Promise<void> {
  const [{ jsPDF }, autoTableMod, fonts, logoDataUrl] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadDejaVuFonts(),
    loadLogoPng(),
  ]);

  const autoTable = autoTableMod.default;
  const doc = new jsPDF({
    orientation: opts.landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const fontName = fonts.reg ? 'DejaVuSans' : 'helvetica';
  if (fonts.reg) {
    doc.addFileToVFS('DejaVuSans.ttf', fonts.reg);
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  }
  if (fonts.bold) {
    doc.addFileToVFS('DejaVuSans-Bold.ttf', fonts.bold);
    doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold');
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Top warm cream header strip
  doc.setFillColor(253, 251, 234); // #FDFBEA
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setDrawColor(234, 223, 199); // #EADFC7
  doc.line(0, 34, pageWidth, 34);

  let titleX = margin;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, 8, 28, 14);
      titleX = margin + 32;
    } catch {
      titleX = margin;
    }
  }

  doc.setFont(fontName, 'bold');
  doc.setFontSize(15);
  doc.setTextColor(43, 26, 18); // #2B1A12
  doc.text(`Zécha! Analytics — ${opts.tabLabel}`, titleX, 14);

  // Badge "App orders only"
  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(117, 96, 79); // #75604F
  doc.text(
    `App orders only  |  Range: ${opts.dateRangeLabel}  |  Outlet: ${opts.outletLabel}`,
    titleX,
    21
  );
  doc.text(`Generated: ${opts.generatedAtIST}`, titleX, 27);

  let currentY = 42;

  // Optional KPI summary row
  if (opts.kpis && opts.kpis.length > 0) {
    const colW = (pageWidth - margin * 2 - (opts.kpis.length - 1) * 3) / opts.kpis.length;
    opts.kpis.forEach((kpi, idx) => {
      const x = margin + idx * (colW + 3);
      doc.setFillColor(255, 254, 247);
      doc.setDrawColor(234, 223, 199);
      doc.roundedRect(x, currentY, colW, 16, 2, 2, 'FD');

      doc.setFont(fontName, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(117, 96, 79);
      doc.text(kpi.label, x + 3, currentY + 5.5);

      doc.setFont(fontName, 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(43, 26, 18);
      doc.text(kpi.value, x + 3, currentY + 12.5);
    });
    currentY += 22;
  }

  // Tables
  for (const section of opts.sections) {
    if (section.title) {
      if (currentY > doc.internal.pageSize.getHeight() - 35) {
        doc.addPage();
        currentY = 18;
      }
      doc.setFont(fontName, 'bold');
      doc.setFontSize(11);
      doc.setTextColor(43, 26, 18);
      doc.text(section.title, margin, currentY);
      currentY += 4;
    }

    const totalRowIndex = section.hasTotalRow ? section.rows.length - 1 : -1;

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [section.headers],
      body: section.rows.map((r) => r.map((cell) => String(cell))),
      styles: {
        font: fontName,
        fontSize: 8.5,
        textColor: [43, 26, 18],
        cellPadding: 2.5,
        lineColor: [234, 223, 199],
        lineWidth: 0.2,
      },
      headStyles: {
        font: fontName,
        fontStyle: 'bold',
        fillColor: [43, 26, 18],
        textColor: [253, 251, 234],
      },
      alternateRowStyles: {
        fillColor: [255, 254, 247],
      },
      didParseCell: (data) => {
        if (
          section.hasTotalRow &&
          data.section === 'body' &&
          data.row.index === totalRowIndex
        ) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [244, 231, 204]; // #F4E7CC
        }
      },
    });

    currentY = ((doc as any).lastAutoTable?.finalY || currentY + 20) + 10;
  }

  doc.save(opts.filename);
}
