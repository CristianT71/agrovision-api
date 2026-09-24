// Escapa los comodines de LIKE/ILIKE para que el texto del usuario se busque literal:
// sin esto, buscar "%" o "_" coincide con cualquier cosa
export function escaparLike(texto: string): string {
    return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}
