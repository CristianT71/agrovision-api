import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";
import { FotoSolicitud, type AnguloFoto } from "./foto-solicitud.entity";

// Estados del ciclo de vida de una solicitud (RF-03.2)
export const ESTADOS_SOLICITUD = ["Pendiente", "Enviada", "Asignada", "Resuelta", "Descartada"] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

// Categorización de la evaluación humana (RF-04.5)
export const TIPOS_RESULTADO = [
    "Confirma diagnóstico IA",
    "Corrige diagnóstico IA",
    "Plaga nueva",
    "Imagen no diagnosticable",
    "Planta sana",
] as const;
export type TipoResultado = (typeof TIPOS_RESULTADO)[number];

// Valores que envía la app móvil: se guardan tal cual los define su contrato
export const CULTIVOS = ["CAFE", "PLATANO", "AGUACATE", "CACAO", "OTRO"] as const;
export type Cultivo = (typeof CULTIVOS)[number];

export const ORGANOS = ["HOJA", "FRUTO", "TALLO", "RAIZ", "FLOR"] as const;
export type Organo = (typeof ORGANOS)[number];

export const MIN_FOTOS_SOLICITUD = 2;
export const MAX_FOTOS_SOLICITUD = 5;
export const MAX_LONGITUD_NOTA = 500;

// Rechazo de una solicitud de la app: el código corto viaja a la app como "reason"
export class SolicitudAppInvalidaError extends ReglaNegocioError {
    constructor(
        public readonly codigo: string,
        mensaje: string,
    ) {
        super(mensaje);
        this.name = "SolicitudAppInvalidaError";
    }
}

// Origen de la altitud sobre el nivel del mar: la midió el GPS del celular o la dedujo un servicio de elevación
export const ORIGENES_ALTITUD = ["servicio", "gps"] as const;
export type OrigenAltitud = (typeof ORIGENES_ALTITUD)[number];

// Rango físico razonable de una altitud (Mar Muerto -430 m, Everest 8849 m)
export const ALTITUD_MIN_METROS = -500;
export const ALTITUD_MAX_METROS = 9000;

// Una solicitud de revisión sin ubicación exacta no sirve para ubicar el cultivo en el mapa
export class UbicacionExactaRequeridaError extends SolicitudAppInvalidaError {
    constructor() {
        super("ubicacion_exacta_requerida", "La solicitud de revisión necesita la ubicación exacta del cultivo.");
        this.name = "UbicacionExactaRequeridaError";
    }
}

export interface UbicacionSolicitud {
    latitud: number;
    longitud: number;
    precisionMetros: number | null;
    // true cuando el celular entregó la ubicación fina (no la aproximada)
    exacta: boolean;
    // true cuando el sistema operativo marcó la ubicación como simulada (mock location)
    simulada: boolean;
    altitudMetros: number | null;
}

export interface DatosSolicitudApp {
    id: string;
    idCliente: string;
    // Se copia su ubicación: la solicitud conserva la finca que tenía al enviarse
    productor: { id: string; municipio: string; vereda: string; finca: string };
    capturaId: string | null;
    cultivo: Cultivo;
    organo: Organo;
    nota: string | null;
    fecha: Date;
    ubicacion: UbicacionSolicitud | null;
    fotos: { id: string; idCliente: string; angulo: AnguloFoto }[];
}

export class Solicitud {
    constructor(
        public readonly id: string,
        public readonly productorId: string,
        public agronomoId: string | null,
        public estado: EstadoSolicitud,
        public readonly fecha: Date,
        public readonly municipio: string,
        public readonly vereda: string,
        public readonly finca: string,
        // Nulos en las solicitudes de la app: la confianza vive en la captura (detecciones)
        public readonly confianzaIa: number | null,
        public readonly modeloVersionId: string | null,
        public respuestaProfesional: string | null = null,
        public tipoResultado: TipoResultado | null = null,
        public plagaIdentificada: string | null = null,
        public fechaResolucion: Date | null = null,
        // Datos que solo traen las solicitudes creadas desde la app móvil
        public readonly idCliente: string | null = null,
        public readonly capturaId: string | null = null,
        public readonly cultivo: Cultivo | null = null,
        public readonly organo: Organo | null = null,
        public readonly nota: string | null = null,
        public readonly latitud: number | null = null,
        public readonly longitud: number | null = null,
        public readonly precisionMetros: number | null = null,
        public readonly actualizadoEn: Date | null = null,
        // Metros sobre el nivel del mar: la manda el GPS o la completa el servidor la primera vez que se consulta
        public altitudMsnm: number | null = null,
        public altitudOrigen: OrigenAltitud | null = null,
        public readonly ubicacionSimulada: boolean = false,
        public readonly ubicacionExacta: boolean = false,
    ) {}

