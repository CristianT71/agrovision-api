import { Plaga } from "../../../../domain/entities/plaga.entity";
import { AvalPlaga } from "../../../../domain/entities/aval-plaga.entity";
import { aFichaPublica, claveDesdeNombre } from "./catalogo-publico.mapper";

const ID_ROYA = "dd8cfa55-a7a6-5e64-80b3-32c106f5ff19";

const crearFicha = (id: string, avalada: boolean, fotoUrl: string | null = null) =>
    new Plaga(
        id,
        "Roya de Café",
        "Hemileia vastatrix",
        "enfermedad",
        "Descripción",
        "Síntomas",
        "cafe",
        ["hoja"],
        ["café"],
        "Quitar hojas afectadas",
        "Fungicida X, dosis Y",
        fotoUrl,
        ["roya"],
        avalada ? [new AvalPlaga("av-1", "agr-1", "TP-123456", new Date())] : [],
    );

describe("Catálogo público: mapper", () => {
    it("sin aval no publica las medidas ni el protocolo químico", () => {
        const ficha = aFichaPublica(crearFicha(ID_ROYA, false), "https://agrovision.sbs");

        expect(ficha.avalada).toBe(false);
        expect(ficha.medidasContencion).toBeNull();
        expect(ficha.protocoloQuimico).toBeNull();
    });

    it("la ficha de hormigas se enlaza con la clase del modelo aunque su UUID sea otro (se busca por clave)", () => {
        const hormigas = new Plaga(
            "11111111-2222-4333-8444-555555555555",
            "Hormigas (hormigueros)",
            null,
            "plaga",
            "Descripción",
            "Síntomas",
            "cafe",
            ["raíz"],
            [],
            "Medidas",
            null,
            null,
            [],
            [],
        );

        const ficha = aFichaPublica(hormigas, "https://agrovision.sbs");

        expect(ficha.clave).toBe("Hormigas_hormigueros");
        expect(ficha.modelo).toEqual({ clase: "Hormigas_hormigueros", desdeVersion: "3.0.0" });
    });

    it("con aval publica las medidas y el protocolo, pero no quién firmó", () => {
        const ficha = aFichaPublica(crearFicha(ID_ROYA, true), "https://agrovision.sbs");

        expect(ficha.avalada).toBe(true);
        expect(ficha.medidasContencion).toBe("Quitar hojas afectadas");
        expect(ficha.protocoloQuimico).toBe("Fungicida X, dosis Y");
        expect(JSON.stringify(ficha)).not.toContain("TP-123456");
        expect(JSON.stringify(ficha)).not.toContain("agr-1");
    });

    it("liga la ficha con la clase del modelo", () => {
        const ficha = aFichaPublica(crearFicha(ID_ROYA, false), "https://agrovision.sbs");

        expect(ficha.clave).toBe("Enfermedad_Roya");
        expect(ficha.modelo).toEqual({ clase: "Leaf rust", desdeVersion: "2.0.0" });
    });

    it("una ficha fuera del mapa recibe una clave derivada del nombre y no tiene clase de modelo", () => {
        const ficha = aFichaPublica(crearFicha("id-propio", false), "https://agrovision.sbs");

        expect(ficha.clave).toBe("Roya_de_Cafe");
        expect(ficha.modelo).toBeNull();
    });

    it("entrega la URL completa de la foto", () => {
        const ficha = aFichaPublica(crearFicha(ID_ROYA, false, "/archivos/plagas/a.jpg"), "https://agrovision.sbs/");

        expect(ficha.fotoUrl).toBe("https://agrovision.sbs/archivos/plagas/a.jpg");
    });

    it("sin foto devuelve null", () => {
        expect(aFichaPublica(crearFicha(ID_ROYA, false), "https://agrovision.sbs").fotoUrl).toBeNull();
    });

    it("claveDesdeNombre quita tildes y símbolos", () => {
        expect(claveDesdeNombre("Deficiencia de Azufre-S")).toBe("Deficiencia_de_Azufre_S");
        expect(claveDesdeNombre("Quema del Cogollo")).toBe("Quema_del_Cogollo");
    });
});
