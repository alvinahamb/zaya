import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Colonne d'export : { cle, titre, valeur?(ligne) → valeur brute (Excel),
 * texte?(ligne) → texte formaté (PDF) }. À défaut, ligne[cle] est utilisé.
 */
const brut = (colonne, ligne) => (colonne.valeur ? colonne.valeur(ligne) : ligne[colonne.cle]);
const texte = (colonne, ligne) => {
  const v = colonne.texte ? colonne.texte(ligne) : brut(colonne, ligne);
  return v === null || v === undefined ? '' : String(v);
};

/** Helvetica (jsPDF) ne connaît ni les espaces fines ni le signe moins typographique. */
const nettoyerPdf = (s) => s.replace(/[\u202f\u00a0]/g, ' ').replace(/−/g, '-');

function telecharger(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exporterExcel({ nomFichier, titre, colonnes, lignes }) {
  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet((titre || 'Export').slice(0, 31));
  feuille.columns = colonnes.map((c) => ({ header: c.titre, key: c.cle, width: c.largeur ?? 20 }));
  for (const ligne of lignes) {
    const rangee = {};
    for (const c of colonnes) rangee[c.cle] = brut(c, ligne) ?? null;
    feuille.addRow(rangee);
  }
  feuille.getRow(1).font = { bold: true };
  feuille.views = [{ state: 'frozen', ySplit: 1 }];
  const tampon = await classeur.xlsx.writeBuffer();
  telecharger(
    new Blob([tampon], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${nomFichier}.xlsx`,
  );
}

export function exporterPdf({ nomFichier, titre, sousTitre, colonnes, lignes }) {
  const doc = new jsPDF({ orientation: colonnes.length > 5 ? 'landscape' : 'portrait', unit: 'mm' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(nettoyerPdf(titre), 14, 16);
  let depart = 22;
  if (sousTitre) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(107, 94, 89);
    doc.text(nettoyerPdf(sousTitre), 14, 22);
    depart = 28;
  }
  autoTable(doc, {
    startY: depart,
    head: [colonnes.map((c) => nettoyerPdf(c.titre))],
    body: lignes.map((l) => colonnes.map((c) => nettoyerPdf(texte(c, l)))),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, textColor: [43, 35, 32] },
    headStyles: { fillColor: [200, 67, 47], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 248, 245] },
    columnStyles: Object.fromEntries(
      colonnes.map((c, i) => [i, { halign: c.align === 'droite' ? 'right' : 'left' }]),
    ),
  });
  doc.save(`${nomFichier}.pdf`);
}
