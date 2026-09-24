import { ConflictException, ForbiddenException } from "@nestjs/common";
import { ObtenerPlagaService } from "./obtener-plaga.service";
import { CrearPlagaService } from "./crear-plaga.service";
import { ActualizarPlagaService } from "./actualizar-plaga.service";
import { AvalarPlagaService } from "./avalar-plaga.service";
import { ActualizarProtocoloQuimicoService } from "./actualizar-protocolo-quimico.service";
import { SubirFotoPlagaService } from "./subir-foto-plaga.service";
import { Plaga } from "../../domain/entities/plaga.entity";
import type { IPlagaRepository } from "../../domain/ports/out/plaga.repository";
import type { DatosFichaPlaga } from "../../domain/ports/in/gestionar-plagas.port";
import type { IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import { Agronomo, type EstadoAgronomo } from "../../../agronomos/domain/entities/agronomo.entity";
import type {
    ArchivoParaGuardar,
    IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// uuid se publica como ESM y Jest no lo carga: se reemplaza por el generador nativo
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

const FICHA: DatosFichaPlaga = {
    nombreComun: "Roya del cafeto",
    nombreCientifico: "Hemileia vastatrix",
    tipo: "enfermedad",
    descripcion: "Hongo que ataca las hojas del cafeto.",
    sintomas: "Manchas amarillas en el envés.",
    organosAfectados: ["hoja"],
    medidasContencion: "Variedades resistentes y manejo de sombra.",
    sinonimos: ["Roya", "roya", " Óxido "],
};

const FOTO: ArchivoParaGuardar = { nombreOriginal: "roya.png", tipoMime: "image/png", contenido: Buffer.from("png") };

const crearAgronomo = (estado: EstadoAgronomo) =>
    new Agronomo("a-1", "u-1", "Claudia Ríos", "TP-098712", "+573001", "c@a.co", "Fitopatología", estado, new Date());

describe("Plagas - casos de uso", () => {
    let plaga: Plaga | null;
    let agronomo: Agronomo | null;
    let existeNombre: boolean;
    let guardar: jest.Mock<Promise<Plaga>, [Plaga]>;
    let guardarPublico: jest.Mock<Promise<string>, [string, ArchivoParaGuardar]>;
    let eliminarPublico: jest.Mock<Promise<void>, [string]>;
    let repositorio: IPlagaRepository;
    let agronomos: IAgronomoRepository;
    let almacenamiento: IAlmacenamientoArchivos;
    let obtener: ObtenerPlagaService;

    beforeEach(() => {
        plaga = Plaga.crear({ ...FICHA, id: "pl-1" });
        agronomo = crearAgronomo("activo");
        existeNombre = false;
        guardar = jest.fn((p: Plaga) => Promise.resolve(p));
        guardarPublico = jest.fn<Promise<string>, [string, ArchivoParaGuardar]>(() =>
            Promise.resolve("/archivos/plagas/nueva.png"),
        );
        eliminarPublico = jest.fn<Promise<void>, [string]>(() => Promise.resolve());

        repositorio = {
            findById: () => Promise.resolve(plaga),
            findAll: () => Promise.resolve([]),
            existeNombreCientifico: () => Promise.resolve(existeNombre),
            guardar,
        };
        agronomos = { findByUsuarioId: () => Promise.resolve(agronomo) } as unknown as IAgronomoRepository;
        almacenamiento = {
            guardarPublico,
            eliminarPublico,
            guardarPrivado: jest.fn(),
            leerPrivado: jest.fn(),
            eliminarPrivado: jest.fn(),
        };
        obtener = new ObtenerPlagaService(repositorio);
    });

    it("crea la ficha sin aval y con los sinónimos normalizados (RF-05.4, RF-05.5)", async () => {
        const creada = await new CrearPlagaService(repositorio).ejecutar(FICHA);

        expect(creada.tieneAval()).toBe(false);
        expect(creada.protocoloQuimico).toBeNull();
        expect(creada.sinonimos).toEqual(["Roya", "Óxido"]);
    });

    it("no permite repetir el nombre científico", async () => {
        existeNombre = true;

        await expect(new CrearPlagaService(repositorio).ejecutar(FICHA)).rejects.toBeInstanceOf(ConflictException);
    });

    it("actualiza la ficha y reemplaza la lista de hospederos (RF-05.3)", async () => {
        const actualizada = await new ActualizarPlagaService(repositorio, obtener).ejecutar("pl-1", {
            sintomas: "Pústulas anaranjadas.",
            hospederos: ["Coffea arabica", "coffea arabica"],
        });

        expect(actualizada.sintomas).toBe("Pústulas anaranjadas.");
        expect(actualizada.hospederos).toEqual(["Coffea arabica"]);
    });

    it("bloquea el protocolo químico mientras la ficha no tenga aval (RF-05.6)", async () => {
        await expect(
            new ActualizarProtocoloQuimicoService(repositorio, obtener).ejecutar({
                plagaId: "pl-1",
                protocoloQuimico: "Oxicloruro de cobre 3 g/L",
            }),
        ).rejects.toBeInstanceOf(ReglaNegocioError);
    });

    it("el aval del agrónomo activo copia su tarjeta y libera el protocolo (RF-05.7)", async () => {
        const avalada = await new AvalarPlagaService(repositorio, agronomos, obtener).ejecutar({
            plagaId: "pl-1",
            usuarioId: "u-1",
        });

        expect(avalada.avales[0].numeroTarjeta).toBe("TP-098712");

        const conProtocolo = await new ActualizarProtocoloQuimicoService(repositorio, obtener).ejecutar({
            plagaId: "pl-1",
            protocoloQuimico: "Oxicloruro de cobre 3 g/L",
        });
        expect(conProtocolo.protocoloQuimico).toBe("Oxicloruro de cobre 3 g/L");
    });

    it("un agrónomo inactivo no puede avalar", async () => {
        agronomo = crearAgronomo("inactivo");

        await expect(
            new AvalarPlagaService(repositorio, agronomos, obtener).ejecutar({ plagaId: "pl-1", usuarioId: "u-1" }),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("al subir una foto nueva borra la anterior solo después de guardar", async () => {
        plaga!.actualizarFicha({ fotoUrl: "/archivos/plagas/vieja.png" });

        const actualizada = await new SubirFotoPlagaService(repositorio, almacenamiento, obtener).ejecutar({
            plagaId: "pl-1",
            archivo: FOTO,
        });

        expect(actualizada.fotoUrl).toBe("/archivos/plagas/nueva.png");
        expect(eliminarPublico).toHaveBeenCalledWith("/archivos/plagas/vieja.png");
    });

    it("si guardar falla, borra la foto nueva y conserva la anterior", async () => {
        plaga!.actualizarFicha({ fotoUrl: "/archivos/plagas/vieja.png" });
        guardar.mockRejectedValue(new Error("fallo de base de datos"));

        await expect(
            new SubirFotoPlagaService(repositorio, almacenamiento, obtener).ejecutar({
                plagaId: "pl-1",
                archivo: FOTO,
            }),
        ).rejects.toThrow("fallo de base de datos");
        expect(eliminarPublico).toHaveBeenCalledWith("/archivos/plagas/nueva.png");
        expect(eliminarPublico).not.toHaveBeenCalledWith("/archivos/plagas/vieja.png");
    });
});
