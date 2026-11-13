# Sincronización pública del catálogo

`GET /api/public/v1/pests/sync?since=<epoch-ms>` no requiere JWT. Tiene un límite propio de 60 peticiones por minuto mediante el throttler público existente. El contrato sigue `App-Coffe-check/network/api/src/main/kotlin/co/agrovision/network/api/CatalogSync.kt` y los enums de `core/model/.../pest/PestTaxon.kt`.

Una respuesta 200 contiene `{ upserted, deletedIds, etag, serverTime }` y cabecera `ETag`. `If-None-Match` coincidente devuelve 304 sin cuerpo; admite listas de etiquetas y comparación débil. El hash SHA-256 usa el contenido público y las versiones del delta en orden estable, sin incluir `serverTime`. Se debe conservar la etiqueta completa, incluidas sus comillas.

## Identidad y versiones

La migración `1793500000000-SincronizacionPublicaPlagas.ts` añade `plagas.catalog_id`, único e inmutable, sin cambiar ninguna PK ni referencia existente. Recupera los ocho pares UUID/appId de la siembra `1793100000000-SembrarCatalogoPlagas.ts`: `Enfermedad_Roya`, `Enfermedad_ManchadeHierro`, `Enfermedad_OjodeGallo`, `Enfermedad_Antracnosis`, `Deficiencia_Azufre`, `Deficiencia_Potasio`, `Enfermedad_Phoma`, `Plaga_Minador`.

Las demás fichas existentes y las nuevas creadas por un agrónomo reciben **`Pest_<UUID interno de la ficha>`**. Un trigger lo asigna al insertar, por lo que renombrar la ficha o cambiar su clasificación no cambia su id público. Un id dado de baja no puede reutilizarse.

`catalog_version` es un entero positivo. Los triggers actualizan `updated_at` (timestamptz, precisión de milisegundos) e incrementan la versión al escribir la ficha, sus sinónimos o sus avales, incluyendo operaciones SQL directas. No dependen de un guardado concreto de TypeORM.

## Cursor y bajas

Sin `since` se devuelven todas las fichas vigentes y `deletedIds: []`. Con `since`, se filtran fichas por `updated_at >= since` y bajas por `deleted_at >= since`. El milisegundo del cursor se incluye deliberadamente: Android hace upsert por id y puede recibir una ficha repetida sin perder cambios en ese límite. Se rechazan cursores mal formados, negativos o futuros.

Una transacción corta toma `LOCK TABLE plagas IN SHARE MODE`, espera a los escritores anteriores y captura el reloj de PostgreSQL para `serverTime`. Lee fichas y bajas antes de soltar el bloqueo. Así un escritor pendiente obtiene su fecha después del cursor, sin saltarse cambios todavía sin confirmar. El bloqueo permite lecturas concurrentes y retrasa las escrituras durante esta lectura del catálogo, que es pequeño.

El borrado es físico y conserva **un registro persistente de bajas** en `plagas_catalogo_bajas`: el trigger existente `BEFORE DELETE` conserva únicamente el id público y la fecha, aunque se elimine la ficha y sus relaciones. No se purgan las bajas, para cubrir dispositivos que lleven meses desconectados. Usar `DELETE`, nunca `TRUNCATE`, para retirar fichas conservando el delta. No hay columna de baja lógica en la ficha.

## Eliminación de fichas (panel)

`DELETE /api/plagas/:id` recibe el UUID interno de la ficha y exige JWT con rol `agronomo`. Responde **204 sin cuerpo**; sin sesión devuelve 401, otro rol 403, UUID inválido 400, ficha inexistente 404 y ficha protegida 409 con un mensaje en español. El puerto de entrada `IEliminarPlagaUseCase`, el caso de uso `EliminarPlagaService` y la regla de dominio impiden borrar fichas cuyo `catalog_id` no comienza por `Pest_` (las ocho originales de las que depende el modelo de IA).

Todas las respuestas de ficha del panel (listado, detalle, creación y modificaciones) incluyen **`protegida: boolean`**, calculado desde `catalog_id`, sin columna nueva ni cambios al DTO público Android. El panel debe ocultar el botón de eliminación cuando sea `true`; el API valida siempre la regla.

El repositorio ejecuta un `DELETE` por UUID: las FK existentes eliminan avales y sinónimos en cascada y el trigger de la migración `1793500000000-SincronizacionPublicaPlagas` registra la baja sin escrituras duplicadas desde el caso de uso. El próximo sync con `since` que incluya la fecha de baja devuelve su **id público** en `deletedIds`. Tras confirmar el borrado, se elimina la foto local si existe y ninguna otra ficha la referencia; solo se admiten rutas UUID de `/archivos/plagas/`, sin tocar archivos ajenos ni URLs externas.

## Contenido y aval

La salida se construye con una lista explícita de campos. No se publican ids de usuarios, correos, teléfonos, estados administrativos, hospederos ni otros datos internos. Las fichas sin aval válido llevan `recommendations: []` y omiten `approval`.

El nombre del firmante se copia al aval, igual que la tarjeta profesional; la migración rellena los nombres de los avales existentes. Si hay varios avales, se publica el más reciente (desempate estable por id del aval). `approvedAt` es un número en epoch ms. No se consulta ni serializa el registro personal del agrónomo durante el sync.

Con aval se publica `medidas_contencion` como recomendación `CULTURAL` y, cuando existe, `protocolo_quimico` como `QUIMICO`, conservando el texto completo en `detail`. No se deducen ingredientes, dosis ni días de carencia de texto libre. El esquema actual no guarda bibliografía ni esos valores estructurados, así que se omiten `reference`, `activeIngredient`, `dosage` y `preHarvestIntervalDays`. Un nombre científico nulo se publica como `Sin binomio registrado`; cultivo y órganos se normalizan a los nombres de enum de Android.

## Fotos anónimas

Las fotos ya se servían sin token mediante archivos estáticos. Se conserva su URL y se restringe el montaje a `uploads/publico/plagas` (o el equivalente bajo `UPLOADS_DIR`) en `/archivos/plagas/`. Solo admite GET/HEAD a nombres UUID con extensión jpg, png o webp. No hay listado, índice, redirección, archivos ocultos ni segmentos de ruta proporcionados por el usuario. Se fija el tipo MIME de imagen y `X-Content-Type-Options: nosniff`.

El sync convierte esas rutas a URLs absolutas usando el origen de **`API_PUBLIC_URL`, obligatorio con HTTPS cuando se publiquen fotos** (por ejemplo `https://agrovision.sbs`). No utiliza `Host` de la petición ni publica enlaces externos o rutas privadas. Si falta HTTPS y hay una foto local publicable, la configuración produce un error del servidor en lugar de enviar una URL que Android no puede descargar. Las fichas sembradas sin foto llevan `images: []`.

## Verificación

Ejecutar `npx jest src/modules/plagas` y `npx tsc --noEmit`. Las pruebas unitarias cubren el mapeo de las ocho fichas y su migración simulada, avales, privacidad, fotos, filtros SQL del delta, bajas, ETag/304, validación y metadatos de ruta pública/throttler. También cubren el borrado normal, protección de las ocho originales, 204/400/403/404/409, guard JWT declarado, fotos compartidas y ajenas, eliminación real de una foto temporal y el delta posterior al DELETE con el trigger simulado. No requieren puertos ni conexión a PostgreSQL. La migración debe ejecutarla el responsable de despliegue antes de habilitar el endpoint. La descarga HTTP real y la aplicación de triggers en PostgreSQL requieren verificación en el entorno de despliegue.
