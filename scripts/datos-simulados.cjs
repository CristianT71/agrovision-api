// Datos SIMULADOS para ver cómo se vería el panel con una producción llena.
//
//   node scripts/datos-simulados.cjs sembrar   crea productores, agrónomos, detecciones, telemetría y solicitudes
//   node scripts/datos-simulados.cjs borrar    elimina SOLO lo que creó este script
//   node scripts/datos-simulados.cjs estado    cuenta lo simulado y lo real
//
// Cómo se distingue lo simulado de lo real: las cuentas simuladas tienen teléfono +57999… (un rango que no
// existe) y las instalaciones de telemetría empiezan por "sim-". Todo lo demás cuelga de esas cuentas, así que
// borrar nunca toca datos reales.
const fs = require("fs");
const crypto = require("crypto");
const { Client } = require("pg");

const env = Object.fromEntries(
    fs
        .readFileSync(".env", "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => {
            const i = l.indexOf("=");
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
);

const PREFIJO_TELEFONO = "+57999";
const PREFIJO_INSTALACION = "sim-";

// Generador determinista: la misma simulación sale igual cada vez
function mulberry32(a) {
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rnd = mulberry32(20261025);
const uuid = () => crypto.randomUUID();
const entre = (a, b) => a + rnd() * (b - a);
const entero = (a, b) => Math.floor(entre(a, b + 1));
const elegir = (lista) => lista[Math.floor(rnd() * lista.length)];
function elegirPonderado(pares) {
    const total = pares.reduce((s, [, p]) => s + p, 0);
    let x = rnd() * total;
    for (const [valor, p] of pares) {
        x -= p;
        if (x <= 0) return valor;
    }
    return pares[pares.length - 1][0];
}
const normal = (media, desv) => {
    const u = Math.max(rnd(), 1e-9);
    return media + desv * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
};

const DIA = 86_400_000;
const DIAS = 90;

// ── Catálogos de la simulación ──────────────────────────────────────────────────────────────────────
const MUNICIPIOS = [
    { nombre: "Pitalito", lat: 1.853, lon: -76.05, veredas: ["Criollo", "Bruselas", "Guacacallo", "Charguayaco"] },
    { nombre: "Garzón", lat: 2.196, lon: -75.627, veredas: ["El Mesón", "San Luis", "Cabuyal"] },
    { nombre: "La Plata", lat: 2.389, lon: -75.893, veredas: ["Belén", "Monserrate", "La Candelaria"] },
    { nombre: "Jardín", lat: 5.599, lon: -75.819, veredas: ["Santa Inés", "La Arboleda", "El Edén"] },
    { nombre: "Salgar", lat: 5.964, lon: -75.977, veredas: ["Peñalisa", "La Margarita", "Cañaveral"] },
    { nombre: "Chinchiná", lat: 4.983, lon: -75.606, veredas: ["Cartagena", "La Divisa", "Santa Rosa"] },
    { nombre: "Timbío", lat: 2.351, lon: -76.682, veredas: ["Mulaló", "El Cabuyal", "Los Anayes"] },
    { nombre: "Neira", lat: 5.166, lon: -75.52, veredas: ["Tapias", "San Bartolo", "Alto Corozal"] },
];
const NOMBRES = [
    "Ana María Rojas", "Luis Fernando Cuéllar", "Marta Lucía Vargas", "Jorge Iván Ospina", "Claudia Patricia Muñoz",
    "Hernán Darío Castaño", "Rosalba Giraldo", "Édgar Ramírez", "Luz Dary Hoyos", "Wilson Mosquera",
    "Gloria Inés Salazar", "Carlos Arturo Betancur", "Nubia Yanet Perdomo", "Álvaro Trujillo", "Sandra Milena Quintero",
    "Fabio Nelson Tovar", "Dora Alba Cardona", "Jhon Freddy Parra", "Mariela Zuluaga", "Gustavo Adolfo Ríos",
    "Yolanda Torres", "Duván Ceballos", "Esperanza Marín", "Rubén Darío Ortiz",
];
const FINCAS = ["La Esperanza", "El Paraíso", "Buenavista", "La Palmira", "Los Naranjos", "San Isidro", "El Recuerdo", "La Cumbre", "Villa Rocío", "El Mirador", "La Gloria", "Santa Teresa"];
const AGRONOMOS = [
    ["Laura Camila Henao Duque", "Fitopatología", "TPS-CAF-52113-ANT"],
    ["Ricardo Andrés Salcedo Peña", "Manejo integrado de plagas", "TPS-CAF-47720-HUI"],
    ["Diana Marcela Arias Gómez", "Nutrición vegetal", "TPS-CAF-60381-CAL"],
    ["Camilo Ernesto Valencia Ruiz", "Agronomía general", "TPS-CAF-44095-CAU"],
];

// Clases de cada versión del modelo, con la frecuencia con que aparecen en campo
const CLASES_V1 = [["Cerscospora", 13], ["Healthy", 30], ["Leaf rust", 22], ["Miner", 20], ["Otras_Enfermedades", 5], ["Phoma", 10]];
const CLASES_V2 = [["Cerscospora", 12], ["Healthy", 28], ["Leaf rust", 20], ["Miner", 18], ["Phoma", 9], ["Deficiencia_Azufre", 5], ["Deficiencia_Potasio", 4], ["Enfermedad_Antracnosis", 4]];
// Resultado de las compuertas: la versión 2.0.0 duda y falla menos
const RESULTADOS_V1 = [["IDENTIFIED", 66], ["UNCERTAIN", 22], ["OOD", 12]];
const RESULTADOS_V2 = [["IDENTIFIED", 85], ["UNCERTAIN", 15]];
const ALIAS = { leaf_rust: "enfermedad", cerscospora: "enfermedad", cercospora: "enfermedad", phoma: "enfermedad", otras_enfermedades: "enfermedad", miner: "plaga", healthy: "sano" };

// Misma regla que la API (categoria-biologica.ts)
function categorizar(resultado, clase) {
    if (resultado !== "IDENTIFIED" || !clase) return "no_reconocido";
    const n = clase.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (n.startsWith("enfermedad")) return "enfermedad";
    if (n.startsWith("plaga")) return "plaga";
    if (n.startsWith("deficiencia")) return "deficiencia";
    if (n === "sana" || n === "sano") return "sano";
    return ALIAS[n] ?? "otra";
}

const PLAGAS_SOLICITUD = ["Roya", "Mancha de hierro", "Minador de la hoja", "Quema del cogollo", "Antracnosis", "Deficiencia de potasio", "Deficiencia de azufre", "Ojo de gallo"];
const RESPUESTAS = [
    "Se observan lesiones compatibles con el diagnóstico. Recomiendo monitorear el lote cada ocho días y reforzar la nutrición.",
    "La IA acertó. Retire las hojas más afectadas, mejore la ventilación del cafetal y vuelva a escanear en una semana.",
    "No corresponde al diagnóstico del modelo: por el patrón de las manchas es otra afección. Aplique el manejo indicado en la ficha.",
    "Las fotos permiten confirmar el caso. Evite el exceso de sombra y programe una fertilización balanceada.",
    "Hace falta una foto más cercana del envés de la hoja para ser concluyente; con lo enviado el cuadro es consistente con lo indicado.",
    "Caso de baja severidad. Con manejo cultural es suficiente; no se justifica aplicación química por ahora.",
];

// ── Utilidades de base de datos ─────────────────────────────────────────────────────────────────────
async function insertar(cliente, tabla, columnas, filas, tamano = 400) {
    for (let i = 0; i < filas.length; i += tamano) {
        const lote = filas.slice(i, i + tamano);
        const params = [];
        const marcas = lote.map((fila) => {
            const ms = fila.map((valor) => {
                params.push(valor);
                return `$${params.length}`;
            });
            return `(${ms.join(",")})`;
        });
        await cliente.query(`INSERT INTO ${tabla} (${columnas.join(",")}) VALUES ${marcas.join(",")}`, params);
    }
}

async function contar(cliente) {
    const q = async (sql) => Number((await cliente.query(sql)).rows[0].n);
    const sim = `(SELECT id FROM productores WHERE telefono LIKE '${PREFIJO_TELEFONO}%')`;
    return {
        "productores simulados": await q(`SELECT count(*) n FROM productores WHERE telefono LIKE '${PREFIJO_TELEFONO}%'`),
        "agrónomos simulados": await q(`SELECT count(*) n FROM agronomos WHERE telefono LIKE '${PREFIJO_TELEFONO}%'`),
        "detecciones simuladas": await q(`SELECT count(*) n FROM detecciones_app WHERE productor_id IN ${sim}`),
        "solicitudes simuladas": await q(`SELECT count(*) n FROM solicitudes WHERE productor_id IN ${sim}`),
        "eventos de telemetría simulados": await q(`SELECT count(*) n FROM eventos_telemetria WHERE instalacion_id LIKE '${PREFIJO_INSTALACION}%'`),
        "detecciones REALES": await q(`SELECT count(*) n FROM detecciones_app WHERE productor_id NOT IN ${sim}`),
        "telemetría REAL": await q(`SELECT count(*) n FROM eventos_telemetria WHERE instalacion_id IS NULL OR instalacion_id NOT LIKE '${PREFIJO_INSTALACION}%'`),
    };
}

async function borrar(cliente) {
    const sim = `(SELECT id FROM productores WHERE telefono LIKE '${PREFIJO_TELEFONO}%')`;
    await cliente.query("BEGIN");
    const quitadas = {};
    const paso = async (nombre, sql) => (quitadas[nombre] = (await cliente.query(sql)).rowCount);
    await paso("eventos de telemetría", `DELETE FROM eventos_telemetria WHERE instalacion_id LIKE '${PREFIJO_INSTALACION}%'`);
    await paso("solicitudes", `DELETE FROM solicitudes WHERE productor_id IN ${sim}`);
    await paso("detecciones", `DELETE FROM detecciones_app WHERE productor_id IN ${sim}`);
    await paso("productores", `DELETE FROM productores WHERE telefono LIKE '${PREFIJO_TELEFONO}%'`);
    await paso("agrónomos", `DELETE FROM agronomos WHERE telefono LIKE '${PREFIJO_TELEFONO}%'`);
    await paso("cuentas de usuario", `DELETE FROM usuarios WHERE telefono LIKE '${PREFIJO_TELEFONO}%'`);
    await cliente.query("COMMIT");
    return quitadas;
}

async function sembrar(cliente) {
    const ya = await contar(cliente);
    if (ya["productores simulados"] > 0) {
        throw new Error("Ya hay datos simulados. Ejecuta primero: node scripts/datos-simulados.cjs borrar");
    }

    const modelos = (await cliente.query("SELECT id, version, fecha_publicacion FROM modelos_ia WHERE version IN ('1.0.0','2.0.0')")).rows;
    const v1 = modelos.find((m) => m.version === "1.0.0");
    const v2 = modelos.find((m) => m.version === "2.0.0");
    if (!v1 || !v2) throw new Error("Hacen falta los modelos 1.0.0 y 2.0.0 en el inventario.");

    const ahora = Date.now();
    const inicio = ahora - DIAS * DIA;
    // La 2.0.0 empieza a llegar hace 14 días y cada instalación la recibe entre ese día y el décimo siguiente
    const lanzamientoV2 = ahora - 14 * DIA;

    await cliente.query("BEGIN");

    // ── Cuentas ───────────────────────────────────────────────────────────────────────────────────
    const usuarios = [];
    const productores = [];
    const instalaciones = [];
    let consecutivo = 0;
    const telefono = () => `${PREFIJO_TELEFONO}${String(1000000 + ++consecutivo).slice(1)}`.padEnd(13, "0").slice(0, 13);

    NOMBRES.forEach((nombre, i) => {
        const m = MUNICIPIOS[i % MUNICIPIOS.length];
        const idUsuario = uuid();
        const idProductor = uuid();
        const tel = telefono();
        const registro = inicio + entre(0, 70) * DIA;
        const consiente = i % 8 !== 7; // tres no dieron consentimiento
        usuarios.push([idUsuario, tel, "productor", "activo", new Date(registro)]);
        productores.push({
            id: idProductor,
            usuarioId: idUsuario,
            nombre,
            finca: `${elegir(FINCAS)} ${i < 12 ? "" : "II"}`.trim(),
            vereda: elegir(m.veredas),
            municipio: m.nombre,
            lat: m.lat,
            lon: m.lon,
            tel,
            consiente,
            registro,
            // cada productor usa uno o dos teléfonos
            instalaciones: Array.from({ length: i % 5 === 0 ? 2 : 1 }, (_, k) => `${PREFIJO_INSTALACION}${String(i).padStart(2, "0")}${"ab"[k]}`),
        });
    });
    productores.forEach((p) =>
        p.instalaciones.forEach((id) =>
            instalaciones.push({
                id,
                productor: p,
                // cuándo pasa esta instalación a la 2.0.0
                cambioV2: lanzamientoV2 + entre(0, 10) * DIA,
                delegado: elegirPonderado([["nnapi", 45], ["gpu", 20], ["cpu", 35]]),
                factorLatencia: entre(0.7, 1.6),
            }),
        ),
    );

    const agronomos = AGRONOMOS.map(([nombre, especialidad, tarjeta], i) => {
        const idUsuario = uuid();
        const tel = telefono();
        usuarios.push([idUsuario, tel, "agronomo", "activo", new Date(inicio + i * 3 * DIA)]);
        return { id: uuid(), usuarioId: idUsuario, nombre, especialidad, tarjeta, tel, correo: `sim.agronomo${i + 1}@agrovision.test` };
    });

    await insertar(cliente, "usuarios", ["id", "telefono", "rol", "estado", "fecha_registro"], usuarios);
    await insertar(
        cliente,
        "productores",
        ["id", "usuario_id", "nombre", "finca", "vereda", "municipio", "telefono", "estado", "consentimiento", "fecha_consentimiento"],
        productores.map((p) => [p.id, p.usuarioId, p.nombre, p.finca, p.vereda, p.municipio, p.tel, "validado", p.consiente, p.consiente ? new Date(p.registro + DIA) : null]),
    );
    await insertar(
        cliente,
        "agronomos",
        ["id", "usuario_id", "nombre", "tarjeta_profesional", "telefono", "correo", "especialidad", "estado", "fecha_alta"],
        agronomos.map((a) => [a.id, a.usuarioId, a.nombre, a.tarjeta, a.tel, a.correo, a.especialidad, "activo", new Date(inicio)]),
    );

    // ── Escaneos: una fila de detección por escaneo que el productor aceptó enviar, y su evento de telemetría ──
    const detecciones = [];
    const eventos = [];
    const productoresConConsentimiento = productores.filter((p) => p.consiente);

    for (let d = 0; d < DIAS; d++) {
        const diaInicio = inicio + d * DIA;
        const diaSemana = new Date(diaInicio).getDay();
        // Crece con el tiempo, baja el fin de semana y tiene algo de ruido
        const factorSemana = diaSemana === 0 ? 0.45 : diaSemana === 6 ? 0.7 : 1;
        const escaneos = Math.max(2, Math.round((16 + d * 0.5) * factorSemana * entre(0.75, 1.3)));

        for (let k = 0; k < escaneos; k++) {
            const inst = elegir(instalaciones.filter((x) => x.productor.registro <= diaInicio + DIA));
            if (!inst) continue;
            const productor = inst.productor;
            const hora = Math.min(19, Math.max(5, Math.round(normal(10.5, 3))));
            const momento = diaInicio + hora * 3_600_000 + entero(0, 59) * 60_000 + entero(0, 59) * 1000;
            if (momento > ahora) continue;

            const esV2 = momento >= inst.cambioV2;
            const modelo = esV2 ? v2 : v1;
            const version = modelo.version;
            const latencia = Math.round(Math.max(60, normal(esV2 ? 130 : 175, 40)) * inst.factorLatencia);

            // Algunos escaneos los rechaza la calidad de imagen: solo se ve en telemetría, no se guarda captura
            if (rnd() < (esV2 ? 0.045 : 0.07)) {
                eventos.push(["scan", inst.id, "2.0.0", version, "QUALITY_REJECTED", null, latencia, inst.delegado, null, null, null, null, null, momento]);
                continue;
            }

            const resultado = elegirPonderado(esV2 ? RESULTADOS_V2 : RESULTADOS_V1);
            const clase = elegirPonderado(esV2 ? CLASES_V2 : CLASES_V1);
            let confianza;
            if (resultado === "IDENTIFIED") confianza = Math.min(0.995, Math.max(0.56, normal(esV2 ? 0.93 : 0.88, 0.07)));
            else if (resultado === "UNCERTAIN") confianza = Math.min(0.69, Math.max(0.28, normal(0.5, 0.1)));
            else confianza = Math.min(0.6, Math.max(0.1, normal(0.35, 0.1)));
            // Un poco de confianza exactamente cero: inferencia defectuosa
            const defectuosa = rnd() < 0.006;
            if (defectuosa) confianza = 0;
            const claseGuardada = resultado === "OOD" ? null : clase;

            const corrigio = !defectuosa && resultado !== "OOD" && rnd() < (esV2 ? 0.035 : 0.06);
            const correccion = corrigio ? elegirPonderado((esV2 ? CLASES_V2 : CLASES_V1).filter(([c]) => c !== clase)) : null;

            eventos.push(["scan", inst.id, "2.0.0", version, resultado, Number(confianza.toFixed(4)), latencia, inst.delegado, null, null, null, null, null, momento]);
            if (corrigio) eventos.push(["correction", inst.id, "2.0.0", version, null, null, null, null, claseGuardada, correccion, null, null, null, momento + 60_000]);

            if (productor.consiente) {
                const lat = productor.lat + entre(-0.03, 0.03);
                const lon = productor.lon + entre(-0.03, 0.03);
                detecciones.push([
                    uuid(), uuid(), productor.id, categorizar(resultado, claseGuardada), claseGuardada, Number(confianza.toFixed(4)),
                    esV2 ? 0 : Number((resultado === "OOD" ? entre(2.6, 4.8) : Math.abs(normal(0.9, 0.5))).toFixed(3)),
                    resultado, modelo.id, version, correccion, !corrigio && rnd() < 0.2, "CAFE", rnd() < 0.9 ? "HOJA" : elegir(["FRUTO", "TALLO"]),
                    Number(lat.toFixed(6)), Number(lon.toFixed(6)), Number(entre(4, 35).toFixed(1)), productor.municipio,
                    new Date(momento), new Date(momento + entero(2, 90) * 1000), defectuosa,
                ]);
            }
        }
    }

    // ── Actualizaciones de modelo: cada instalación pasa de la 1.0.0 a la 2.0.0 ──
    for (const inst of instalaciones) {
        if (inst.cambioV2 > ahora) continue;
        if (rnd() < 0.08) {
            // un intento fallido y el reintento al día siguiente
            eventos.push(["model_update", inst.id, "2.0.0", null, null, null, null, null, null, null, "1.0.0", "2.0.0", false, inst.cambioV2 - entero(1, 20) * 3_600_000]);
        }
        eventos.push(["model_update", inst.id, "2.0.0", null, null, null, null, null, null, null, "1.0.0", "2.0.0", true, inst.cambioV2]);
    }

    await insertar(
        cliente,
        "detecciones_app",
        ["id", "id_cliente", "productor_id", "tipo", "clase_predicha", "confianza", "puntaje_ood", "resultado_compuerta", "modelo_id", "modelo_version", "correccion_productor", "confirmada_productor", "cultivo", "organo", "latitud", "longitud", "precision_metros", "municipio", "fecha", "recibida_en", "defectuosa"],
        detecciones,
    );
    await insertar(
        cliente,
        "eventos_telemetria",
        ["id", "tipo", "instalacion_id", "version_app", "version_modelo", "resultado", "confianza", "latencia_ms", "delegado", "clase_origen", "clase_destino", "version_origen", "version_destino", "exito", "ocurrido_en", "recibido_en"],
        eventos.map((e) => [uuid(), e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8], e[9], e[10], e[11], e[12], new Date(e[13]), new Date(e[13] + 2000)]),
    );

    // ── Solicitudes de revisión ──
    const solicitudes = [];
    for (let i = 0; i < 160; i++) {
        // Más recientes que antiguas
        const momento = inicio + Math.pow(rnd(), 0.75) * DIAS * DIA;
        if (momento > ahora - 3_600_000) continue;
        const productor = elegir(productoresConConsentimiento);
        const esV2 = momento >= lanzamientoV2 + 5 * DIA;
        const reciente = ahora - momento < 2 * DIA;
        const estado = reciente
            ? elegirPonderado([["Pendiente", 25], ["Enviada", 30], ["Asignada", 25], ["Resuelta", 20]])
            : elegirPonderado([["Resuelta", 86], ["Descartada", 5], ["Asignada", 5], ["Enviada", 4]]);
        const agronomo = estado === "Asignada" || estado === "Resuelta" ? elegirPonderado(agronomos.map((a, k) => [a, [38, 27, 22, 13][k]])) : null;
        const tipo = estado === "Resuelta"
            ? elegirPonderado([["Confirma diagnóstico IA", 45], ["Corrige diagnóstico IA", 28], ["Plaga nueva", 9], ["Imagen no diagnosticable", 9], ["Planta sana", 9]])
            : null;
        const resolucion = estado === "Resuelta" ? momento + entre(2, 60) * 3_600_000 : null;
        solicitudes.push([
            uuid(), productor.id, agronomo ? agronomo.id : null, estado, new Date(momento), productor.municipio, productor.vereda, productor.finca,
            Number(entre(0.3, 0.85).toFixed(3)), esV2 ? v2.id : v1.id,
            estado === "Resuelta" ? elegir(RESPUESTAS) : null,
            tipo,
            tipo === "Planta sana" ? "Sin plaga (planta sana)" : tipo === "Imagen no diagnosticable" ? "No determinable" : tipo ? (tipo === "Plaga nueva" ? "Ojo de gallo" : elegir(PLAGAS_SOLICITUD)) : null,
            resolucion ? new Date(resolucion) : null,
            uuid(), null, "CAFE", rnd() < 0.85 ? "HOJA" : elegir(["FRUTO", "TALLO"]),
            rnd() < 0.5 ? elegir(["Manchas en el haz de las hojas", "Hojas amarillas en el lote nuevo", "Galerías en las hojas jóvenes", "Caída de hojas en las ramas bajas", "Puntos oscuros que avanzan"]) : null,
            Number((productor.lat + entre(-0.03, 0.03)).toFixed(6)), Number((productor.lon + entre(-0.03, 0.03)).toFixed(6)), Number(entre(4, 35).toFixed(1)),
            new Date(resolucion ?? momento),
        ]);
    }
    await insertar(
        cliente,
        "solicitudes",
        ["id", "productor_id", "agronomo_id", "estado", "fecha", "municipio", "vereda", "finca", "confianza_ia", "modelo_version_id", "respuesta_profesional", "tipo_resultado", "plaga_identificada", "fecha_resolucion", "id_cliente", "captura_id", "cultivo", "organo", "nota", "latitud", "longitud", "precision_metros", "actualizado_en"],
        solicitudes,
        200,
    );

    await cliente.query("COMMIT");
    return { productores: productores.length, agronomos: agronomos.length, detecciones: detecciones.length, eventos: eventos.length, solicitudes: solicitudes.length };
}

(async () => {
    const comando = process.argv[2];
    if (!["sembrar", "borrar", "estado"].includes(comando)) {
        console.log("Uso: node scripts/datos-simulados.cjs sembrar | borrar | estado");
        process.exit(1);
    }
    const cliente = new Client({ host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME });
    await cliente.connect();
    try {
        if (comando === "estado") console.table(await contar(cliente));
        if (comando === "borrar") console.table(await borrar(cliente));
        if (comando === "sembrar") {
            console.table(await sembrar(cliente));
            console.table(await contar(cliente));
        }
    } catch (error) {
        await cliente.query("ROLLBACK").catch(() => undefined);
        console.error("ERROR:", error.message);
        process.exitCode = 1;
    } finally {
        await cliente.end();
    }
})();
