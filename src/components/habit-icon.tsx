import {
  Barbell,
  BeerStein,
  BookOpenText,
  Brain,
  Cigarette,
  Coffee,
  Cookie,
  DeviceMobile,
  Drop,
  GameController,
  Leaf,
  Martini,
  Moon,
  MusicNotes,
  PencilSimpleLine,
  PersonSimpleRun,
  Pill,
  PokerChip,
  ShoppingBag,
  Target,
  TelevisionSimple,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Iconos de hábito.
 *
 * Se guarda una clave, no el dibujo: los emoji se ven distintos en cada
 * sistema —en Android son los de Google y no los de Apple— y el hábito de
 * alguien no debería cambiar de cara según el teléfono con que abra la app.
 */
// El tipo se deriva de un icono real en vez de importarse desde una ruta de
// dist: el paquete no lo exporta en su entrada pública y esa ruta cambia entre
// versiones.
type IconoPhosphor = typeof Target;

const REGISTRO: Record<string, IconoPhosphor> = {
  alcohol: BeerStein,
  copas: Martini,
  nicotina: Cigarette,
  azucar: Cookie,
  redes: DeviceMobile,
  apuestas: PokerChip,
  cafeina: Coffee,
  compras: ShoppingBag,
  videojuegos: GameController,
  pantallas: TelevisionSimple,
  pastillas: Pill,
  ejercicio: Barbell,
  mente: Brain,
  // Para los hábitos que se quieren construir, no dejar.
  correr: PersonSimpleRun,
  agua: Drop,
  leer: BookOpenText,
  dormir: Moon,
  meditar: Leaf,
  escribir: PencilSimpleLine,
  musica: MusicNotes,
  otro: Target,
};

export function HabitIcon({
  clave,
  size = 22,
  weight = "fill",
  className,
}: {
  clave: string;
  size?: number;
  weight?: "regular" | "bold" | "fill" | "duotone";
  className?: string;
}) {
  // Los hábitos creados antes del cambio guardaron un emoji. Se pintan tal
  // cual en vez de caer al icono genérico: quien ya lo tenía no debería ver
  // cambiar su hábito de golpe.
  if (!REGISTRO[clave]) {
    if (clave && !/^[a-z_]+$/.test(clave)) {
      return (
        <span aria-hidden="true" style={{ fontSize: size * 0.9, lineHeight: 1 }}>
          {clave}
        </span>
      );
    }
    const Generico = REGISTRO.otro;
    return <Generico size={size} weight={weight} className={className} aria-hidden="true" />;
  }

  const Componente = REGISTRO[clave];
  return <Componente size={size} weight={weight} className={className} aria-hidden="true" />;
}
