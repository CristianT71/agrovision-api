import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// Datos de la solicitud que el permiso necesita para decidir si se puede otorgar
export interface ContextoSolicitud {
    id: string;
    productorId: string;
    agronomoId: string | null;
    estado: string;
}

// Permiso expreso para que el agrónomo vea el teléfono del productor de un caso (RF-04.10, RF-08.8).
// Hay uno por solicitud: otorgarlo o revocarlo actualiza la misma fila.
export class PermisoContacto {
    constructor(
        public readonly id: string,
        public readonly solicitudId: string,
        // Agrónomo al que se otorgó: si el caso se reasigna, el nuevo evaluador no lo hereda
        public agronomoId: string | null,
        public habilitado: boolean,
        // Cuentas de login (usuarios.id) del administrador que hizo cada cambio
        public otorgadoPor: string | null,
        public fechaOtorgado: Date | null,
        public revocadoPor: string | null = null,
        public fechaRevocado: Date | null = null,
    ) {}

    // Una solicitud sin permiso registrado equivale a uno nunca otorgado
    public static sinOtorgar(id: string, solicitudId: string): PermisoContacto {
        return new PermisoContacto(id, solicitudId, null, false, null, null);
    }

    // Regla de Negocio (RF-08.8): el contacto se otorga al evaluador asignado de un caso abierto
    public otorgar(contexto: ContextoSolicitud, adminUsuarioId: string): void {
        if (contexto.id !== this.solicitudId) {
            throw new ReglaNegocioError("El permiso no corresponde a esta solicitud.");
        }

        if (!contexto.agronomoId) {
            throw new ReglaNegocioError("No se puede otorgar el contacto en una solicitud sin agrónomo asignado.");
        }

        if (contexto.estado === "Resuelta" || contexto.estado === "Descartada") {
            throw new ReglaNegocioError("La solicitud está cerrada: no se puede otorgar el contacto.");
        }

        if (this.estaVigentePara(contexto.agronomoId)) {
            throw new ReglaNegocioError("El agrónomo asignado ya tiene habilitado el contacto con el productor.");
        }

        this.agronomoId = contexto.agronomoId;
        this.habilitado = true;
        this.otorgadoPor = adminUsuarioId;
        this.fechaOtorgado = new Date();
    }

    // Regla de Negocio (RF-08.8): solo se extingue un permiso habilitado.
    // Se permite aunque el caso esté cerrado: retirar el acceso siempre protege al productor.
    public revocar(adminUsuarioId: string): void {
        if (!this.habilitado) {
            throw new ReglaNegocioError("La solicitud no tiene un permiso de contacto habilitado para revocar.");
        }

        this.habilitado = false;
        this.revocadoPor = adminUsuarioId;
        this.fechaRevocado = new Date();
    }

    // Regla de Negocio (RF-04.10): el teléfono solo se entrega al agrónomo al que se le otorgó
    public estaVigentePara(agronomoId: string | null): boolean {
        return this.habilitado && agronomoId !== null && this.agronomoId === agronomoId;
    }
}
