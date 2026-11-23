# Flujos de n8n

Flujos exportados de n8n, uno por archivo. Cómo importarlos y probarlos:
[../docs/04-guia-importar-y-probar.md](../docs/04-guia-importar-y-probar.md).

> **Estado:** los 5 flujos están escritos y su estructura y su JavaScript están revisados, pero **no se han
> ejecutado en n8n**. Los flujos 01 y 02 además dependen de piezas que aún no existen (ver la guía).

Antes de subir un JSON a git, comprueba que no contiene claves ni URLs privadas.

## Los 5 flujos

Los tres primeros son los de los modelos (ver [../docs/01-arquitectura.md](../docs/01-arquitectura.md)). Los dos
últimos son de apoyo. Los flujos se llaman entre sí por su **id**.

| Archivo | Id | Flujo | Cómo se activa | Modelo |
|---|---|---|---|---|
| `01-chat-asistente.json` | `chatAsistente001` | Chat del panel: agente con memoria y 3 herramientas | Webhook `POST /webhook/asistente` | 1. Conversación (Kimi K3.1 Pro) |
| `02-analisis-vuelo.json` | `analisisVuelo002` | Índices multiespectrales y análisis de visión de un vuelo | Lo llaman 01 y 03 | 2. Visión (Qwen 3.8 Max) |
| `03-informe-pdf.json` | `informePdf000003` | Redacción del informe y generación del PDF | Lo llama 01 (o a mano) | 3. Redacción (GLM 5.3) |
| `04-descargar-informe.json` | `descargarInforme4` | Entrega el PDF por un enlace temporal | Webhook `GET /webhook/informe?t=…` | Ninguno |
| `05-manejo-errores.json` | `errores00000005` | Registra los fallos en `errores.log` (y avisa por correo, si se activa) | Lo llama n8n cuando otro flujo falla | Ninguno |

Los contratos (qué JSON entra y sale de cada uno) están en [../docs/03-contratos.md](../docs/03-contratos.md).

## Orden de importación y de prueba

1. **05** y **04**, luego **03**, **02** y **01** (el 05 primero porque los demás lo usan).
2. Probar el **03** con sus datos de prueba y después el **04** con el enlace que genera.
3. El **02** y el **01** se prueban cuando existan la llave de servicio de la API y el servicio de índices.

## Utilidades de desarrollo

| Archivo | Para qué |
|---|---|
| `dev/dev-probar-modelos.json` | Comprueba la credencial de Fireworks y que cada modelo responda; muestra los tokens gastados. Cuesta una fracción de centavo |

Cada flujo exportado debe traer un `id` propio, o el import por la terminal falla. n8n no tiene comando para
borrar flujos: se borran desde el editor.
