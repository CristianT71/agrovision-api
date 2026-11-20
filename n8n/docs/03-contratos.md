# Contratos entre los flujos

Estado: **vigente** (2026-11-14). Si cambia un campo, se cambia aquí y en los dos flujos que lo usan.

Los flujos se llaman entre sí con un JSON. Estos son los formatos.

## Entrada del flujo `03-informe-pdf` (la produce el flujo 02)

```json
{
  "vuelo": {
    "id": "uuid del vuelo",
    "nombre": "Vuelo lote norte",
    "lote": "La Esperanza",
    "fecha": "2026-11-12",
    "notas": null,
    "alturaRelativaM": 80,
    "rtkFijoPct": 92.5,
    "cantidadCapturas": 42
  },
  "analisis": {
    "generadoEn": "2026-11-14T15:30:00-05:00",
    "indices": [
      {
        "nombre": "NDVI",
        "formula": "(NIR - R) / (NIR + R)",
        "media": 0.71,
        "mediana": 0.74,
        "p10": 0.42,
        "p90": 0.85,
        "umbral": 0.5,
        "areaBajoUmbralPct": 12.4
      }
    ],
    "zonas": [
      {
        "id": "Z1",
        "descripcion": "Franja con vigor bajo en el borde oriental",
        "severidad": "alta",
        "indice": "NDVI",
        "valor": 0.38,
        "ubicacion": { "lat": 5.5, "lon": -75.8 }
      }
    ],
    "observaciones": ["texto libre del modelo de visión"],
    "confianza": "media",
    "limitaciones": ["Sin banda rededge en 3 capturas"]
  }
}
```

- Obligatorios: `vuelo.id`, `vuelo.nombre`, `analisis.indices` (al menos uno).
- `severidad`: `alta`, `media`, `baja` o `informativa`. `confianza`: `alta`, `media` o `baja`.
- Los campos opcionales pueden ir en `null` o no venir. El informe no inventa lo que falta: lo omite.
- Los números ya vienen **calculados** por código. El modelo de redacción no calcula ni convierte cifras.

## Salida del flujo `03-informe-pdf`

```json
{
  "ok": true,
  "informeId": "1794767400-3f9a...(48 caracteres hexadecimales)",
  "archivo": "<informeId>.pdf",
  "enlace": "https://n8n.agrovision.sbs/webhook/informe?t=<informeId>",
  "expiraEn": "2026-11-15T20:31:00.000Z",
  "advertencias": ["Cifras del texto que no aparecen en los datos: 17,3"],
  "consumo": { "entrada": 1800, "salida": 2100, "razonamiento": 0 }
}
```

- El PDF queda en `/informes/<informeId>.pdf` dentro del contenedor (`n8n/data/informes/` en el equipo).
- El `informeId` tiene la forma `<vencimiento en segundos Unix>-<48 caracteres hexadecimales aleatorios>`.
  La parte aleatoria hace imposible adivinarlo: quien tenga el enlace puede descargar el PDF hasta que
  venza. El flujo `04` valida el formato exacto y el vencimiento antes de tocar el disco. Como el
  vencimiento va dentro del nombre del archivo, no se puede alargar cambiando el enlace.
- Los PDF vencidos **no se borran solos** (n8n no tiene un nodo para eso): se pueden borrar a mano de
  `n8n/data/informes/`.
- Si algo falla, el flujo termina con error (no devuelve `ok: false` a medias) y lo recoge el flujo `05`.

## Variantes de entrada del flujo `03`

Además del JSON completo de arriba, el flujo acepta solo `{ "vueloId": "uuid" }`. En ese caso llama
primero al flujo `02` para calcular el análisis. Es lo que usa la herramienta `generar_informe` del chat.

## Flujo `02-analisis-vuelo`

- Entrada: `{ "vueloId": "uuid" }`.
- Salida: `{ "vuelo": {...}, "analisis": {...}, "consumoVision": {...} }`, con `vuelo` y `analisis` tal
  como se describen arriba. Las cifras (índices y valor de cada zona) vienen del servicio de índices; el
  modelo de visión solo aporta el texto, la severidad, la confianza y las limitaciones.

