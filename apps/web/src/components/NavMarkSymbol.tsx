import type { NavMark } from "../lib/navigation.ts";
import { HkmKuerzel, HkmLogo } from "./HkmLogo.tsx";

/**
 * Das Zeichen oben in der Navigation. Ab Werk das Logo „HKM finanz“ (`HkmLogo.tsx`): ausgeklappt und am Handy
 * das ganze Logo, eingeklappt der Bogen mit dem Kürzel; der Server liefert beide, CSS zeigt eins. Hat die Firma ein eigenes
 * Zeichen gewählt, steht es fest quadratisch (styles.css) neben „Haben“: das Logo der Belege auf weißer Fläche (Logos sind
 * für Papier gemacht) oder das „H“ in eigener Farbe. Farbe als Inline-Style ist die Ausnahme aus DESIGN.md (Farben und Themes).
 */
export function NavMarkSymbol({ mark }: { mark: NavMark }) {
  if (!mark)
    return (
      <span className="brand-hkm">
        <HkmLogo className="brand-hkm-voll" />
        <HkmKuerzel className="brand-hkm-kurz" />
      </span>
    );
  if ("logo" in mark) return <img className="brand-logo" src={mark.logo} alt="" width={40} height={40} />;
  return (
    <span className={mark.kante ? "brand-mark brand-mark-kante" : "brand-mark"} style={{ background: mark.background, color: mark.ink }}>
      H
    </span>
  );
}
