# Captação de Clientes

App simples para medir a captação de clientes: regista os contactos feitos, marca
os que **resultaram** (ganhos) e os que **não resultaram** (perdidos), e vê as
métricas de conversão.

## Como usar

Abre o ficheiro `index.html` no navegador (duplo-clique). Não precisa de servidor,
instalação nem internet.

## O que faz

- **Registar contactos** — nome/empresa, canal (Email, Telefone, LinkedIn,
  Referência, Evento, Website, Outro), data, valor potencial e notas.
- **Estado** — Pendente, Ganho (resultou) ou Perdido (não resultou). Podes mudar
  o estado diretamente na tabela.
- **Métricas** — total de contactos, ganhos, perdidos, pendentes e **taxa de
  conversão** (ganhos ÷ contactos fechados).
- **Funil de conversão** e **desempenho por canal** (qual canal converte melhor).
- **Valor** — total ganho e valor em pipeline (pendentes).
- **Pesquisa e filtros** por estado e canal.
- **Exportar CSV**, **backup JSON** e **importar** para levar os dados para outro
  computador.

## Dados

Os dados são guardados localmente no navegador (`localStorage`). Ficam apenas no
teu computador. Faz **backup JSON** com regularidade — limpar os dados do
navegador apaga os contactos.