## Servicio de índices (Python) — implementado en `indices/` (2026-11-18)

Lo llama el flujo `02` en `POST http://indices:8000/analizar`. Lee los TIFF directamente del disco
(`/datos/vuelos/<vueloId>/<archivoId>.<extensión>`, en solo lectura).

Petición:

```json
{
  "vueloId": "uuid",
  "umbrales": { "NDVI": 0.5, "NDRE": 0.3, "GNDVI": 0.45 },
  "maxImagenes": 4,
  "capturas": [
    {
      "id": "DJI_20261112101500_0001",
      "bandas": { "green": "archivoId", "red": "archivoId", "rededge": "archivoId", "nir": "archivoId" },
      "rgb": "archivoId o null",
      "ubicacion": { "lat": 5.5, "lon": -75.8 },
      "capturadoEn": "2026-11-12T10:15:00Z"
    }
  ]
}
```

Respuesta:

```json
{
  "capturasUsadas": 4,
  "indices": [
    { "nombre": "NDVI", "formula": "(NIR - R) / (NIR + R)", "media": 0.71, "mediana": 0.74, "p10": 0.42, "p90": 0.85, "umbral": 0.5, "areaBajoUmbralPct": 12.4 }
  ],
  "zonasCandidatas": [
    { "id": "Z1", "indice": "NDVI", "valor": 0.38, "areaPct": 3.1, "capturaId": "DJI_20261112101500_0001", "ubicacion": { "lat": 5.5, "lon": -75.8 } }
  ],
  "mapas": [
    { "titulo": "NDVI — captura 1", "indice": "NDVI", "capturaId": "DJI_20261112101500_0001", "mime": "image/png", "base64": "..." },
    { "titulo": "Foto RGB — captura 1", "indice": "RGB", "capturaId": "DJI_20261112101500_0001", "mime": "image/png", "base64": "..." }
  ],
  "advertencias": ["Captura X sin georreferencia"]
}
```

- Los mapas van reducidos (lado largo de unos 1.024 px) para no gastar tokens de imagen.
- Los índices se calculan con los valores reales de reflectancia; las cifras salen siempre del servicio.

## Qué escribe el modelo de redacción

Responde **solo un JSON** con esta forma; el flujo lo valida y lo convierte en HTML:

```json
{
  "titulo": "string",
  "resumenEjecutivo": "string, hasta 120 palabras",
  "hallazgos": [
    { "titulo": "string", "detalle": "string", "severidad": "alta|media|baja|informativa", "referencia": "Z1 o NDVI" }
  ],
  "interpretacionIndices": [{ "indice": "NDVI", "lectura": "string" }],
  "recomendaciones": ["string"],
  "limitaciones": ["string"]
}
```

Reglas que el modelo debe cumplir (van en el prompt de sistema y se revisan en el flujo):

1. Solo usa cifras que estén en los datos. No calcula, no redondea de otra manera, no convierte (por
   ejemplo 0,124 a 12,4 %).
2. No diagnostica enfermedades ni plagas: un índice bajo indica **vigor reducido**, no la causa.
3. Las recomendaciones son **verificaciones en campo** que haría un agrónomo. **Sin productos ni dosis.**
4. Si falta un dato, lo dice en `limitaciones` en vez de suponerlo.
5. Español claro, sin relleno.

## Comprobación de cifras

Después de redactar, el flujo busca en el texto todos los números y comprueba que existan en los datos de
entrada (también acepta los enteros del 0 al 10, años y los valores ×100 y ÷100). Los que no aparezcan van a
`advertencias` y se muestran en el PDF en una nota de revisión. No bloquea el informe: avisa.

## Ficha, variabilidad y correlación con la app (2026-11-19)

Ambas ramas del flujo 02 (con visión y por reglas) conservan los siguientes campos del servicio en
`analisis`. Los datos desconocidos son `null`; el PDF muestra «no disponible» para la ficha y la
variabilidad ausentes.

