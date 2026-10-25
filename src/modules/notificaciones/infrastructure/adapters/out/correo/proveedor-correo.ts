export type ProveedorCorreo = "log" | "smtp";

// MAIL_PROVIDER=log escribe el correo en la consola; smtp lo envía de verdad (Gmail con contraseña de aplicación).
// Una configuración incompleta tumba el arranque, no el primer aviso.
export function elegirProveedorCorreo(entorno: {
    proveedor?: string;
    usuario?: string;
    clave?: string;
}): ProveedorCorreo {
    const proveedor = (entorno.proveedor ?? "log").trim().toLowerCase();
    if (proveedor === "log") return "log";
    if (proveedor !== "smtp") throw new Error(`MAIL_PROVIDER debe ser log o smtp, no "${entorno.proveedor}".`);
    if (!entorno.usuario?.trim() || !entorno.clave?.trim()) {
        throw new Error("MAIL_PROVIDER=smtp exige MAIL_USER y MAIL_PASSWORD.");
    }
    return "smtp";
}
