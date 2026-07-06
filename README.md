# Mythralis

Sistema privado de gestão de inteligência, mídia e vigilância com interface **cyberpunk monocromática** premium.

> **NODE.MYTHRALIS // v3.6 — OPERATIONAL**

---

## 📋 O que é

**Mythralis** é uma aplicação web completa para gerenciar dossiês de alvos (targets) com:

- Dados pessoais completos (CPF, RG, endereço, telefone, veículo, etc.)
- Galeria privada de fotos e vídeos com lightbox
- Mapa de vigilância 2D (Google Maps embed por target)
- Globo tático 3D interativo (Globe.gl + Three.js) com fronteiras estaduais
- Dashboard com radar, estatísticas e busca no registro de saúde SISReg III
- Sistema de login multi-usuário com convites
- Painel administrativo para gestão de usuários
- Exportação ZIP/TXT/PDF de dossiês
- Relatórios PDF táticos com foto do target e galeria de fotos
- Dark/Light mode com transição suave
- Backend PHP para persistência de dados em servidor

---

## 🚀 Como usar

### Opção 1: Servidor PHP (Produção)
Upload da pasta `gallery/` para um servidor Apache com PHP + cURL habilitado.

Acesse via navegador:
```
https://seu-dominio.com
```

### Opção 2: Node.js (Local)
```bash
cd tpn/
node server.js
```
Acesse: `http://127.0.0.1:3000`

### Login
- **Usuário:** `admin`
- **Senha:** Definida no primeiro deploy (hash bcrypt-like interno)
- Novos usuários se registram com **código de convite** gerado pelo admin

---

## 📁 Estrutura do projeto

```
tpn/
├── gallery/
│   ├── index.html          # Interface principal (SPA)
│   ├── style.css           # Design system monocromático (~2200 linhas)
│   ├── app.js              # Lógica completa (~2100 linhas)
│   ├── accounts.js         # Sistema de autenticação + IndexedDB
│   ├── api.php             # Backend API REST (PHP)
│   ├── config.php          # Credenciais externas (SISReg III)
│   ├── .htaccess           # Rotas + proteção de config
│   ├── jszip.min.js        # Biblioteca para gerar ZIPs
│   └── database/           # Dados persistidos (JSON files)
│       ├── people/         # Dossiês de targets
│       ├── media/          # Metadados de mídia
│       ├── media_files/    # Arquivos de mídia (binários)
│       ├── users/          # Contas de usuários
│       ├── invites/        # Códigos de convite
│       └── rate_limit/     # Rate limiting por IP
├── server.js               # Servidor Node.js local (alternativo)
├── icon.png                # Ícone do sistema
└── README.md               # Este arquivo
```

---

## 🎯 Funcionalidades

### 🏠 Dashboard Home
- Header com identificação do sistema
- **Radar tático animado** com sweep e crosshair
- **Estatísticas em tempo real** (targets ativos, arquivos encriptados)
- **Busca SISReg III** — consulta ao registro nacional de saúde via proxy PHP

### 🌍 Globo Tático 3D
- Globe.gl + Three.js renderizado em tempo real
- Fronteiras estaduais brasileiras (GeoJSON)
- Referência de cidades capitais
- Pinos de localização de targets
- Toggle de camadas (bordas estaduais, cidades)
- Navegação automática para target selecionado
- Otimizado com `destroyGlobe()` para evitar memory leaks

### 👤 Cadastro de Target
| Campo | Descrição |
|-------|-----------|
| Nome completo | Nome e sobrenome |
| Nick/Alias | Apelido |
| CPF / RG | Documentos |
| Nascimento / Sexo | Dados pessoais |
| Mãe / Pai | Filiação |
| Telefones (2) | Principal + secundário |
| Email / Redes sociais | Contatos digitais |
| Endereço completo | Rua, bairro, CEP, cidade, estado |
| Placa / Veículo | Dados do veículo |
| Coordenadas GPS | Latitude e longitude para mapa |
| Observações | Notas adicionais |
| Avatar | Foto de perfil do target |

### 📷 Mídia
- **Fotos:** JPG, PNG, WEBP, GIF
- **Vídeos:** MP4, WEBM, MOV (conversão automática), AVI, MKV
- Upload múltiplo
- Lightbox com navegação por setas (← →)
- Grid de thumbnails com contagem
- Exclusão individual

### 🔍 Busca Local
Busca instantânea no sidebar por:
- Nome, Nick, CPF, RG, Telefone, Placa, Email, Cidade

### 🔍 Busca SISReg III (Health Registry)
- Widget no dashboard home
- Proxy server-side via PHP (credenciais seguras)
- Login automático + pesquisa por CNS ou nome do paciente
- Parsing de HTML com DOMDocument/DOMXPath
- Rate limiting (3s por IP)
- Suporta cURL e file_get_contents (fallback)

### 📦 Exportação
| Tipo | Conteúdo |
|------|----------|
| TXT individual | Dossiê formatado com todos os dados |
| PDF individual | Relatório PDF tático com foto do target e galeria |
| ZIP individual | TXT + pasta PHOTOS/ + pasta VIDEOS/ |
| ZIP total | Todos os targets em subpastas (`MYTHRALIS_ALL_TARGETS.zip`) |

