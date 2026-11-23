# Seguridad de los webhooks (chat e informe)

Estado: **hecho** (2026-11-20).

## Cómo fluye ahora

```
Panel (admin con sesión) ──JWT──▶ API  POST /api/vuelos/:id/chat        ──X-N8N-Secret──▶ n8n /webhook/asistente (flujo 01)
                                  API  GET  /api/vuelos/:id/informe?t=… ──X-N8N-Secret──▶ n8n /webhook/informe   (flujo 04)
```

- El navegador **ya no conoce la URL de n8n**. El panel llama a la API con su token; la API comprueba la
  sesión, el rol `admin`, que el vuelo exista (404 si no) y aplica un límite por cuenta: **10 mensajes por
  minuto** en el chat y 30 descargas por minuto del informe (429 al pasarlo).
- El `vueloId` sale de la ruta de la API, no del cuerpo que manda el navegador.
- La API reenvía a n8n con la cabecera `X-N8N-Secret`. Los webhooks de los flujos 01 y 04 tienen
  autenticación **Header Auth** y responden 403 sin ella.
- Respuestas de la API: n8n ocupado o caído → **503**; n8n no responde en 230 s → **504**; sin
  `N8N_CHAT_SECRET` configurado → **503** «El asistente aún no está configurado». El panel ya muestra
  «asistente ocupado» ante esos errores.
- El enlace del informe que escribe el asistente (`…/webhook/informe?t=<código>`) ya no se abre directo:
  el panel toma el código `t` y descarga el PDF por la API con su sesión.

## Configurarlo (una sola vez)

1. Genera un secreto (mínimo 32 caracteres, distinto de `N8N_API_KEY`):
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. En el `.env` de la API pon `N8N_CHAT_SECRET=<ese valor>` y, si n8n no está en `http://localhost:5679/`,
   `N8N_WEBHOOK_URL` con la dirección **interna** con la que la API llega a n8n. Reinicia la API.
3. En n8n: **Credentials → Add credential → Header Auth**, con nombre
   `Webhook AgroVision (secreto de la API)`, *Name* `X-N8N-Secret` y *Value* el mismo secreto.
4. Abre los flujos **01-chat-asistente** y **04-descargar-informe**; en el nodo *Webhook* elige esa
   credencial (al importar el JSON queda enlazada por nombre; si n8n no la encuentra, selecciónala a mano)
   y vuelve a publicar los dos flujos.

El secreto vive solo en el `.env` de la API y en la credencial cifrada de n8n. **Nunca** lo pongas en los
JSON de `workflows/` ni en el panel.

## n8n no debe exponerse públicamente

- El contenedor publica el puerto solo en `127.0.0.1` (ver `docker-compose.yml`). Mantenlo así.
- Ya no hace falta publicar `/webhook/…` por el túnel de Cloudflare: quita la ruta `n8n.agrovision.sbs`
  del túnel. La única puerta pública es la API.
- Si la API y n8n viven en máquinas distintas, únelas por red privada (VPN, red de Docker) y nunca
  publiques el editor ni los webhooks en Internet. El secreto es una segunda barrera, no la primera.

## Probar

- Sin sesión: `curl -X POST http://localhost:3000/api/vuelos/<id>/chat` → 401.
- Directo a n8n sin la cabecera: `curl -X POST http://localhost:5679/webhook/asistente` → 403.
- Desde el panel, como admin, abre un vuelo y escribe en el asistente; pide el informe y pulsa
  «Descargar informe en PDF».
