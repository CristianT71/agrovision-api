// RF-01.3: el teléfono es el login y debe guardarse siempre igual. Sin esto "573001234567" y
// "+573001234567" serían dos cuentas distintas (usuarios.telefono es único por texto).

// Prefijos admitidos y cuántos dígitos tiene el número nacional de un celular en cada país
const PAISES: { prefijo: string; digitosNacionales: number }[] = [
    { prefijo: "57", digitosNacionales: 10 }, // Colombia
    { prefijo: "1", digitosNacionales: 10 }, // Estados Unidos y Canadá
    { prefijo: "52", digitosNacionales: 10 }, // México
    { prefijo: "51", digitosNacionales: 9 }, // Perú
    { prefijo: "593", digitosNacionales: 9 }, // Ecuador
];

export const PREFIJOS_TELEFONO = PAISES.map((pais) => `+${pais.prefijo}`);

export const MENSAJE_TELEFONO_INVALIDO = `El teléfono debe incluir el prefijo del país (${PREFIJOS_TELEFONO.join(", ")}) y el número completo.`;

// Devuelve el número en formato E.164 ("+573001234567") o null si no es un celular de un país admitido.
// Tolera espacios, guiones, puntos y paréntesis, y que falte el "+".
export function normalizarTelefono(valor: string): string | null {
    const limpio = valor.replace(/[\s\-().]/g, "");
    if (!/^\+?\d+$/.test(limpio)) return null;

    const digitos = limpio.startsWith("+") ? limpio.slice(1) : limpio;
    const pais = PAISES.find(
        ({ prefijo, digitosNacionales }) =>
            digitos.startsWith(prefijo) && digitos.length === prefijo.length + digitosNacionales,
    );

    return pais ? `+${digitos}` : null;
}
