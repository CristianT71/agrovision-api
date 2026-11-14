import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ReglaZona, type FilaRegla } from "../../domain/entities/regla-zona";
import type { Actor, IGestionReglasZona, ResultadoSimulacion } from "../../domain/ports/in/reglas-zona.port";
import {
    REGLAS_ZONA_REPOSITORY,
    type FiltrosReglasZona,
    type IReglasZonaRepository,
} from "../../domain/ports/out/reglas-zona.repository";
import type {
    AccionAuditoriaReglaZona,
    IAuditoriaReglasZona,
    RegistroAuditoriaReglaZona,
} from "../../domain/ports/out/auditoria-reglas-zona.port";
import { UNIDAD_TRABAJO_REGLAS_ZONA, type IUnidadTrabajoReglasZona } from "../../domain/ports/out/unidad-trabajo.port";
import { APROBADORES_REGLAS_ZONA, type IAprobadoresReglasZona } from "../../domain/ports/out/aprobadores.port";
import {
    ReglaInmutableError,
    ReglaNoEncontradaError,
    RevisionEnConflictoError,
    SinPermisoAprobarError,
    TransicionInvalidaError,
} from "../../domain/errors/reglas-zona.error";
import { aplicarRegla, plantasEnRadio } from "../../domain/services/aplicar-regla";

export const ROL_AGRONOMO = "agronomo";

function exigir(regla: ReglaZona | null): ReglaZona {
    if (!regla) throw new ReglaNoEncontradaError();
    return regla;
}

// Cada modificación corre en una unidad de trabajo: el cambio y su auditoría se confirman juntos o no queda nada.
@Injectable()
export class GestionReglasZonaService implements IGestionReglasZona {
    constructor(
        @Inject(REGLAS_ZONA_REPOSITORY) private readonly repo: IReglasZonaRepository,
        @Inject(UNIDAD_TRABAJO_REGLAS_ZONA) private readonly unidad: IUnidadTrabajoReglasZona,
        @Inject(APROBADORES_REGLAS_ZONA) private readonly aprobadores: IAprobadoresReglasZona,
    ) {}

    async crear(actor: Actor, datos: { tipoEnfermedad: string; notas: string | null; filas: FilaRegla[] }) {
        const ahora = new Date();
        // Valida antes de reservar versión: una tabla inválida no consume número.
        ReglaZona.crearBorrador({ ...datos, id: randomUUID(), version: 1, creadaPor: actor.id, ahora });
        return this.unidad.ejecutar(async ({ reglas, auditoria }) => {
            const regla = await reglas.insertarNuevaVersion(datos.tipoEnfermedad, (version) =>
                ReglaZona.crearBorrador({ ...datos, id: randomUUID(), version, creadaPor: actor.id, ahora }),
            );
            await this.auditar(auditoria, "crear", actor, regla);
            return regla.vista();
        });
    }

    async listar(filtros: FiltrosReglasZona) {
        return (await this.repo.listar(filtros)).map((r) => r.vista());
    }

    async obtener(id: string) {
        return exigir(await this.repo.obtener(id)).vista();
    }

    async editar(actor: Actor, id: string, cambios: { revision: number; notas?: string | null; filas?: FilaRegla[] }) {
        return this.unidad.ejecutar(async ({ reglas, auditoria }) => {
            const regla = exigir(await reglas.obtenerParaModificar(id));
            regla.exigirBorrador();
            regla.exigirRevision(cambios.revision);
            regla.editar({ notas: cambios.notas, filas: cambios.filas });
            if (!(await reglas.guardarBorrador(regla, cambios.revision, cambios.filas !== undefined)))
                throw new RevisionEnConflictoError();
            await this.auditar(auditoria, "editar", actor, regla);
            return regla.vista();
        });
    }

    async eliminar(actor: Actor, id: string) {
        await this.unidad.ejecutar(async ({ reglas, auditoria }) => {
            const regla = exigir(await reglas.obtenerParaModificar(id));
            regla.exigirBorrador();
            if (!(await reglas.eliminarBorrador(id))) throw new ReglaInmutableError();
            await this.auditar(auditoria, "borrar", actor, regla);
        });
    }

