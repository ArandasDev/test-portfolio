# Portfólio

Portfólio pessoal mobile-first, com foco em animações, construído em **HTML, CSS e JavaScript puro** — sem build, sem dependências.

## Estrutura

```
.
├── index.html          # marcação + conteúdo (procure por 🔧 TROCAR)
├── css/
│   ├── reset.css       # reset enxuto
│   ├── tokens.css      # design tokens (cores, tipografia, espaço) — mude aqui pra trocar o visual
│   ├── animations.css  # keyframes + reveals (respeita prefers-reduced-motion)
│   └── style.css       # estilos das seções (mobile-first)
└── js/
    └── main.js         # preloader, reveals, cursor, nav, contadores, parallax
```

## Como rodar

Por usar fontes externas e `IntersectionObserver`, sirva por HTTP local:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Onde editar o conteúdo

Todos os pontos a personalizar estão marcados no `index.html` com o comentário `🔧 TROCAR`:
nome, bio, projetos, números, links sociais e e-mail.

## Princípios

- **Mobile-first:** estilos base são mobile; breakpoints crescem para cima.
- **Acessibilidade:** animações desligam com `prefers-reduced-motion`; foco visível; nav semântica.
- **Performance:** zero dependências, animações via `transform`/`opacity`, `IntersectionObserver` para reveals.
