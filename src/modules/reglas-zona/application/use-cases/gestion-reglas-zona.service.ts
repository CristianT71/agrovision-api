import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ReglaZona, type FilaRegla } from "../../domain/entities/regla-zona";
import type { Actor, IGestionReglasZona, ResultadoSimulacion } from "../../domain/ports/in/reglas-zona.port";
import {
    REGLAS_ZONA_REPOSITORY,
    type FiltrosReglasZona,
    type IReglasZonaRepository,
} from "../../domain/ports/out/reglas-zona.repository";
import {
    AUDITORIA_REGLAS_ZONA,
    type AccionAuditoriaReglaZona,
    type IAuditoriaReglasZona,
    type RegistroAuditoriaReglaZona,
} from "../../domain/ports/out/auditoria-reglas-zona.port";
import { APROBADORES_REGLAS_ZONA, type IAprobadoresReglasZona } from "../../domain/ports/out/aprobadores.port";
import {
    ReglaInmutableError,
    ReglaNoEncontradaError,
    SinPermisoAprobarError,
    TransicionInvalidaError,
} from "../../domain/errors/reglas-zona.error";
import { aplicarRegla, plantasEnRadio } from "../../domain/services/aplicar-regla";

export const ROL_AGRONOMO = "agronomo";

@Injectable()
export class GestionReglasZonaService implements IGestionReglasZona {
    constructor(
        @Inject(REGLAS_ZONA_REPOSITORY) private readonly repo: IReglasZonaRepository,
        @Inject(AUDITORIA_REGLAS_ZONA) private readonly auditoria: IAuditoriaReglasZona,
        @Inject(APROBADORES_REGLAS_ZONA) private readonly aprobadores: IAprobadoresReglasZona,
    ) {}

    async crear(actor: Actor, datos: { tipoEnfermedad: string; notas: string | null; filas: FilaRegla[] }) {
        const ahora = new Date();
        // Valida antes de reservar versión: una tabla inválida no consume número.
        ReglaZona.crearBorrador({ ...datos, id: randomUUID(), version: 1, creadaPor: actor.id, ahora });
        const regla = await this.repo.insertarNuevaVersion(datos.tipoEnfermedad, (version) =>
            ReglaZona.crearBorrador({ ...datos, id: randomUUID(), version, creadaPor: actor.id, ahora }),
        );
        await this.auditar("crear", actor, regla);
        return regla.vista();
    }

    async listar(filtros: FiltrosReglasZona) {
        return (await this.repo.listar(filtros)).map((r) => r.vista());
    }

    async obtener(id: string) {
        return (await this.exigir(id)).vista();
    }

    async editar(actor: Actor, id: string, cambios: { notas?: string | null; filas?: FilaRegla[] }) {
        const regla = await this.exigir(id);
        regla.editar(cambios);
        if (!(await this.repo.guardarBorrador(regla))) throw new ReglaInmutableError();
        await this.auditar("editar", actor, regla);
        return regla.vista();
    }

    async eliminar(actor: Actor, id: string) {
        const regla = await this.exigir(id);
        regla.exigirBorrador();
        if (!(await this.repo.eliminarBorrador(id))) throw new ReglaInmutableError();
        await this.auditar("borrar", actor, regla);
    }

    async duplicar(actor: Actor, id: string) {
        const origen = await this.exigir(id);
        const ahora = new Date();
        const copia = await this.repo.insertarNuevaVersion(origen.tipoEnfermedad, (version) =>
            origen.duplicar({ id: randomUUID(), version, creadaPor: actor.id, ahora }),
        );
        await this.auditar("duplicar", actor, copia, { origenId: origen.id });
        return copia.vista();
    }

    async aprobar(actor: Actor, id: string, datos: { calibrada: boolean; nota?: string | null }) {
        // Doble barrera: el controlador ya exige el rol; aquí además la cuenta debe ser un agrónomo validado.
        if (actor.rol !== ROL_AGRONOMO) throw new SinPermisoAprobarError();
        const regla = await this.exigir(id);
        regla.exigirBorrador();
        const aprobador = await this.aprobadores.agronomoValidado(actor.id);
        if (!aprobador) throw new SinPermisoAprobarError();
        regla.aprobar(aprobador, actor.id, datos, new Date());
        if (!(await this.repo.guardarAprobacion(regla))) throw new ReglaInmutableError();
        await this.auditar("aprobar", actor, regla, { calibrada: regla.calibrada });
        return regla.vista();
    }

    async activar(actor: Actor, id: string) {
        const regla = await this.exigir(id);
        regla.activar(new Date());
        const { archivadaId } = await this.repo.activar(regla);
        await this.auditar("activar", actor, regla, { archivadaId });
        return regla.vista();
    }

    async archivar(actor: Actor, id: string) {
        const regla = await this.exigir(id);
        const estadoPrevio = regla.estado;
        regla.archivar();
        if (!(await this.repo.archivar(regla, estadoPrevio)))
            throw new TransicionInvalidaError("La regla cambió de estado mientras se archivaba. Vuelve a cargarla.");
        await this.auditar("archivar", actor, regla);
        return regla.vista();
    }

    async simular(
        id: string,
        datos: { severidadPct: number; incidenciaPct: number; plantasPorHa: number },
    ): Promise<ResultadoSimulacion> {
        const regla = await this.exigir(id);
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

    private async exigir(id: string): Promise<ReglaZona> {
        const regla = await this.repo.obtener(id);
        if (!regla) throw new ReglaNoEncontradaError();
        return regla;
    }

    private async auditar(
        accion: AccionAuditoriaReglaZona,
        actor: Actor,
        regla: ReglaZona,
        extra: Partial<RegistroAuditoriaReglaZona["detalle"]> = {},
    ) {
        await this.auditoria.registrar({
            accion,
            actorUsuarioId: actor.id,
            reglaId: regla.id,
            detalle: { tipoEnfermedad: regla.tipoEnfermedad, version: regla.version, estado: regla.estado, ...extra },
        });
    }
}
