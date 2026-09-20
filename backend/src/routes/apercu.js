import { Router } from 'express';
import { exiger } from '../lib/erreurs.js';

export const routeurApercu = Router();

const DUREE_CACHE = 24 * 60 * 60 * 1000;
const TAILLE_MAX_CACHE = 500;
const cache = new Map();

const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Refuse les adresses locales : le serveur ne doit pas servir de relais vers le réseau interne. */
function hoteAutorise(hote) {
  const h = hote.toLowerCase();
  if (!h.includes('.') || h === 'localhost') return false;
  if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
  return true;
}

function lireMeta(html, propriete) {
  const attr = `(?:property|name)=["']${propriete}["']`;
  const m =
    html.match(new RegExp(`<meta[^>]+${attr}[^>]+content=["']([^"']+)["']`, 'i')) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}`, 'i'));
  return m ? m[1].replace(/&amp;/g, '&') : null;
}

/**
 * Les pages d'épingle Pinterest n'exposent pas toujours og:image dans le HTML
 * servi : on repère alors la première image d'épingle en pleine taille.
 */
function imagePinterest(html) {
  const m =
    html.match(/https:\/\/i\.pinimg\.com\/originals\/[A-Za-z0-9_./-]+\.(?:jpg|jpeg|png|webp|gif)/i) ||
    html.match(/https:\/\/i\.pinimg\.com\/736x\/[A-Za-z0-9_./-]+\.(?:jpg|jpeg|png|webp|gif)/i);
  return m ? m[0] : null;
}

/** Récupère l'image et le titre Open Graph d'une page (Pinterest, réseaux…). */
async function extraire(url) {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), 7000);
  try {
    const reponse = await fetch(url, {
      signal: controleur.signal,
      redirect: 'follow',
      headers: { 'User-Agent': AGENT, Accept: 'text/html,application/xhtml+xml' },
    });
    if (!reponse.ok) return { image: null, titre: null };
    const html = (await reponse.text()).slice(0, 2_000_000);
    return {
      image: lireMeta(html, 'og:image') || lireMeta(html, 'twitter:image') || imagePinterest(html),
      titre: lireMeta(html, 'og:title') || null,
    };
  } catch {
    return { image: null, titre: null };
  } finally {
    clearTimeout(minuterie);
  }
}

routeurApercu.get('/', async (req, res) => {
  const url = String(req.query.url ?? '').trim();
  let cible;
  try {
    cible = new URL(url);
  } catch {
    cible = null;
  }
  exiger(cible && /^https?:$/.test(cible.protocol) && hoteAutorise(cible.hostname), 'URL invalide');

  const enCache = cache.get(url);
  if (enCache && enCache.expire > Date.now()) return res.json(enCache.donnees);

  const donnees = await extraire(url);
  if (cache.size >= TAILLE_MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(url, { donnees, expire: Date.now() + DUREE_CACHE });
  res.json(donnees);
});