    async duplicar(actor: Actor, id: string) {
        const ahora = new Date();
        return this.unidad.ejecutar(async ({ reglas, auditoria }) => {
            const origen = exigir(await reglas.obtener(id));
            const copia = await reglas.insertarNuevaVersion(origen.tipoEnfermedad, (version) =>
                origen.duplicar({ id: randomUUID(), version, creadaPor: actor.id, ahora }),
            );
            await this.auditar(auditoria, "duplicar", actor, copia, { origenId: origen.id });
            return copia.vista();
        });
    }

    async aprobar(actor: Actor, id: string, datos: { revision: number; calibrada: boolean; nota?: string | null }) {
        // Doble barrera: el controlador ya exige el rol; aquí además la cuenta debe ser un agrónomo validado.
        if (actor.rol !== ROL_AGRONOMO) throw new SinPermisoAprobarError();
        const aprobador = await this.aprobadores.agronomoValidado(actor.id);
        if (!aprobador) throw new SinPermisoAprobarError();
        return this.unidad.ejecutar(async ({ reglas, auditoria }) => {
            // Con la regla bloqueada: se aprueba exactamente la revisión que el agrónomo revisó, o nada.
            const regla = exigir(await reglas.obtenerParaModificar(id));
            regla.exigirBorrador();
            regla.exigirRevision(datos.revision);
            regla.aprobar(aprobador, actor.id, datos, new Date());
            if (!(await reglas.guardarAprobacion(regla, datos.revision))) throw new RevisionEnConflictoError();
            await this.auditar(auditoria, "aprobar", actor, regla, { calibrada: regla.calibrada });
            return regla.vista();
        });
    }

    async activar(actor: Actor, id: string) {
        return this.unidad.ejecutar(async ({ reglas, auditoria }) => {
            // Sin bloquear aquí: `activar` bloquea todas las reglas del tipo en orden y vuelve a comprobar el estado.
            const regla = exigir(await reglas.obtener(id));
            regla.activar(new Date());
            const { archivadaId } = await reglas.activar(regla);
            await this.auditar(auditoria, "activar", actor, regla, { archivadaId });
            return regla.vista();
        });
    }

    async archivar(actor: Actor, id: string) {
        return this.unidad.ejecutar(async ({ reglas, auditoria }) => {
            const regla = exigir(await reglas.obtener(id));
            const estadoPrevio = regla.estado;
            regla.archivar();
            if (!(await reglas.archivar(regla, estadoPrevio)))
                throw new TransicionInvalidaError(
                    "La regla cambió de estado mientras se archivaba. Vuelve a cargarla.",
                );
            await this.auditar(auditoria, "archivar", actor, regla);
            return regla.vista();
        });
    }

    async simular(
        id: string,
        datos: { severidadPct: number; incidenciaPct: number; plantasPorHa: number },
    ): Promise<ResultadoSimulacion> {
        const regla = exigir(await this.repo.obtener(id));
        const fila = aplicarRegla(regla.filas, datos.severidadPct, datos.incidenciaPct);
        return {
            reglaVersion: regla.version,
            filaAplicada: fila.orden,
            radioMinM: fila.radioMinM,
            radioMaxM: fila.radioMaxM,
            plantasMin: plantasEnRadio(fila.radioMinM, datos.plantasPorHa),
            plantasMax: plantasEnRadio(fila.radioMaxM, datos.plantasPorHa),
            calibrada: regla.calibrada,
        };
    }

    private async auditar(
        auditoria: IAuditoriaReglasZona,
        accion: AccionAuditoriaReglaZona,
        actor: Actor,
        regla: ReglaZona,
        extra: Partial<RegistroAuditoriaReglaZona["detalle"]> = {},
    ) {
        await auditoria.registrar({
            accion,
            actorUsuarioId: actor.id,
            reglaId: regla.id,
            detalle: { tipoEnfermedad: regla.tipoEnfermedad, version: regla.version, estado: regla.estado, ...extra },
        });
    }
}
