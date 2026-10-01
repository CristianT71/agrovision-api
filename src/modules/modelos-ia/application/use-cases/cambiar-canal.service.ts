import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type {
    CambiarCanalCommand,
    ICambiarCanalUseCase,
    ModeloVista,
} from "../../domain/ports/in/gestionar-modelos.port";
import { MODELO_IA_REPOSITORY, type IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";
import type { ModeloIa } from "../../domain/entities/modelo-ia.entity";
import { RegistroAuditoria } from "../../domain/entities/registro-auditoria.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";
import { aModeloVista } from "./modelo-vista";

// RF-09.5: pipeline de liberación borrador → interno → canario → producción
@Injectable()
export class CambiarCanalService implements ICambiarCanalUseCase {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
    ) {}

    async ejecutar(comando: CambiarCanalCommand): Promise<{ modelo: ModeloVista; retirado: ModeloVista | null }> {
        // 1. Obtener el modelo
        const modelo = await this.modeloRepository.findById(comando.modeloId);

        if (!modelo) {
            throw new NotFoundException(`El modelo con ID ${comando.modeloId} no existe.`);
        }

        // 2. Regla de negocio pura del dominio (orden del pipeline y requisitos para publicar)
        const anterior = modelo.canal;
        modelo.cambiarCanal(comando.canal, { porcentajeCanario: comando.porcentajeCanario });

        // 3. Un solo canario a la vez: se decide cuál antes de lanzar otro
        if (comando.canal === "canario" && anterior !== "canario") {
            const [enCurso] = await this.modeloRepository.findAll({ canal: "canario" });
            if (enCurso && enCurso.id !== modelo.id) {
                throw new ReglaNegocioError(
                    `Ya hay un canario en curso (versión ${enCurso.version}): promuévelo o descontinúalo antes.`,
                );
            }
        }

        // 4. Una sola producción: la vigente se retira en la misma transacción
        let retirado: ModeloIa | null = null;
        if (comando.canal === "produccion") {
            const [vigente] = await this.modeloRepository.findAll({ canal: "produccion" });
            if (vigente && vigente.id !== modelo.id) {
                vigente.cambiarCanal("descontinuado");
                retirado = vigente;
            }
        }

        // 5. RF-09.4: cada cambio queda auditado
        const auditorias = [
            ...(retirado
                ? [
                      this.auditar(retirado, comando.adminUsuarioId, {
                          de: "produccion",
                          a: "descontinuado",
                          reemplazadoPor: modelo.version,
                      }),
                  ]
                : []),
            this.auditar(modelo, comando.adminUsuarioId, {
                de: anterior,
                a: modelo.canal,
                porcentajeCanario: modelo.porcentajeCanario,
            }),
        ];

        // 6. El retirado primero: libera la producción antes de que el nuevo la ocupe
        const guardado = await this.modeloRepository.guardarCambios(
            retirado ? [retirado, modelo] : [modelo],
            auditorias,
        );
        if (!guardado) {
            throw new ConflictException(
                "Otro administrador cambió el pipeline al mismo tiempo. Recarga e inténtalo de nuevo.",
            );
        }

        return { modelo: aModeloVista(modelo), retirado: retirado ? aModeloVista(retirado) : null };
    }

    private auditar(modelo: ModeloIa, adminUsuarioId: string, detalle: Record<string, unknown>): RegistroAuditoria {
        return RegistroAuditoria.registrar({
            id: uuidv4(),
            modeloId: modelo.id,
            accion: "cambio_canal",
            actorUsuarioId: adminUsuarioId,
            detalle: { version: modelo.version, ...detalle },
        });
    }
}
