# AgroVision API

API REST del ecosistema **AgroVision**: diagnóstico de plagas, enfermedades y deficiencias foliares del café.
Da servicio al **panel web** (agrónomos y administradores) y a la **app móvil** de los productores.

Proyecto de formación — SENA, Análisis y Desarrollo de Software (ADSO), ficha 3225853.

## Stack

- **NestJS 11** + TypeScript
- **PostgreSQL 16** (Docker) con **TypeORM** y migraciones
- Autenticación por **OTP** (código de 6 dígitos al celular) y **JWT**
- Jest para pruebas unitarias

## Puesta en marcha

### 1. Requisitos

- Node.js 22 o superior
- Docker Desktop (para la base de datos)

### 2. Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DB_HOST`, `DB_PORT` | Sí | Conexión a PostgreSQL (`localhost`, `5432`) |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Sí | Credenciales; el contenedor de Docker se crea con estos mismos valores |
| `JWT_SECRET` | Sí | Secreto para firmar los tokens. **La API no arranca sin él** |
| `PORT` | No | Puerto de la API (por defecto `3000`) |
| `UPLOADS_DIR` | No | Carpeta de archivos subidos (por defecto `./uploads`) |
| `ZAVU_API_URL`, `ZAVU_API_KEY`, `ZAVU_SENDER_ID` | No | Proveedor de SMS real (ver [Códigos OTP](#códigos-otp)) |

Para generar un `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Base de datos y migraciones

```bash
docker compose up -d        # levanta PostgreSQL (contenedor Agrovision_DB)
npm i
npm run migration:run       # crea todas las tablas
```

Las **migraciones son la única fuente del esquema** (`synchronize` está desactivado).
Para cambiar una tabla: modifica la entidad y genera una migración nueva:

```bash
npm run migration:generate -- src/database/migrations/NombreDelCambio
```

### 4. Ejecutar

```bash
npm run start:dev    # http://localhost:3000/api
```

El CORS está habilitado para el panel en `http://localhost:5173`.

### 5. Crear el primer administrador

Por seguridad, **ninguna ruta de la API crea administradores**. El primero se inserta directamente en la base
(con DataGrip o `psql`). El teléfono va con prefijo y sin espacios, igual que lo envía el login:

```sql
INSERT INTO usuarios (id, telefono, rol, estado, fecha_registro)
VALUES (gen_random_uuid(), '+573001234567', 'admin', 'activo', now());
```

## Códigos OTP

En desarrollo los SMS **no se envían**: el código aparece en la consola de la API.

```
[SMS DEV] Código OTP generado para +573001234567: 123456
```

Para usar el proveedor real, cambia `LoggerSmsAdapter` por `ZavuSmsAdapter` en
`src/modules/autenticacion/autenticacion.module.ts` y configura las variables `ZAVU_*`.

Reglas del login:

- El código dura **5 minutos**, admite **5 intentos** y se guarda cifrado (hash SHA-256).
- Hay que esperar **30 segundos** entre solicitudes (RF-01.5).
- El rol elegido debe ser el de la cuenta; nunca se cambia desde el login (RF-01.2).
- Un número desconocido solo se registra solo si es de la **app móvil** (productor). Desde el panel se rechaza.
- El token dura **30 minutos** (RNF-02.2).

## Arquitectura

Arquitectura **hexagonal** (puertos y adaptadores). Cada módulo sigue la misma estructura:

```
src/modules/<modulo>/
├── domain/
│   ├── entities/              # Entidades puras con las reglas de negocio (sin NestJS ni TypeORM)
│   └── ports/
│       ├── in/                # Contratos de los casos de uso
│       └── out/               # Contratos de persistencia y servicios externos
├── application/use-cases/     # Casos de uso: orquestan el dominio (+ pruebas *.spec.ts)
├── infrastructure/adapters/
│   ├── in/http/               # Controladores y DTOs (validación de entrada)
│   └── out/persistence/       # Entidades y repositorios de TypeORM
└── <modulo>.module.ts
```

Código compartido en `src/common/`:

- `guards/` y `decorators/`: autenticación JWT, roles (`@Roles`) y usuario actual (`@UsuarioActual`)
- `errors/regla-negocio.error.ts`: error del dominio que el filtro global responde como **409**
- `filters/`: formato único de errores `{ statusCode, timestamp, path, metodo, mensaje }`
- `almacenamiento/`: guardado de archivos subidos y validación de su tipo real

## Módulos y endpoints

Todas las rutas llevan el prefijo `/api`. Roles: **admin**, **agronomo** (Profesional), **productor** (app móvil).

### Autenticación

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/auth/solicitar-otp` | Público | Envía el código OTP |
| POST | `/auth/validar-otp` | Público | Valida el código y entrega el JWT |

### Solicitudes (RF-03, RF-04)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/solicitudes` | agronomo, admin | Lista con filtros `estado`, `agronomoId` y `soloMias` |
| GET | `/solicitudes/:id` | agronomo, admin | Detalle |
| PATCH | `/solicitudes/:id/resolver` | agronomo | Resolución del agrónomo asignado; queda en solo lectura |

### Agrónomos (RF-01.6, RF-10)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/agronomos/registro` | Público | Solicitud de acceso con documentos (multipart); queda **pendiente** |
| GET | `/agronomos` | admin | Lista con casos activos de cada uno |
| GET | `/agronomos/me` | agronomo | Perfil propio |
| GET | `/agronomos/:id` | admin | Detalle con documentos |
| GET | `/agronomos/:id/documentos/:documentoId` | admin | Descarga un documento de acreditación |
| PATCH | `/agronomos/:id/validar` \| `desactivar` \| `reactivar` | admin | Cambia el estado de la cuenta |

### Productores (RF-10)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/productores/me` | productor | Completa el perfil tras el primer login |
| GET | `/productores/me` | productor | Perfil propio |
| PATCH | `/productores/me/consentimiento/otorgar` \| `revocar` | productor | Consentimiento de uso de fotos |
| GET | `/productores` | admin | Lista con filtros y búsqueda |
| GET | `/productores/:id` | admin | Detalle |
| PATCH | `/productores/:id/validar` | admin | Valida al productor |
| PATCH | `/productores/:id/consentimiento/revocar` | admin | Revoca el consentimiento (requiere `{ "confirmacion": true }`) |

### Catálogo de plagas (RF-05)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/plagas` | agronomo, admin | Lista con filtros `tipo`, `busqueda` y `conAval` |
| GET | `/plagas/:id` | agronomo, admin | Detalle |
| POST | `/plagas` | agronomo | Crea una ficha (nace sin aval) |
| PATCH | `/plagas/:id` | agronomo | Edita la ficha |
| POST | `/plagas/:id/avales` | agronomo | Aval firmado con la tarjeta del agrónomo autenticado |
| PATCH | `/plagas/:id/protocolo-quimico` | agronomo | Protocolo químico; bloqueado mientras no haya aval |
| POST | `/plagas/:id/foto` | agronomo | Sube la foto de la ficha (multipart, campo `foto`) |

### Mensajería de coordinación (RF-04.9, RF-08.5 a RF-08.7)

Canal interno entre el agrónomo asignado y el administrador; el productor no participa.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/mensajes/pendientes` | agronomo, admin | Contador de mensajes sin leer |
| GET | `/solicitudes/:solicitudId/mensajes` | agronomo, admin | Bitácora del caso |
| POST | `/solicitudes/:solicitudId/mensajes` | agronomo, admin | Envía un mensaje con adjuntos opcionales (multipart); se rechaza si el caso no tiene agrónomo asignado |
| PATCH | `/solicitudes/:solicitudId/mensajes/leidos` | agronomo, admin | Marca los mensajes como leídos |
| GET | `/solicitudes/:solicitudId/mensajes/:mensajeId/adjuntos/:adjuntoId` | agronomo, admin | Descarga un adjunto |

### Notificaciones (RF-02.5, RF-02.6)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/notificaciones` | Todos | Notificaciones del usuario autenticado |
| GET | `/notificaciones/no-leidas` | Todos | Cantidad sin leer |
| PATCH | `/notificaciones/leidas` | Todos | Marca todas como leídas |
| PATCH | `/notificaciones/:id/leida` | Todos | Marca una como leída |

## Archivos subidos

Se guardan en `UPLOADS_DIR` (fuera del repositorio):

- `publico/`: fotos del catálogo, servidas en `http://localhost:3000/archivos/...`
- `privado/`: documentos de acreditación, que solo se descargan con un token de administrador

El tipo se valida por el contenido real del archivo (PDF, PNG, JPG o WEBP), no por la extensión.

## Pruebas y calidad

```bash
npm test          # pruebas unitarias de los casos de uso
npm run lint      # ESLint + Prettier
npm run build     # compilación
```

## Pendiente

- Registro de solicitudes desde la app móvil, fotos de la solicitud y permisos de contacto (RF-04)
- Asignación de casos, dashboard, detecciones y modelos IA (RF-06 a RF-09)
- Límite de peticiones en las rutas públicas (registro y OTP)
