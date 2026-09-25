import { BadRequestException } from "@nestjs/common";
import { TIPOS_DOCUMENTO, TIPOS_IMAGEN, validarArchivo, type ArchivoSubido } from "./validar-archivo";

const archivo = (contenido: Buffer, mimetype = "application/pdf"): ArchivoSubido => ({
    originalname: "soporte",
    mimetype,
    size: contenido.length,
    buffer: contenido,
});

describe("validarArchivo", () => {
    it("acepta un PDF real y usa el tipo detectado por su contenido", () => {
        const resultado = validarArchivo(archivo(Buffer.from("%PDF-1.7 ..."), "text/plain"), {
            tiposPermitidos: TIPOS_DOCUMENTO,
            maxBytes: 1024,
        });

        expect(resultado.tipoMime).toBe("application/pdf");
    });

    it("rechaza un archivo que dice ser imagen pero no lo es", () => {
        expect(() =>
            validarArchivo(archivo(Buffer.from("<script>"), "image/png"), {
                tiposPermitidos: TIPOS_IMAGEN,
                maxBytes: 1024,
            }),
        ).toThrow(BadRequestException);
    });

    it("rechaza un PDF donde solo se permiten imágenes", () => {
        expect(() =>
            validarArchivo(archivo(Buffer.from("%PDF-1.7")), { tiposPermitidos: TIPOS_IMAGEN, maxBytes: 1024 }),
        ).toThrow(BadRequestException);
    });

    it("rechaza archivos que superan el tamaño máximo", () => {
        expect(() =>
            validarArchivo(archivo(Buffer.from("%PDF-1.7")), { tiposPermitidos: TIPOS_DOCUMENTO, maxBytes: 4 }),
        ).toThrow(BadRequestException);
    });
});
