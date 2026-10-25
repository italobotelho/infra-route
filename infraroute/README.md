# InfraRoute

```
npm install
npm run dev
```

Rotas: `/cadastro` · `/projetos` · `/workspace`

## Estrutura
```
infraroute/
├─ index.html
├─ package.json · vite.config.js · tailwind.config.js · postcss.config.js
├─ public/favicon.svg
└─ src/
   ├─ main.jsx            # entrada (importa index.css)
   ├─ App.jsx             # rotas (react-router-dom)
   ├─ index.css           # Tailwind + variáveis de cor (global, uma única vez)
   ├─ components/         # componentes compartilhados entre telas (vazio por enquanto)
   └─ pages/
      ├─ Cadastro/        # index.jsx · validators.js · cadastro.css (escopado em .cadastro)
      ├─ Projetos/        # index.jsx · components/ (CurrentProjects, Sidebar, icons/) · assets/
      └─ Workspace/       # index.jsx (mapa GIS) · assets/
```
Os SVGs em `assets/` são **placeholders**: troque pelos originais mantendo os nomes.
