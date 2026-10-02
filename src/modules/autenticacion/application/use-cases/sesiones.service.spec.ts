import { UnauthorizedException } from "@nestjs/common";
import { SesionesService } from "./sesiones.service";
import { SesionUsuario } from "../../domain/entities/sesion-usuario.entity";
import type { RolUsuario } from "../../domain/entities/usuario.entity";
import type { ISesionUsuarioRepository } from "../../domain/ports/out/sesion-usuario.repository";

const MINUTO = 60 * 1000;

// Sesión creada hace "haceMinutos" y con su última actividad hace "inactivaMinutos"
const crearSesion = (rol: RolUsuario, haceMinutos: number, inactivaMinutos: number) => {
    const ahora = Date.now();
    const creadaEn = new Date(ahora - haceMinutos * MINUTO);
    const expiraEn = new Date(creadaEn.getTime() + 12 * 60 * MINUTO);
    return new SesionUsuario("s-1", "u-1", rol, creadaEn, expiraEn, new Date(ahora - inactivaMinutos * MINUTO));
};

describe("SesionesService", () => {
    let sesion: SesionUsuario | null;
    let registrarActividad: jest.Mock<Promise<void>, [string, Date]>;
    let revocar: jest.Mock<Promise<void>, [string, Date]>;
    let servicio: SesionesService;

    beforeEach(() => {
        sesion = crearSesion("agronomo", 10, 5);
        registrarActividad = jest.fn<Promise<void>, [string, Date]>(() => Promise.resolve());
        revocar = jest.fn<Promise<void>, [string, Date]>(() => Promise.resolve());

        const repositorio: ISesionUsuarioRepository = {
            crear: jest.fn(),
            findById: () => Promise.resolve(sesion),
            registrarActividad,
            revocar,
        };
        servicio = new SesionesService(repositorio);
    });

    it("acepta una sesión con actividad reciente y renueva su actividad", async () => {
        await servicio.verificar("s-1");

        expect(registrarActividad).toHaveBeenCalledWith("s-1", expect.any(Date));
    });

    it("no escribe en la base si la última actividad fue hace menos de un minuto", async () => {
        sesion = crearSesion("agronomo", 10, 0);

        await servicio.verificar("s-1");

        expect(registrarActividad).not.toHaveBeenCalled();
    });

    it("cierra la sesión del panel tras 30 minutos sin actividad (RNF-02.2)", async () => {
        sesion = crearSesion("admin", 60, 31);

        await expect(servicio.verificar("s-1")).rejects.toThrow("inactividad");
    });

    it("la sesión del productor en la app no se cierra por 30 minutos sin actividad", async () => {
        sesion = crearSesion("productor", 60, 31);

        await expect(servicio.verificar("s-1")).resolves.toBeUndefined();
    });

    it("rechaza una sesión cerrada (RF-01.8)", async () => {
        sesion = crearSesion("agronomo", 10, 1);
        sesion.revocar();

        await expect(servicio.verificar("s-1")).rejects.toThrow("cerrada");
    });

    it("rechaza un token sin sesión en el servidor", async () => {
        sesion = null;

        await expect(servicio.verificar("s-x")).rejects.toBeInstanceOf(UnauthorizedException);
        await expect(servicio.verificar(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("cerrar sesión la revoca en el servidor", async () => {
        await servicio.cerrar("s-1");

        expect(revocar).toHaveBeenCalledWith("s-1", expect.any(Date));
    });

    it("la duración máxima del token depende del rol", () => {
        const panel = SesionUsuario.iniciar({ id: "a", usuarioId: "u", rol: "agronomo" });
        const app = SesionUsuario.iniciar({ id: "b", usuarioId: "u", rol: "productor" });

        expect(panel.segundosDeVida()).toBe(12 * 60 * 60);
        expect(app.segundosDeVida()).toBe(30 * 24 * 60 * 60);
    });
});
