import {
    ReglaInmutableError,
    ReglaInvalidaError,
    ReglaNoAprobadaError,
    RevisionEnConflictoError,
    TransicionInvalidaError,
} from "../errors/reglas-zona.error";
import { validarFilas } from "../services/validar-filas";

export const ESTADOS_REGLA = ["borrador", "aprobada", "activa", "archivada"] as const;
export type EstadoRegla = (typeof ESTADOS_REGLA)[number];

export interface FilaRegla {
    orden: number;
    sevMax: number;
    incMax: number;
    radioMinM: number;
    radioMaxM: number;
}

export interface Aprobador {
    nombre: string;
    tarjetaProfesional: string;
}

export interface DatosReglaZona {
    id: string;
    tipoEnfermedad: string;
    version: number;
    // Contador de cambios del borrador (control de concurrencia optimista); no es la versión de publicación.
    revision: number;
    estado: EstadoRegla;
    calibrada: boolean;
    notas: string | null;
    filas: FilaRegla[];
    creadaPor: string | null;
    creadaEn: Date;
    aprobadaPor: Aprobador | null;
    // Cuenta del agrónomo que aprobó: solo para trazabilidad interna, no se expone en el JSON.
    aprobadaPorUsuarioId: string | null;
    aprobadaEn: Date | null;
    activadaEn: Date | null;
}

// Vista del contrato (JSON del panel).
export interface VistaReglaZona {
    id: string;
    tipoEnfermedad: string;
    version: number;
    revision: number;
    estado: EstadoRegla;
    calibrada: boolean;
    notas: string | null;
    filas: FilaRegla[];
    creadaPor: string | null;
    creadaEn: Date;
    aprobadaPor: Aprobador | null;
    aprobadaEn: Date | null;
    activadaEn: Date | null;
}

function exigirFilasValidas(filas: FilaRegla[]): FilaRegla[] {
    const errores = validarFilas(filas);
    if (errores.length > 0) throw new ReglaInvalidaError(errores);
    return filas.map((f) => ({ ...f }));
}

// Tabla versionada de criterio experto (severidad %, incidencia %) → radio en metros.
// Ciclo: borrador → aprobada → activa → archivada. Solo el borrador cambia; lo demás se duplica.
export class ReglaZona {
    private constructor(private datos: DatosReglaZona) {}

    static reconstruir(datos: DatosReglaZona): ReglaZona {
        return new ReglaZona({ ...datos, filas: datos.filas.map((f) => ({ ...f })) });
    }

    static crearBorrador(p: {
        id: string;
        tipoEnfermedad: string;
        version: number;
        notas: string | null;
        filas: FilaRegla[];
        creadaPor: string;
        ahora: Date;
    }): ReglaZona {
        return new ReglaZona({
            id: p.id,
            tipoEnfermedad: p.tipoEnfermedad,
            version: p.version,
            revision: 1,
            estado: "borrador",
            calibrada: false,
            notas: p.notas,
            filas: exigirFilasValidas(p.filas),
            creadaPor: p.creadaPor,
            creadaEn: p.ahora,
            aprobadaPor: null,
            aprobadaPorUsuarioId: null,
            aprobadaEn: null,
            activadaEn: null,
        });
    }

    get id() {
        return this.datos.id;
    }
    get tipoEnfermedad() {
        return this.datos.tipoEnfermedad;
    }
    get version() {
        return this.datos.version;
    }
    get revision() {
        return this.datos.revision;
    }
    get estado() {
        return this.datos.estado;
    }
    get calibrada() {
        return this.datos.calibrada;
    }
    get filas(): FilaRegla[] {
        return this.datos.filas.map((f) => ({ ...f }));
    }
    instantanea(): DatosReglaZona {
        return {
            ...this.datos,
            filas: this.filas,
            aprobadaPor: this.datos.aprobadaPor && { ...this.datos.aprobadaPor },
        };
    }

    exigirBorrador(): void {
        if (this.datos.estado !== "borrador") throw new ReglaInmutableError();
    }

    // El cliente envía la revisión que vio: si el borrador cambió después, su operación ya no aplica.
    exigirRevision(revisionVista: number): void {
        if (this.datos.revision !== revisionVista) throw new RevisionEnConflictoError();
    }

    editar(cambios: { notas?: string | null; filas?: FilaRegla[] }): void {
        this.exigirBorrador();
        if (cambios.filas === undefined && cambios.notas === undefined) return;
        if (cambios.filas !== undefined) this.datos.filas = exigirFilasValidas(cambios.filas);
        if (cambios.notas !== undefined) this.datos.notas = cambios.notas;
        this.datos.revision += 1;
    }

    // calibrada solo puede ser true si el agrónomo deja una nota que lo justifique.
    aprobar(
        aprobador: Aprobador,
        aprobadorUsuarioId: string,
        p: { calibrada: boolean; nota?: string | null },
        ahora: Date,
    ) {
        this.exigirBorrador();
        const nota = p.nota?.trim() ?? "";
        if (p.calibrada && nota === "")
            throw new ReglaInvalidaError(["Para marcar la regla como calibrada se requiere una nota."]);
        this.datos.estado = "aprobada";
        this.datos.revision += 1;
        this.datos.calibrada = p.calibrada;
        this.datos.aprobadaPor = { nombre: aprobador.nombre, tarjetaProfesional: aprobador.tarjetaProfesional };
        this.datos.aprobadaPorUsuarioId = aprobadorUsuarioId;
        this.datos.aprobadaEn = ahora;
        if (nota !== "") {
            const etiqueta = p.calibrada ? "Nota de calibración" : "Nota de aprobación";
            this.datos.notas = [this.datos.notas?.trim(), `${etiqueta}: ${nota}`].filter(Boolean).join("\n\n");
        }
    }

    activar(ahora: Date): void {
        if (this.datos.estado !== "aprobada") throw new ReglaNoAprobadaError();
        this.datos.estado = "activa";
        this.datos.activadaEn = ahora;
    }

    // La regla activa previa del mismo tipo se archiva al activar otra.
    archivar(): void {
        if (this.datos.estado !== "aprobada" && this.datos.estado !== "activa")
            throw new TransicionInvalidaError("Solo una regla aprobada o activa se puede archivar.");
        this.datos.estado = "archivada";
    }

    // Nueva versión en borrador con la misma tabla; nunca hereda aprobación ni calibración.
    duplicar(p: { id: string; version: number; creadaPor: string; ahora: Date }): ReglaZona {
        return ReglaZona.crearBorrador({
            id: p.id,
            tipoEnfermedad: this.datos.tipoEnfermedad,
            version: p.version,
            notas: this.datos.notas,
            filas: this.filas,
            creadaPor: p.creadaPor,
            ahora: p.ahora,
        });
    }

    vista(): VistaReglaZona {
        const d = this.instantanea();
        return {
            id: d.id,
            tipoEnfermedad: d.tipoEnfermedad,
            version: d.version,
            revision: d.revision,
            estado: d.estado,
            calibrada: d.calibrada,
            notas: d.notas,
            filas: d.filas,
            creadaPor: d.creadaPor,
            creadaEn: d.creadaEn,
            aprobadaPor: d.aprobadaPor,
            aprobadaEn: d.aprobadaEn,
            activadaEn: d.activadaEn,
        };
    }
}