- `ficha`: `{ sensores: string[] | null, resolucionesPx: [{ancho, alto}] | null,
  bandasDisponibles: string[] | null, alturaRelativaM: {min, max} | null, capturasUsadas,
  capturasConGeorreferencia, calibracion: {calibradas, sinCalibrar}, fechaCaptura: {min, max} | null,
  gsdCmPx: {min, max, media} | null, gsdNominalCmPx, gsdEfectivoCmPx: {min, max, media, capturasConEfectivo} | null,
  razonEfectivoNominal: {mediana, min, max} | null, paresValidos, paresTotales, georreferenciacion }`.
  Altura en metros, resolución en píxeles, GSD en cm/píxel.
- **GSD:** el nominal es altura relativa ÷ focal (la altura es relativa al despegue, no al suelo). El efectivo se
  mide con pares de capturas consecutivas (distancia GPS RTK ÷ desplazamiento medido entre imágenes) y se usa donde
  exista; si no, se usa el nominal y la zona lo indica en `gsdOrigen`. Para medirlo, la petición a `/analizar`
  incluye `capturasEscala`: todas las capturas del vuelo (solo banda NIR), porque las capturas analizadas están
  separadas y no se solapan. Cada zona candidata añade `ubicacionZona`, `poligono`, `areaM2` y `gsdOrigen`.
- **Qué copia el flujo 02 al `analisis`:** `plantas` (con `notaValidacion`: estimación experimental sin validar y
  error observado de −19 % a +46 %) y, en cada zona, `ubicacionZona`, `areaM2`, `gsdOrigen` y `poligono`.
  El flujo 03 **no envía `poligono` al modelo** (gasta tokens) y el PDF muestra el área de cada zona, el bloque
  «Conteo de copas (experimental)» y los GSD nominal, efectivo y la razón entre ambos. El chat puede explicarlos.
- **Prueba nula del comparador** (mismo sitio y día, 70 m frente a 30 m): NDVI +0,07, NDRE +0,03 y GNDVI +0,05.
  Un solo par de vuelos: sirve como orden de magnitud del ruido, no como umbral. Para comparar fechas conviene
  volar a la misma altura.
- Cada elemento de `indices` incluye `desviacion` y `cv` (números o `null`). El PDF los muestra
  sin convertir el CV a porcentaje.
- `variabilidadEspacial`: `{desviacion, celdasValidas, nivel: "baja" | "media" | "alta" | null}`;
  sus umbrales son provisionales. Se conserva completa en el análisis.

Después de calcular índices, `Registros de la app` consulta
`GET {urlApi}/servicio/vuelos/{vueloId}/correlacion-app?radioM={config.radioCorrelacionM}` con
`X-Api-Key` mediante la credencial existente `apiAgroVision01`. El radio configurado es 300 m;
la petición tiene timeout de 30 s, `neverError` y continuidad ante errores de transporte.
La API devuelve `{caja, cajaAmpliada, radioM, fechaVuelo, limitaciones, registros, truncado, resumen}`.
Los registros consentidos incluyen origen, clase, confianza, fecha, latitud, longitud y
`diasDesdeVuelo`; se usan únicamente dentro de `Correlacionar con la app`.

El nodo devuelve la respuesta completa del servicio de índices más `correlacionApp`, y agrega las
limitaciones a `advertencias`. Ambas ramas producen:

```text
analisis.correlacionApp = {
  radioM,
  registrosCercanos: número,
  registrosEnAreaVuelo: número | null,
  fechaMin: fecha | null,
  fechaMax: fecha | null,
  diasMinDesdeVuelo: número | null,
  diasMaxDesdeVuelo: número | null,
  porCaptura: [{capturaId, zonas: [id de zona], cercanos, clases: {"nombre de clase": conteo}}],
  limitaciones: [texto]
} | null
```

