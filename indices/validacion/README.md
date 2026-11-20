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

## Conteo experimental de copas por captura

```sh
python -m validacion.contar_copas VUELO_UUID --salida /tmp/copas.png
python -m validacion.contar_copas VUELO_UUID --captura 3 --salida /tmp/cuadro.png
```

`--captura` es el índice **desde cero** de los NIR ordenados por hora; por defecto
se elige la primera captura georreferenciable/cenital. `--raiz` y `RAIZ_VUELOS`
funcionan igual que en el verificador de escala. Se exige una única banda roja
con la misma hora de captura. Un emparejamiento ambiguo se rechaza. Requiere las
dependencias TIFF que ya utiliza el servicio, además de numpy y Pillow.

Se intenta medir GSD con las vecinas inmediatas usando `app/escala.py`; las horas
repetidas invalidan sus pares y no se saltan capturas inclinadas. Si no es medible,
se usa nominal con advertencia. Una captura inclinada seleccionada explícitamente
produce conteo `null` y no genera PNG. No se estima el total del lote.

Para comparar un rectángulo del NIR original:

```sh
python -m validacion.contar_copas VUELO_UUID --captura 3 --recorte 100,200,1100,1200 --salida /tmp/recorte.png
```

Los extremos finales son exclusivos. Se detecta con el contexto de toda la
captura y se cuentan solo centros dentro del rectángulo. El PNG muestra únicamente
ese rectángulo; las coordenadas JSON siguen siendo píxeles NIR originales.
`areaRecorteM2` es ancho × alto × GSD²; `areaAnalizadaM2` resta la intersección
con las masas grandes. Sin recorte se conserva la exclusión de un radio mínimo
en el borde. No se añade ese margen a un recorte manual.

El PNG tiene hasta 1300 px de ancho, NIR en gris, círculos numerados verdes,
fusionadas en naranja y masas grandes en gris sin numerar. Los círculos usan el
diámetro equivalente medido; no representan el contorno exacto. El marco cian
marca el rectángulo de análisis. El contraste del PNG no cambia la detección.

El detector promedia a factor 2 y suaviza con gaussiana. Sustituye Otsu global por
contraste relativo `(NIR suavizado - fondo local) / abs(fondo local)`. El fondo
es una media de ventana ancha de aproximadamente 6 m, calculada por sumas
acumuladas. Exige contraste >= 0,05, NDVI >= 0,4 y diámetro >= 0,4 m. No busca
señales de menor contraste. **NDVI alto no separa pasto de café**.

El diámetro se mide sobre la componente conectada que supera la mitad del
contraste del pico. Solo se reparte por proximidad el solapamiento de esas regiones
brillantes, sin incorporar pasto exterior. Dos máximos separados al menos 0,4 m
requieren un valle de al menos 3% del pico menor: si siguen conectados por encima
de ese nivel, se conserva un único máximo. Una copa es fusionada si su región
brillante contiene otro máximo significativo; se conserva además la regla del
vecino a menos de 0,52 m. El diámetro grande por sí solo no activa esa etiqueta.

Una región con un único máximo significativo y diámetro equivalente > 2,5 m
se registra en `masasGrandes` y `regionesGrandes`, con su área y diámetro.
`areaMasasGrandesM2` informa el área excluida dentro del rectángulo de análisis,
incluso si el centro de la masa queda fuera. `masasGrandes` cuenta centros dentro.
No entra en conteo ni densidad. `descartadasGrandes` conserva el mismo contador
por compatibilidad. Con área analizable cero, la densidad es `null`.

Todos los umbrales tienen nombre en `app/copas.py`: **provisional, calibrar con
conteos manuales**. La prueba tenue/brillante acepta ambas cuando superan el
contraste local y rechaza la tenue cuando su contraste es insuficiente. La prueba
anterior de vecinas usaba manchas de diámetro inferior al mínimo: se ampliaron
para probar proximidad sin contradecir el nuevo filtro de tamaño. Se comprueban
además diámetro a media altura, copa grande individual, masa con textura débil,
resta de área, pasto y recorte. Solo requieren numpy, Pillow y biblioteca estándar.

La estadística de diámetro requiere tres copas; vecino más cercano requiere dos;
CV es desviación poblacional/media. NaN se excluye del promedio y de la máscara;
el área sigue siendo geométrica salvo la resta de masas. Una zona sin datos no
demuestra ausencia de plantas. Las masas más extensas que la ventana de fondo,
la iluminación desigual y los bordes requieren validación manual adicional.

No se ejecutaron los TIFF reales en esta tarea. Las referencias proporcionadas
son 63 detecciones frente a 78 manuales en A, 37 frente a 38 en B y unas 21
frente a aproximadamente 2 en C. No se ajustaron parámetros con estos conteos;
queda pendiente medir separabilidad con el explorador y validar por separado.

El servicio añade `plantas`, sin imágenes ni lista pesada de coordenadas. Cada
captura no elegible conserva sus mediciones en `null`. La densidad del vuelo es
el promedio de las densidades válidas por captura (incluidos ceros); nunca la suma
de conteos, porque las imágenes se solapan. `siembra` recibe densidad detectada y
diferencia porcentual frente a la teórica; `conteoReal` permanece `null`.

## Exploración de rasgos de copas (tarea H)

Desde `indices/`:

```sh
python -m validacion.explorar_copas VUELO_UUID --captura 2 \
  --recorte A=840,660,1840,1460 --recorte B=1760,860,2560,1500 \
  --recorte C=0,360,800,1000 --gsd-m 0.01368 --csv /tmp/rasgos.csv \
  > /tmp/rasgos.json
```

