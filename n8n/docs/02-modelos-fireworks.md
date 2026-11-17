# Modelos de Fireworks AI

Estado: **propuesta** (consultado el 2026-11-14). Los precios cambian: confirma en la página antes de
gastar. Ninguna de las páginas consultadas muestra fecha de actualización.

Fuentes: [precios serverless](https://docs.fireworks.ai/serverless/pricing) y
[catálogo de modelos](https://fireworks.ai/models).

## Propuesta por rol

| Rol | Modelo propuesto | Alternativa más barata | Precio por 1M tokens (entrada / entrada en caché / salida) |
|---|---|---|---|
| 1. Chat con herramientas | **Kimi K3.1 Pro** (`kimi-k3p1-pro`, visión, 1M de contexto) | DeepSeek V4.1 Flash | 2,00 / 0,20 / 10,00 USD |
| 2. Visión (fotos y mapas del dron) | **Qwen 3.8 Max** (`qwen3p8-max`, visión) o Kimi K3.1 Pro | GLM 5.3 Flash (visión) | Qwen 3.8 Max: 2,00 / 0,25 / 6,00 USD |
| 3. Redacción del informe | **GLM 5.3** (`glm-5p3`, solo texto, 1M de contexto) | DeepSeek V4.1 Flash | 1,40 / 0,26 / 4,40 USD |

Otros precios de referencia (entrada / caché / salida): DeepSeek V4.1 Flash 0,30 / 0,006 / 1,20 ·
GLM 5.3 Flash 0,15 / 0,03 / 0,50 · Kimi K3 3,00 / 0,30 / 15,00 · Ember-1 3,00 / 0,30 / 15,00 ·
Muse Spark Open 1,25 / 0,15 / 4,25 (solo EE. UU.) · GPT OSS 120B 0,15 / 0,015 / 0,60.

## Por qué

- **Chat:** el agente decide qué herramienta llamar y con qué argumentos; un fallo ahí rompe la
  conversación. Fireworks recomienda familias Kimi y GLM para uso de herramientas. Kimi K3.1 Pro tiene
  visión (permite mirar una imagen en el chat) y cuesta menos que Kimi K3.
- **Visión:** hay que interpretar una foto RGB, mapas de calor y cifras a la vez. Qwen 3.8 Max y Kimi
  K3.1 Pro son dos candidatos con visión disponibles en serverless a un precio medio. No hay una
  comparación de calidad en las fuentes: se elige con una prueba (ver abajo).
- **Informe:** solo escribe a partir de un JSON ya calculado; no necesita visión. GLM 5.3 da buena
  redacción a un costo menor que los de visión.
- **Evitar los «Flash» para el chat:** son los más baratos, pero los modelos pequeños suelen elegir peor
  las herramientas. Es una regla general, no una medición de estos modelos: se comprueba en la prueba.

## Costo estimado

Supuestos (no medidos): conversación de 4.000 tokens de entrada y 400 de salida por mensaje; análisis
con 4 imágenes y texto (8.000 de entrada, 1.500 de salida); informe de 3.000 de entrada y 3.000 de salida.

| Operación | Cuenta | Costo |
|---|---|---|
| Un mensaje de chat (Kimi K3.1 Pro) | 4.000 × 2 / 1M + 400 × 10 / 1M | ≈ 0,012 USD |
| Un análisis de vuelo (Qwen 3.8 Max) | 8.000 × 2 / 1M + 1.500 × 6 / 1M | ≈ 0,025 USD |
| Un informe (GLM 5.3) | 3.000 × 1,40 / 1M + 3.000 × 4,40 / 1M | ≈ 0,017 USD |
| Análisis + informe | | ≈ 0,04 USD |

Es decir, 100 análisis con informe cuestan unos 4 USD. El caché de entrada baja el costo del prompt de
sistema repetido.

## Verificado con la credencial real (2026-11-14)

Con el flujo [dev-probar-modelos](../workflows/dev/dev-probar-modelos.json), con la base
`https://api.fireworks.ai/inference/v1`:

- **Identificadores que funcionan** (todos con el prefijo `accounts/fireworks/models/`): `glm-5p3-flash`,
  `glm-5p3`, `kimi-k3p1-pro`, `qwen3p8-max` y `deepseek-v4p1-flash`. Los cinco respondieron 200.
- **Todos son modelos que «razonan»**: piensan antes de contestar y esos tokens se cobran como salida.
  Con una pregunta trivial, sin controlarlo, gastaron entre 11 y 64 tokens de razonamiento. GLM 5.3,
  con un tope de 64 tokens, los agotó pensando y **no devolvió texto**.
- **Se controla con `reasoning_effort`:**

| Modelo | `none` | `low` |
|---|---|---|
| GLM 5.3 y GLM 5.3 Flash | **No se puede** (error 400: solo piensan) | Funciona; 0 tokens de razonamiento en la prueba |
| Kimi K3.1 Pro | Funciona; 0 tokens | 24 tokens |
| Qwen 3.8 Max | Funciona; 0 tokens | 26 tokens |

- **Consecuencias para los flujos:** enviar siempre `reasoning_effort` de forma explícita, dejar un
  `max_tokens` holgado (razonamiento más respuesta) y medir el consumo real. La prueba fue trivial: en
  tareas largas el razonamiento crece y puede dominar el costo, así que las estimaciones de abajo pueden
  quedar cortas.

- **En el nodo «OpenAI Chat Model» de n8n** la opción «Reasoning Effort» solo se muestra para modelos de
  OpenAI (`o1`, `o3`, `gpt-5`…), y n8n **borra** su valor al guardar con modelos de Fireworks. Para limitar el
  razonamiento del agente se usa la opción **Extra Body** con `{"reasoning_effort": "low"}`, que se envía tal
  cual a la API. Así está en el flujo 01.

## Presupuesto

Saldo disponible: **4,42 USD** (2026-11-14). Meta: hasta 50 análisis completos, pruebas incluidas.

- 50 análisis con informe ≈ 2,1 USD. Quedan ≈ 2,3 USD para el chat, unos 190 mensajes.
- Es una estimación sin medir. Una imagen puede costar más tokens de lo supuesto: si el costo real
  resultara el doble, 50 análisis ya consumirían casi todo el saldo.
- **Medir antes de seguir:** correr los primeros 3 análisis, mirar el consumo real en el panel de
  Fireworks y proyectar.
- **Ahorrar:** armar y depurar los flujos con un modelo barato (GLM 5.3 Flash o DeepSeek V4.1 Flash) y
  pasar a los modelos finales solo para las pruebas de calidad; reducir las imágenes (lado largo de
  unos 1.024 px); limitar los tokens de salida en cada nodo.
- No se comprobó si el saldo caduca.

## Cuidado con los precios

- Las cifras son del nivel **Standard**. El nivel **Priority** cuesta un 25 % más.
- Las variantes **(US)** cuestan un 50 % más, y algunos modelos solo están en capacidad de EE. UU.
- Fireworks calcula el costo por tokens: una imagen consume tokens según su tamaño. Reduce las imágenes
  a lo necesario antes de enviarlas.

## Cómo conectarlo en n8n

Fireworks usa una API compatible con OpenAI. En n8n se usa el nodo **OpenAI Chat Model** con una
credencial cuya URL base sea `https://api.fireworks.ai/inference/v1` y el nombre del modelo en la forma
`accounts/fireworks/models/<slug>`. Esa forma se deduce del ejemplo `accounts/fireworks/models/rune` de
la página de precios: **copia el identificador exacto desde la página de cada modelo**.

## Antes de decidir: prueba con casos reales

Ninguna página compara la calidad de uso de herramientas entre estos modelos, y los nombres son recientes.
Antes de fijarlos, probar 15 a 20 casos reales y calificar:

1. Chat: preguntas sobre vuelos que obliguen a usar 2 herramientas seguidas.
2. Visión: 5 imágenes reales de un vuelo (RGB, NDVI) con un resultado esperado conocido.
3. Informe: que no aparezca ninguna cifra que no esté en el JSON de entrada.
