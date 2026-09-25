export class AvalPlaga {
    constructor(
        public readonly id: string,
        public readonly agronomoId: string,
        // Copia de la tarjeta profesional del agrónomo al momento de firmar: queda como
        // evidencia aunque después cambie el registro en "agronomos"
        public readonly numeroTarjeta: string,
        public readonly fechaAval: Date,
    ) {}
}
