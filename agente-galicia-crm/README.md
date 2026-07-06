# Agente Galicia CRM

CRM de contactos para o André e a Cristina, com API simples para o Codex
consultar/atualizar contactos. Node.js + Express + SQLite, sem dependências
externas pagas.

- **UI** em espanhol, mobile-first (pensada para uso no telemóvel).
- **Login por sessão** (André / Cristina) para as pessoas.
- **API com Bearer token** para integrações (Codex).
- **Dados persistentes** em SQLite num único ficheiro.

Este documento é o **runbook completo** para instalar na VPS `athenea-vps`.
Todos os comandos abaixo correm-se **na VPS, por SSH** — esta app não tem
acesso direto à VPS a partir daqui.

---

## 0. Antes de começar

- **Não mexer** em DoNotAct, botpolymarket ou outros serviços já a correr.
- Confirmar que a porta `8790` continua livre: `sudo ss -tlnp | grep 8790`
  (deve devolver vazio).
- Confirmar quem serve as portas 80/443 antes de tocar em nginx/caddy:
  `sudo ss -tlnp | grep -E ':80|:443'`. Se estiver ocupado por docker-proxy
  (como indicado), **não mexer** — usar Cloudflare Tunnel (ver secção 6).

## 1. Criar diretórios e utilizador de serviço

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin agente-galicia-crm

sudo mkdir -p /opt/agente-galicia-crm
sudo mkdir -p /mnt/donotact-data/agente-galicia-crm/data
sudo mkdir -p /mnt/donotact-data/agente-galicia-crm/backups
sudo mkdir -p /var/log/agente-galicia-crm
sudo mkdir -p /etc/agente-galicia-crm

sudo chown -R agente-galicia-crm:agente-galicia-crm \
  /mnt/donotact-data/agente-galicia-crm \
  /var/log/agente-galicia-crm
```

## 2. Subir o código

A pasta deste projeto no repositório (`agente-galicia-crm/`) corresponde a
`/opt/agente-galicia-crm/app` na VPS. Por exemplo, clonando o repositório
diretamente na VPS:

```bash
sudo git clone <url-do-repo-scibase.ai> /opt/agente-galicia-crm/src
sudo ln -s /opt/agente-galicia-crm/src/agente-galicia-crm /opt/agente-galicia-crm/app
cd /opt/agente-galicia-crm/app
sudo npm install --omit=dev
```

(Ou copia por `rsync`/`scp` apenas a pasta `agente-galicia-crm/` para
`/opt/agente-galicia-crm/app` — o que preferires.)

## 3. Configurar o `.env`

```bash
sudo cp /opt/agente-galicia-crm/app/.env.example /etc/agente-galicia-crm/.env
sudo chmod 600 /etc/agente-galicia-crm/.env
sudo chown agente-galicia-crm:agente-galicia-crm /etc/agente-galicia-crm/.env
```

Gerar os segredos **na própria VPS** (nunca colar segredos numa conversa ou commit):

```bash
openssl rand -hex 32   # usar para CRM_API_TOKEN
openssl rand -hex 32   # usar para SESSION_SECRET

cd /opt/agente-galicia-crm/app
npm run hash-password -- "a-password-do-andre"      # dá ANDRE_PASSWORD_SALT / _HASH
npm run hash-password -- "a-password-da-cristina"   # dá CRISTINA_PASSWORD_SALT / _HASH
```

Editar `/etc/agente-galicia-crm/.env` e preencher todos os valores (ver
`.env.example` para a lista completa de campos).

## 4. Systemd

```bash
sudo cp /opt/agente-galicia-crm/app/deploy/agente-galicia-crm.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable agente-galicia-crm
sudo systemctl start agente-galicia-crm
sudo systemctl status agente-galicia-crm
```

Logs:

```bash
sudo journalctl -u agente-galicia-crm -f
tail -f /var/log/agente-galicia-crm/app.log
```

## 5. Testar localmente na VPS

```bash
curl http://127.0.0.1:8790/api/health
# {"status":"ok","time":"..."}

curl -H "Authorization: Bearer <CRM_API_TOKEN>" http://127.0.0.1:8790/api/contacts
# []
```

Se isto funcionar, a app está operacional — falta só expor ao exterior.

## 6. Expor `crm.agentegalicia.com` sem tocar no proxy existente

Como as portas 80/443 já estão ocupadas por docker-proxy, a forma mais segura
é usar **Cloudflare Tunnel** (não expõe a porta 8790 diretamente à internet):

```bash
# Se ainda não existir um túnel:
cloudflared tunnel login
cloudflared tunnel create agente-galicia-crm

