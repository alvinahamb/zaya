/**
 * Tableau responsive : <table> classique sur grand écran, lignes empilées en
 * cartes sur mobile (chaque cellule affiche son libellé via data-libelle).
 *
 * colonnes : [{ cle, titre, rendu?(ligne), align?: 'droite', classe?, principal? }]
 */
export function Tableau({ colonnes, lignes, cle = 'id', surClic, vide = null, pied = null, cartes = true }) {
  if (!lignes || lignes.length === 0) return vide;

  const classeCellule = (c) =>
    [c.align === 'droite' && 'droite', c.classe, c.principal && 'tableau__principal'].filter(Boolean).join(' ');

  return (
    <div className="tableau__conteneur">
      <table className={`tableau ${cartes ? 'tableau--cartes' : ''}`}>
        <thead>
          <tr>
            {colonnes.map((c) => (
              <th key={c.cle} className={classeCellule(c)} style={c.largeur ? { width: c.largeur } : undefined}>
                {c.titre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr
              key={typeof cle === 'function' ? cle(ligne) : ligne[cle]}
              data-cliquable={surClic ? '' : undefined}
              tabIndex={surClic ? 0 : undefined}
              onClick={surClic ? () => surClic(ligne) : undefined}
              onKeyDown={surClic ? (e) => e.key === 'Enter' && surClic(ligne) : undefined}
            >
              {colonnes.map((c) => (
                <td key={c.cle} data-libelle={c.titre} className={classeCellule(c)}>
                  {c.rendu ? c.rendu(ligne) : ligne[c.cle]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {pied && <tfoot>{pied}</tfoot>}
      </table>
    </div>
  );
}
