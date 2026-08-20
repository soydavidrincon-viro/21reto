import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Qué día es "hoy" para este usuario.
 *
 * Todo el trackeo cuelga de esta respuesta. Si se calculara con la hora del
 * servidor, alguien que marca a las 23:40 en Ciudad de México vería su check
 * caer en el día siguiente y perdería la racha sin haber hecho nada mal.
 */
export function todayIn(timeZone: string): string {
  return formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
}

/** Zona horaria del navegador, para sembrar el perfil en el primer ingreso. */
export function detectTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Días transcurridos entre dos fechas ISO (yyyy-MM-dd), sin horas de por medio. */
export function daysBetween(fromISO: string, toISO: string): number {
  return differenceInCalendarDays(parseISO(toISO), parseISO(fromISO));
}

/** La fecha ISO desplazada n días. Negativo va hacia atrás. */
export function shiftISO(dateISO: string, days: number): string {
  return format(addDays(parseISO(dateISO), days), "yyyy-MM-dd");
}

/**
 * Los siete días que terminan en `todayISO`, del más viejo al más nuevo.
 * Es la tira de fechas de la pantalla Hoy y la fila de checks del detalle.
 */
export function lastSevenDays(todayISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftISO(todayISO, i - 6));
}

const WEEKDAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"];

/** Inicial del día en español: L M M J V S D. */
export function weekdayInitial(dateISO: string): string {
  return WEEKDAY_INITIALS[parseISO(dateISO).getDay()];
}

/** Número del día del mes, para las píldoras de la tira de fechas. */
export function dayOfMonth(dateISO: string): number {
  return parseISO(dateISO).getDate();
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const WEEKDAYS = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];

/** "Jueves 20 de agosto", el encabezado de la pantalla Hoy. */
export function longDate(dateISO: string): string {
  const date = parseISO(dateISO);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

/** Nombre del mes, para el encabezado del heatmap. */
export function monthName(dateISO: string): string {
  const name = MONTHS[parseISO(dateISO).getMonth()];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * La cuadrícula del mes que contiene `dateISO`, alineada a semanas que empiezan
 * en lunes. Las celdas de relleno del inicio vienen como null.
 */
export function monthGrid(dateISO: string): (string | null)[] {
  const ref = parseISO(dateISO);
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();

  // getDay() cuenta desde domingo; la semana de la app empieza en lunes.
  const leading = (first.getDay() + 6) % 7;

  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      format(new Date(ref.getFullYear(), ref.getMonth(), i + 1), "yyyy-MM-dd"),
    ),
  ];
}
