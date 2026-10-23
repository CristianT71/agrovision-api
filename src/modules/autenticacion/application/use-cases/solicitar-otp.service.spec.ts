import { ForbiddenException, HttpStatus, NotFoundException, type HttpException } from "@nestjs/common";
import { MAX_CODIGOS_POR_VENTANA, SolicitarOtpService } from "./solicitar-otp.service";
import { Usuario } from "../../domain/entities/usuario.entity";
import { SesionOtp } from "../../domain/entities/sesion-otp.entity";
import type { IUsuarioRepository } from "../../domain/ports/out/usuario.repository";
import type { ISesionOtpRepository } from "../../domain/ports/out/sesion-otp.repository";
import type { ISmsService } from "../../domain/ports/out/sms.service";

// uuid se publica como ESM y Jest no lo carga: se reemplaza por el generador nativo
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

const TELEFONO = "+573114528801";

describe("SolicitarOtpService", () => {
    let usuario: Usuario | null;
    let ultimaSesion: SesionOtp | null;
    let codigosUltimaHora: number;
    let usuarioGuardado: jest.Mock<Promise<Usuario>, [Usuario]>;
    let sesionGuardada: jest.Mock<Promise<void>, [SesionOtp]>;
    let enviarOtp: jest.Mock<Promise<boolean>, [string, string]>;
    let servicio: SolicitarOtpService;

    beforeEach(() => {
        usuario = null;
        ultimaSesion = null;
        codigosUltimaHora = 0;
        usuarioGuardado = jest.fn((u: Usuario) => Promise.resolve(u));
        sesionGuardada = jest.fn<Promise<void>, [SesionOtp]>(() => Promise.resolve());
        enviarOtp = jest.fn<Promise<boolean>, [string, string]>(() => Promise.resolve(true));

        const usuarios: IUsuarioRepository = {
            findByTelefono: () => Promise.resolve(usuario),
            findById: () => Promise.resolve(usuario),
            guardar: usuarioGuardado,
        };
        const sesiones: ISesionOtpRepository = {
            findUltimaPorUsuarioId: () => Promise.resolve(ultimaSesion),
            contarDesde: () => Promise.resolve(codigosUltimaHora),
            guardar: sesionGuardada,
            registrarIntentoFallido: jest.fn(),
            consumir: jest.fn(),
        };
        const sms: ISmsService = { enviarOtp };

        servicio = new SolicitarOtpService(usuarios, sesiones, sms);
    });

    it("registra un teléfono nuevo solo como productor", async () => {
        await servicio.ejecutar({ telefono: TELEFONO, rolSeleccionado: "productor" });

        const registrado = usuarioGuardado.mock.calls[0][0];
        expect(registrado.rol).toBe("productor");
    });

    it("rechaza desde el panel un número que no está registrado", async () => {
        await expect(servicio.ejecutar({ telefono: TELEFONO })).rejects.toBeInstanceOf(NotFoundException);
        expect(usuarioGuardado).not.toHaveBeenCalled();
        expect(enviarOtp).not.toHaveBeenCalled();
    });

    it("registra un número nuevo solo desde el flujo móvil de productor", async () => {
        await servicio.ejecutar({ telefono: TELEFONO, rolSeleccionado: "productor" });

        expect(usuarioGuardado).toHaveBeenCalledTimes(1);
        expect(enviarOtp).toHaveBeenCalledTimes(1);
    });

    it("envía el código usando el rol registrado en la cuenta", async () => {
        usuario = Usuario.registrarProductor("u-1", TELEFONO);

        await servicio.ejecutar({ telefono: TELEFONO });

        expect(enviarOtp).toHaveBeenCalledTimes(1);
    });

    it("envía un código de 6 dígitos y guarda solo su hash", async () => {
        await servicio.ejecutar({ telefono: TELEFONO, rolSeleccionado: "productor" });

        const codigo = enviarOtp.mock.calls[0][1];
        const sesion = sesionGuardada.mock.calls[0][0];
        expect(codigo).toMatch(/^\d{6}$/);
        expect(sesion.codigoHash).not.toContain(codigo);
        expect(sesion.coincide(codigo)).toBe(true);
    });

    it("responde 429 si no han pasado 30 segundos desde el último código", async () => {
        usuario = Usuario.registrarProductor("u-1", TELEFONO);
        ultimaSesion = SesionOtp.crear({ id: "s-1", usuarioId: "u-1", codigo: "123456", minutosVigencia: 5 });

        const error = (await servicio.ejecutar({ telefono: TELEFONO }).catch((e: unknown) => e)) as HttpException;

        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(enviarOtp).not.toHaveBeenCalled();
    });

    it("responde 429 al pedir el sexto código en una hora: no se puede adivinar uno a base de pedir códigos", async () => {
        usuario = Usuario.registrarProductor("u-1", TELEFONO);
        codigosUltimaHora = MAX_CODIGOS_POR_VENTANA;

        const error = (await servicio.ejecutar({ telefono: TELEFONO }).catch((e: unknown) => e)) as HttpException;

        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(sesionGuardada).not.toHaveBeenCalled();
        expect(enviarOtp).not.toHaveBeenCalled();
    });

    it("con el tope sin alcanzar sigue enviando el código", async () => {
        usuario = Usuario.registrarProductor("u-1", TELEFONO);
        codigosUltimaHora = MAX_CODIGOS_POR_VENTANA - 1;

        await servicio.ejecutar({ telefono: TELEFONO });

        expect(enviarOtp).toHaveBeenCalledTimes(1);
    });

    it("no envía códigos a cuentas inactivas", async () => {
        usuario = new Usuario("u-1", TELEFONO, "agronomo", "inactivo", new Date());

        await expect(servicio.ejecutar({ telefono: TELEFONO })).rejects.toBeInstanceOf(ForbiddenException);
        expect(enviarOtp).not.toHaveBeenCalled();
    });
});
