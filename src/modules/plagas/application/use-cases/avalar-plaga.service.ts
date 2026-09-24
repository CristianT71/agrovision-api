import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type { IAvalarPlagaUseCase } from "../../domain/ports/in/gestionar-plagas.port";
import { PLAGA_REPOSITORY, type IPlagaRepository } from "../../domain/ports/out/plaga.repository";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import { AvalPlaga } from "../../domain/entities/aval-plaga.entity";
import type { Plaga } from "../../domain/entities/plaga.entity";
import { ObtenerPlagaService } from "./obtener-plaga.service";

@Injectable()
export class AvalarPlagaService implements IAvalarPlagaUseCase {
    constructor(
        @Inject(PLAGA_REPOSITORY)
        private readonly plagaRepository: IPlagaRepository,
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
        private readonly obtenerPlagaService: ObtenerPlagaService,
    ) {}

    async ejecutar(comando: { plagaId: string; usuarioId: string }): Promise<Plaga> {
        const plaga = await this.obtenerPlagaService.ejecutar(comando.plagaId);

        // RF-05.7: solo un agrónomo validado y activo puede firmar el aval
        const agronomo = await this.agronomoRepository.findByUsuarioId(comando.usuarioId);
        if (!agronomo || agronomo.estado !== "activo") {
            throw new ForbiddenException("Solo un agrónomo activo puede avalar fichas del catálogo.");
        }

        // La tarjeta se copia del registro del agrónomo: queda como evidencia de la firma
        plaga.registrarAval(new AvalPlaga(uuidv4(), agronomo.id, agronomo.tarjetaProfesional, new Date()));

        return await this.plagaRepository.guardar(plaga);
    }
}
