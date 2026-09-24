import { AvalPlaga } from "./aval-plaga.entity";

// Clasificación de la ficha técnica (RF-05.1)
export type TipoPlaga = "enfermedad" | "plaga" | "deficiencia" | "sano";

export class Plaga {
    constructor(
        public readonly id: string,
        public nombreComun: string,
        public nombreCientifico: string | null,
        public tipo: TipoPlaga,
        public descripcion: string,
        public sintomas: string,
        public cultivo: string,
        public organosAfectados: string[],
        public hospederos: string[],
        public medidasContencion: string,
        public protocoloQuimico: string | null,
        public fotoUrl: string | null,
        public sinonimos: string[],
        public avales: AvalPlaga[],
    ) {}

    // Regla de Negocio (RF-05.4): Una ficha nueva exige los campos mínimos y nunca nace
    // avalada ni con protocolo químico
    public static crear(datos: {
        id: string;
        nombreComun: string;
        nombreCientifico?: string | null;
        tipo: TipoPlaga;
        descripcion: string;
        sintomas: string;
        cultivo?: string;
        organosAfectados: string[];
        hospederos?: string[];
        medidasContencion: string;
        fotoUrl?: string | null;
        sinonimos?: string[];
    }): Plaga {
        if (!datos.nombreComun?.trim()) {
            throw new Error("El nombre común de la ficha es obligatorio.");
        }

        if (!datos.tipo) {
            throw new Error("El tipo de la ficha es obligatorio.");
        }

        if (!datos.descripcion?.trim()) {
            throw new Error("La descripción de la ficha es obligatoria.");
        }

        if (!datos.sintomas?.trim()) {
            throw new Error("Los síntomas de la ficha son obligatorios.");
        }

        if (!datos.organosAfectados?.length) {
            throw new Error("La ficha debe indicar al menos un órgano afectado.");
        }

        if (!datos.medidasContencion?.trim()) {
            throw new Error("Las medidas de contención de la ficha son obligatorias.");
        }

        const plaga = new Plaga(
            datos.id,
            datos.nombreComun,
            datos.nombreCientifico ?? null,
            datos.tipo,
            datos.descripcion,
            datos.sintomas,
            datos.cultivo ?? "cafe",
            datos.organosAfectados,
            [],
            datos.medidasContencion,
            null,
            datos.fotoUrl ?? null,
            [],
            [],
        );

        plaga.reemplazarSinonimos(datos.sinonimos ?? []);
        plaga.reemplazarHospederos(datos.hospederos ?? []);

        return plaga;
    }

    // Regla de Negocio (RF-05.7): El aval profesional es lo que libera el protocolo químico
    public tieneAval(): boolean {
        return this.avales.length > 0;
    }

    // Regla de Negocio (RF-05.3): La edición de la ficha no alcanza al protocolo químico,
    // que tiene su propia regla de aval (RF-05.6)
    public actualizarFicha(datos: {
        nombreComun?: string;
        nombreCientifico?: string | null;
        tipo?: TipoPlaga;
        descripcion?: string;
        sintomas?: string;
        cultivo?: string;
        organosAfectados?: string[];
        medidasContencion?: string;
        fotoUrl?: string | null;
    }): void {
        if (datos.nombreComun !== undefined) this.nombreComun = datos.nombreComun;
        if (datos.nombreCientifico !== undefined) this.nombreCientifico = datos.nombreCientifico;
        if (datos.tipo !== undefined) this.tipo = datos.tipo;
        if (datos.descripcion !== undefined) this.descripcion = datos.descripcion;
        if (datos.sintomas !== undefined) this.sintomas = datos.sintomas;
        if (datos.cultivo !== undefined) this.cultivo = datos.cultivo;
        if (datos.organosAfectados !== undefined) this.organosAfectados = datos.organosAfectados;
        if (datos.medidasContencion !== undefined) this.medidasContencion = datos.medidasContencion;
        if (datos.fotoUrl !== undefined) this.fotoUrl = datos.fotoUrl;
    }

    // Regla de Negocio (RF-05.5): Los sinónimos son una lista dinámica y normalizada
    public reemplazarSinonimos(lista: string[]): void {
        this.sinonimos = Plaga.normalizarLista(lista);
    }

    // Regla de Negocio (RF-05.5): Los hospederos son una lista dinámica y normalizada
    public reemplazarHospederos(lista: string[]): void {
        this.hospederos = Plaga.normalizarLista(lista);
    }

    // Regla de Negocio (RF-05.6): Los parámetros químicos y la dosificación quedan bloqueados
    // mientras la ficha no tenga aval profesional
    public actualizarProtocoloQuimico(protocolo: string): void {
        if (!this.tieneAval()) {
            throw new Error(
                "No se puede modificar el protocolo químico ni la dosificación de una ficha sin aval profesional.",
            );
        }

        this.protocoloQuimico = protocolo;
    }

    // Regla de Negocio (RF-05.7): Un agrónomo avala una ficha una sola vez
    public registrarAval(aval: AvalPlaga): void {
        if (this.avales.some((existente) => existente.agronomoId === aval.agronomoId)) {
            throw new Error("Este agrónomo ya avaló esta ficha.");
        }

        this.avales.push(aval);
    }

    // Normaliza una lista de texto: recorta, descarta vacíos y elimina duplicados
    // sin distinguir mayúsculas, conservando la primera forma escrita
    private static normalizarLista(lista: string[]): string[] {
        const vistos = new Set<string>();
        const resultado: string[] = [];

        for (const valor of lista ?? []) {
            const limpio = valor?.trim();
            if (!limpio) continue;

            const clave = limpio.toLowerCase();
            if (vistos.has(clave)) continue;

            vistos.add(clave);
            resultado.push(limpio);
        }

        return resultado;
    }
}
