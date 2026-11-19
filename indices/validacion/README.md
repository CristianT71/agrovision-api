# Validación de escala y georreferenciación

El script usa solo numpy, tifffile y Pillow, además de los módulos del servicio.
No modifica imágenes ni escribe resultados en el vuelo. Identifica NIR mediante
`BandName="NIR"` en XMP porque los nombres almacenados son UUID; informa los TIFF
sin esa identificación y las capturas sin hora, sin inventar su banda u orden.

Desde `indices/`, con las dependencias del servicio instaladas:

```sh
python -m validacion.validar_escala 73c55c8a-5f4c-4e02-98a4-f279c0745feb
```

La imagen Docker actual solo copia `app/`. Para ejecutar este script en un
contenedor existente, sustituir `CONTENEDOR_INDICES` por su nombre y ejecutar
estos comandos desde la raíz del repositorio (con el código actualizado de
`indices/app/` ya desplegado):

```sh
docker cp indices/validacion CONTENEDOR_INDICES:/tmp/validacion
docker exec -e PYTHONPATH=/app:/tmp -w /app CONTENEDOR_INDICES python -m validacion.validar_escala 73c55c8a-5f4c-4e02-98a4-f279c0745feb
```

La raíz predeterminada es `/datos/vuelos`, configurable con `RAIZ_VUELOS` o
`--raiz /otra/carpeta`. La salida contiene una tabla y después un objeto JSON
con resumen, detalle de pares, omisiones y parámetros usados. Los desconocidos
se representan como `null`. Para ejecutar las pruebas sintéticas sin pytest:

```sh
cd indices
python tests/ejecutar.py
```

## Interpretación

- Se ordenan las capturas NIR por su hora XMP/EXIF, nunca por nombre de archivo.
  Se comparan vecinas de esa secuencia. Una captura no cenital no se elimina
  para crear artificialmente otro par. Horas iguales descartan el par; mezclar
  horas con y sin huso horario impide ordenar el vuelo y genera un error.
- Una cámara es cenital únicamente con `abs(pitch + 90) <= 5`. Cada par requiere
  altura y focal positivas, centro óptico, yaw, coordenadas y RTK confirmado
  en ambas capturas. La correlación supone traslación y suficiente solapamiento;
  rotación, relieve, vegetación en movimiento y cambios de escala pueden
  invalidarla. Se informa el cambio de yaw para ayudar a interpretar los pares.
- Se aplica correlación de fase a la **magnitud del gradiente** de cada imagen
  reducida por promedio a 1/2, 1/4 y 1/8, con ventana de Hann. Los tres módulos
  deben diferir como máximo un **4 %** del módulo de 1/4. Se devuelve el vector
  de 1/4 en píxeles originales, refinado mediante interpolación parabólica.
  El movimiento es el del **contenido de la primera imagen a la segunda**.
  La FFT es periódica: desplazamientos mayores que medio lado son ambiguos.
  Textura constante, valores no finitos y dimensiones incompatibles o menores
  de 64 píxeles se descartan.
- Cada par exige cambio circular de `yawGrados` **≤ 10°**, módulo **≥ 20 px**,
  distancia GPS **≥ 1 m** y error angular **≤ 15°**, además de coincidencia
  multiescala y RTK en ambas capturas. Se conserva la preferencia de
  `FlightYawDegree` de `geo.leer_geo`.
- Haversine usa un radio terrestre de 6371000 m. El GSD nominal del par es la
  media de altura/focal de ambas capturas. La razón compara el GSD efectivo
  (distancia GPS/módulo) con ese nominal. Para rumbo GPS `r` y yaw inicial `y`,
  el vector esperado del contenido es `(-sin(r-y), cos(r-y))`, con ángulos
  convertidos a radianes. El error angular es el ángulo con el vector medido.
- La tabla muestra los módulos de las tres escalas, coincidencia, razón y error
  angular. El JSON resume pares válidos/descartados, mediana, mínimo, máximo y
  MAD de las razones, y error angular mediano y máximo de los pares válidos.
- Solo se declara **escala coherente** con **al menos 8 pares válidos**, razón
  mediana en **[0,9; 1,1]** y **MAD ≤ 0,05** (sin normalización). Con al menos
  8 pares y mediana en ese intervalo pero MAD mayor, el veredicto es
  **escala variable: usar GSD efectivo local**. En otro caso: **escala NO validada**.
  El veredicto incluye los números; un vuelo no validado globalmente puede
  tener pares útiles para estimar el GSD local.

## Campos del servicio

Cada captura usa una única referencia geométrica: la banda NIR ya cargada.
El servicio ordena las capturas usadas por hora NIR XMP/EXIF. Si falta alguna
hora o se mezclan horas con y sin huso, conserva el nominal: no inventa el orden.
Las horas repetidas invalidan los pares que tocan esas capturas, sin saltarlas.
El GSD efectivo de una captura es la media de sus pares válidos adyacentes;
si no tiene ninguno, se usa altura/focal nominal, o `null` si tampoco se conoce.
`app.escala.gsd_efectivo_pares` devuelve `{pares, capturas}` sin mutar la entrada;
las copias de capturas incluyen `gsdEfectivoM` (metros/píxel o `null`).

`ficha.gsdCmPx` resume el GSD usado. Se añaden `gsdNominalCmPx`,
`gsdEfectivoCmPx` (con `capturasConEfectivo`), `razonEfectivoNominal`
(mediana, mínimo y máximo de pares válidos), `paresValidos` y `paresTotales`.
Los resúmenes sin mediciones son `null`; los contadores son cero cuando no
hay pares evaluables. Cada zona incluye `gsdOrigen` (`efectivo`, `nominal` o
`null`); su polígono, centro y área usan el GSD seleccionado para su captura.
Se advierte cuando hay respaldo nominal y cuando una razón válida baja de 0,9.

 Las estadísticas
GSD cuentan una vez cada captura con altura y focal válidas, incluso si no puede
proyectarse por faltar orientación. `rtkPct` se calcula entre capturas con
`GpsStatus` conocido; si ninguno se conoce es `null`. Las capturas
georreferenciables requieren todos los datos de proyección y cámara cenital;
RTK se informa por separado y no es obligatorio para proyectar en el servicio.

La rejilla usa el mismo recorte entero que `calculo.medias_celdas`. Si las bandas
se reducen para igualar tamaños, se transforman las esquinas de la rejilla al
sistema de píxeles NIR original por separado en cada eje. `ubicacion` conserva el
valor histórico de la petición. `ubicacionZona` y `areaM2` corresponden al casco
convexo exacto, que puede incluir huecos o concavidades de la zona detectada.
`poligono` se envía sin repetir el primer vértice y con un máximo de 12 vértices:
solo si el casco excede ese tamaño se eliminan los vértices de menor área
triangular. Es una representación simplificada que puede omitir pequeñas cuñas;
el cálculo puro del casco, área y centroide conserva todos los vértices reales.

**GSD y coordenadas por píxel suponen terreno plano y cámara vertical; la altura
es relativa al punto de despegue, no al suelo.** No se corrige distorsión de lente;
el error crece con la pendiente. La validación no sustituye una ortofoto ni un
modelo digital del terreno.
