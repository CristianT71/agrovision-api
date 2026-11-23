# API pública de AgroVisión — Catálogo

Información de las enfermedades, plagas y deficiencias del café que reconoce AgroVisión, para que
otros proyectos (por ejemplo una wiki) la consuman.

- **Solo lectura.** Solo existen peticiones `GET`.
- **Sin cuenta ni llave.** No hay que registrarse ni enviar ningún encabezado especial.
- **Se puede llamar desde el navegador** (CORS abierto para estas rutas).
- **Límite:** 300 peticiones por minuto por dirección IP en el catálogo (60 en las reglas de zona). Si lo superas responde `429`. Guarda la
  respuesta en tu proyecto en vez de pedirla en cada visita.

**URL base:** `https://agrovision.sbs/api/public/v1/catalog`

## Endpoints

### `GET /public/v1/catalog` — lista de fichas

| Parámetro | Qué hace |
|---|---|
| `tipo` | Filtra por tipo: `enfermedad`, `plaga`, `deficiencia` o `sano`. |
| `q` | Busca en el nombre común, el nombre científico y los sinónimos. |

```
GET https://agrovision.sbs/api/public/v1/catalog?tipo=deficiencia
```

Responde `{ "total": 10, "fichas": [ ... ] }`.

### `GET /public/v1/catalog/{id}` — una ficha

`{id}` puede ser el `id` (UUID) o la `clave` legible, por ejemplo `Deficiencia_Zinc`.
Responde `404` si no existe.

```
GET https://agrovision.sbs/api/public/v1/catalog/Deficiencia_Zinc
```

## Campos de cada ficha

| Campo | Descripción |
|---|---|
| `id` | UUID de la ficha. |
| `clave` | Identificador estable y legible (`Enfermedad_Roya`, `Deficiencia_Boro`…). Úsalo como llave en tu proyecto. |
| `nombreComun`, `nombreCientifico` | Nombres. El científico puede ser `null` (deficiencias y hoja sana). |
| `sinonimos` | Otros nombres con los que se conoce. |
| `tipo` | `enfermedad`, `plaga`, `deficiencia` o `sano`. |
| `cultivo` | Siempre `cafe`. |
| `descripcion` | Qué es y por qué aparece. |
| `sintomas` | Cómo se ve en la planta. |
| `organosAfectados`, `hospederos` | Partes de la planta afectadas y plantas hospederas. |
| `fotoUrl` | URL completa de la foto, o `null` si la ficha aún no tiene. |
| `avalada` | `true` si un agrónomo revisó y firmó la ficha. |
| `medidasContencion`, `protocoloQuimico` | Solo llegan con texto cuando `avalada` es `true`; si no, vienen en `null`. |
| `modelo` | Clase del modelo de reconocimiento ligada a la ficha: `{ "clase", "desdeVersion" }`, o `null` si el modelo no la reconoce. |

> **Importante para tu wiki:** una ficha con `avalada: false` no fue revisada por un agrónomo. Muestra
> esa advertencia a quien la lea y no la presentes como recomendación técnica.

## Ejemplos

**JavaScript (navegador o Node 18+)**

```js
const respuesta = await fetch('https://agrovision.sbs/api/public/v1/catalog?tipo=deficiencia')
const { total, fichas } = await respuesta.json()
fichas.forEach((f) => console.log(f.clave, '-', f.nombreComun, f.fotoUrl))
```

**Python**

```python
import requests

r = requests.get("https://agrovision.sbs/api/public/v1/catalog/Enfermedad_Roya", timeout=10)
r.raise_for_status()
ficha = r.json()
print(ficha["nombreComun"], ficha["sintomas"])
```

**curl**

```
curl "https://agrovision.sbs/api/public/v1/catalog?q=roya"
```

**Respuesta de ejemplo (recortada)**

```json
{
  "id": "c07f02d2-74c9-4be8-861d-00554bf85cf6",
  "clave": "Deficiencia_Zinc",
  "nombreComun": "Deficiencia de Zinc-Zn",
  "nombreCientifico": null,
  "sinonimos": ["falta de zinc", "deficiencia de Zn"],
  "tipo": "deficiencia",
  "cultivo": "cafe",
  "descripcion": "El zinc ayuda al crecimiento de los brotes…",
  "sintomas": "Afecta los brotes nuevos: las hojas salen pequeñas, angostas…",
  "organosAfectados": ["hoja", "brote"],
  "hospederos": [],
  "fotoUrl": null,
  "avalada": false,
  "medidasContencion": null,
  "protocoloQuimico": null,
  "modelo": { "clase": "Deficiencia_Zinc", "desdeVersion": "3.0.0" }
}
```

## Las clases del modelo

El modelo de reconocimiento publicado hoy es la versión **2.0.0** (8 clases). La **3.0.0** agrega 8
deficiencias nutricionales, hasta 16 clases. El campo `modelo.desdeVersion` indica desde qué versión
el modelo reconoce cada clase; las de `3.0.0` están en preparación.

| Clave | Clase del modelo | Desde |
|---|---|---|
| `Enfermedad_ManchadeHierro` | `Cerscospora` | 2.0.0 |
| `Hoja_Sana` | `Healthy` | 2.0.0 |
| `Enfermedad_Roya` | `Leaf rust` | 2.0.0 |
| `Plaga_Minador` | `Miner` | 2.0.0 |
| `Enfermedad_Phoma` | `Phoma` | 2.0.0 |
| `Deficiencia_Azufre` | `Deficiencia_Azufre` | 2.0.0 |
| `Deficiencia_Potasio` | `Deficiencia_Potasio` | 2.0.0 |
| `Enfermedad_Antracnosis` | `Enfermedad_Antracnosis` | 2.0.0 |
| `Deficiencia_Boro` | `Deficiencia_Boro` | 3.0.0 |
| `Deficiencia_Calcio` | `Deficiencia_Calcio` | 3.0.0 |
| `Deficiencia_Hierro` | `Deficiencia_Hierro` | 3.0.0 |
| `Deficiencia_Nitrogeno` | `Deficiencia_Nitrogeno` | 3.0.0 |
| `Deficiencia_Fosforo` | `Deficiencia_Fosforo` | 3.0.0 |
| `Deficiencia_Manganeso` | `Deficiencia_Manganeso` | 3.0.0 |
| `Deficiencia_Magnesio` | `Deficiencia_Magnesio` | 3.0.0 |
| `Deficiencia_Zinc` | `Deficiencia_Zinc` | 3.0.0 |

El catálogo también incluye la ficha `Enfermedad_OjodeGallo`, que el modelo todavía no reconoce
(`modelo: null`).

## Qué NO expone esta API

Solicitudes, productores, ubicaciones, fotos de los productores, mensajes, datos de agrónomos y claves.
Es información del catálogo y nada más.
