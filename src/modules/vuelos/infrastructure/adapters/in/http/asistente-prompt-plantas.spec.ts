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
