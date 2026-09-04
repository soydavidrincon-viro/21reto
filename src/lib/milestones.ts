/**
 * Los días que se celebran. No es una escala regular a propósito: los primeros
 * son los que cuestan, así que van juntos, y después se separan a medida que la
 * racha se sostiene sola.
 */
export const MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 180, 365];

/** El hito que se acaba de alcanzar con esta racha, si alguno. */
export function milestoneReached(streak: number): number | null {
  return MILESTONES.includes(streak) ? streak : null;
}

/** El siguiente hito por delante, o null si ya pasó el último. */
export function nextMilestone(streak: number): number | null {
  return MILESTONES.find((day) => day > streak) ?? null;
}

/**
 * Cuánto falta para lo próximo que vale la pena decir.
 *
 * Es el más cercano entre el siguiente hito y la meta del reto: "Faltan 3
 * para tu semana" dice más que "18/21", porque nombra algo que se puede
 * imaginar. Si la meta es lo más cercano, se dice la meta. Con racha en cero
 * no se dice nada: "faltan 7 para tu semana" a quien va en cero es presión, no
 * información.
 */
export function faltaPara(
  streak: number,
  targetDays: number,
): { dias: number; texto: string } | null {
  if (streak <= 0) return null;

  const hito = nextMilestone(streak);
  const metaFalta = targetDays - streak;
  const hitoFalta = hito === null ? Infinity : hito - streak;

  if (metaFalta > 0 && metaFalta <= hitoFalta) {
    return {
      dias: metaFalta,
      texto: metaFalta === 1 ? "Mañana llegas a tu meta" : `En ${metaFalta} días llegas a tu meta`,
    };
  }
  if (hito === null) return null;

  const nombre = NOMBRE_DE_HITO[hito] ?? `${hito} días`;
  return {
    dias: hitoFalta,
    texto: hitoFalta === 1 ? `Mañana llegas a ${nombre}` : `Faltan ${hitoFalta} para ${nombre}`,
  };
}

const NOMBRE_DE_HITO: Record<number, string> = {
  3: "tres días",
  7: "tu semana",
  14: "dos semanas",
  21: "veintiún días",
  30: "tu mes",
  60: "dos meses",
  90: "noventa días",
  180: "medio año",
  365: "tu año",
};

/** Qué se le dice a alguien que acaba de llegar a cada hito. */
export function milestoneCopy(day: number): { title: string; detail: string } {
  switch (day) {
    case 1:
      return {
        title: "Primer día",
        detail: "El más difícil de todos ya está hecho.",
      };
    case 3:
      return {
        title: "Tres días",
        detail: "Aquí es donde el cuerpo empieza a bajar el ruido.",
      };
    case 7:
      return {
        title: "Una semana",
        detail: "Pasaste un fin de semana completo. Eso pesa.",
      };
    case 14:
      return {
        title: "Dos semanas",
        detail: "Ya no estás resistiendo: estás cambiando la costumbre.",
      };
    case 21:
      return {
        title: "Veintiún días",
        detail: "Cumpliste el reto. Puedes cerrarlo o seguir contando.",
      };
    case 30:
      return { title: "Un mes", detail: "Un mes entero de decisiones tuyas." };
    case 60:
      return { title: "Dos meses", detail: "Esto ya es cómo vives, no un intento." };
    case 90:
      return { title: "Noventa días", detail: "El trimestre completo." };
    case 180:
      return {
        title: "Medio año",
        detail: "Seis meses. Lo que empezó como un reto ya es tu vida normal.",
      };
    case 365:
      return { title: "Un año", detail: "Un año entero. Trescientos sesenta y cinco decisiones." };
    default:
      return { title: `${day} días`, detail: "Sigue contando." };
  }
}
