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

    // Los productores se registran solos desde la app móvil con su teléfono.
    // Las cuentas de agrónomo y administrador nunca nacen por esta vía (RF-01.6, RF-10.5).
    public static registrarProductor(id: string, telefono: string): Usuario {
        return new Usuario(id, telefono, "productor", "activo", new Date());
    }

    public estaActivo(): boolean {
        return this.estado === "activo";
    }

    // Regla RF-01.2: el rol elegido en el login debe ser el que tiene la cuenta; nunca lo reemplaza
    public tieneRol(rol: RolUsuario): boolean {
        return this.rol === rol;
    }
}