sudo mkdir -p /etc/cloudflared
sudo cp /opt/agente-galicia-crm/app/deploy/cloudflared-config.example.yml /etc/cloudflared/config.yml
# editar /etc/cloudflared/config.yml com o ID do túnel gerado acima

cloudflared tunnel route dns agente-galicia-crm crm.agentegalicia.com
sudo systemctl enable --now cloudflared
```

Depois disto, `https://crm.agentegalicia.com` deve responder.

## 7. Backups

O script `deploy/backup.sh` faz uma cópia da base de dados para
`/mnt/donotact-data/agente-galicia-crm/backups/` e mantém os últimos 30.
Agendar via cron do utilizador de serviço:

```bash
sudo -u agente-galicia-crm crontab -e
# adicionar:
0 3 * * * /opt/agente-galicia-crm/app/deploy/backup.sh
```

## 8. Usar no telemóvel

Abrir `https://crm.agentegalicia.com` no telemóvel do André/Cristina e
**adicionar ao ecrã principal** (Android: menu ⋮ · iPhone: Partilhar →
Adicionar ao ecrã principal). Cada um faz login com o seu utilizador.

---

## Arquitetura

- `server.js` — Express, rotas da API e ficheiros estáticos.
- `db.js` — schema SQLite (`contacts`, `interactions`).
- `auth.js` — login por sessão (scrypt) + verificação de Bearer token.
- `public/` — frontend (HTML/CSS/JS puro, sem build step): `login.html`,
  `index.html` (shell da SPA) e `app.js` (router + views).
- `scripts/hash-password.mjs` — gera hash+salt de uma password (correr na VPS).
- `deploy/` — unit systemd, exemplo de config do Cloudflare Tunnel e script de backup.

## API REST

Todas as rotas `/api/*` (exceto `/api/health` e `/api/login`) exigem
autenticação: sessão de browser **ou** `Authorization: Bearer <CRM_API_TOKEN>`.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check (público) |
| POST | `/api/login` | `{ username, password }` → sessão |
| POST | `/api/logout` | Termina a sessão |
| GET | `/api/me` | Utilizador autenticado |
| GET | `/api/contacts` | Lista, com filtros `status`, `owner`, `channel`, `q` |
| GET | `/api/contacts/:id` | Um contacto |
| POST | `/api/contacts` | Cria contacto |
| PATCH | `/api/contacts/:id` | Atualiza (parcial) |
| GET | `/api/contacts/:id/interactions` | Histórico de interações |
| POST | `/api/contacts/:id/interactions` | Regista interação |
| GET | `/api/export/contacts.csv` | Exporta CSV |

### Campos de `contacts`

`business_name` (obrigatório), `sector`, `contact_name`, `mobile`, `email`,
`channel` (`whatsapp`\|`email`\|`llamada`\|`otro`), `owner` (`andre`\|`cristina`),
`status` (`pendiente`\|`enviado`\|`respondio`\|`interesado`\|`demo_agendada`\|`no_interesado`\|`cliente`),
`source`, `source_url`, `last_message`, `next_action`, `next_action_at`, `notes`.

### Campos de `interactions`

`contact_id`, `direction` (`outbound`\|`inbound`), `channel`
(`whatsapp`\|`email`\|`llamada`), `message`, `outcome`.

### Exemplo (Codex)

```bash
curl -H "Authorization: Bearer $CRM_API_TOKEN" \
  "https://crm.agentegalicia.com/api/contacts?status=pendiente&owner=cristina"

curl -X PATCH -H "Authorization: Bearer $CRM_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"interesado"}' \
  "https://crm.agentegalicia.com/api/contacts/<id>"
```

## Desenvolvimento local

```bash
cd agente-galicia-crm
npm install
cp .env.example .env   # preencher com valores de teste
export $(cat .env | xargs)
npm start
```

Abrir `http://127.0.0.1:8790`.

## Notas de segurança

- Passwords guardadas com `scrypt` (salt + hash), nunca em texto simples.
- Token da API comparado com `timingSafeEqual` (evita timing attacks).
- Cookies de sessão `httpOnly`, `sameSite=lax`, `secure` em produção.
- `.env` nunca vai para o repositório (`.gitignore`) — só existe em
  `/etc/agente-galicia-crm/.env` na VPS, com permissões `600`.
- O serviço systemd corre com utilizador dedicado sem privilégios e
  `ProtectSystem=strict` — só pode escrever no seu volume de dados e logs.
