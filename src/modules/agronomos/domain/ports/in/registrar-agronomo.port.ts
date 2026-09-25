import type { EstadoAgronomo } from "../../entities/agronomo.entity";
import type { ArchivoParaGuardar } from "../../../../../common/almacenamiento/almacenamiento.port";

export interface RegistrarAgronomoCommand {
    nombre: string;
    telefono: string;
    correo: string;
    tarjetaProfesional: string;
    especialidad: string;
    // RF-10.4: soportes de acreditación ya validados (tipo y tamaño)
    documentos: ArchivoParaGuardar[];
}

export interface RespuestaRegistroAgronomo {
    id: string;
    estado: EstadoAgronomo;
    mensaje: string;
}

export interface IRegistrarAgronomoUseCase {
    ejecutar(comando: RegistrarAgronomoCommand): Promise<RespuestaRegistroAgronomo>;
}