- `registrosCercanos` cuenta los registros a una distancia menor o igual a `radioM` del centro de alguna captura
  analizada (sin repetir un registro cercano a varias capturas). `registrosEnAreaVuelo` cuenta los recibidos dentro
  de `caja` (sur/norte/oeste/este), no de la caja ampliada; no equivale a un lindero exacto. Sin caja válida es `null`.
- Las zonas se ubican en el centro de su captura (no hay georreferencia por píxel), así que la cercanía se calcula
  **por captura** con Haversine y las zonas de una misma captura comparten el resultado (`zonas` lista sus ids).
  Una observación puede contarse en varias capturas. Las clases nulas se agrupan como `sin clase`.
  Las capturas sin ubicación se omiten y se advierte; los registros sin coordenadas válidas no se cuentan.
- Las fechas y diferencias temporales son extremos de los registros recibidos en la caja ampliada.
  Los días se redondean a un decimal y conservan el signo: negativos antes del vuelo, positivos después.
  Sin datos temporales, los extremos son `null`; no se supone una diferencia de cero días.
- Si `truncado` es verdadero, se advierte que conteos y rangos son parciales.
- Las limitaciones incluyen siempre asociación espacial sin causalidad, diferencia temporal con
  los días reales disponibles y que el porcentaje de incidencia de la app no se guarda en el
  servidor, por lo que no se compara.
- Un fallo HTTP, de conexión o respuesta inválida deja `correlacionApp: null` y añade limitaciones
  al análisis; no interrumpe el cálculo del vuelo.
- No salen registros, cajas ni coordenadas de la app hacia el PDF, el chat o ningún modelo:
  solo conteos y rangos temporales agregados. Las ubicaciones de las zonas del propio vuelo se conservan.
- Al resumen del modelo de visión se añade únicamente `variabilidadEspacial.nivel`; la ficha y la
  correlación completa se conservan internamente, fuera de `mensajes`. No se cambian modelo ni límites
  de tokens. El presupuesto de entrada es 7000 tokens/minuto y la petición previa ronda 4800.
- El PDF incluye «Ficha técnica del vuelo», «Variabilidad espacial» y «Correlación con la app»,
  con textos dinámicos escapados. `Interpretar respuesta` mantiene la comprobación de cifras sobre
  todos los datos de entrada, incluidos los campos nuevos.

## Mapas, huellas y registros agregados de la app (2026-11-19)

- **Servicio de índices (`POST /analizar`)** añade, sin cambiar lo existente:
  - `mapasInforme`: mapas de calor **JPEG** de NDVI, NDRE y GNDVI de las capturas cenitales (las inclinadas no se
    dibujan: no son un mapa) y, por cada captura con copas, el NIR con un círculo por copa detectada
    (`indice: "COPAS"`). Pesan ~1 MB en total. `mapas` (PNG para el modelo de visión) no cambia.
  - `huellas`: polígono `[[lat, lon], …]` del encuadre de **todas** las capturas con GPS RTK (hasta 400), calculado
    con yaw y GSD (efectivo si existe) sobre terreno plano; `analizada` indica si la captura entró en el cálculo.
    No es el lindero del lote: no existe un polígono del lote registrado.
- **Flujo 02** acepta la entrada opcional `mapasInforme` (booleano, por defecto falso). Solo si es `true` devuelve
  `mapasInforme` en la salida, **fuera de `analisis`**: así el chat (`analizar_vuelo`) nunca recibe las imágenes.
  `analisis.huellas` sí va dentro del análisis (son pocos números).
- **`analisis.correlacionApp`** ahora mide el área del vuelo con la unión de las huellas (`areaVueloBase: "huellas"`;
  si no hay huellas, la caja anterior) y añade `clasesEnHuella`, `celdas` y `ladoCeldaM`. Las `celdas` agrupan los
  registros cercanos en celdas de ~25 m (`{lat, lon, n, clases}`, máximo 150): se ve dónde se concentran sin entregar
  el punto exacto de cada productor. **Los registros no se asocian a zonas.**
