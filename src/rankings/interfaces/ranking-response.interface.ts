export interface RankingResponse {
    jogador?: string
    posicao?: string
    pontuacao?: string
    historicoPartidas?: Historico
}

export interface Historico {
    vitorias?: number
    derrotas?: number
}