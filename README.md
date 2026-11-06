# Revisões para Concursos (PWA)

App de estudos em **Vue 3** (Composition API) + Vite + Vue Router + Pinia + Tailwind CSS + IndexedDB.
Registra o que foi estudado e organiza automaticamente revisões diárias (D+1) e semanais (a cada 5 dias estudados), caderno de erros e flashcards. Sem backend: tudo fica no navegador.

## Instalação e execução

```bash
npm install
npm run dev        # desenvolvimento
npm test           # testes (lógica de revisão, IndexedDB, backup)
npm run build      # build de produção
npm run preview    # serve o build (necessário para testar PWA/offline)
```

## PWA e offline
O Service Worker só é gerado no build. Rode `npm run build && npm run preview`, ou publique `dist/` em hospedagem estática com HTTPS, e use "Instalar app / Adicionar à tela inicial". Após o primeiro carregamento, o app funciona offline.

## Regras de revisão
- **Diária (D+1):** cada dia com ao menos um registro gera uma revisão disponível a partir do dia seguinte, com os assuntos e questões daquele dia. Vários registros no mesmo dia = um dia estudado.
- **Semanal:** a cada 5 dias estudados (só dias com registro) é liberada uma revisão com as questões do ciclo; depois começa um novo ciclo.
- Revisões atrasadas continuam pendentes (marcadas como atrasadas); concluídas não são duplicadas.
- Flashcards têm repetição espaçada própria: errou = revisar no dia seguinte; acertou = intervalo cresce.

## Flashcards: revisão programada × estudo livre
- **Revisão programada** (`/flashcards/estudar`): cartões vencidos pela repetição espaçada.
- **Estudar flashcards** (`/flashcards/livre`): estudo livre, a qualquer hora e quantas vezes quiser, com qualquer conjunto de cartões (pendentes ou não).
  - Filtros combináveis: matéria, assunto, domínio, desempenho (maior/menor taxa de erros, maior taxa de acertos), histórico (mais errados, erros recentes — últimos 14 dias —, mais revisados) e data de cadastro. Filtros de desempenho/histórico usam só cartões com respostas registradas.
  - Atalhos: todos, só os que erro, só não dominados, só nunca revisados, mais difíceis, aleatório. Escolha 10/20/30/50 cartões ou todos; é possível encerrar a sessão a qualquer momento.
- Cada cartão guarda o próprio histórico (`history`): revisões, acertos, erros, taxas de acerto/erro (calculadas do histórico real), última revisão, próxima sugerida e nível.
- Estudo livre atualiza o histórico e a repetição espaçada do cartão, mas **nunca** conclui nem altera revisões diárias/semanais do caderno de erros.

## Backup
Em **Ajustes**: exportar/importar JSON com todos os dados.

## Estrutura
`src/components`, `src/views`, `src/stores` (Pinia), `src/services` (motores de revisão, flashcards, estatísticas e backup, sem UI), `src/database` (IndexedDB), `src/router`, `src/composables`, `src/utils`, `src/assets`, `tests`.
