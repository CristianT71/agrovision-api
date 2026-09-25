import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type {
    CompletarPerfilProductorCommand,
    ICompletarPerfilProductorUseCase,
} from "../../domain/ports/in/gestionar-productores.port";
import { PRODUCTOR_REPOSITORY, type IProductorRepository } from "../../domain/ports/out/productor.repository";
import { Productor } from "../../domain/entities/productor.entity";

@Injectable()
export class CompletarPerfilProductorService implements ICompletarPerfilProductorUseCase {
    constructor(
        @Inject(PRODUCTOR_REPOSITORY)
        private readonly productorRepository: IProductorRepository,
    ) {}

    async ejecutar(comando: CompletarPerfilProductorCommand): Promise<Productor> {
        // La cuenta existe desde el login por OTP; el perfil se completa una sola vez
        if (await this.productorRepository.findByUsuarioId(comando.usuarioId)) {
            throw new ConflictException("Tu perfil de productor ya fue registrado.");
        }

        // RF-10.2: nace "registrado" y solo fecha el consentimiento si lo otorga
        const productor = Productor.registrar({
            id: uuidv4(),
            usuarioId: comando.usuarioId,
            nombre: comando.nombre.trim(),
            finca: comando.finca.trim(),
            vereda: comando.vereda.trim(),
            municipio: comando.municipio.trim(),
            telefono: comando.telefono,
            consentimiento: comando.consentimiento,
        });

        return await this.productorRepository.guardar(productor);
    }
}
