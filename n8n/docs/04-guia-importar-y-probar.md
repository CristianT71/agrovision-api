# Guía: importar y probar los flujos

Los 5 flujos están en [../workflows/](../workflows/README.md). **No están probados**: se crearon sin ejecutarlos
en n8n. Esta guía es para importarlos, probarlos y arreglar lo que haga falta. Si algo falla, el mensaje de
error de n8n dice en qué nodo; ver «Si algo falla» al final.

## Qué vas a ver en n8n (para leer los flujos)

- **Disparador (trigger):** el nodo donde empieza un flujo (un webhook, otro flujo, o el botón manual).
- **Items:** n8n pasa los datos entre nodos como una lista de «items» (cada uno un JSON). `$json` es el
  item actual del nodo.
- **Expresiones:** lo que va entre `{{ ... }}` en un campo se calcula. `$('Nombre del nodo')` lee la salida
  de otro nodo.
- **Nodo Code:** JavaScript. Aquí se valida, se arman los mensajes para el modelo y se genera el HTML.
- **Subflujos:** un flujo puede llamar a otro (`Execute Workflow`), y el agente del chat los usa como
  herramientas.
- **Notas adhesivas:** cada flujo trae notas amarillas que explican cada tramo.

## Paso 0 — Aplicar la configuración nueva de n8n

Se agregaron dos variables al `docker-compose.yml` (permiso para escribir en `/informes` y para usar `crypto`).
Desde la carpeta `agrovision-api`:

```
docker compose --profile n8n up -d n8n
```

Recrea solo el contenedor de n8n. Tus flujos, credenciales y cuenta se conservan. Comprueba que arrancó:
abre http://localhost:5679.

## Paso 1 — Importar los 5 flujos

Los flujos se llaman entre sí por un **id fijo**, así que se importan por la terminal, que respeta ese id
(el botón «Import from file» del editor suele asignar un id nuevo y entonces se rompen las llamadas entre
flujos). Desde `agrovision-api`, en PowerShell:

```
foreach ($f in "05-manejo-errores","04-descargar-informe","03-informe-pdf","02-analisis-vuelo","01-chat-asistente") {
  docker cp "n8n/workflows/$f.json" "agrovision-n8n:/tmp/$f.json"
  docker exec agrovision-n8n n8n import:workflow --input="/tmp/$f.json"
}
```

Cada uno debe decir `Successfully imported 1 workflow`. Luego recarga el editor. Orden importante: primero el
05 (el de errores), porque los demás lo usan.

Si ya había un «03-informe-pdf» de una prueba anterior, el import lo reemplaza (mismo id). Si ves flujos
repetidos con el mismo nombre, borra los sobrantes desde el editor.

## Paso 2 — Probar el flujo 03 (informe PDF) con datos inventados

Es el único que se puede probar completo sin nada más.

1. Abre el flujo **03-informe-pdf**.
2. Ejecútalo desde el nodo **Entrada manual (pruebas)**: pasa el cursor sobre él y pulsa su botón de ejecutar
   (▶). Si usas el botón general **Execute workflow** y te pregunta por qué disparador empezar, elige ese. Ese
   camino usa los *Datos de prueba* inventados.
3. Los nodos se ponen verdes uno a uno. Abre el último, **Resultado**: verás `ok`, el `enlace`, y las
   `advertencias` y el `consumo` de tokens.
4. El PDF queda en `agrovision-api/n8n/data/informes/`. Ábrelo y míralo.

Cuesta una fracción de centavo (usa `glm-5p3-flash`). Mira en el nodo *Interpretar respuesta* cuántos tokens
gastó y compáralo con los precios de [02-modelos-fireworks.md](02-modelos-fireworks.md).

**Para el informe final** cambia en el nodo *Configuración* el modelo a `accounts/fireworks/models/glm-5p3`.

## Paso 3 — Probar la descarga (flujo 04)

1. Abre **04-descargar-informe** y pulsa **Publish** (arriba a la derecha): un webhook solo tiene su URL de
   producción mientras el flujo está publicado.
2. Copia el `enlace` del resultado del paso 2 (empieza por `http://localhost:5679/webhook/informe?t=`) y
   ábrelo en el navegador: debe descargarse el PDF.
3. Prueba que falla bien: cambia una letra del código en la URL, debe decir «Enlace no válido».

## Paso 4 — Probar el flujo 05 (errores)

1. Abre **05-manejo-errores**. Mira el nodo desactivado del correo: si quieres avisos por correo, créale una
   credencial SMTP, pon tus correos y actívalo.
2. Para probarlo, rompe a propósito el flujo 03 (por ejemplo borra el contenido del campo URL de Gotenberg) y
   ejecútalo: debe aparecer una línea nueva en `n8n/data/informes/errores.log`. Después deshaz el cambio.

## Paso 5 — Probar el chat (flujo 01), primer hito: que responda

Solo hace falta la credencial de Fireworks. Todavía no usa herramientas.

1. Abre **01-chat-asistente**. En **Modelo del chat** debe verse la credencial «Fireworks AI».
2. La herramienta **listar_vuelos** pedirá una credencial que aún no existe. Para esta prueba desactívala:
   selecciónala y pulsa la tecla **D** (se ve gris). Se vuelve a activar cuando exista la llave de servicio.