`--gsd-m` permite usar el GSD efectivo conocido de esta captura. Sin esa opción
se usa exactamente la selección local/nominal de `contar_copas`, informando su
origen. No hay recortes predeterminados; las etiquetas son libres y únicas.
Se requiere al menos uno. Solo las etiquetas A, B, C activan la comparación
C frente a A+B; otras etiquetas aparecen únicamente en el resumen. Los recortes
se validan contra el tamaño NIR. Se detecta una sola vez con contexto completo,
y se seleccionan centros; los identificadores CSV son estables entre recortes.
Los recortes solapados pueden repetir observaciones: no son muestras independientes.

Stdout contiene exclusivamente un JSON; stderr contiene la tabla y advertencias.
Por rasgo se informa `n` válido, mediana, p10 y p90 (desconocidos: `null`).
El CSV contiene una fila por copa, con coordenadas originales y `null` explícito.
Las masas previamente excluidas por tamaño se conservan como detalle en JSON,
pero no entran en las estadísticas de copas ni en el CSV.

AUC mide P(valor de C > valor de A+B), con medio punto por empate: 1 indica
valores mayores en C, 0 menores, 0,5 ausencia de orden discriminante. Se muestran
ambos sentidos (`>=` y `<=`) y un umbral candidato por sentido que marca al menos
el 90% de C con dato válido. Se usan estadísticos de orden inclusivos, por lo que
los empates pueden marcar más. Se informa cuántas observaciones A+B se perderían,
el porcentaje y los tamaños muestrales válidos; no se imputan rasgos ausentes.
Con una clase vacía, AUC es `null` y no hay candidatos.

**Es exploración, no validación.** Pertenecer a C no demuestra que cada copa sea
no-café; A+B tampoco son etiquetas individuales. Tres recortes no permiten
estimar generalización. Las referencias manuales suministradas son A=78, B=38,
C≈2; no se han usado para inventar umbrales ni resultados de separabilidad.

Los rasgos usan la región brillante asignada por el detector (no toda la
componente de baja exigencia):

- `areaRegionM2` es alias de `areaM2`; `diametroM` es el diámetro circular equivalente.
- `solidez` divide el área por el casco convexo de las celdas completas, obtenido
  mediante extremos por fila. `excentricidad` es sqrt(1 − momento menor/mayor),
  con la varianza interna de las celdas; cero corresponde a forma isotrópica.
- `texturaNir` es desviación poblacional/media del NIR original sin suavizar
  (calibrado cuando hay metadatos), sobre los píxeles cubiertos por la región.
  Media no positiva o ausencia de datos da `null`. `ndviMedio` usa los píxeles
  finitos de esa misma región. La rejilla roja se lleva a NIR como en el conteo.
- `contrasteMedio` promedia el contraste relativo del detector en la región.
- `numeroMaximos` cuenta mesetas máximas locales de la componente conectada de
  baja exigencia antes de rechazar por separación, valle o tamaño. Una meseta
  cuenta una vez; varias copas pueden compartir este número. No mide todos los
  picos del NIR crudo ni usa un nuevo umbral ajustado.

El cálculo nuevo solo usa numpy y el dibujo Pillow; la lectura de metadatos
reutiliza los módulos del servicio y su dependencia TIFF existente.

### Clasificación opcional para revisión humana

`clasificarAtipicas=False` conserva conteos, filtros y áreas históricos. Con
`True`, `areaAnalizadaM2` conserva toda el área geométrica, incluidas masas
históricas y atípicas; la densidad usa únicamente `copas` sobre esa área total.
Los filtros históricos de detección/tamaño siguen funcionando: activar el modo
neutro no rescata automáticamente las regiones antes descartadas.

Todos los siguientes parámetros son **provisionales, calibrar con conteos
manuales**, y parten de `null` (condición desactivada):

| Parámetro | Condición inclusiva |
| --- | --- |
| `atipicaAreaMinM2` | área ≥ umbral |
| `atipicaDiametroMinM` | diámetro ≥ umbral |
| `atipicaSolidezMax` | solidez ≤ umbral |
| `atipicaExcentricidadMin` | excentricidad ≥ umbral |
| `atipicaTexturaNirMin` | textura ≥ umbral |
| `atipicaNdviMax` | NDVI ≤ umbral |
| `atipicaContrasteMin` | contraste ≥ umbral |
| `atipicaNumeroMaximosMin` | máximos ≥ umbral |

Deben cumplirse **todas las condiciones configuradas** y existir al menos una.
Un dato desconocido no cumple una condición. Los umbrales individuales de H2
no calibran automáticamente esta conjunción. Ninguno se transfiere al detector.
Se pueden revisar tanto copas aceptables por tamaño como masas de un solo máximo
ya registradas por el filtro histórico. Las marcadas pasan a `copasAtipicas`,
con los mismos rasgos, y salen de conteo, vecinos y estadísticas de diámetro.
`atipicasConteo` cuenta centros incluidos y `atipicasAreaM2` suma las regiones
completas de esos centros (pueden rebasar el recorte); no es el área recortada.
No se infiere especie ni condición de árbol de sombra.

Para dibujarlas, pasar a `contar_copas` un archivo JSON de parámetros mediante
`--parametros /tmp/parametros-copas.json`. Por ejemplo, el modo neutro se expresa
como `{"clasificarAtipicas": true}`; no excluirá nuevas copas. Tras fijar los
umbrales con evidencia, añadirlos a ese objeto. El PNG muestra atípicas con
arcos grises discontinuos e identificadores A1, A2…; las masas históricas
mantienen borde gris continuo. Los círculos representan diámetro equivalente,
no el contorno exacto de la región.
