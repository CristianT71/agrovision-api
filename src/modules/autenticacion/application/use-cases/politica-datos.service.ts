import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { VERSION_POLITICA_DATOS, type EstadoPoliticaDatos } from "../../domain/politica-datos";
import {
    POLITICA_DATOS_REPOSITORY,
    type IPoliticaDatosRepository,
} from "../../domain/ports/out/politica-datos.repository";

// Habeas data (Ley 1581 de 2012): la autorización queda registrada con la versión del texto aceptado
// y la fecha, y la persona puede revocarla en cualquier momento.
@Injectable()
export class PoliticaDatosService {
    constructor(
        @Inject(POLITICA_DATOS_REPOSITORY)
        private readonly repository: IPoliticaDatosRepository,
    ) {}

    async consultar(usuarioId: string): Promise<EstadoPoliticaDatos> {
        const aceptacion = await this.repository.obtener(usuarioId);
        if (!aceptacion) throw new NotFoundException("Usuario no encontrado.");

        return {
            versionVigente: VERSION_POLITICA_DATOS,
            versionAceptada: aceptacion.version,
            fechaAceptacion: aceptacion.fecha,
            aceptada: aceptacion.version === VERSION_POLITICA_DATOS,
        };
    }

    // Solo se acepta la versión vigente: aceptar un texto viejo no autoriza el tratamiento actual
    async aceptar(usuarioId: string, version: string): Promise<EstadoPoliticaDatos> {
        if (version !== VERSION_POLITICA_DATOS) {
            throw new ConflictException(
                `La versión ${version} de la política no está vigente (vigente: ${VERSION_POLITICA_DATOS}). Actualiza la aplicación.`,
            );
        }

        const actual = await this.repository.obtener(usuarioId);
        if (!actual) throw new NotFoundException("Usuario no encontrado.");

        // Aceptar de nuevo la misma versión no cambia la fecha original de la autorización
        if (actual.version !== version) {
            await this.repository.registrar(usuarioId, version, new Date());
        }

        return await this.consultar(usuarioId);
    }

    async revocar(usuarioId: string): Promise<EstadoPoliticaDatos> {
        const actual = await this.repository.obtener(usuarioId);
        if (!actual) throw new NotFoundException("Usuario no encontrado.");

        await this.repository.revocar(usuarioId);

        return await this.consultar(usuarioId);
    }
}
