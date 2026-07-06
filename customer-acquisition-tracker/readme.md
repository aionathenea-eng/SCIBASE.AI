# Captação de Clientes

App para medir a captação de clientes: regista os contactos feitos, marca os que
**resultaram** (ganhos) e os que **não resultaram** (perdidos), e vê as métricas
de conversão. Os dados ficam num **servidor com base de dados**, por isso são
partilhados entre utilizadores e dispositivos.

## Arquitetura

- **Backend** — Node.js + Express, API REST em `server.js`.
- **Base de dados** — SQLite (ficheiro `data.db`), via `better-sqlite3`. Sem
  serviços externos.
- **Frontend** — `public/index.html` (HTML/CSS/JS puro), servido pelo backend.
  Fala com a API; se o servidor não estiver acessível entra em **modo offline**
  e guarda no navegador (`localStorage`) até voltar a haver ligação.

## Como correr

```bash
cd customer-acquisition-tracker
npm install
npm start
```

Depois abre **http://localhost:3000** no navegador. Para partilhar na equipa,
corre o servidor numa máquina/servidor acessível na rede e todos usam o mesmo
endereço — os dados são partilhados.

Variáveis de ambiente opcionais:

- `PORT` — porta (por omissão `3000`).
- `DB_PATH` — caminho do ficheiro da base de dados (por omissão `data.db` na pasta da app).

## Pôr online (usar no telemóvel)

Para usar a app no telemóvel, ela tem de estar acessível por um **link**. A forma
mais fácil é publicá-la na [Render](https://render.com):

1. Cria uma conta grátis na Render e liga a tua conta do GitHub.
2. **New → Blueprint** e escolhe este repositório. A Render lê o `render.yaml`
   e cria o serviço automaticamente.
   (Em alternativa: **New → Web Service**, escolhe o repositório, define
   *Root Directory* = `customer-acquisition-tracker`, *Build* = `npm install`,
   *Start* = `npm start`.)
3. Ao terminar, a Render dá um endereço tipo
   `https://captacao-clientes.onrender.com`.
4. Abre esse link no telemóvel. No Android (Chrome) usa **⋮ → Adicionar ao ecrã
   principal**; no iPhone (Safari) usa **Partilhar → Adicionar ao ecrã principal**.
   Fica com um ícone como se fosse uma app.

Como toda a gente abre o mesmo link, os contactos são **partilhados** — o que ela
adiciona no telemóvel aparece para ti, e vice-versa.

> **Dados permanentes:** o `render.yaml` já inclui um disco persistente (plano
> `starter`), por isso os contactos não se perdem. O plano `free` serve para
> testar, mas pode apagar os dados nos reinícios — para uso a sério, mantém o
> disco.

## Funcionalidades

- **Registo de contactos** — nome/empresa, canal (Email, Telefone, LinkedIn,
  Referência, Evento, Website, Outro), data, valor potencial e notas.
- **Estado** — Pendente, Ganho (resultou) ou Perdido (não resultou), editável
  diretamente na tabela.
- **Métricas** — total, ganhos, perdidos, pendentes e **taxa de conversão**
  (ganhos ÷ contactos fechados).
- **Funil de conversão** e **desempenho por canal**.
- **Valor** — total ganho e valor em pipeline (pendentes).
- **Pesquisa e filtros** por estado e canal.
- **Exportar CSV**, **backup JSON** e **importar**.

## API REST

| Método | Rota                     | Descrição                          |
|--------|--------------------------|------------------------------------|
| GET    | `/api/contacts`          | Lista todos os contactos           |
| POST   | `/api/contacts`          | Cria um contacto                   |
| PATCH  | `/api/contacts/:id`      | Atualiza um contacto (parcial)     |
| DELETE | `/api/contacts/:id`      | Elimina um contacto                |
| POST   | `/api/contacts/import`   | Importa uma lista de contactos     |

Campos de um contacto: `name` (obrigatório), `channel`, `date`, `status`
(`pending` | `won` | `lost`), `value`, `notes`.

## Notas

- O ficheiro `data.db` guarda todos os dados — faz cópias de segurança e/ou usa
  o **backup JSON** da interface.
- `node_modules/` e `data.db` estão no `.gitignore`.
