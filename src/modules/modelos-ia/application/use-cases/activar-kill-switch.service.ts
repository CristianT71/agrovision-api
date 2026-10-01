import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type {
    ActivarKillSwitchCommand,
    IActivarKillSwitchUseCase,
    ModeloVista,
} from "../../domain/ports/in/gestionar-modelos.port";
import { MODELO_IA_REPOSITORY, type IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";
import { RegistroAuditoria } from "../../domain/entities/registro-auditoria.entity";
import { aModeloVista } from "./modelo-vista";

// RF-09.3 y RF-09.4: retiro de emergencia de una versión publicada, con causa documentada y auditada
@Injectable()
export class ActivarKillSwitchService implements IActivarKillSwitchUseCase {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
    ) {}

    async ejecutar(comando: ActivarKillSwitchCommand): Promise<ModeloVista> {
        // 1. Obtener el modelo
        const modelo = await this.modeloRepository.findById(comando.modeloId);

        if (!modelo) {
            throw new NotFoundException(`El modelo con ID ${comando.modeloId} no existe.`);
        }

        // 2. Regla de negocio pura del dominio: solo modelos publicados y con justificación
        modelo.activarKillSwitch(comando.justificacion);

        // 3. Registro inmutable: operador, estampa de tiempo y causa (RF-09.4)
        const auditoria = RegistroAuditoria.registrar({
            id: uuidv4(),
            modeloId: modelo.id,
            accion: "kill_switch",
            actorUsuarioId: comando.adminUsuarioId,
            motivo: modelo.motivoKillSwitch,
            detalle: { version: modelo.version, canal: modelo.canal },
        });

        // 4. El cambio y su rastro se guardan juntos
        if (!(await this.modeloRepository.guardarCambios([modelo], [auditoria]))) {
            throw new ConflictException(
                "Otro administrador cambió el pipeline al mismo tiempo. Recarga e inténtalo de nuevo.",
            );
        }

        return aModeloVista(modelo);
    }
}
