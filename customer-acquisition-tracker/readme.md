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
