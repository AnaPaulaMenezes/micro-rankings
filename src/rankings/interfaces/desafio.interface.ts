import { DesafioStatus } from "./enum-status.enum";

export interface Desafio {
    _id: string;
    dataHoraDesafio: Date;
    status: DesafioStatus;
    dataHoraSolicitacao: Date;
    dataHoraResposta: Date;
    solicitante: string;
    categoria: string;
    partida?: string;
    jogadores: string;
}




