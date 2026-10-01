import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Artefacto, IDescargarArtefactoUseCase } from "../../domain/ports/in/manifiesto-modelos.port";
import { MODELO_IA_REPOSITORY, type IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";

const NOMBRES: Record<Artefacto, { nombre: string; tipoMime: string }> = {
    model: { nombre: "model.tflite", tipoMime: "application/octet-stream" },
    labels: { nombre: "labels.json", tipoMime: "application/json" },
    calibration: { nombre: "calibration.json", tipoMime: "application/json" },
};

// Descarga pública de los archivos de un modelo publicado. Lo protege la firma Ed25519, no el acceso:
// un archivo alterado en el camino no pasa la verificación de la app.
@Injectable()
export class DescargarArtefactoService implements IDescargarArtefactoUseCase {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
        @Inject(ALMACENAMIENTO_ARCHIVOS)
        private readonly almacenamiento: IAlmacenamientoArchivos,
    ) {}

    async ejecutar(consulta: {
        version: string;
        artefacto: Artefacto;
    }): Promise<{ contenido: Buffer; tipoMime: string; nombre: string }> {
        const modelo = await this.modeloRepository.findByVersion(consulta.version);

        // Borradores, internos, descontinuados o retirados con kill-switch no se distribuyen.
        // Se responde 404 igual que si no existiera: no se revela qué versiones hay en preparación.
        if (!modelo?.estaActivo()) {
            throw new NotFoundException("El artefacto solicitado no está disponible.");
        }

        const rutas: Record<Artefacto, string | null> = {
            model: modelo.artefactos.rutaModelo,
            labels: modelo.artefactos.rutaEtiquetas,
            calibration: modelo.artefactos.rutaCalibracion,
        };
        const ruta = rutas[consulta.artefacto];
        if (!ruta) {
            throw new NotFoundException("El artefacto solicitado no está disponible.");
        }

        return { contenido: await this.almacenamiento.leerPrivado(ruta), ...NOMBRES[consulta.artefacto] };
    }
}
