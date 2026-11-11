import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const purify = createDOMPurify(new JSDOM('').window);
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// Retire scripts, gestionnaires d'événements et contenus étrangers d'un SVG.
// Renvoie null si rien d'exploitable ne subsiste.
export function sanitizeSvg(source: string): string | null {
  const clean = purify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
  if (!/^\s*<svg[\s>]/i.test(clean)) {
    return null;
  }
  // Sans espace de noms, un SVG servi seul n'est pas affiché par le navigateur.
  return clean.includes(SVG_NAMESPACE)
    ? clean
    : clean.replace(/<svg/i, `<svg xmlns="${SVG_NAMESPACE}"`);
}
