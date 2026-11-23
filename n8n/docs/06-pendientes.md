# Pendientes por ajustar

Estado al 2026-11-22. Salen de la primera prueba real del informe en PDF (vuelo `Prueba_Vuelo_001`, 56 archivos,
11 capturas) y del simulacro de producción en `agrovision.sbs`.

## Informe en PDF (flujo 03 y servicio de índices)

El informe salió completo en menos de un minuto y no diagnostica ni recomienda productos. Lo que hay que ajustar:

1. **Capturas: el informe dice 11 y los índices usan 4.** La portada y el resumen cuentan las 11 capturas del vuelo,
   pero los índices salen de 4 ("las capturas inclinadas no se usan"). El mosaico dice "11 capturas cenitales", que
   contradice a los índices. Hay que decir en la portada cuántas capturas entraron realmente al cálculo.
   *Depende del servicio de índices (código de Kevin).*
2. **RTK: el informe y el panel no coinciden.** El panel muestra "RTK fijo 0 % (0 de 56)", pero el informe dice que
   las huellas y el mosaico se calculan "con el GPS RTK" y cita `rtkPct` de 100. Sin RTK fijo, la ubicación de las
   zonas no tiene precisión centimétrica. Aclarar qué mide cada campo y no sugerir una precisión que no existe.
3. **Nombres internos en el texto.** Salen `(variabilidadEspacial)`, `(NDRE)`, `rtkFijoPct es nulo` y `rtkPct`.
   Corregir el mensaje de instrucciones del flujo 03 para que no use nombres de campos técnicos.
4. **La mediana del NDVI no cuadra:** 0,82 en la tabla y 0,83 en el texto de la página 2. Revisar la verificación de
   cifras, que debía detectarlo.
5. **La observación de la foto RGB** ("hileras de café… sin daños visibles") sale de una sola imagen. Presentarla
   como observación del modelo de visión y no como medición.

### Pregunta para Kevin

> ¿Cómo elige el servicio de índices las 4 capturas que usa de las 11 del vuelo, y por qué el mosaico dice "11
> capturas cenitales"? Además, el panel muestra RTK fijo 0 % y el informe habla de GPS RTK con `rtkPct` de 100:
> ¿qué mide cada uno?

## Modelo de IA 3.0.0

- Está en producción (la 2.0.0 quedó descontinuada: desde el panel no se vuelve a ella; hay que subir sus archivos
  como una versión nueva, por ejemplo la 3.0.1).
- El `.tflite` float16 acierta 97,0 % en 270 fotos de las 9 clases nuevas (prueba propia); el modelo sin exportar,
  94,5 % en 1.171 fotos. No se ha medido la velocidad en el celular ni las 8 clases de café con el float16.
- Probar con fotos reales, sobre todo **roya** (recall 0,82 en el reporte) y las clases débiles: calcio, fósforo y
  nitrógeno.
- Hormigas sale con 100 % sobre 36 fotos: puede estar inflado por duplicados entre entrenamiento y prueba.

## Catálogo y reglas de zona

- La ficha de **Hormigas (hormigueros)** la redacté yo con conocimiento general: que un agrónomo la revise y la avale.
  Falta completar su nombre científico.
- El campo `modelo` de la ficha **Hormigas (hormigueros)** viene `null` en la API pública, aunque el modelo 3.0.0 la reconoce:
  el enlace sale de una tabla fija por UUID (`src/modules/plagas/domain/catalogo-clases.ts`) y esa ficha se creó a mano en la nube.
  Hay que sembrarla con un UUID fijo (migración) y agregarla a la tabla.
- Las **reglas de zona** son valores de ejemplo: solo la de roya está activa. Hay que calibrarlas con un agrónomo.
- Las fichas de las 8 deficiencias tienen foto, pero su relación foto-síntoma no está validada por un agrónomo.

## App móvil

- El resultado de una detección muestra nombre, porcentaje y botones, pero **no enlaza a la ficha** con los
  síntomas y el manejo. Agregar un botón "Ver ficha" (cambio en la pantalla de resultado).
- El APK publicado es de **depuración**. Para Google Play hace falta uno firmado con un keystore de lanzamiento.
- El cambio de la prueba de humo (`SmokeTestRunner`) es código de Kevin: avisarle.

## Infraestructura y seguridad

- **Rotar la llave de Fireworks** que se pegó en el chat el 2026-11-20.
- **Cambiar los códigos OTP de demostración** (`OTP_FIJO_*` en el `.env` del servidor) después de las presentaciones.
  Son una contraseña compartida: no usarlos con datos reales.
- El crédito de **Akamai vence el 1 de febrero de 2027**: después empieza a cobrar a la tarjeta (≈ 33,60 USD/mes).
- Falta decidir si el servidor de la nube queda como entorno permanente.
- Almacenamiento externo (R2/B2) para los archivos de la API: hoy van al disco del servidor.
- `local.agrovision.sbs` apunta al túnel de tu PC, pero el API local está apagado.
- Los documentos de `Docs/` y el repositorio raíz no tienen remoto.
