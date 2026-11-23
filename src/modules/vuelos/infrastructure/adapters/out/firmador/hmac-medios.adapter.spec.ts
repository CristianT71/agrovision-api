import { ConfigService } from "@nestjs/config";
import { HmacMediosAdapter } from "./hmac-medios.adapter";
import { TokenMedioError } from "../../../../domain/errors/vuelos.error";
jest.mock("@nestjs/config", () => ({
    ConfigService: class {
        constructor(private datos: Record<string, unknown>) {}
        get(clave: string) {
            return this.datos[clave];
        }
        getOrThrow(clave: string) {
            if (!(clave in this.datos)) throw new Error("Falta variable");
            return this.datos[clave];
        }
    },
}));
const id = "11111111-1111-4111-8111-111111111111";
describe("Enlaces HMAC vuelos", () => {
    const crear = (secreto = "vuelos-secreto") =>
        new HmacMediosAdapter(
            new ConfigService({ VUELOS_URL_SECRET: secreto, JWT_SECRET: "jwt", UPLOAD_URL_SECRET: "upload" }),
        );
    it("firma archivo y variante por cinco minutos", () => {
        const f = crear(),
            exp = Date.now() + 300_000;
        expect(f.verificar(f.firmar(id, "contenido", exp))).toEqual({ archivoId: id, variante: "contenido", exp });
        expect(f.verificar(f.firmar(id, "miniatura", exp)).variante).toBe("miniatura");
    });
    it("distingue vencido de inválido", () => {
        const f = crear();
        try {
            f.verificar(f.firmar(id, "contenido", Date.now()));
            throw new Error("no lanzó");
        } catch (e) {
            expect(e).toMatchObject({ vencido: true });
        }
        expect(() => f.verificar("basura")).toThrow(TokenMedioError);
    });
    it("rechaza manipulación de carga, firma y secreto", () => {
        const f = crear(),
            token = f.firmar(id, "contenido", Date.now() + 1000),
            [carga, firma] = token.split(".");
        const c = JSON.parse(Buffer.from(carga, "base64url").toString()) as Record<string, unknown>;
        c.variante = "miniatura";
        expect(() => f.verificar(`${Buffer.from(JSON.stringify(c)).toString("base64url")}.${firma}`)).toThrow(
            TokenMedioError,
        );
        expect(() => f.verificar(`${carga}.AAAA`)).toThrow(TokenMedioError);
        expect(() => crear("otro").verificar(token)).toThrow(TokenMedioError);
    });
    it.each(["", "jwt", "upload"])("no arranca con secreto vacío o compartido %s", (secreto) => {
        expect(() => crear(secreto)).toThrow();
    });
});
