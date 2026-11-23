# Revisões para Concursos (PWA) — Central de produtividade e estudos

App de estudos em **Vue 3** (Composition API) + Vite + Vue Router + Pinia + Tailwind CSS + IndexedDB.
Registra o que foi estudado e organiza automaticamente revisões diárias (D+1) e semanais (a cada N dias estudados, padrão 5), caderno de erros e flashcards. Além das revisões, reúne ofensiva (heatmap), calendário, hábitos, tarefas, anotações e o módulo **Meu Concurso** (edital, ciclo, estatísticas, desempenho). Sem backend: tudo fica no navegador e funciona offline.

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
- **Semanal:** a cada N dias estudados (só dias com registro; vários registros no mesmo dia = 1) é liberada uma revisão com as questões do ciclo; depois começa um novo ciclo. N é configurável (veja abaixo).
- Revisões atrasadas continuam pendentes (marcadas como atrasadas); concluídas não são duplicadas.
- Flashcards têm repetição espaçada própria: errou = revisar no dia seguinte; acertou = intervalo cresce.

## Flashcards: revisão programada × estudo livre
- **Revisão programada** (`/flashcards/estudar`): cartões vencidos pela repetição espaçada.
- **Estudar flashcards** (`/flashcards/livre`): estudo livre, a qualquer hora e quantas vezes quiser, com qualquer conjunto de cartões (pendentes ou não).
  - Filtros combináveis: matéria, assunto, domínio, desempenho (maior/menor taxa de erros, maior taxa de acertos), histórico (mais errados, erros recentes — últimos 14 dias —, mais revisados) e data de cadastro. Filtros de desempenho/histórico usam só cartões com respostas registradas.
  - Atalhos: todos, só os que erro, só não dominados, só nunca revisados, mais difíceis, aleatório. Escolha 10/20/30/50 cartões ou todos; é possível encerrar a sessão a qualquer momento.
- Cada cartão guarda o próprio histórico (`history`): revisões, acertos, erros, taxas de acerto/erro (calculadas do histórico real), última revisão, próxima sugerida e nível.
- Estudo livre atualiza o histórico e a repetição espaçada do cartão, mas **nunca** conclui nem altera revisões diárias/semanais do caderno de erros.

## Simulados
Módulo independente das revisões, integrado ao Dashboard e às Estatísticas (menu **Simulados**).
- **Cadastro manual** (nome, data, concurso/banca/observações opcionais) com várias matérias por simulado; cada matéria tem total, acertos, erros e em branco (opcional: se omitido, é calculado; se informado, precisa fechar com o total). Matérias ausentes em um simulado não contam como zero.
- **Histórico** (filtros por nome, período, concurso, banca e simulados específicos; ver detalhes, editar e excluir), **Evolução** geral (gráficos de linha, média por mês, comparação entre simulados, comparação de períodos), **Matérias** (evolução individual com atual/melhor/pior/média/diferença/tendência e ranking em barras) e **Frequência**.
- **Frequência sugerida** (padrão 15 dias; 7, 10, 15, 20, 30 ou personalizada em *Ajustes*): próxima data = simulado mais recente + frequência. Na data (e depois dela) aparece um lembrete que permanece pendente até você cadastrar outro. Nunca bloqueia nem cria simulados.
- O banco passou à versão 2 (novo store `mockExams`); a atualização preserva todos os dados existentes. Backups antigos continuam compatíveis.

## Matérias e assuntos ativos/inativos
O app acompanha a preparação **atual**: em **Ajustes → Matérias e assuntos nas revisões** você ativa/desativa matérias e, dentro delas, assuntos.
- Matéria/assunto inativo **não gera nem exibe** revisões automáticas (diárias, semanais e flashcards pendentes na Central, Dashboard e contador). Nada é apagado; ao reativar, o conteúdo volta de onde estava.
- Flashcards, questões, estudos, simulados e estatísticas continuam acessíveis para consulta, busca e **estudo livre**, esteja a matéria ativa ou não.
- **Central de revisões:** filtros combináveis por matéria, assunto, tipo (diária/semanal/flashcards) e status (pendentes/concluídas/todas), mais o botão **Somente matérias ativas** (ligado por padrão).
- Revisões que só têm conteúdo inativo ficam ocultas (com aviso) e reaparecem ao reativar.

## Frequência da revisão semanal
Em **Ajustes → Frequência da revisão semanal**: 3, 4, 5, 6, 7, 8, 10 ou personalizada (1–100). Só dias estudados contam; ao atingir a meta a revisão é liberada e um novo ciclo começa. Alterar a frequência vale para o ciclo em aberto e os próximos, sem apagar histórico, sem duplicar e sem perder pendências (ex.: 5 → 7). O Dashboard mostra o progresso do ciclo e quantos dias estudados faltam.

