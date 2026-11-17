# Arquitectura de la automatización

Estado: **propuesta** (2026-11-14). Pendiente de confirmar antes de construir.

## Qué ya existe

- **Chat del panel.** `agrovision-panel/src/components/ChatAsistente` hace un `POST` a
  `VITE_N8N_CHAT_WEBHOOK_URL` con `{ "action": "sendMessage", "sessionId": "...", "chatInput": "..." }`
  y espera `{ "output": "texto" }` **en la misma respuesta** (también acepta un arreglo cuyo primer
  elemento tenga `output`). Solo aparece para administradores, en la pantalla de vuelos.
- **No se envía contexto del vuelo.** El chat solo manda el texto que escribe el administrador. Los datos
  del vuelo los tiene que ir a buscar n8n.
- **Vuelos en la API** (`/api/vuelos`, solo administrador con JWT). Cada archivo del vuelo es `foto_rgb`,
  `banda_multiespectral` (`green`, `red`, `rededge`, `nir`), `video`, `srt` u `otro`, con metadata de GPS,
  altura, RTK y cámara. Los archivos se piden con un enlace firmado y temporal
  (`POST /vuelos/:id/archivos/:archivoId/enlace`).

## Los flujos

Son **5**: los tres de los modelos (abajo) más dos de apoyo, `04-descargar-informe` (entrega el PDF por
un enlace temporal) y `05-manejo-errores`. El detalle, el orden de construcción y lo que bloquea cada uno
están en [../workflows/README.md](../workflows/README.md). Aparte de n8n hay tres piezas más: la llave de
servicio en la API, el servicio de índices en Python y la publicación de los webhooks por el túnel.

## Los tres flujos de los modelos

### 1. Chat (modelo 1: conversación y herramientas)

Chat Trigger o Webhook → AI Agent → respuesta `{ "output": "..." }`.

- Memoria por sesión, con `sessionId` como clave.
- Herramientas del agente: listar vuelos, resumen de un vuelo (llama al flujo 2) y generar informe
  (llama al flujo 3).
- El prompt de sistema obliga a responder solo con datos de las herramientas, a no inventar
  diagnósticos y a aclarar que es apoyo y no sustituye a un agrónomo.
- Temperatura baja (0 a 0,3) para que elija bien las herramientas.

### 2. Análisis de vuelo (modelo 2: visión)

1. Trae los archivos del vuelo y los agrupa por captura (RGB más las 4 bandas).
2. **Calcula los índices con código, no con el modelo:**
   - NDVI = (NIR − R) / (NIR + R)
   - NDRE = (NIR − RE) / (NIR + RE)
   - GNDVI = (NIR − G) / (NIR + G)
3. Genera estadísticas (media, percentiles, % del área bajo un umbral) y un mapa de calor PNG por índice.
4. El modelo de visión recibe la foto RGB, los mapas y las cifras, y devuelve un **JSON estructurado**
   (zonas críticas, observaciones, nivel de confianza).

### 3. Informe PDF (modelo 3: redacción)

JSON del análisis + metadatos del vuelo (fecha, lote, altura, RTK) → el modelo redacta las secciones →
plantilla HTML → PDF → enlace de descarga. Para el PDF se propone un contenedor **Gotenberg**
(HTML a PDF), llamado con un nodo HTTP Request.

> Regla de oro: el modelo **interpreta** índices que ya vienen calculados. No calcula ni inventa cifras.

## Dónde corre n8n

Decisión (2026-11-14): **en local, con Docker, definido en el `docker-compose.yml` de la API** (servicios
`n8n` y `gotenberg` con el perfil `n8n`), junto a la base de datos y dentro del repositorio de la API.

- Es gratis y los datos no salen del equipo. Mismo requisito que la API: el PC debe estar encendido.
- El contenedor `n8n` que ya existe en este equipo pertenece a otro proyecto (`ia-sena`: su propia
  carpeta de flujos y su propio volumen con credenciales). **No se reutiliza.** AgroVision tendrá el
  suyo, con otro nombre, otro volumen y otro puerto.
- El editor de n8n se queda solo en local. Por el túnel de Cloudflare se publican **únicamente los
  webhooks** (`/webhook/...`), nunca el editor.
- Alternativa descartada por ahora: n8n Cloud, que es de pago tras una prueba gratuita.

## Lo que falta resolver

| Tema | Detalle |
|---|---|
| Acceso a los datos | `/api/vuelos` exige un administrador con JWT y el login es por OTP, que n8n no puede automatizar. Opciones: (a) una llave de servicio de solo lectura en la API, lo más limpio pero toca la API de Kevin; (b) como n8n corre en el mismo equipo, montar `UPLOADS_DIR/vuelos` en el contenedor en solo lectura y leer los datos del vuelo con un usuario de Postgres de solo lectura, más rápido pero acopla n8n al esquema de la base. |
| TIFF de 16 bits | Un nodo Code de n8n no los procesa bien. Propuesta: un pequeño servicio en Python (numpy y tifffile) que n8n llama por HTTP. |
| Exponer n8n | El navegador llama directo al webhook, así que n8n debe estar publicado (por ejemplo con otro nombre en el túnel de Cloudflare) y permitir CORS desde `agrovision.sbs`. |
| Seguridad del webhook | La URL va en el código público del panel: cualquiera podría gastar créditos de IA. Mínimo: ruta con token largo y límite de uso en Cloudflare. Lo correcto sería pasar por la API (lo revisaría Kevin). |
| Dónde queda el PDF | Carpeta con enlace temporal, o guardarlo en la API. Falta decidir y comprobar si el chat muestra bien un enlace. |
| Formato real del dron | El README del módulo de vuelos dice que el sufijo `_MS_*` y el SRT **no están verificados** con archivos reales. Probar primero con un vuelo real. |
| Privacidad | Las imágenes de los lotes salen hacia el proveedor de IA (Fireworks). Confirmar que es aceptable. |