- **Flujo 03** pide los mapas al flujo 02, no envía `huellas` ni `celdas` al modelo de redacción (conserva todo en
  `completo` para el PDF) y dibuja: mapas por captura (NDVI/NDRE/GNDVI) con leyenda de color, mapa de copas, mapa
  esquemático SVG (huellas, polígonos de zonas, celdas de la app, escala y norte; **sin mapa base**) y una tabla
  «Qué es cada resultado» (medición / estimación / pendiente). Los decimales de los textos del modelo se unifican
  (coma decimal; los valores 0,xxx a dos decimales; coordenadas y miles escritos con punto no se tocan).

## Mosaico aproximado del vuelo (2026-11-19)

- **Servicio de índices:** `POST /analizar` acepta `capturasMosaico` (todas las capturas con sus bandas, máx. 400) e
  `indicesMosaico` (por defecto `["NDVI", "NDRE"]`). Solo se calcula si se piden mapas. Devuelve `mosaicos`:
  `{indice, mime, base64, resM, ancho, alto, origenLat, origenLon, kx, ky, capturasUsadas, coberturaPct, capturasConGsdNominal}`.
  Para ubicar un punto sobre la imagen: `x = (lon − origenLon)·kx / resM`, `y = (origenLat − lat)·ky / resM`.
- **Qué es:** un mosaico **aproximado** (`app/mosaico.py`): pega cada captura cenital en un lienzo con el norte arriba según
  su posición GPS RTK, su orientación y su GSD (efectivo si existe), promediando con más peso al centro de cada captura.
  Supone terreno plano y cámara en nadir, no corrige lente ni relieve ni alinea capturas entre sí: puede tener costuras y
  desplazamientos. No es un ortomosaico. Las capturas inclinadas no se usan. El lienzo mide ≤ 1600 px de lado largo.
- **Flujo 02** pide el mosaico solo cuando `mapasInforme` es `true` y lo devuelve fuera de `analisis`, como los demás mapas.
  **Flujo 03** lo dibuja con las zonas críticas, escala y norte encima.
- Con el vuelo real (28 capturas, 22 cenitales): ~16 s en total, 4,7 cm/píxel, 72 % del rectángulo cubierto.

## Zonas siempre ubicables (2026-11-19)

- El flujo 02 ahora envía hasta 40 capturas **candidatas** en `capturas`; el servicio elige entre ellas las `maxImagenes`
  que analiza, **solo cenitales y georreferenciables** (repartidas por el vuelo). Antes se elegían por reparto uniforme y
  una captura inclinada producía zonas sin polígono ni área. Si ninguna es cenital, se analizan las primeras como antes.
  Con `capturas` ≤ `maxImagenes` el comportamiento no cambia.
- La respuesta añade `capturasAnalizadas` (ids). La correlación con la app usa solo esas capturas.
- `areaM2` de las zonas se redondea a un decimal. El PDF imprime el **centroide del polígono** de cada zona
  (`ubicacionZona`), no el centro de la captura, que se repetía en todas las zonas de una misma captura.

## Zonas fusionadas y reintento del redactor (2026-11-19)

- El servicio fusiona las zonas candidatas que son el mismo sitio (solape de polígonos ≥ 50 % del área de la menor, valor
  provisional): cada zona trae `indicesAfectados` (`[{indice, valor}]`), `detecciones` y `capturasIds`; el polígono, el
  área y el centroide son los de la envolvente convexa de las fusionadas (puede sobrestimar el área).
- Flujo 03: el nodo «Redactar informe» reintenta hasta 3 veces (3 s) ante cualquier error HTTP, p. ej. el 400
  «Failed to validate JSON» que Groq devuelve a veces; si todos fallan, el PDF usa el respaldo con el motivo real.

## Enlace de descarga en el chat (2026-11-19)

El agente a veces copiaba mal el enlace (un carácter de menos → 400). El agente devuelve ahora sus pasos intermedios y
el nodo «Corregir enlace» reemplaza cualquier enlace `…/informe?t=…` del texto por el real que devolvió la herramienta
`generar_informe`; la respuesta del webhook sigue siendo solo `{output}`.