### 👥 Sistema de Usuários
- Login com username + password (hash SHA-256)
- Registro com código de convite (8 caracteres)
- Roles: `admin` e `user`
- Painel admin: gerenciar usuários, gerar convites, deletar contas
- Sincronização com servidor PHP

---

## 🎨 Interface

### Design System
- **Cores:** Preto puro (#000) e branco puro (#fff)
- **Accent:** `#00ffcc` (dark) / `#0055ff` (light)
- **Tipografia:** Courier New, Lucida Console, monospace
- **Bordas:** 1px solid, sem arredondamento
- **Botões:** Formato `[ TEXTO ]`
- **Labels:** UPPERCASE com letter-spacing

### Animações
- Spin-in do logo no login
- Radar sweep contínuo no dashboard
- Fade-in/slide de resultados de busca
- Spinner ring animado durante loading
- Glow pulsante na barra de busca
- Transição suave entre temas

### Dark/Light Mode
- Toggle no topo da sidebar (☀ / ☾)
- Disponível na tela de login e modais
- Preferência salva no localStorage
- Globe accent color muda por tema

---

## 🔒 Segurança

### Armazenamento
- **IndexedDB** para dados locais (cache offline)
- **PHP + JSON files** para persistência no servidor
- Arquivos de mídia salvos como binários no servidor

### Autenticação
- Senha admin customizada (não exposta no frontend)
- Hash de senhas via SHA-256
- Convites de uso único para novos usuários

### Proteção
- `config.php` bloqueado via `.htaccess` (acesso direto negado)
- Credenciais do SISReg III armazenadas apenas server-side
- Rate limiting na busca externa (3s cooldown por IP)
- `escapeHtml()` para prevenir XSS nos resultados

---

## 🔌 API REST (PHP)

Base URL: `/api/{endpoint}`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/people` | Listar todos os targets |
| POST | `/api/people` | Criar/atualizar target |
| DELETE | `/api/people?id=X` | Deletar target + mídia |
| GET | `/api/media?personId=X` | Listar mídia de um target |
| POST | `/api/media` | Upload de mídia (Base64 → binário) |
| DELETE | `/api/media?id=X` | Deletar mídia |
| GET | `/api/users` | Listar usuários |
| POST | `/api/users` | Criar/atualizar usuário |
| DELETE | `/api/users?id=X` | Deletar usuário |
| GET | `/api/invites` | Listar convites |
| POST | `/api/invites` | Criar convite |
| DELETE | `/api/invites?code=X` | Deletar convite |
| POST | `/api/search` | Busca no SISReg III (proxy) |

---

## 🛠 Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| 3D Globe | Globe.gl + Three.js (CDN) |
| Storage local | IndexedDB API |
| Backend | PHP 7.4+ com cURL |
| Compression | JSZip 3.10.1 |
| Server local | Node.js HTTP module (nativo) |
| Routing | Apache mod_rewrite (.htaccess) |
| Mapas | Google Maps Embed API |

---

## ⚙️ Configuração

### Requisitos do servidor PHP
- PHP 7.4 ou superior
- Extensão **cURL** habilitada
- `allow_url_fopen = On`
- `mod_rewrite` habilitado (Apache)
- Permissão de escrita na pasta `database/`

### Variáveis de configuração

**config.php** — Credenciais externas:
```php
define('SISREG_URL',  'https://sisregiii.saude.gov.br');
define('SISREG_USER', 'SEU_USUARIO');
define('SISREG_PASS', 'SUA_SENHA');
define('SEARCH_RATE_LIMIT', 3); // segundos entre buscas por IP
```

---

## 🐛 Troubleshooting

| Erro | Solução |
|------|---------|
| IndexedDB não funciona | Nunca abra via `file://` — use HTTP |
| Vídeos .mov não reproduzem | Aguarde conversão automática (.mov → .webm) |
| 502 Bad Gateway na busca | Hospedagem bloqueia cURL externo — use VPS/hospedagem paga |
| Globe trava o sistema | O globe é destruído ao sair da aba — bug de memória resolvido |
| `exports is not defined` | Conflito Three.js — resolvido com CDN única |
| Login não funciona | Verifique se `api.php` está acessível e `database/users/` tem permissão |

---

## 📝 Roadmap

- [x] Sistema de login multi-usuário
- [x] Painel administrativo
- [x] Backend PHP para persistência
- [x] Globo tático 3D
- [x] Dashboard com radar
- [x] Busca SISReg III
- [x] Dark/Light mode
- [x] Exportação ZIP
- [x] Importação de dados via CSV
- [x] Geração de relatórios em PDF (com foto e galeria)
- [ ] Timeline de eventos por target
- [ ] Backup/restore automático
- [ ] Notificações push

---

## 📄 Licença

Projeto privado de uso pessoal.

---

## 👤 Sobre

**Mythralis** — Private Intelligence & Surveillance System  
Status: **ONLINE** // **OPERATIONAL**

```
// NODE.MYTHRALIS.SEC.SYS
// CLEARANCE: OVERLORD
// END OF DOCUMENTATION
==========================================================
```