3. Pasa el cursor sobre **Webhook asistente** y pulsa **Listen for test event** (o **Execute workflow**).
   n8n queda esperando una petición en la *Test URL*: `http://localhost:5679/webhook-test/asistente`.
4. En PowerShell, envía un mensaje como lo haría el panel:

```
$cuerpo = '{"action":"sendMessage","sessionId":"prueba-1234567","chatInput":"Hola, ¿qué puedes hacer?"}'
Invoke-RestMethod -Method Post -Uri "http://localhost:5679/webhook-test/asistente" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($cuerpo))
```

5. Debe responder `output` con el texto del asistente. En n8n verás los nodos en verde. Abre **Modelo del
   chat** para ver los tokens gastados.
6. **Prueba la memoria:** vuelve a pulsar *Listen*, cambia `chatInput` por `¿Qué te pregunté antes?` y deja el
   **mismo** `sessionId`. Debe acordarse. Con otro `sessionId` es una conversación nueva.
7. **Publica** el flujo (arriba a la derecha). Desde ahí funciona la URL de producción, sin *Listen*:
   `http://localhost:5679/webhook/asistente`.

Si falla: *«reasoning_effort»* → en **Modelo del chat**, quita la opción de esfuerzo de razonamiento.
*«Falta el mensaje»* → faltó el `Content-Type` JSON. *Se queda esperando* → no pulsaste *Listen* antes de enviar.

## Estado actual (2026-11-14)

- Los 5 flujos están importados y **publicados** en este n8n, con el flujo `05` puesto como flujo de errores
  en los demás. Sus ids son los de la tabla de [../workflows/README.md](../workflows/README.md).
- La credencial **API AgroVisión (llave de servicio)** (Header Auth, cabecera `X-Api-Key`) está creada y enlazada.
  La llave es `N8N_API_KEY` del `.env` de la API y abre solo `GET /api/servicio/vuelos` (lectura).
- El webhook del chat es `https://n8n.agrovision.sbs/webhook/asistente`. Por el túnel solo salen las rutas
  `/webhook/…`: el editor de n8n y `/webhook-test/…` **no** se publican.
- El panel lee esa URL de `VITE_N8N_CHAT_WEBHOOK_URL` (se compila dentro del panel).
- El chat del panel espera hasta 240 s y convierte en enlaces las URL de las respuestas.

**Para que funcione después de un reinicio:** API encendida (`node dist/main`), `cloudflared tunnel run agrovision`,
Docker con n8n (`docker compose --profile n8n up -d n8n gotenberg`) y el panel servido.

### Lo que todavía falta

| Pieza | Para qué | Estado |
|---|---|---|
| Servicio de índices (Python) | Calcula NDVI, NDRE y GNDVI con los TIFF y devuelve los mapas de calor. Sin él, las herramientas `analizar_vuelo` y `generar_informe` del chat fallan | Pendiente (contrato en [03-contratos.md](03-contratos.md)) |
| Un vuelo real con las 4 bandas | Subirlo en la pantalla Vuelos del panel, para probar el análisis de verdad | Falta |
| Límite de uso del webhook | La URL del chat va en el código público del panel: cualquiera podría gastar tu saldo de Fireworks. Conviene una regla de límite de peticiones en Cloudflare (Seguridad → Reglas de límite de velocidad) para `n8n.agrovision.sbs/webhook/asistente` | Pendiente, hazla tú en Cloudflare |

El chat funciona sin el servicio de índices para conversar y listar vuelos. Con la base sin vuelos, «¿qué vuelos hay?»
responde que no hay ninguno.

## Si algo falla

| Síntoma | Qué mirar |
|---|---|
| Un nodo sale con un triángulo rojo o «node type not found» | Esa versión del nodo no existe en tu n8n. Bórralo, agrégalo de nuevo desde el menú y copia en él los campos del nodo original |
| *Guardar PDF* o *Leer PDF*: «access to the file is not allowed» | Falta aplicar el paso 0 (`N8N_RESTRICT_FILE_ACCESS_TO`) |
| *Armar HTML*: «crypto» o «Cannot find module» | Falta aplicar el paso 0 (`NODE_FUNCTION_ALLOW_BUILTIN`) |
| *Redactar informe*: error 401 | La credencial «Fireworks AI» no está elegida en el nodo |
| *Redactar informe*: error 400 con «reasoning_effort» | GLM no admite `none`; en *Configuración* el esfuerzo debe ser `low` |
| *Interpretar respuesta*: «no devolvió texto» | El razonamiento se comió los tokens: sube `maxTokens` en *Configuración* |
| *HTML a PDF*: no conecta | `docker compose --profile n8n ps` debe mostrar `agrovision-gotenberg` activo |
| *Guardar PDF* sin error pero no hay archivo | Mira `n8n/data/informes/` en `agrovision-api`, no en otra carpeta |

Si encuentras algo que falla y lo arreglas en el editor, **exporta el flujo** (menú del flujo → Download) y
reemplaza el JSON de `workflows/`, para que el arreglo quede guardado. Revisa antes que no lleve claves.