    // La app crea la solicitud y luego sube cada foto por separado: queda "Pendiente"
    // hasta que llegan todas
    public static crearDesdeApp(datos: DatosSolicitudApp): { solicitud: Solicitud; fotos: FotoSolicitud[] } {
        if (datos.fotos.length < MIN_FOTOS_SOLICITUD) {
            throw new SolicitudAppInvalidaError(
                "imagenes_insuficientes",
                `La solicitud necesita al menos ${MIN_FOTOS_SOLICITUD} fotos.`,
            );
        }

        if (datos.fotos.length > MAX_FOTOS_SOLICITUD) {
            throw new SolicitudAppInvalidaError(
                "demasiadas_imagenes",
                `La solicitud admite como máximo ${MAX_FOTOS_SOLICITUD} fotos.`,
            );
        }

        if (new Set(datos.fotos.map((foto) => foto.idCliente)).size !== datos.fotos.length) {
            throw new SolicitudAppInvalidaError("imagenes_repetidas", "Cada foto debe tener un id distinto.");
        }

        const nota = datos.nota?.trim() || null;
        if (nota && nota.length > MAX_LONGITUD_NOTA) {
            throw new SolicitudAppInvalidaError(
                "nota_muy_larga",
                `La nota no puede superar ${MAX_LONGITUD_NOTA} caracteres.`,
            );
        }

        const { ubicacion } = datos;
        if (!ubicacion || !ubicacion.exacta) {
            throw new UbicacionExactaRequeridaError();
        }

        if (!Solicitud.esUbicacionValida(ubicacion)) {
            throw new SolicitudAppInvalidaError("ubicacion_invalida", "La ubicación de la solicitud no es válida.");
        }

        if (Number.isNaN(datos.fecha.getTime())) {
            throw new SolicitudAppInvalidaError("fecha_invalida", "La fecha de la solicitud no es válida.");
        }

        const solicitud = new Solicitud(
            datos.id,
            datos.productor.id,
            null,
            "Pendiente",
            datos.fecha,
            datos.productor.municipio,
            datos.productor.vereda,
            datos.productor.finca,
            null,
            null,
            null,
            null,
            null,
            null,
            datos.idCliente,
            datos.capturaId,
            datos.cultivo,
            datos.organo,
            nota,
            ubicacion.latitud,
            ubicacion.longitud,
            ubicacion.precisionMetros,
            null,
            ubicacion.altitudMetros,
            ubicacion.altitudMetros === null ? null : "gps",
            ubicacion.simulada,
            ubicacion.exacta,
        );

        // El orden es el de la app: el ángulo puede repetirse, la posición no
        const fotos = datos.fotos.map(
            (foto, indice) => new FotoSolicitud(foto.id, datos.id, foto.idCliente, foto.angulo, indice + 1),
        );

        return { solicitud, fotos };
    }

    private static esUbicacionValida(ubicacion: UbicacionSolicitud): boolean {
        const { latitud, longitud, precisionMetros, altitudMetros } = ubicacion;
        return (
            Number.isFinite(latitud) &&
            Number.isFinite(longitud) &&
            latitud >= -90 &&
            latitud <= 90 &&
            longitud >= -180 &&
            longitud <= 180 &&
            (precisionMetros === null || (Number.isFinite(precisionMetros) && precisionMetros >= 0)) &&
            (altitudMetros === null ||
                (Number.isFinite(altitudMetros) &&
                    altitudMetros >= ALTITUD_MIN_METROS &&
                    altitudMetros <= ALTITUD_MAX_METROS))
        );
    }

