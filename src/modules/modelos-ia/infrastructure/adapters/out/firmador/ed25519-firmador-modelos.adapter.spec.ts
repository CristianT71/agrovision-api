import { createHash, createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import { Ed25519FirmadorModelosAdapter } from "./ed25519-firmador-modelos.adapter";

// @nestjs/config se publica como ESM y Jest no lo carga: solo se usa como tipo
jest.mock("@nestjs/config", () => ({ ConfigService: class {} }));

const configCon = (clave: string | undefined) => ({ get: () => clave }) as unknown as ConfigService;

const ETIQUETAS = Buffer.from('{"class_count":2}');
const CALIBRACION = Buffer.from('{"temperature":1.5}');
const SHA256_MODELO = "AB".repeat(32);

// Lo que hace la app (ArtifactInstaller.kt, paso 4) con la clave pública de 32 bytes que trae embebida
function verificaComoLaApp(clavePublicaBase64: string, firmaBase64: string): boolean {
    const digest = createHash("sha256")
        .update(SHA256_MODELO.toLowerCase())
        .update(ETIQUETAS)
        .update(CALIBRACION)
        .digest();

    const clave = createPublicKey({
        key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(clavePublicaBase64, "base64").toString("base64url") },
        format: "jwk",
    });

    return verify(null, digest, clave, Buffer.from(firmaBase64, "base64"));
}

describe("Ed25519FirmadorModelosAdapter", () => {
    const par = generateKeyPairSync("ed25519");
    const privadaBase64 = par.privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
    // Formato de MODEL_SIGNING_PUBLIC_KEY en la app: los 32 bytes crudos en Base64
    const publicaBase64 = Buffer.from(par.publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64");

    const firmar = (firmador: Ed25519FirmadorModelosAdapter) =>
        firmador.firmarConjunto({ sha256Modelo: SHA256_MODELO, etiquetas: ETIQUETAS, calibracion: CALIBRACION });

    it("produce una firma que la app acepta con su clave pública", () => {
        const firma = firmar(new Ed25519FirmadorModelosAdapter(configCon(privadaBase64)));

        expect(firma).not.toBeNull();
        expect(Buffer.from(firma!, "base64")).toHaveLength(64);
        expect(verificaComoLaApp(publicaBase64, firma!)).toBe(true);
    });

    it("la firma no sirve si cambian las etiquetas o la calibración", () => {
        const firma = new Ed25519FirmadorModelosAdapter(configCon(privadaBase64)).firmarConjunto({
            sha256Modelo: SHA256_MODELO,
            etiquetas: Buffer.from('{"class_count":3}'),
            calibracion: CALIBRACION,
        });

        expect(verificaComoLaApp(publicaBase64, firma!)).toBe(false);
    });

    it("sin clave configurada no firma, pero la API sigue funcionando", () => {
        expect(firmar(new Ed25519FirmadorModelosAdapter(configCon(undefined)))).toBeNull();
    });

    it("rechaza una clave que no es Ed25519", () => {
        const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
        const clave = rsa.privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");

        expect(() => new Ed25519FirmadorModelosAdapter(configCon(clave))).toThrow("Ed25519");
    });
});
