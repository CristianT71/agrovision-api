export type RolUsuario = "admin" | "agronomo" | "productor";
export type EstadoUsuario = "activo" | "inactivo" | "pendiente";

export class Usuario {
    constructor(
        public readonly id: string,
        public readonly telefono: string,
        public rol: RolUsuario,
        public estado: EstadoUsuario,
        public readonly fechaRegistro: Date,
    ) {}

    public estaActivo(): boolean {
        return this.estado === "activo";
    }
}
