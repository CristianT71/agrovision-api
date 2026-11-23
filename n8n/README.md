# n8n — Asistente de IA y análisis multiespectral

Automatización en n8n para la pantalla de **IA y análisis multiespectral** del panel (vuelos de dron).
Esta carpeta, dentro del repositorio de la API, es donde se documenta todo lo de n8n y donde van los
flujos exportados (JSON). Los contenedores se definen en el `docker-compose.yml` de la API, junto a la
base de datos.

## Estructura

| Ruta | Contenido |
|---|---|
| [docs/01-arquitectura.md](docs/01-arquitectura.md) | Los 3 flujos, contratos con el panel y la API, y lo que falta resolver |
| [docs/02-modelos-fireworks.md](docs/02-modelos-fireworks.md) | Modelos de Fireworks AI elegidos, por qué y cuánto cuestan |
| [docs/03-contratos.md](docs/03-contratos.md) | Qué JSON entra y sale de cada flujo y del servicio de índices |
| [docs/04-guia-importar-y-probar.md](docs/04-guia-importar-y-probar.md) | Cómo importar los flujos, probarlos y arreglarlos |
| [docs/05-seguridad-webhooks.md](docs/05-seguridad-webhooks.md) | El panel pasa por la API; secreto `X-N8N-Secret` en los webhooks y por qué n8n no se publica |
| `workflows/` | Los 5 flujos de n8n (`.json`), uno por archivo, más utilidades de desarrollo |
| `data/informes/` | Informes PDF generados (no se sube a git) |
| `../docker-compose.yml` | Servicios `n8n` y `gotenberg` (perfil `n8n`) |
| `../.env.example` | Variables `N8N_ENCRYPTION_KEY`, `N8N_WEBHOOK_URL` y `N8N_CHAT_SECRET` |

## Cómo levantarlo

Requisitos: Docker Desktop encendido y, en el `.env` de la API, `N8N_ENCRYPTION_KEY` (ver `.env.example`).

Desde la carpeta de la API:

```
docker compose --profile n8n up -d n8n gotenberg
```

- **Editor de n8n:** http://localhost:5679. La primera vez pide crear la cuenta de propietario.
- **Los servicios de n8n son opcionales:** un `docker compose up -d` normal solo levanta la base de datos.
- **Apagar solo n8n:** `docker compose --profile n8n stop n8n gotenberg`.
- **No uses `docker compose down` sin indicar servicios:** apagaría también la base de datos.
- **Ver registros:** `docker compose logs -f n8n`.
- Los flujos y credenciales quedan en el volumen `agrovision-n8n_n8n_data` (el nombre viene de una
  versión anterior del compose; se conserva para no perder la cuenta ya creada).
- La clave `N8N_ENCRYPTION_KEY` cifra las credenciales guardadas. Si se pierde o se cambia, hay que
  volver a crearlas. Guárdala en un lugar seguro.

Carpetas que ve el contenedor: `uploads/vuelos` de la API en **solo lectura** (`/datos/vuelos`) y
`n8n/data/informes` en escritura (`/informes`). Gotenberg (HTML a PDF) no publica puertos: solo n8n lo
llama, en `http://gotenberg:3000`. Desde el contenedor, la API del equipo se ve en
`http://host.docker.internal:3000`.

## Estado

El entorno de n8n está levantado y verificado: n8n responde, Gotenberg está activo y n8n llega a la API.
Ya existe la cuenta de propietario. Los 5 flujos están escritos pero sin probar en n8n; faltan la llave de servicio de la API y el servicio de índices. Las decisiones
marcadas como **propuesta** en los documentos se confirman antes de construir los flujos.

## Reglas para esta carpeta

- **n8n no se expone a Internet.** Solo la API lo llama, con la cabecera secreta `X-N8N-Secret`
  (ver [docs/05-seguridad-webhooks.md](docs/05-seguridad-webhooks.md)).
- **Nunca** guardar claves (API key de Fireworks, tokens) en estos archivos ni en los JSON de los flujos.
  Las credenciales viven en n8n; al exportar un flujo solo sale el nombre de la credencial, no su valor.
  Revisa el JSON antes de subirlo.
- Un flujo por archivo, con nombre `NN-nombre-del-flujo.json`.
- Cuando cambie una decisión, actualiza el documento correspondiente y la fecha.
