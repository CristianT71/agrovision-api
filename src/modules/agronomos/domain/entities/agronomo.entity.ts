export type EstadoAgronomo = "pendiente" | "activo" | "inactivo";

export class Agronomo {
    constructor(
        public readonly id: string,
        public readonly usuarioId: string,
        public nombre: string,
        public readonly tarjetaProfesional: string,
        public telefono: string,
        public correo: string,
        public especialidad: string,
        public estado: EstadoAgronomo,
        public readonly fechaAlta: Date,
    ) {}

    // Regla de Negocio (RF-10.5): Todo agrónomo nuevo queda "pendiente" hasta la validación humana
    public static registrar(datos: {
        id: string;
        usuarioId: string;
        nombre: string;
        tarjetaProfesional: string;
        telefono: string;
        correo: string;
        especialidad: string;
    }): Agronomo {
        return new Agronomo(
            datos.id,
            datos.usuarioId,
            datos.nombre,
            datos.tarjetaProfesional,
            datos.telefono,
            datos.correo,
            datos.especialidad,
            "pendiente",
            new Date(),
        );
    }

    // Regla de Negocio (RF-10.5): Solo un agrónomo pendiente puede ser validado por un administrador
    public validar(): void {
        if (this.estado !== "pendiente") {
            throw new Error("Solo se puede validar un agrónomo en estado pendiente.");
        }

        this.estado = "activo";
    }

    // Regla de Negocio (RF-10.5): Un agrónomo inactivo no se puede volver a desactivar
    public desactivar(): void {
        if (this.estado === "inactivo") {
            throw new Error("El agrónomo ya se encuentra inactivo.");
        }

        this.estado = "inactivo";
    }

    // Regla de Negocio (RF-10.5): Solo se reactiva un agrónomo previamente desactivado
    public reactivar(): void {
        if (this.estado !== "inactivo") {
            throw new Error("Solo se puede reactivar un agrónomo en estado inactivo.");
        }

        this.estado = "activo";
    }

    // Regla de Negocio (RF-08.3): Solo un agrónomo activo puede recibir asignación de casos
    public puedeRecibirCasos(): boolean {
        return this.estado === "activo";
    }
}
