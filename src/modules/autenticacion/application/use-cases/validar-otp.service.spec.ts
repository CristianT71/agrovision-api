import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { ValidarOtpService } from "./validar-otp.service";
import { Usuario, type RolUsuario } from "../../domain/entities/usuario.entity";
import { SesionOtp, MAX_INTENTOS_OTP } from "../../domain/entities/sesion-otp.entity";
import type { IUsuarioRepository } from "../../domain/ports/out/usuario.repository";
import type { ISesionOtpRepository } from "../../domain/ports/out/sesion-otp.repository";
import type { IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import { Agronomo, type EstadoAgronomo } from "../../../agronomos/domain/entities/agronomo.entity";

// @nestjs/jwt se publica como ESM y Jest no lo carga: basta con una clase vacía para la inyección
jest.mock("@nestjs/jwt", () => ({ JwtService: class {} }));

const TELEFONO = "+573114528801";
const CODIGO = "123456";

describe("ValidarOtpService", () => {
    let usuario: Usuario | null;
    let sesion: SesionOtp | null;
    let agronomo: Agronomo | null;
    let usuarioGuardado: jest.Mock;
    let intentoFallido: jest.Mock;
    let consumir: jest.Mock;
    let servicio: ValidarOtpService;

    const crearUsuario = (rol: RolUsuario) => new Usuario("u-1", TELEFONO, rol, "activo", new Date());
    const crearAgronomo = (estado: EstadoAgronomo) =>
        new Agronomo("a-1", "u-1", "Claudia Ríos", "TP-1", TELEFONO, "c@a.co", "Fitopatología", estado, new Date());

    beforeEach(() => {
        usuario = crearUsuario("admin");
        sesion = SesionOtp.crear({ id: "s-1", usuarioId: "u-1", codigo: CODIGO, minutosVigencia: 5 });
        agronomo = null;
        usuarioGuardado = jest.fn();
        intentoFallido = jest.fn();
        consumir = jest.fn().mockResolvedValue(true);

        const usuarios: IUsuarioRepository = {
            findByTelefono: () => Promise.resolve(usuario),
            findById: () => Promise.resolve(usuario),
            guardar: usuarioGuardado,
        };
        const sesiones: ISesionOtpRepository = {
            findUltimaPorUsuarioId: () => Promise.resolve(sesion),
            guardar: jest.fn(),
            registrarIntentoFallido: intentoFallido,
            consumir,
        };
        const agronomos = {
            findByUsuarioId: () => Promise.resolve(agronomo),
        } as unknown as IAgronomoRepository;

        servicio = new ValidarOtpService(usuarios, sesiones, agronomos, {
            sign: () => "token-firmado",
        } as unknown as JwtService);
    });

    it("entrega el token con el rol guardado cuando todo es válido", async () => {
        const respuesta = await servicio.ejecutar({ telefono: TELEFONO, codigo: CODIGO, rolSeleccionado: "admin" });

        expect(respuesta.usuario.rol).toBe("admin");
        expect(respuesta.accessToken).toEqual(expect.any(String));
        expect(consumir).toHaveBeenCalledWith("s-1");
    });

    it("no permite escalar el rol eligiendo otro en el login", async () => {
        usuario = crearUsuario("productor");

        await expect(
            servicio.ejecutar({ telefono: TELEFONO, codigo: CODIGO, rolSeleccionado: "admin" }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(usuarioGuardado).not.toHaveBeenCalled();
        expect(consumir).not.toHaveBeenCalled();
    });

    it("registra el intento fallido cuando el código no coincide", async () => {
        await expect(
            servicio.ejecutar({ telefono: TELEFONO, codigo: "000000", rolSeleccionado: "admin" }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(intentoFallido).toHaveBeenCalledWith("s-1");
    });

    it("bloquea el código al agotar los intentos aunque luego llegue el correcto", async () => {
        sesion!.intentos = MAX_INTENTOS_OTP;

        await expect(
            servicio.ejecutar({ telefono: TELEFONO, codigo: CODIGO, rolSeleccionado: "admin" }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rechaza cuando otra petición ya consumió el código", async () => {
        consumir.mockResolvedValue(false);

        await expect(
            servicio.ejecutar({ telefono: TELEFONO, codigo: CODIGO, rolSeleccionado: "admin" }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rechaza cuentas inactivas", async () => {
        usuario!.estado = "inactivo";

        await expect(
            servicio.ejecutar({ telefono: TELEFONO, codigo: CODIGO, rolSeleccionado: "admin" }),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("no deja entrar a un agrónomo pendiente de validación", async () => {
        usuario = crearUsuario("agronomo");
        agronomo = crearAgronomo("pendiente");

        await expect(
            servicio.ejecutar({ telefono: TELEFONO, codigo: CODIGO, rolSeleccionado: "agronomo" }),
        ).rejects.toThrow("pendiente de validación");
    });

    it("deja entrar a un agrónomo activo", async () => {
        usuario = crearUsuario("agronomo");
        agronomo = crearAgronomo("activo");

        const respuesta = await servicio.ejecutar({ telefono: TELEFONO, codigo: CODIGO, rolSeleccionado: "agronomo" });

        expect(respuesta.usuario.rol).toBe("agronomo");
    });
});
