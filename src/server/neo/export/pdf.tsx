import "server-only";
import * as React from "react";
import { Document, Page, View, Text, Image, Link, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import type { NeoAnswer, NeoBloco } from "@/lib/neo/answer";
import { translateEvidenciaMatrizClassificacao, translateLacunaTipo, translateNeoAnswerStatus, translateNivelEvidencia } from "@/lib/ui/status-labels";

// Disable hyphenation so pt-BR words aren't awkwardly broken mid-syllable.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 48, paddingHorizontal: 40, fontSize: 10, color: "#0f172a" },
  headerBrand: { fontSize: 9, color: "#64748b", marginBottom: 2 },
  statusPill: { fontSize: 8, color: "#1d4ed8", marginBottom: 4, textTransform: "uppercase" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  metaLine: { fontSize: 8, color: "#64748b", marginBottom: 2 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#1d4ed8" },
  paragraph: { fontSize: 10, lineHeight: 1.5, marginBottom: 4 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletMark: { width: 10 },
  bulletText: { flex: 1, lineHeight: 1.4 },
  indicadorRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  indicadorCard: { width: "33%", paddingRight: 8, marginBottom: 6 },
  indicadorLabel: { fontSize: 8, color: "#64748b" },
  indicadorValor: { fontSize: 12, fontWeight: 700 },
  achadoRow: { marginBottom: 6 },
  achadoConclusao: { fontSize: 10, fontWeight: 700 },
  achadoExplicacao: { fontSize: 9, color: "#334155", marginTop: 1 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#cbd5e1", paddingVertical: 3 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#0f172a", paddingVertical: 3 },
  tableCell: { flex: 1, fontSize: 9, paddingRight: 4 },
  tableHeaderCell: { flex: 1, fontSize: 9, fontWeight: 700, paddingRight: 4 },
  alert: { backgroundColor: "#fef3c7", padding: 6, borderRadius: 3, marginBottom: 4, fontSize: 9 },
  image: { maxWidth: 240, maxHeight: 180, marginBottom: 4 },
  caption: { fontSize: 8, color: "#64748b", marginBottom: 6 },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 8, color: "#94a3b8", flexDirection: "row", justifyContent: "space-between" },
  disclaimer: { fontSize: 7.5, color: "#94a3b8", lineHeight: 1.4 },
  fixedHeader: { position: "absolute", top: 20, left: 40, right: 40, fontSize: 8, color: "#94a3b8" },
});

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function isValidHttpImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function SafePdfImage({ url }: { url: string | null }) {
  if (!url || !isValidHttpImageUrl(url)) return null;
  // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop; this isn't an HTML <img>
  return <Image style={styles.image} src={url} />;
}

function BlocoView({ bloco }: { bloco: NeoBloco }) {
  switch (bloco.tipo) {
    case "texto":
      return (
        <View style={styles.section}>
          {bloco.titulo ? <SectionTitle>{bloco.titulo}</SectionTitle> : null}
          <Text style={styles.paragraph}>{bloco.conteudo}</Text>
        </View>
      );
    case "fatos":
      return (
        <View style={styles.section}>
          {bloco.titulo ? <SectionTitle>{bloco.titulo}</SectionTitle> : null}
          {bloco.itens.map((f, i) => (
            <Bullet key={i}>
              {f.rotulo}: {f.valor} ({translateNivelEvidencia(f.nivelEvidencia)}
              {f.dataObservacao ? `, observado em ${f.dataObservacao}` : ""})
            </Bullet>
          ))}
        </View>
      );
    case "entidade":
      return (
        <View style={styles.section}>
          <SectionTitle>{bloco.nome}</SectionTitle>
          {bloco.subtitulo ? <Text style={styles.paragraph}>{bloco.subtitulo}</Text> : null}
          {bloco.descricao ? <Text style={styles.paragraph}>{bloco.descricao}</Text> : null}
          <SafePdfImage url={bloco.imagemUrl} />
          {bloco.identificadores.map((a, i) => (
            <Bullet key={`id${i}`}>
              {a.rotulo}: {a.valor}
            </Bullet>
          ))}
          {bloco.atributos.map((a, i) => (
            <Bullet key={`a${i}`}>
              {a.rotulo}: {a.valor} ({translateNivelEvidencia(a.nivelEvidencia)})
            </Bullet>
          ))}
          {bloco.metricas.map((m, i) => (
            <Bullet key={`m${i}`}>
              {m.rotulo}: {m.valor}
            </Bullet>
          ))}
        </View>
      );
    case "pessoa":
      return (
        <View style={styles.section}>
          <SectionTitle>{bloco.nome}</SectionTitle>
          <SafePdfImage url={bloco.fotoUrl} />
          {bloco.papeis.map((p, i) => (
            <Bullet key={`p${i}`}>
              {p.classificacao} ({translateNivelEvidencia(p.nivelEvidencia)})
            </Bullet>
          ))}
          {bloco.organizacoesRelacionadas.map((o, i) => (
            <Bullet key={`o${i}`}>
              {o.nome}: {o.relacao}
            </Bullet>
          ))}
          {bloco.atributos.map((a, i) => (
            <Bullet key={`a${i}`}>
              {a.rotulo}: {a.valor} ({translateNivelEvidencia(a.nivelEvidencia)})
            </Bullet>
          ))}
        </View>
      );
    case "perfil_social":
      return (
        <View style={styles.section}>
          <SectionTitle>
            {bloco.nome}
            {bloco.arroba ? ` (${bloco.arroba})` : ""}
          </SectionTitle>
          <SafePdfImage url={bloco.fotoUrl} />
          {bloco.bio ? <Text style={styles.paragraph}>{bloco.bio}</Text> : null}
          <Bullet>
            {[
              bloco.seguidores ? `${bloco.seguidores} seguidores` : null,
              bloco.seguindo ? `${bloco.seguindo} seguindo` : null,
              bloco.publicacoes ? `${bloco.publicacoes} publicações` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </Bullet>
          {bloco.relacao ? <Text style={styles.paragraph}>{bloco.relacao}</Text> : null}
          {bloco.metricaVariavel ? <Text style={styles.caption}>Métricas variáveis, sujeitas a mudança.</Text> : null}
        </View>
      );
    case "publicacao":
      return (
        <View style={styles.section}>
          <SafePdfImage url={bloco.midiaUrl} />
          {bloco.legenda ? <Text style={styles.paragraph}>{bloco.legenda}</Text> : null}
          <Bullet>
            {[
              bloco.dataPublicacao,
              bloco.curtidas ? `${bloco.curtidas} curtidas` : null,
              bloco.comentarios ? `${bloco.comentarios} comentários` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </Bullet>
          {bloco.contexto ? <Text style={styles.paragraph}>{bloco.contexto}</Text> : null}
        </View>
      );
    case "metricas":
      return (
        <View style={styles.section}>
          {bloco.titulo ? <SectionTitle>{bloco.titulo}</SectionTitle> : null}
          {bloco.itens.map((m, i) => (
            <Bullet key={i}>
              {m.rotulo}: {m.valor}
              {m.unidade ? ` ${m.unidade}` : ""}
              {m.dataObservacao ? ` (observado em ${m.dataObservacao})` : ""}
            </Bullet>
          ))}
        </View>
      );
    case "imagem":
      return isValidHttpImageUrl(bloco.url) ? (
        <View style={styles.section}>
          <SafePdfImage url={bloco.url} />
          {bloco.legenda ? <Text style={styles.caption}>{bloco.legenda}</Text> : null}
        </View>
      ) : null;
    case "tabela":
      return (
        <View style={styles.section}>
          {bloco.titulo ? <SectionTitle>{bloco.titulo}</SectionTitle> : null}
          <View style={styles.tableHeaderRow} wrap={false}>
            {bloco.colunas.map((c, i) => (
              <Text style={styles.tableHeaderCell} key={i}>
                {c}
              </Text>
            ))}
          </View>
          {bloco.linhas.map((linha, i) => (
            <View style={styles.tableRow} key={i} wrap={false}>
              {linha.map((cell, j) => (
                <Text style={styles.tableCell} key={j}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "timeline":
      return (
        <View style={styles.section}>
          {bloco.titulo ? <SectionTitle>{bloco.titulo}</SectionTitle> : null}
          {bloco.itens.map((e, i) => (
            <Bullet key={i}>
              {e.data ? `${e.data} — ` : ""}
              {e.titulo}
              {e.descricao ? `: ${e.descricao}` : ""}
            </Bullet>
          ))}
        </View>
      );
    case "relacoes":
      return (
        <View style={styles.section}>
          {bloco.titulo ? <SectionTitle>{bloco.titulo}</SectionTitle> : null}
          {bloco.itens.map((r, i) => (
            <Bullet key={i}>
              {r.origem} → {r.relacao} → {r.destino}
            </Bullet>
          ))}
        </View>
      );
    case "alerta":
      return (
        <View style={styles.section}>
          <Text style={styles.alert}>{bloco.mensagem}</Text>
        </View>
      );
    default:
      return null;
  }
}

export interface NeoAnswerPdfMeta {
  perguntaOriginal: string;
  usuarioNome: string;
  geradoEm: string;
}

function NeoAnswerDocument({ answer, meta }: { answer: NeoAnswer; meta: NeoAnswerPdfMeta }) {
  return (
    <Document title={answer.titulo} author="Triad3 Search">
      <Page size="A4" style={styles.page}>
        <Text style={styles.fixedHeader} fixed>
          Triad3 Search — Neo
        </Text>
        <Text style={styles.headerBrand}>Triad3 Search — Relatório de inteligência do Neo</Text>
        <Text style={styles.statusPill}>{translateNeoAnswerStatus(answer.status)}</Text>
        <Text style={styles.title}>{answer.titulo}</Text>
        {answer.objetivo ? <Text style={styles.metaLine}>{answer.objetivo}</Text> : null}
        <Text style={styles.metaLine}>Pergunta original: {meta.perguntaOriginal}</Text>
        <Text style={styles.metaLine}>Gerado em: {meta.geradoEm}</Text>
        <Text style={styles.metaLine}>Usuário responsável: {meta.usuarioNome}</Text>
        <Text style={styles.metaLine}>Fontes consultadas: {answer.fontes.length}</Text>

        {answer.indicadoresPrincipais.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>Resposta executiva</SectionTitle>
            <View style={styles.indicadorRow}>
              {answer.indicadoresPrincipais.slice(0, 3).map((ind, i) => (
                <View style={styles.indicadorCard} key={i}>
                  <Text style={styles.indicadorLabel}>{ind.rotulo}</Text>
                  <Text style={styles.indicadorValor}>{ind.valor}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {answer.achados.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>O que a investigação encontrou</SectionTitle>
            {answer.achados.map((a, i) => (
              <View style={styles.achadoRow} key={i} wrap={false}>
                <Text style={styles.achadoConclusao}>
                  {i + 1}. {a.conclusao} ({translateNivelEvidencia(a.nivelEvidencia)})
                </Text>
                {a.explicacao ? <Text style={styles.achadoExplicacao}>{a.explicacao}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {answer.respostaDireta ? (
          <View style={styles.section}>
            <SectionTitle>Resposta do Neo</SectionTitle>
            <Text style={styles.paragraph}>{answer.respostaDireta}</Text>
          </View>
        ) : null}

        {answer.blocos.map((bloco, i) => (
          <BlocoView bloco={bloco} key={i} />
        ))}

        {answer.lacunas.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>O que ainda merece apuração</SectionTitle>
            {answer.lacunas.map((l, i) => (
              <Bullet key={i}>
                {translateLacunaTipo(l.tipo)}: {l.descricao}
              </Bullet>
            ))}
          </View>
        ) : null}

        {answer.matrizEvidencias.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>Como cada conclusão foi sustentada</SectionTitle>
            <View style={styles.tableHeaderRow} wrap={false}>
              <Text style={styles.tableHeaderCell}>Conclusão</Text>
              <Text style={styles.tableHeaderCell}>Evidência</Text>
              <Text style={styles.tableHeaderCell}>Classificação</Text>
            </View>
            {answer.matrizEvidencias.map((m, i) => (
              <View style={styles.tableRow} key={i} wrap={false}>
                <Text style={styles.tableCell}>{m.conclusao}</Text>
                <Text style={styles.tableCell}>{m.evidencia}</Text>
                <Text style={styles.tableCell}>{translateEvidenciaMatrizClassificacao(m.classificacao)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {answer.observacoes.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>Observações</SectionTitle>
            {answer.observacoes.map((o, i) => (
              <Bullet key={i}>{o}</Bullet>
            ))}
          </View>
        ) : null}

        {answer.fontes.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>Fontes consultadas</SectionTitle>
            {answer.fontes.map((f, i) => (
              <Bullet key={i}>
                <Link src={f.url}>{f.titulo ?? f.url}</Link>
              </Bullet>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.disclaimer}>Os dados representam o momento da consulta e podem ter mudado desde então.</Text>
          <Text style={styles.disclaimer}>Informações sensíveis ou de natureza formal devem ser validadas antes de qualquer uso oficial.</Text>
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages} — gerado em ${meta.geradoEm}`}
        />
      </Page>
    </Document>
  );
}

export async function renderNeoAnswerPdf(answer: NeoAnswer, meta: NeoAnswerPdfMeta): Promise<Buffer> {
  return renderToBuffer(<NeoAnswerDocument answer={answer} meta={meta} />);
}
