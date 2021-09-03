import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Partida } from './interfaces/partida.interface';
import { Ranking } from './interfaces/ranking.schema';
import { ClientProxySmartRanking } from '../proxyrmq/client-proxy'
import { Categoria } from './interfaces/categoria.interface';
import { EventoNome } from './evento-nome.enum';
import { Historico, RankingResponse } from './interfaces/ranking-response.interface';
import * as momentTimezone from 'moment-timezone';
import { Desafio } from './interfaces/desafio.interface';
import * as _ from "lodash";

@Injectable()
export class RankingsService {

  private readonly logger = new Logger(RankingsService.name);

  constructor(
    @InjectModel('Ranking') private readonly desafioModel: Model<Ranking>,
    private readonly clientProxySmartRanking: ClientProxySmartRanking
  ) { }

  private clientAdminBackend = this.clientProxySmartRanking.getClientProxyAdminBackendInstance();

  private clientDesafios = this.clientProxySmartRanking.getClientProxyDesafiosInstance();

  async processarPartida(idPartida: string, partida: Partida): Promise<void> {
    try {

      const categoria: Categoria = await this.clientAdminBackend.send('consultar-categorias', partida.categoria).toPromise();

      await Promise.all(partida.jogadores.map(async (jogador) => {
        const ranking = new this.desafioModel()

        ranking.categoria = partida.categoria
        ranking.desafio = partida.desafio
        ranking.partida = idPartida
        ranking.jogador = jogador

        if (jogador === partida.def) {
          const [eventoFilter] = categoria.eventos.filter((evento) => evento.nome === EventoNome.VITORIA)

          ranking.evento = EventoNome.VITORIA
          ranking.pontos = eventoFilter.valor
          ranking.operacao = eventoFilter.operacao

        } else {
          const [eventoFilter] = categoria.eventos.filter((evento) => evento.nome === EventoNome.DERROTA)

          ranking.evento = EventoNome.DERROTA
          ranking.pontos = eventoFilter.valor
          ranking.operacao = eventoFilter.operacao

        }

        this.logger.log(`ranking: ${JSON.stringify(ranking)}`)

        await ranking.save()
      }))
    } catch (error) {
      this.logger.error(`Error ${error}`);
      throw new RpcException(error.message);
    }
  }


  async consultarRankings(idCategoria: any, dataRef: any): Promise<RankingResponse | RankingResponse[]> {

    try {
      this.logger.log(`idCategoria: ${idCategoria} dataRef: ${dataRef}`)

      if (!dataRef) {
        dataRef = momentTimezone.tz("America/Sao_Paulo").format('YYYY-MM-DD');
        this.logger.log(`DataRef timezone ${dataRef}`);
      }

      const registrosRanking = await this.desafioModel
        .find()
        .where('categoria')
        .equals(idCategoria)

      this.logger.log(`registrosRanking ${JSON.stringify(registrosRanking)}`);


      const desafios: Desafio[] = await this.clientDesafios.send('consultar-desafios-realizados',
        { idCategoria, dataRef }).toPromise()

      this.logger.log(`desafios ${JSON.stringify(desafios)}`);


      _.remove(registrosRanking, function (item) {
        return desafios.filter(desafio => desafio._id == item.desafio).length == 0;
      });

      this.logger.log(`RegistrosRankingNovo ${JSON.stringify(registrosRanking)}`);

      const resultado =
        _(registrosRanking)
          .groupBy('jogador')
          .map((items, key) => ({
            'jogador': key,
            'historico': _.countBy(items, 'evento'),
            'pontos': _.sumBy(items, 'pontos')
          }))
          .value();




      const resultadoOrdenado = _.orderBy(resultado, 'pontos', 'desc');
      this.logger.log(`resultadoOrdenado ${JSON.stringify(resultadoOrdenado)}`);

      const rankingResponseList: RankingResponse[] = []

      resultadoOrdenado.map(function (item, index) {

        const rankingResponse: RankingResponse = {}
        rankingResponse.jogador = item.jogador;
        rankingResponse.posicao = index + 1;
        rankingResponse.pontuacao = item.pontos;

        const historico: Historico = {}

        historico.vitorias = item.historico.VITORIA ? item.historico.VITORIA : 0;
        historico.derrotas = item.historico.DERROTA ? item.historico.DERROTA : 0;

        rankingResponse.historicoPartidas = historico

        rankingResponseList.push(rankingResponse);
      })

      return rankingResponseList;

    } catch (error) {
      this.logger.error(`Error: ${JSON.stringify(error.message)}`);

      throw new RpcException(error.message);
    }
  }
}
