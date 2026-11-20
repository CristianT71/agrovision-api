import { readFileSync } from "fs";
import { join } from "path";
import { runInNewContext } from "vm";

// Contrato del flujo 01 de n8n: ante preguntas de conteo de plantas el agente debe consultar el análisis
// y citarlo como estimación aproximada, sin instrucciones contradictorias que lo hagan negar el conteo.
const flujo = JSON.parse(
    readFileSync(join(__dirname, "../../../../../../../n8n/workflows/01-chat-asistente.json"), "utf8"),
) as {
    nodes: { name: string; parameters: { description?: string; options?: { systemMessage?: string } } }[];
};
const nodo = (nombre: string) => flujo.nodes.find((n) => n.name === nombre)!;

describe("Prompt del asistente: conteo de plantas", () => {
    const prompt = nodo("Asistente (agente)").parameters.options?.systemMessage ?? "";

    it("no afirma que el conteo de plantas no está calculado", () => {
        expect(prompt).not.toMatch(/conteo real de plantas no está calculado/i);
    });

    it("obliga a llamar a analizar_vuelo y a citar plantas como estimación con su nota y su motivo", () => {
        expect(prompt).toMatch(/plantas[\s\S]*llama PRIMERO a 'analizar_vuelo'/);
        for (const texto of [
            "analisis.plantas",
            "notaValidacion",
            "estimación aproximada",
            "motivoSinConteo",
            "fallas de siembra",
        ]) {
            expect(prompt).toContain(texto);
        }
    });

    it("la herramienta analizar_vuelo anuncia el conteo de copas", () => {
        expect(nodo("analizar_vuelo").parameters.description).toMatch(/conteo de copas o plantas/);
    });
});

describe("Flujo 02: salida compacta para el chat", () => {
    const flujo02 = JSON.parse(
        readFileSync(join(__dirname, "../../../../../../../n8n/workflows/02-analisis-vuelo.json"), "utf8"),
    ) as { nodes: { name: string; parameters: { jsCode?: string } }[] };

    it.each(["Armar análisis", "Armar análisis por reglas (sin IA)"])(
        "%s quita huellas, polígonos y celdas cuando no se piden mapas",
        (nombre) => {
            const codigo = flujo02.nodes.find((n) => n.name === nombre)?.parameters.jsCode ?? "";
            const contexto = (nodo: string) => ({
                first: () => ({ json: nodo === "Entrada (otro flujo)" ? { mapasInforme: false } : {} }),
            });
            const salida = [
                {
                    json: {
                        analisis: {
                            huellas: [{ poligono: [[1, 2]] }],
                            zonas: [{ id: "Z1", poligono: [[1, 2]], areaM2: 3 }],
                            correlacionApp: { radioM: 300, celdas: [{}], porCaptura: [{}] },
                            plantas: { porCaptura: [{ conteo: 5 }] },
                        },
                    },
                },
            ];
            const inicio = codigo.indexOf("const pedirMapas");
            const fin = codigo.indexOf("return compactarParaChat(");
            expect(inicio).toBeGreaterThan(0);
            expect(fin).toBeGreaterThan(inicio);
            const compactar = runInNewContext(codigo.slice(inicio, fin) + "compactarParaChat;", { $: contexto }) as (
                s: typeof salida,
            ) => typeof salida;
            const { analisis } = compactar(salida)[0].json;
            expect(analisis.huellas).toBeNull();
            expect(analisis.zonas[0]).toEqual({ id: "Z1", areaM2: 3 });
            expect(analisis.correlacionApp).toEqual({ radioM: 300 });
            expect(analisis.plantas.porCaptura[0].conteo).toBe(5);
        },
    );
});

describe("Prompt del asistente: reportes de la app y sección fitosanitaria", () => {
    const prompt = nodo("Asistente (agente)").parameters.options?.systemMessage ?? "";

    it("ante reportes de la app o plagas llama primero a analizar_vuelo y usa respaldoApp", () => {
        expect(prompt).toMatch(/Reportes de la app[\s\S]*llama PRIMERO a 'analizar_vuelo'[\s\S]*analisis\.respaldoApp/);
        for (const texto of [
            "consistente",
            "no_consistente",
            "no_concluyente",
            "motivosNoConcluyente",
            "grupos[].razon",
        ]) {
            expect(prompt).toContain(texto);
        }
        expect(nodo("analizar_vuelo").parameters.description).toMatch(/reportes de la app, plagas o enfermedades/);
    });

    it("presenta siempre la sección fitosanitaria como hipótesis o como verificada por el agrónomo", () => {
        expect(prompt).toContain("respaldoApp.fitosanitario");
        expect(prompt).toMatch(/'hipotesis_sin_verificar' preséntala como HIPÓTESIS, nunca como diagnóstico/);
        expect(prompt).toContain("'verificado_por_agronomo'");
    });

    it("incluye siempre los dos avisos y nunca confirma la plaga ni recomienda productos", () => {
        expect(prompt).toMatch(/SIEMPRE estos dos avisos: \(a\) el diagnóstico fitosanitario está pendiente/);
        expect(prompt).toMatch(/\(b\) no es posible calcular la propagación con un único vuelo/);
        expect(prompt).toMatch(/línea «Avisos:» que copie tal cual los textos de respaldoApp\.fitosanitario\.avisos/);
        expect(prompt).toMatch(/Nunca digas que el dron confirma o identifica la plaga/);
        expect(prompt).toMatch(/nunca recomiendes productos ni dosis/);
        expect(prompt).toMatch(/nutrición, sequía, sombra, suelo/);
        // Sin contradicciones con el resto del prompt
        expect(prompt).toContain("nunca diagnostiques enfermedades, plagas ni deficiencias");
        expect(prompt).not.toMatch(/el dron confirma (la|que)/i);
    });
});

