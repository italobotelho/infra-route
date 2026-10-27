# InfraRoute

## Executar localmente

Requisitos: Node.js 20.19+ (ou 22.12+) e Python 3.10+.

1. Abra um terminal na pasta `infraroute` e instale/inicie a API:

   ```powershell
   py -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r src\backend\requirements.txt
   npm run dev:backend
   ```

   A API fica em `http://127.0.0.1:8000`. Verifique `/health` e `/docs`.

2. Em outro terminal, na mesma pasta, instale e inicie o frontend:

   ```powershell
   npm install
   npm run dev
   ```

   O Vite encaminha `/api` e `/health` para a API local.

3. Para ativar o mapa, copie `.env.example` para `.env.local` e informe uma
   chave restrita do Google Maps JavaScript API em `VITE_GOOGLE_MAPS_API_KEY`
   (também aceita `GOOGLE_MAPS_API_KEY`). O arquivo deve ficar na pasta
   `infraroute`, ao lado de `vite.config.js`. Reinicie o Vite após alterar o env.
   O restante da aplicação funciona sem essa chave, mas o mapa não será exibido.

Rotas: `/cadastro` · `/login` · `/projetos` · `/workspace?id_projeto=<id>`

O backend usa dados de demonstração em memória: projetos, cadastros e pontos
criados são apagados ao reiniciar a API. A conta seed para testar o login é
`engenheiro@empresa.com.br` com senha `123456`. Novos cadastros ficam vinculados
à empresa de demonstração e recebem o perfil Projetista.

Para apontar o frontend a uma API remota, configure `VITE_API_BASE_URL` com a
URL base terminada em `/api` (por exemplo, `https://api.exemplo.com/api`).

## Estrutura

```text
infraroute/
├─ index.html
├─ package.json · vite.config.js · tailwind.config.js · postcss.config.js
└─ src/
   ├─ frontend/  # Aplicação React e telas
   └─ backend/   # API FastAPI: controllers, services e testes
```

Os SVGs em `assets/` são placeholders: troque pelos originais mantendo os nomes.
