export type ProveedorSms = "log" | "zavu";
export type CanalZavu = "sms" | "whatsapp" | "auto";

interface Entorno {
    proveedor?: string;
    nodeEnv?: string;
    zavuApiKey?: string;
}

// SMS_PROVIDER decide cómo llega el código OTP:
//  - "log": se escribe en la consola de la API. Solo para desarrollo: no cuesta dinero.
//  - "zavu": se envía de verdad por Zavu.
// En producción el modo "log" está prohibido: dejaría los códigos de acceso (de cualquier cuenta,
// administrador incluido) en los logs, y nadie los recibiría en su celular.
export function elegirProveedorSms({ proveedor, nodeEnv, zavuApiKey }: Entorno): ProveedorSms {
    const elegido = (proveedor?.trim() || "log").toLowerCase();

    if (elegido !== "log" && elegido !== "zavu") {
        throw new Error(`SMS_PROVIDER no es válido: "${proveedor}". Usa "log" o "zavu".`);
    }

    if (elegido === "log" && nodeEnv === "production") {
        throw new Error(
            "SMS_PROVIDER=log no se permite con NODE_ENV=production: los códigos OTP quedarían en los logs. Usa SMS_PROVIDER=zavu.",
        );
    }

    if (elegido === "zavu" && !zavuApiKey?.trim()) {
        throw new Error("SMS_PROVIDER=zavu necesita ZAVU_API_KEY.");
    }

    return elegido;
}

// ZAVU_CHANNEL: "auto" deja que Zavu elija el medio; "whatsapp" exige una plantilla aprobada en Zavu
export function elegirCanalZavu(valor: string | undefined): CanalZavu {
    const canal = (valor?.trim() || "auto").toLowerCase();

    if (canal !== "sms" && canal !== "whatsapp" && canal !== "auto") {
        throw new Error(`ZAVU_CHANNEL no es válido: "${valor}". Usa "sms", "whatsapp" o "auto".`);
    }

    return canal;
}

// "+573001234567" -> "+57******4567": los logs no necesitan el número completo
export function ocultarTelefono(telefono: string): string {
    if (telefono.length <= 6) return "***";

    return `${telefono.slice(0, 3)}${"*".repeat(telefono.length - 7)}${telefono.slice(-4)}`;
}
