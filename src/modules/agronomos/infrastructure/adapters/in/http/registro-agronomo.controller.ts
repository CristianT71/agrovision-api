import { Body, Controller, HttpCode, HttpStatus, Post, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { RegistrarAgronomoService } from "../../../../application/use-cases/registrar-agronomo.service";
import { RegistrarAgronomoDto } from "./dto/registrar-agronomo.dto";
import {
    TIPOS_DOCUMENTO,
    validarArchivo,
    type ArchivoSubido,
} from "../../../../../../common/almacenamiento/validar-archivo";

const MAX_DOCUMENTOS = 3;
const MAX_BYTES_DOCUMENTO = 5 * 1024 * 1024;

// Endpoint público: lo usa el formulario "Solicitar acceso" antes de tener cuenta (RF-01.6)
@Controller("agronomos")
export class RegistroAgronomoController {
    constructor(private readonly registrarAgronomoService: RegistrarAgronomoService) {}

    @Post("registro")
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(
        FilesInterceptor("documentos", MAX_DOCUMENTOS, {
            limits: { fileSize: MAX_BYTES_DOCUMENTO, files: MAX_DOCUMENTOS },
        }),
    )
    async registrar(@Body() dto: RegistrarAgronomoDto, @UploadedFiles() archivos: ArchivoSubido[] | undefined) {
        // RF-10.4: PDF o imagen, verificados por su contenido real
        const documentos = (archivos ?? []).map((archivo) =>
            validarArchivo(archivo, { tiposPermitidos: TIPOS_DOCUMENTO, maxBytes: MAX_BYTES_DOCUMENTO }),
        );

        return await this.registrarAgronomoService.ejecutar({ ...dto, documentos });
    }
}
