import { useEffect, useRef } from 'react';

// Fond GRUNGE "crade / béton / xerox / coulures" peint en canvas — le MÊME que la page de sélection des
// jeux (wizard). À poser derrière le contenu (fixed, z-index 0 ; le contenu doit être en z-index ≥ 1).
// Ce n'est PAS une trame de points régulière : c'est une texture organique (taches, grain, rayures).
export default function GrungeBg() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const ctx = cv.getContext('2d'); if (!ctx) return;
    const paint = () => {
      const W = window.innerWidth, H = window.innerHeight; if (W < 2 || H < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      // grandes taches de lumière / ombre (béton)
      for (let i = 0; i < 26; i++) { const x = Math.random() * W, y = Math.random() * H, r = 120 + Math.random() * 360; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, Math.random() < 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      // grain irrégulier (poussière)
      const density = Math.min(90000, Math.floor((W * H) / 26));
      for (let i = 0; i < density; i++) { const x = Math.random() * W, y = Math.random() * H, dark = Math.random() < 0.62; ctx.fillStyle = dark ? `rgba(0,0,0,${0.10 + Math.random() * 0.35})` : `rgba(255,255,255,${0.03 + Math.random() * 0.10})`; ctx.fillRect(x, y, Math.random() < 0.85 ? 1 : 2, Math.random() < 0.85 ? 1 : 2); }
      // ombres douces localisées
      for (let i = 0; i < 14; i++) { const x = Math.random() * W, y = Math.random() * H, r = 30 + Math.random() * 140; const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r); g.addColorStop(0, `rgba(0,0,0,${0.06 + Math.random() * 0.10})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.lineCap = 'round';
      // coulures verticales
      for (let i = 0; i < 40; i++) { const x = Math.random() * W, y = Math.random() * H * 0.6, len = 40 + Math.random() * 260; ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`; ctx.lineWidth = 0.6 + Math.random() * 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() * 4 - 2), y + len); ctx.stroke(); }
      // rayures claires (griffures xerox)
      for (let i = 0; i < 22; i++) { const x = Math.random() * W, y = Math.random() * H, len = 20 + Math.random() * 90, a = Math.random() * 0.6 - 0.3; ctx.strokeStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`; ctx.lineWidth = 0.5 + Math.random(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke(); }
    };
    // Peinture LOURDE (~85k fillRect) → on la sort de la frame critique (montée / changement de phase) via rAF,
    // et on COALESCE le resize (un drag envoie des dizaines d'events → au plus UNE peinture par frame). Sortie visuelle identique.
    let raf = 0;
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); };
    schedule();
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', schedule); };
  }, []);
  return <canvas ref={ref} className="grungebg" aria-hidden="true" />;
}
