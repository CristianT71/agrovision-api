import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AuditoriaVista, IListarAuditoriaModeloUseCase } from "../../domain/ports/in/gestionar-modelos.port";
import { MODELO_IA_REPOSITORY, type IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";

// RF-09.4: historial de operador, fecha y causa de cada acción sobre el modelo (más reciente primero)
@Injectable()
export class ListarAuditoriaModeloService implements IListarAuditoriaModeloUseCase {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
    ) {}

    async ejecutar(modeloId: string): Promise<AuditoriaVista[]> {
        if (!(await this.modeloRepository.findById(modeloId))) {
            throw new NotFoundException(`El modelo con ID ${modeloId} no existe.`);
        }

        const registros = await this.modeloRepository.listarAuditoria(modeloId);

        return registros.map(({ id, accion, actorUsuarioId, motivo, detalle, fecha }) => ({
            id,
            accion,
            actorUsuarioId,
            motivo,
            detalle,
            fecha,
        }));
    }
}
