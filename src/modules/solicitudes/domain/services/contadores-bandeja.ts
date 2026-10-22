import { ESTADOS_SOLICITUD, type EstadoSolicitud } from "../entities/solicitud.entity";

// Conteos crudos que devuelve la base de datos: solo trae los estados que tienen solicitudes
export interface ConteoBandeja {
    porEstado: { estado: string; casos: number }[];
    // Solicitudes "Enviada" sin agrónomo: las únicas que el administrador puede asignar
    sinAsignar: number;
}

// RF-03.4, RF-08.2: contadores de la bandeja
export interface ContadoresBandeja {
    total: number;
    porEstado: Record<EstadoSolicitud, number>;
    sinAsignar: number;
}

// El panel pinta una pestaña por estado: todos van siempre, con 0 si no hay
export function armarContadores(conteo: ConteoBandeja): ContadoresBandeja {
    const porEstado = Object.fromEntries(ESTADOS_SOLICITUD.map((estado) => [estado, 0])) as Record<
        EstadoSolicitud,
        number
    >;

    let total = 0;
    for (const { estado, casos } of conteo.porEstado) {
        total += casos;
        if (estado in porEstado) porEstado[estado as EstadoSolicitud] = casos;
    }

    return { total, porEstado, sinAsignar: conteo.sinAsignar };
}
