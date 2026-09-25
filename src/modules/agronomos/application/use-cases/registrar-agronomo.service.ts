import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type {
    IRegistrarAgronomoUseCase,
    RegistrarAgronomoCommand,
    RespuestaRegistroAgronomo,
} from "../../domain/ports/in/registrar-agronomo.port";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../domain/ports/out/agronomo.repository";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import { Agronomo } from "../../domain/entities/agronomo.entity";
import { DocumentoAcreditacion } from "../../domain/entities/documento-acreditacion.entity";
import { Usuario } from "../../../autenticacion/domain/entities/usuario.entity";

@Injectable()
export class RegistrarAgronomoService implements IRegistrarAgronomoUseCase {
    constructor(
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
        @Inject(ALMACENAMIENTO_ARCHIVOS)
        private readonly almacenamiento: IAlmacenamientoArchivos,
    ) {}

    async ejecutar(comando: RegistrarAgronomoCommand): Promise<RespuestaRegistroAgronomo> {
        const correo = comando.correo.trim().toLowerCase();
        const tarjetaProfesional = comando.tarjetaProfesional.trim();

        // 1. RF-10.4: el alta debe traer al menos un soporte de acreditación
        if (comando.documentos.length === 0) {
            throw new BadRequestException("Debes adjuntar al menos un documento de acreditación profesional.");
        }

        // 2. Datos únicos: teléfono (login), correo y tarjeta profesional
        if (await this.agronomoRepository.existeCuentaConTelefono(comando.telefono)) {
            throw new ConflictException("Ya existe una cuenta registrada con este número de celular.");
        }

        if (await this.agronomoRepository.findByCorreo(correo)) {
            throw new ConflictException("Ya existe un agrónomo registrado con este correo.");
        }

        if (await this.agronomoRepository.findByTarjetaProfesional(tarjetaProfesional)) {
            throw new ConflictException("Ya existe un agrónomo registrado con esta tarjeta profesional.");
        }

        // 3. RF-01.6 / RF-10.5: cuenta de login y agrónomo nacen pendientes de validación
        const usuario = Usuario.registrarAgronomo(uuidv4(), comando.telefono);
        const agronomo = Agronomo.registrar({
            id: uuidv4(),
            usuarioId: usuario.id,
            nombre: comando.nombre.trim(),
            tarjetaProfesional,
            telefono: comando.telefono,
            correo,
            especialidad: comando.especialidad,
        });

        // 4. Custodiar los soportes en almacenamiento privado (RF-10.4)
        const documentos: DocumentoAcreditacion[] = [];
        try {
            for (const archivo of comando.documentos) {
                const ruta = await this.almacenamiento.guardarPrivado(`agronomos/${agronomo.id}`, archivo);
                documentos.push(
                    new DocumentoAcreditacion(
                        uuidv4(),
                        agronomo.id,
                        ruta,
                        archivo.nombreOriginal,
                        archivo.tipoMime,
                        archivo.contenido.length,
                        new Date(),
                    ),
                );
            }

            await this.agronomoRepository.registrar(agronomo, usuario, documentos);
        } catch (error) {
            // Si algo falla no quedan archivos huérfanos de un registro que no existe
            await Promise.all(documentos.map((documento) => this.almacenamiento.eliminarPrivado(documento.ruta)));
            throw error;
        }

        return {
            id: agronomo.id,
            estado: agronomo.estado,
            mensaje: "Solicitud de acceso recibida. Un administrador validará tu cuenta.",
        };
    }
}
