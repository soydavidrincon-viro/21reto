/**
 * Lo que se ve mientras el servidor arma la pantalla.
 *
 * Sin esto, tocar una pestaña no hacía nada visible hasta que el servidor
 * contestaba: el dedo tocaba, la pantalla se quedaba igual medio segundo o dos,
 * y eso se siente como que la app está trabada, no como que está cargando.
 *
 * Next lo enseña al instante porque no depende de ningún dato. El carril y la
 * barra de pestañas viven en el layout, así que no parpadean: lo único que
 * cambia es esta zona.
 *
 * Las piezas son del tamaño aproximado de lo que viene después. Un esqueleto
 * que no se parece a la pantalla real produce un salto al llegar los datos, que
 * es peor que no poner nada.
 */
export default function Cargando() {
  return (
    <div className="flex animate-pulse flex-col gap-4 pt-11 lg:pt-0">
      <div className="flex flex-col gap-2 px-5 lg:px-0">
        <span className="block h-3 w-32 rounded bg-fill" />
        <span className="block h-7 w-44 rounded-lg bg-fill" />
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.45fr_1fr] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <span className="mx-4 block h-[72px] rounded-[22px] bg-fill lg:mx-0" />
          <span className="mx-4 block h-[188px] rounded-[26px] bg-fill lg:mx-0" />
          <div className="flex flex-col gap-2.5 px-4 lg:px-0">
            {[0, 1, 2].map((i) => (
              <span key={i} className="block h-[90px] rounded-[22px] bg-fill" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <span className="mx-4 block h-[132px] rounded-[22px] bg-fill lg:mx-0" />
          <span className="mx-4 block h-[88px] rounded-[22px] bg-fill lg:mx-0" />
        </div>
      </div>

      <span className="sr-only" role="status">
        Cargando
      </span>
    </div>
  );
}