describe("Flujo 02: respaldo de los reportes de la app", () => {
    const flujo02 = JSON.parse(
        readFileSync(join(__dirname, "../../../../../../../n8n/workflows/02-analisis-vuelo.json"), "utf8"),
    ) as {
        nodes: { name: string; parameters: { jsCode?: string; jsonBody?: string; url?: string } }[];
        connections: Record<string, { main: { node: string }[][] }>;
    };
    const n02 = (nombre: string) => flujo02.nodes.find((n) => n.name === nombre)!;

    it("consulta la app ANTES del servicio de índices y le pasa reportes, revisión y reglas", () => {
        const siguiente = (nombre: string) => flujo02.connections[nombre].main[0][0].node;
        expect(siguiente("Agrupar capturas")).toBe("Registros de la app");
        expect(siguiente("Registros de la app")).toBe("Calcular índices (servicio)");
        expect(siguiente("Calcular índices (servicio)")).toBe("Correlacionar con la app");
        const cuerpo = n02("Calcular índices (servicio)").parameters.jsonBody ?? "";
        for (const texto of ["reportesApp", "revision", "reglasZona", "diasDesdeVuelo"])
            expect(cuerpo).toContain(texto);
        expect(n02("Agrupar capturas").parameters.jsCode).toContain("capturasRespaldo");
        expect(n02("Correlacionar con la app").parameters.jsCode).toContain("$('Registros de la app').first().json");
    });

    it.each(["Armar análisis", "Armar análisis por reglas (sin IA)"])(
        "%s entrega respaldoApp y lo compacta para el chat sin métricas ni nombre del agrónomo",
        (nombre) => {
            const codigo = n02(nombre).parameters.jsCode ?? "";
            expect(codigo).toMatch(/respaldoApp: (servicio|r)\.respaldoApp \?\? null/);
            const contexto = () => ({ first: () => ({ json: { mapasInforme: false } }) });
            const inicio = codigo.indexOf("const pedirMapas");
            const fin = codigo.indexOf("return compactarParaChat(");
            const compactar = runInNewContext(codigo.slice(inicio, fin) + "compactarParaChat;", { $: contexto }) as (
                s: unknown,
            ) => {
                json: {
                    analisis: {
                        respaldoApp: {
                            grupos: { metricas?: unknown }[];
                            firmaEsperada?: string;
                            resumen: unknown;
                            fitosanitario: { texto: string; avisos: string[] };
                        };
                    };
                };
            }[];
            const fito = {
                estado: "verificado_por_agronomo",
                texto: "Verificado por agrónomo Ana Pérez el 2026-11-02: Confirma diagnóstico IA (Roya).",
                verificados: [{ agronomo: "Ana Pérez", conclusion: "confirmada" }],
                avisos: ["No es posible calcular la propagación con un único vuelo."],
            };
            const salida = compactar([
                {
                    json: {
                        analisis: {
                            zonas: [],
                            respaldoApp: {
                                resumen: { consistente: 1 },
                                firmaEsperada: "larga",
                                umbrales: {},
                                fitosanitario: fito,
                                reglas: [{ tipo: "roya", cortesIncidenciaPct: [5] }],
                                grupos: [1, 2, 3, 4, 5].map((i) => ({
                                    clase: "Leaf rust",
                                    razon: `r${i}`,
                                    metricas: { NDRE: {} },
                                    fitosanitario: { agronomo: "Ana Pérez" },
                                })),
                            },
                        },
                    },
                },
            ]);
            const r = salida[0].json.analisis.respaldoApp;
            expect(r.grupos).toHaveLength(4);
            expect(r.grupos[0].metricas).toBeUndefined();
            expect(r.firmaEsperada).toBeUndefined();
            expect(r.resumen).toEqual({ consistente: 1 });
            expect(JSON.stringify(r)).not.toContain("Ana");
            expect(r.fitosanitario.texto).toBe(
                "Verificado por agrónomo el 2026-11-02: Confirma diagnóstico IA (Roya).",
            );
            expect(r.fitosanitario.avisos).toEqual(fito.avisos);
        },
    );
});

describe("Flujo 03: el informe siempre trae la sección fitosanitaria", () => {
    const flujo03 = JSON.parse(
        readFileSync(join(__dirname, "../../../../../../../n8n/workflows/03-informe-pdf.json"), "utf8"),
    ) as { nodes: { name: string; parameters: { jsCode?: string } }[] };
    const codigo = (nombre: string) => flujo03.nodes.find((n) => n.name === nombre)?.parameters.jsCode ?? "";

    it("pinta la sección con sus estados y los dos avisos, sin pasar el respaldo al modelo redactor", () => {
        const html = codigo("Armar HTML");
        expect(html).toContain("${bloqueFitosanitario}");
        for (const texto of [
            "Hipótesis sin verificar (no es un diagnóstico)",
            "Verificado por agrónomo",
            "Diagnóstico fitosanitario pendiente",
            "No es posible calcular la propagación con un único vuelo",
        ]) {
            expect(html).toContain(texto);
        }
        expect(codigo("Validar y preparar")).toContain("respaldoApp: _respaldo");
    });
});
