import { BadRequestException, ConflictException } from "@nestjs/common";
import { RegistrarAgronomoService } from "./registrar-agronomo.service";
import { CambiarEstadoAgronomoService } from "./cambiar-estado-agronomo.service";
import { ListarAgronomosService } from "./listar-agronomos.service";
import { Agronomo, type EstadoAgronomo } from "../../domain/entities/agronomo.entity";
import type { DocumentoAcreditacion } from "../../domain/entities/documento-acreditacion.entity";
import type { IAgronomoRepository } from "../../domain/ports/out/agronomo.repository";
import type { Usuario } from "../../../autenticacion/domain/entities/usuario.entity";
import type {
    ArchivoParaGuardar,
    IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// uuid se publica como ESM y Jest no lo carga: se reemplaza por el generador nativo
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

const PDF: ArchivoParaGuardar = {
    nombreOriginal: "tarjeta.pdf",
    tipoMime: "application/pdf",
    contenido: Buffer.from("%PDF"),
};

const DATOS = {
    nombre: "Claudia Ríos",
    telefono: "+573124417780",
    correo: "Claudia@AgroVision.co",
    tarjetaProfesional: "TP-098712",
    especialidad: "Fitopatología",
};

const crearAgronomo = (estado: EstadoAgronomo) =>
    new Agronomo("a-1", "u-1", "Claudia Ríos", "TP-1", "+573001", "c@a.co", "Fitopatología", estado, new Date());

describe("Agrónomos - casos de uso", () => {
    let repositorio: jest.Mocked<IAgronomoRepository>;
    let almacenamiento: jest.Mocked<IAlmacenamientoArchivos>;
    // Mocks sueltos para las aserciones: evita referenciar métodos del objeto (unbound-method)
    let registrar: jest.Mock<Promise<void>, [Agronomo, Usuario, DocumentoAcreditacion[]]>;
    let guardar: jest.Mock<Promise<Agronomo>, [Agronomo]>;
    let guardarPrivado: jest.Mock<Promise<string>, [string, ArchivoParaGuardar]>;
    let eliminarPrivado: jest.Mock<Promise<void>, [string]>;

    beforeEach(() => {
        registrar = jest.fn<Promise<void>, [Agronomo, Usuario, DocumentoAcreditacion[]]>(() => Promise.resolve());
        guardar = jest.fn((agronomo: Agronomo) => Promise.resolve(agronomo));
        guardarPrivado = jest.fn<Promise<string>, [string, ArchivoParaGuardar]>(() =>
            Promise.resolve("agronomos/a-1/doc.pdf"),
        );
        eliminarPrivado = jest.fn<Promise<void>, [string]>(() => Promise.resolve());
        repositorio = {
            findById: jest.fn(),
            findByUsuarioId: jest.fn(),
            findByTarjetaProfesional: jest.fn().mockResolvedValue(null),
            findByCorreo: jest.fn().mockResolvedValue(null),
            findAll: jest.fn(),
            existeCuentaConTelefono: jest.fn().mockResolvedValue(false),
            registrar,
            guardar,
            findDocumentos: jest.fn(),
            findDocumento: jest.fn(),
            contarCasosActivos: jest.fn(),
        };
        almacenamiento = {
            guardarPublico: jest.fn(),
            eliminarPublico: jest.fn(),
            guardarPrivado,
            leerPrivado: jest.fn(),
            eliminarPrivado,
        };
    });

    describe("RegistrarAgronomoService", () => {
        const registrarAgronomo = (documentos: ArchivoParaGuardar[] = [PDF]) =>
            new RegistrarAgronomoService(repositorio, almacenamiento).ejecutar({ ...DATOS, documentos });

        it("crea la cuenta y el agrónomo pendientes, con sus documentos en almacenamiento privado", async () => {
            const respuesta = await registrarAgronomo();

            const [agronomo, usuario, documentos] = registrar.mock.calls[0];
            expect(respuesta.estado).toBe("pendiente");
            expect(usuario.rol).toBe("agronomo");
            expect(usuario.estado).toBe("pendiente");
            expect(agronomo.usuarioId).toBe(usuario.id);
            expect(agronomo.correo).toBe("claudia@agrovision.co");
            expect(documentos).toHaveLength(1);
            expect(guardarPrivado).toHaveBeenCalled();
        });

        it("exige al menos un documento de acreditación (RF-10.4)", async () => {
            await expect(registrarAgronomo([])).rejects.toBeInstanceOf(BadRequestException);
        });

        it("rechaza un celular que ya tiene cuenta", async () => {
            repositorio.existeCuentaConTelefono.mockResolvedValue(true);

            await expect(registrarAgronomo()).rejects.toBeInstanceOf(ConflictException);
            expect(guardarPrivado).not.toHaveBeenCalled();
        });

        it("borra los archivos guardados si el registro falla", async () => {
            registrar.mockRejectedValue(new Error("fallo de base de datos"));

            await expect(registrarAgronomo()).rejects.toThrow("fallo de base de datos");
            expect(eliminarPrivado).toHaveBeenCalledWith("agronomos/a-1/doc.pdf");
        });
    });

    describe("CambiarEstadoAgronomoService", () => {
        const cambiar = (accion: "validar" | "desactivar" | "reactivar") =>
            new CambiarEstadoAgronomoService(repositorio).ejecutar({ agronomoId: "a-1", accion });

        it("valida un agrónomo pendiente (RF-10.5)", async () => {
            repositorio.findById.mockResolvedValue(crearAgronomo("pendiente"));

            const agronomo = await cambiar("validar");

            expect(agronomo.estado).toBe("activo");
            expect(guardar).toHaveBeenCalled();
        });

        it("no valida dos veces al mismo agrónomo", async () => {
            repositorio.findById.mockResolvedValue(crearAgronomo("activo"));

            await expect(cambiar("validar")).rejects.toBeInstanceOf(ReglaNegocioError);
            expect(guardar).not.toHaveBeenCalled();
        });
    });

    describe("ListarAgronomosService", () => {
        it("incluye la carga de casos activos de cada agrónomo (RF-08.4)", async () => {
            repositorio.findAll.mockResolvedValue([crearAgronomo("activo")]);
            repositorio.contarCasosActivos.mockResolvedValue(new Map([["a-1", 4]]));

            const [resumen] = await new ListarAgronomosService(repositorio).ejecutar({});

            expect(resumen.casosActivos).toBe(4);
        });
    });
});