Não há migração de banco: continua na versão 2 e matérias antigas são tratadas como ativas. Backups antigos continuam compatíveis.

## Navegação
Três áreas + histórico (sidebar no desktop, barra inferior no celular):
- **Visão geral** — dashboard personalizável (botão *Personalizar indicadores* escolhe o que aparece) e **Ofensiva**.
- **Aplicativos** — Calendário, Hábitos, Tarefas, Flashcards e Anotações.
- **Meu Concurso** — Edital, Registrar estudo, Revisões (diária/semanal), Revisão de assuntos, Caderno de erros, Ciclo de estudos, Estatísticas e Desempenho (simulados).
- **Histórico** — linha do tempo de tudo, com filtros por categoria e período; cada item abre a atividade original.

## Ofensiva e mapa de atividades (estilo GitHub)
- Heatmap anual com 5 níveis de verde, navegação entre anos e detalhe do dia (atividades, tempo, sessões, hábitos, revisões).
- **Ofensiva atual**, maior ofensiva, total de dias ativos, % de dias ativos no mês e histórico de sequências. A sequência só zera se ontem e hoje ficaram sem atividade.
- Conta: estudos, revisões (caderno e de assuntos), flashcards, sessões do ciclo, hábitos e simulados. Tarefas e anotações aparecem no histórico e podem ser incluídas na ofensiva. **Configure as categorias na tela Ofensiva.**
- Tudo é **derivado dos registros reais** (nada é copiado), então a mesma atividade nunca conta duas vezes: flashcards do dia viram 1 registro (1 unidade de intensidade a cada 10 cartões); hábito marcado/desmarcado tem um único registro por dia.
- Datas no fuso local do aparelho (um horário às 23h30 continua no mesmo dia) e atividades futuras são ignoradas.

## Aplicativos
- **Calendário:** visão mensal e semanal, eventos manuais, tarefas com data, estudos, simulados (realizados e o próximo sugerido) e revisões previstas, cada um com sua cor.
- **Hábitos:** diários ou em dias da semana; sequência, histórico (marque também dias anteriores), consistência dos últimos 30 dias e gráfico de evolução semanal. Arquivar preserva o histórico.
- **Tarefas:** prioridade, categoria, vencimento, recorrência (diária/semanal/mensal — concluir cria a próxima ocorrência uma única vez) e filtros pendentes/concluídas/atrasadas.
- **Anotações:** pastas, tags, busca, favoritos, datas de criação/atualização e vínculo com matéria e assunto.
- **Flashcards:** módulo anterior preservado integralmente (estudo livre, revisão programada, filtros, estatísticas).

## Meu Concurso
- **Edital:** concurso (nome, cargo, banca, data da prova, situação), matérias e assuntos hierárquicos (com subassuntos), status Não iniciado → Dominado e % de conclusão. Não exige cronograma. As matérias do edital são as mesmas do resto do app.
- **Ciclo de estudos (opcional):** matérias com prioridade, tempo por rodada e ordem; registre sessões; sem dias fixos. Ao completar a rodada, inicie uma nova.
- **Estatísticas:** dias, horas, questões, aproveitamento, assuntos estudados/dominados, revisões, simulados e evolução mensal, com filtro de período e matéria. (As estatísticas detalhadas anteriores continuam disponíveis.)
- **Desempenho:** simulados, evolução geral e por matéria, médias, comparações e matérias fortes/fracas, com a frequência configurável.
- **Revisão de assuntos:** marque um assunto como revisado (data + observação), consulte o histórico e veja o que precisa de atenção (nunca revisado, 14+ dias sem revisão ou questões não dominadas).
- **Revisões diárias/semanais** (frequência configurável), **matérias/assuntos ativos** e **Caderno de erros** continuam como antes.
- **Tempo de estudo:** ao registrar um estudo é possível informar os minutos (opcional). O tempo das sessões do ciclo é somado ao dos estudos; não registre o mesmo tempo nos dois lugares.

## Atualização do banco (v3) e seus dados
O banco passou à **versão 3** e a atualização apenas **adiciona** stores (hábitos, tarefas, anotações, eventos, concursos, edital, ciclo e sessões); nenhum dado existente é alterado ou apagado. Ao publicar a nova versão no mesmo endereço, seus dados são mantidos. Backups v1/v2 continuam compatíveis e o backup v3 inclui os módulos novos.

## Backup
Em **Ajustes**: exportar/importar JSON com todos os dados.

## Estrutura
`src/components`, `src/views`, `src/stores` (Pinia), `src/services` (motores de revisão, flashcards, estatísticas e backup, sem UI), `src/database` (IndexedDB), `src/router`, `src/composables`, `src/utils`, `src/assets`, `tests`.
