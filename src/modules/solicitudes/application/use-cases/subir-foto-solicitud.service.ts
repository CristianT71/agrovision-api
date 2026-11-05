import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { ISubirFotoSolicitudUseCase, SubirFotoCommand } from "../../domain/ports/in/solicitudes-app.port";
import {
    SOLICITUD_APP_REPOSITORY,
    type ISolicitudAppRepository,
} from "../../domain/ports/out/solicitud-app.repository";
import { SOLICITUD_REPOSITORY, type ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import { FIRMADOR_URLS_SUBIDA, type IFirmadorUrlsSubida } from "../../domain/ports/out/firmador-urls-subida.port";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import { AsignarAutomaticamenteService } from "./asignar-automaticamente.service";
import { TIPOS_IMAGEN, validarArchivo } from "../../../../common/almacenamiento/validar-archivo";

export const MAX_BYTES_FOTO_SOLICITUD = 10 * 1024 * 1024;

@Injectable()
export class SubirFotoSolicitudService implements ISubirFotoSolicitudUseCase {
    private readonly logger = new Logger(SubirFotoSolicitudService.name);

    constructor(
        @Inject(SOLICITUD_APP_REPOSITORY)
        private readonly solicitudAppRepository: ISolicitudAppRepository,
        @Inject(SOLICITUD_REPOSITORY)
        private readonly solicitudRepository: ISolicitudRepository,
        @Inject(FIRMADOR_URLS_SUBIDA)
        private readonly firmador: IFirmadorUrlsSubida,
        @Inject(ALMACENAMIENTO_ARCHIVOS)
        private readonly almacenamiento: IAlmacenamientoArchivos,
        private readonly asignarAutomaticamenteService: AsignarAutomaticamenteService,
    ) {}

    async ejecutar(comando: SubirFotoCommand): Promise<void> {
        // 1. El token es la única autorización de esta ruta: firma y vencimiento
        const fotoId = this.firmador.verificar(comando.token);
        if (!fotoId) {
            throw new ForbiddenException("La URL de subida no es válida o ya venció.");
        }

        const foto = await this.solicitudAppRepository.findFotoById(fotoId);
        if (!foto) {
            throw new NotFoundException("La foto ya no existe.");
        }

        // 2. Idempotente: si la app reintenta una subida que sí llegó, no se guarda otra copia
        if (!foto.estaSubida()) {
            // Tipo y tamaño se verifican por el contenido real, no por lo que declara el cliente
            const archivo = validarArchivo(comando.archivo, {
                tiposPermitidos: TIPOS_IMAGEN,
                maxBytes: MAX_BYTES_FOTO_SOLICITUD,
            });

            const ruta = await this.almacenamiento.guardarPrivado(`solicitudes/${foto.solicitudId}`, archivo);

            try {
                foto.marcarSubida(ruta, archivo.tipoMime, archivo.contenido.length);
                const marcada = await this.solicitudAppRepository.marcarFotoSubida(foto);
                // Otra subida simultánea de la misma foto ganó: se descarta esta copia
                if (!marcada) await this.almacenamiento.eliminarPrivado(ruta);
            } catch (error) {
                // Si no quedó registrada no deja un archivo huérfano
                await this.almacenamiento.eliminarPrivado(ruta);
                throw error;
            }
        }

        // 3. Con la última foto la solicitud pasa a revisión. También se revisa en un
        // reintento, por si la vez anterior falló justo después de guardar la foto.
        await this.enviarSiEstaCompleta(foto.solicitudId);
    }

    private async enviarSiEstaCompleta(solicitudId: string): Promise<void> {
        const solicitud = await this.solicitudRepository.findById(solicitudId);
        if (!solicitud) return;

        const fotos = await this.solicitudAppRepository.listarFotos(solicitudId);
        if (!solicitud.puedeMarcarseEnviada(fotos)) return;

        solicitud.marcarEnviada(fotos);
        // UPDATE condicionado a "Pendiente": si dos fotos terminan a la vez, solo una la envía
        const enviada = await this.solicitudAppRepository.guardarEnvio(solicitud);
        if (enviada) await this.asignarSiCorresponde(solicitudId);
    }

    // La subida de la foto ya salió bien: si la asignación automática falla, el caso queda para el administrador
    private async asignarSiCorresponde(solicitudId: string): Promise<void> {
        try {
            await this.asignarAutomaticamenteService.ejecutar(solicitudId);
        } catch (error) {
            this.logger.warn(
                `No se pudo asignar automáticamente la solicitud ${solicitudId}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
