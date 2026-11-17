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

## Servicio de índices (Python) — aún no existe

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
