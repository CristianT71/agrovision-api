import { ForbiddenException, HttpStatus, NotFoundException, type HttpException } from "@nestjs/common";
import { SolicitarOtpService } from "./solicitar-otp.service";
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
    let usuarioGuardado: jest.Mock<Promise<Usuario>, [Usuario]>;
    let sesionGuardada: jest.Mock<Promise<void>, [SesionOtp]>;
    let enviarOtp: jest.Mock<Promise<boolean>, [string, string]>;
    let servicio: SolicitarOtpService;

    beforeEach(() => {
        usuario = null;
        ultimaSesion = null;
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
            guardar: sesionGuardada,
            registrarIntentoFallido: jest.fn(),
            consumir: jest.fn(),
        };
        const sms: ISmsService = { enviarOtp };

        servicio = new SolicitarOtpService(usuarios, sesiones, sms);
    });

    it("registra un teléfono nuevo solo como productor", async () => {
        await servicio.ejecutar({ telefono: TELEFONO });

        const registrado = usuarioGuardado.mock.calls[0][0];
        expect(registrado.rol).toBe("productor");
    });

    it("desde el panel no crea cuentas: un número desconocido con rol de agrónomo se rechaza", async () => {
        await expect(servicio.ejecutar({ telefono: TELEFONO, rolSeleccionado: "agronomo" })).rejects.toBeInstanceOf(
            NotFoundException,
        );
        expect(usuarioGuardado).not.toHaveBeenCalled();
        expect(enviarOtp).not.toHaveBeenCalled();
    });

    it("no envía el código si el rol elegido no es el de la cuenta", async () => {
        usuario = Usuario.registrarProductor("u-1", TELEFONO);

        await expect(servicio.ejecutar({ telefono: TELEFONO, rolSeleccionado: "admin" })).rejects.toBeInstanceOf(
            ForbiddenException,
        );
        expect(enviarOtp).not.toHaveBeenCalled();
    });

    it("envía un código de 6 dígitos y guarda solo su hash", async () => {
        await servicio.ejecutar({ telefono: TELEFONO });

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

    it("no envía códigos a cuentas inactivas", async () => {
        usuario = new Usuario("u-1", TELEFONO, "agronomo", "inactivo", new Date());

        await expect(servicio.ejecutar({ telefono: TELEFONO })).rejects.toBeInstanceOf(ForbiddenException);
        expect(enviarOtp).not.toHaveBeenCalled();
    });
});
