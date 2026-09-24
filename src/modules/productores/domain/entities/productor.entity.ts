export type EstadoProductor = "registrado" | "validado";

export class Productor {
    constructor(
        public readonly id: string,
        public readonly usuarioId: string,
        public nombre: string,
        public finca: string,
        public vereda: string,
        public municipio: string,
        public telefono: string,
        public estado: EstadoProductor,
        public consentimiento: boolean,
        public fechaConsentimiento: Date | null,
    ) {}

    // Regla de Negocio (RF-10.2): Todo productor nuevo queda "registrado" y solo fecha su
    // consentimiento si lo otorga en el alta
    public static registrar(datos: {
        id: string;
        usuarioId: string;
        nombre: string;
        finca: string;
        vereda: string;
        municipio: string;
        telefono: string;
        consentimiento: boolean;
    }): Productor {
        return new Productor(
            datos.id,
            datos.usuarioId,
            datos.nombre,
            datos.finca,
            datos.vereda,
            datos.municipio,
            datos.telefono,
            "registrado",
            datos.consentimiento,
            datos.consentimiento ? new Date() : null,
        );
    }

    // Regla de Negocio (RF-10.2): Solo un productor registrado puede ser validado
    public validar(): void {
        if (this.estado !== "registrado") {
            throw new Error("El productor ya se encuentra validado.");
        }

        this.estado = "validado";
    }

    // Regla de Negocio (RF-10.2): El consentimiento se otorga una sola vez y queda fechado
    public otorgarConsentimiento(): void {
        if (this.consentimiento) {
            throw new Error("El productor ya otorgó su consentimiento.");
        }

        this.consentimiento = true;
        this.fechaConsentimiento = new Date();
    }

    // Regla de Negocio (RF-10.3): La revocación del consentimiento requiere validación explícita
    public revocarConsentimiento(confirmacion: boolean): void {
        if (confirmacion !== true) {
            throw new Error("La revocación del consentimiento requiere confirmación explícita.");
        }

        if (!this.consentimiento) {
            throw new Error("El productor no tiene un consentimiento vigente para revocar.");
        }

        this.consentimiento = false;
        this.fechaConsentimiento = null;
    }

    // Regla de Negocio (RF-10.2): Determina la legalidad del tratamiento de sus fotos.
    // Lo consulta la exportación de datasets (RF-09.6).
    public permiteUsoDeFotos(): boolean {
        return this.consentimiento;
    }
}
