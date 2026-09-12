# RedePulse — MVP / Production Readiness Checklist

## Objetivo
Levar o RedePulse ao ponto de piloto real com isolamento multi-tenant, análise de publicações do Instagram, gestão de rede, relatórios e operação administrativa confiável.

## P0 — Obrigatório antes do piloto

### Fundação
- [ ] Validar projeto Supabase real e aplicar todas as migrations.
- [ ] Comparar schema real x migrations e resolver drift.
- [ ] Gerar tipos TypeScript a partir do banco real.
- [ ] Rodar `npm run lint` e `npm run build` sem erros.
- [ ] Confirmar variáveis de ambiente sem segredos versionados.
- [ ] Revisar autenticação, callback OAuth e proteção das rotas.
- [ ] Confirmar PWA: manifest, ícones, instalação e service worker.

### Segurança / multi-tenant
- [ ] Testar líder A tentando ler/escrever rede do líder B.
- [ ] Testar líder tentando alterar `campaign_id` ou `leader_id`.
- [ ] Testar coordenador tentando acessar outra campanha.
- [ ] Testar superadmin com acesso global.
- [ ] Revisar todas as policies RLS e funções SECURITY DEFINER.
- [ ] Garantir que tokens Meta nunca chegam ao cliente.
- [ ] Sanitizar mensagens de erro externas antes de persistir/exibir.
- [ ] Auditar alterações administrativas e análises.

### Líder — Minha Rede
- [ ] Adicionar membro individual.
- [ ] Importar CSV/TXT.
- [ ] Importar XLSX de verdade.
- [ ] Pré-visualização e validação antes da importação.
- [ ] Detectar duplicados sem diferenciar maiúsculas/minúsculas.
- [ ] Editar membro.
- [ ] Ativar/inativar membro.
- [ ] Excluir membro.
- [ ] Buscar, filtrar e ordenar.
- [ ] Exibir participação/última participação por membro quando houver histórico.
- [ ] Exportar rede para XLSX.

### Líder — Análise
- [ ] Validar URL do Instagram.
- [ ] Garantir que a análise usa somente a campanha selecionada.
- [ ] Evitar análise duplicada acidental.
- [ ] Persistir estados pending/running/completed/failed.
- [ ] Resolver publicação pela API Meta.
- [ ] Buscar comentários/menções disponíveis.
- [ ] Cruzar interações com a rede ativa.
- [ ] Calcular participação corretamente.
- [ ] Exibir claramente limitações da API (não prometer lista completa de curtidas).
- [ ] Persistir métricas disponíveis da publicação.
- [ ] Exibir participantes e não identificados.
- [ ] Permitir exportação XLSX.

### Histórico / Relatórios
- [ ] Filtro por período.
- [ ] Filtro por líder para coordenador.
- [ ] Busca/ordenação/paginação quando necessário.
- [ ] Reabrir resultado de análise.
- [ ] Relatório consolidado por período.
- [ ] Aba `Resumo` no Excel.
- [ ] Uma aba por dia (`YYYY-MM-DD`).
- [ ] Consolidado por líder.
- [ ] Horário exibido em horário local do Brasil.

### Coordenador
- [ ] Dashboard da campanha.
- [ ] Cadastro/edição/ativação de líderes.
- [ ] Convite real por e-mail.
- [ ] Reenvio/revogação de convite.
- [ ] Detalhe individual do líder.
- [ ] Ranking por participação.
- [ ] Identificação de líderes sem análise/baixa participação.
- [ ] Exportação da equipe.

### Superadmin
- [ ] Dashboard global.
- [ ] CRUD de campanhas.
- [ ] CRUD de coordenadores.
- [ ] Gestão de líderes.
- [ ] Transferência de líder entre campanhas somente por superadmin.
- [ ] Ativar/inativar/arquivar campanha.
- [ ] Configuração de Instagram/Meta.
- [ ] Auditoria global.
- [ ] Gestão de permissões sem expor dados sensíveis.

## P1 — Logo após o piloto
- [ ] Central de atividade.
- [ ] Alertas operacionais.
- [ ] Comparação entre períodos.
- [ ] Relatório executivo visual.
- [ ] Notificações internas.
- [ ] Melhorias avançadas de filtros/ranking.
- [ ] Monitoramento técnico e métricas de erro.

## P2 — Fora do MVP inicial
- [ ] WhatsApp/n8n.
- [ ] Monitoramento contínuo.
- [ ] Sentimento/IA de comentários.
- [ ] Lista individual de curtidas via provedor externo, somente após validação jurídica/técnica.
- [ ] Scraping.
- [ ] Gamificação.
- [ ] CRM/predição.
- [ ] Aplicativo nativo.

## Critério de aceite do piloto
O MVP só deve ser considerado pronto quando um superadmin conseguir criar uma campanha, cadastrar um coordenador e líderes, cada líder conseguir administrar apenas a própria rede e executar análises, o coordenador conseguir acompanhar a equipe, os relatórios puderem ser exportados em XLSX e os testes de isolamento RLS não demonstrarem acesso cruzado entre campanhas/líderes.

## Regra de implementação
GitHub/Codex é a fonte principal para código e migrations. Lovable deve ser usado somente quando houver ganho real de velocidade em UI/UX. O banco real precisa ser validado antes de declarar o sistema pronto.