    // Copia sin coordenadas ni altitud: el detalle y la bandeja no las exponen. Dónde está un cultivo solo
    // sale por los endpoints de ubicación y del mapa, que comprueban el consentimiento y dejan rastro.
    public sinUbicacion(): Solicitud {
        return Object.assign(Object.create(Solicitud.prototype) as Solicitud, this, {
            latitud: null,
            longitud: null,
            precisionMetros: null,
            altitudMsnm: null,
            altitudOrigen: null,
        });
    }

    public tieneUbicacion(): boolean {
        return this.latitud !== null && this.longitud !== null;
    }

    // La altitud del GPS manda: la del servicio solo rellena cuando el celular no la dio
    public registrarAltitudDeServicio(metros: number): void {
        if (this.altitudMsnm !== null) return;
        this.altitudMsnm = metros;
        this.altitudOrigen = "servicio";
    }

    // Solo pasa a revisión cuando todas sus fotos llegaron al servidor
    public puedeMarcarseEnviada(fotos: FotoSolicitud[]): boolean {
        return (
            this.estado === "Pendiente" &&
            fotos.length > 0 &&
            fotos.every((foto) => foto.solicitudId === this.id && foto.estaSubida())
        );
    }

    public marcarEnviada(fotos: FotoSolicitud[]): void {
        if (this.estado !== "Pendiente") {
            throw new ReglaNegocioError("Solo una solicitud pendiente puede marcarse como enviada.");
        }

        if (!this.puedeMarcarseEnviada(fotos)) {
            throw new ReglaNegocioError("La solicitud aún tiene fotos pendientes por subir.");
        }

        this.estado = "Enviada";
    }

    public estaAsignadaA(agronomoId: string): boolean {
        return this.agronomoId === agronomoId;
    }

    // Regla de Negocio (RF-04.5, RF-04.7, RF-04.8): solo una solicitud asignada se resuelve,
    // con la evaluación completa, y queda en solo lectura
    public resolver(datos: {
        respuestaProfesional: string;
        tipoResultado: TipoResultado;
        plagaIdentificada: string;
    }): void {
        if (this.estado === "Resuelta") {
            throw new ReglaNegocioError("La solicitud ya se encuentra resuelta y es de solo lectura.");
        }

        if (this.estado === "Descartada") {
            throw new ReglaNegocioError("No se puede resolver una solicitud descartada.");
        }

        if (this.estado !== "Asignada" || !this.agronomoId) {
            throw new ReglaNegocioError("Solo se puede resolver una solicitud asignada a un agrónomo.");
        }

        if (!datos.respuestaProfesional?.trim() || !datos.plagaIdentificada?.trim() || !datos.tipoResultado) {
            throw new ReglaNegocioError(
                "La resolución exige tipo de resultado, plaga identificada y respuesta para el productor.",
            );
        }

        this.respuestaProfesional = datos.respuestaProfesional.trim();
        this.tipoResultado = datos.tipoResultado;
        this.plagaIdentificada = datos.plagaIdentificada.trim();
        this.fechaResolucion = new Date();
        this.estado = "Resuelta";
    }

    // Regla de Negocio (RF-08.3): Delegar o asignar recurso profesional
    public asignarAgronomo(agronomoId: string): void {
        if (this.estado === "Resuelta") {
            throw new ReglaNegocioError("No se puede reasignar una solicitud que ya fue resuelta.");
        }

        if (this.estado === "Descartada") {
            throw new ReglaNegocioError("No se puede asignar una solicitud descartada.");
        }

        if (this.estado === "Pendiente") {
            throw new ReglaNegocioError("No se puede asignar una solicitud que el productor aún no ha enviado.");
        }

        if (this.agronomoId === agronomoId) {
            throw new ReglaNegocioError("La solicitud ya está asignada a este agrónomo.");
        }

        this.agronomoId = agronomoId;
        this.estado = "Asignada";
    }
}
