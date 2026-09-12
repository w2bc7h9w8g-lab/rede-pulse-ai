# Campaign Connect

Crie um novo SaaS full-stack para gestão e análise de participação de redes de liderados em publicações do Instagram de campanhas/candidatos. Nome provisório do produto: RedePulse. Este é o MVP e deve ser construído já com arquitetura multi-tenant, segura e preparada para crescer, mas com UX extremamente simples para usuários não técnicos.

CONTEXTO DO PRODUTO
Uma campanha possui um coordenador (ex.: Jaiminho) que administra vários líderes (ex.: 50). Cada líder possui sua própria rede de aproximadamente 300 pessoas, identificadas por @ do Instagram. O líder NÃO conecta seu Instagram. Apenas a conta profissional do Instagram do candidato/campanha será conectada futuramente via Meta OAuth. O líder entra no SaaS, mantém sua rede e cola a URL de uma publicação para analisar. O sistema coleta interações individualmente identificáveis que estejam disponíveis pela API oficial do Instagram/Meta, principalmente comentários e menções, e cruza os usernames com a rede daquele líder. Curtidas individuais NÃO são requisito do MVP e não devem ser simuladas ou prometidas. Métricas agregadas da publicação podem ser exibidas quando disponíveis. A arquitetura deve deixar uma camada de provider preparada para futura integração com API de terceiros para likers, sem depender dela.

REQUISITOS CRÍTICOS
1. MULTI-TENANT: cada campanha/organização deve ser completamente isolada. Um coordenador vê apenas sua campanha. Um líder vê somente seus próprios liderados e análises. Nenhum dado de outra campanha pode aparecer mesmo por manipulação de URL/API. Use Supabase/PostgreSQL e RLS como controle real de autorização, não apenas filtros no frontend.
2. PAPÉIS: superadmin da plataforma (mínimo necessário), coordinator e leader. O coordinator pode criar/editar/desativar líderes. O líder pode gerenciar apenas sua rede e suas análises.
3. AUTENTICAÇÃO: Supabase Auth. Nunca solicitar nem armazenar senha do Instagram. A integração Instagram/Meta será OAuth e tokens ficarão somente no backend/server-side quando implementada.
4. REDE: tela 'Minha rede'. Permitir adicionar um @ por vez e, principalmente, colar centenas de usernames de uma vez. Aceitar formatos @joao, joao, linhas separadas, vírgula e ponto e vírgula. Normalizar, remover @, trim, deduplicar, validar formato e mostrar resumo de importação. Permitir CSV e Excel se viável no MVP. Campos mínimos: id, campaign_id, leader_id, instagram_username, display_name opcional, active, created_at, updated_at. Um username não deve duplicar dentro da mesma rede do líder.
5. ANÁLISE MANUAL: tela principal com 'Nova análise', campo grande 'Cole o link da publicação do Instagram' e botão 'Analisar publicação'. Não implementar monitoramento contínuo neste MVP. Validar URL e extrair shortcode quando possível.
6. CAMADA INSTAGRAM: criar uma abstração de provider/service para Instagram. Implementar estrutura para Meta/Instagram Graph API via backend/Edge Function, sem expor token no browser. A integração real pode ficar configurada como placeholder seguro até as credenciais Meta serem fornecidas. O app deve funcionar em modo demo com dados simulados claramente identificados como demonstração, sem fingir que são dados reais.
7. INTERAÇÕES: modelar interaction_type extensível. MVP: comment e mention/tag quando a API disponibilizar. Guardar username, texto do comentário quando permitido, timestamp da interação, media/post reference e analysis_id/member_id. Não criar fake likes. Likes individuais devem permanecer future/unsupported no MVP. Métricas agregadas podem ter campos separados: likes_count, comments_count, shares_count, reach, impressions etc., nullable, sempre identificadas como métricas da publicação.
8. RESULTADO: depois da análise mostrar de forma visual e simples: tamanho da rede, pessoas identificadas como participantes, percentual de participação identificada, lista dos participantes e tipo de interação. Ex.: '24 de 300 — 8,0%'. Deixar claro 'participação identificada' para não confundir com total de curtidas da publicação.
9. HISTÓRICO: guardar cada análise com URL, shortcode/post id, data/hora, status, métricas agregadas disponíveis, total da rede no momento da análise, participantes identificados e percentual. Permitir abrir uma análise antiga.
10. DASHBOARD DO COORDENADOR: quantidade de líderes, total de pessoas nas redes, média de participação identificada, análises recentes, tabela/ranking por líder e evolução. Coordenador pode clicar em um líder para consultar suas informações, respeitando a campanha.
11. EXPORTAÇÃO EXCEL É REQUISITO OBRIGATÓRIO: TODAS as informações relevantes precisam poder ser baixadas em planilha Excel (.xlsx), organizadas por DIA. Criar exportações para líder e coordenador. No mínimo: relatório diário de análises; publicação; data; líder; username; tipo de interação; comentário quando disponível; timestamp; tamanho da rede; participantes; percentual; métricas agregadas da publicação. Para coordenador, permitir exportar toda a campanha ou filtrar líder/período. A exportação deve ter uma aba/planilha por dia quando houver múltiplos dias, com nomes como '2026-09-10', e também uma aba 'Resumo' com totais. Se o usuário escolher apenas um dia, gerar uma planilha daquele dia. Criar filtros de período e botões claros 'Baixar Excel'. Não depender de servidor externo pago para gerar xlsx; usar biblioteca adequada no frontend/backend conforme a arquitetura Lovable. Garantir datas em horário local do Brasil e formatação legível.
12. IMPORTAÇÃO/EXPORTAÇÃO: criar também exportação da 'Minha rede' para Excel/CSV, incluindo username, nome opcional, status e data de cadastro.
13. UX: interface em português-BR, bonita, limpa, responsiva, desktop e celular. Para usuários não técnicos. Navegação simples: Início, Nova análise, Minha rede, Histórico, Relatórios (e, para coordenador, Minha equipe). Evitar termos técnicos. Home do líder deve destacar 'Nova análise'. Criar onboarding curto no primeiro acesso: 1) Cadastre sua rede; 2) Cole uma publicação; 3) Analise; 4) Veja quem participou.
14. RESULTADO E GRÁFICOS: cards claros, whitespace, tipografia boa, gráficos simples de evolução. Sem excesso de dashboard técnico. Cores sóbrias e profissionais. Não parecer ferramenta de scraping.
15. ESTADOS: loading, erro de URL, publicação não encontrada, conta Meta não conectada, API indisponível, nenhum comentário, nenhum participante da rede, importação com duplicados/erros, exportação sem dados. Mensagens amigáveis em português.
16. SEGURANÇA/LGPD: minimizar dados pessoais; permitir exclusão/desativação de membros; registrar created_at/updated_at; separar dados por campaign_id; RLS; não expor tokens; não coletar senhas de Instagram. Incluir aviso de que o sistema analisa dados disponibilizados pelas integrações autorizadas e não garante identificação de toda forma de interação.
17. FUTURO: preparar interfaces/services para WhatsApp/n8n e para um 'LikersProvider' de terceiros no futuro. Não implementar scraping privado nem login/senha de Instagram. Não usar API de terceiros de curtidas no MVP.

BANCO DE DADOS SUGERIDO
- organizations/campaigns: id, name, candidate_name, instagram_username, status, created_at
- profiles/users: id, auth user reference, name, role, campaign_id, leader_id nullable
- leaders: id, campaign_id, user_id, name, status, created_at
- network_members: id, campaign_id, leader_id, instagram_username, display_name, active, created_at, updated_at
- instagram_connections: id, campaign_id, provider, account_username, external_account_id, token reference/secure secret metadata, status, connected_at, expires_at
- posts: id, campaign_id, external_post_id/shortcode, url, published_at, likes_count nullable, comments_count nullable, shares_count nullable, reach nullable, impressions nullable
- analyses: id, campaign_id, leader_id, post_id nullable, url, status, analyzed_at, network_size_snapshot, identified_participants_count, participation_rate
- interaction_results: id, campaign_id, analysis_id, leader_id, network_member_id nullable, instagram_username, interaction_type, comment_text nullable, interacted_at, raw_external_id nullable
- audit_logs: id, campaign_id, user_id, action, entity_type, entity_id, created_at
Add appropriate indexes and unique constraints. Use UUIDs. Timestamps timezone-aware.

RLS/PERMISSÕES
- Superadmin: plataforma inteira.
- Coordinator: CRUD de leaders/network/analyses within own campaign and aggregate reports.
- Leader: CRUD/read own network and own analyses/results only.
- Never rely solely on frontend route guards.

IMPORTANTE SOBRE INSTAGRAM
Não invente campos ou endpoints. Onde a integração Meta não estiver configurada, implemente interface/mock adapter e uma tela de configuração explicando que é necessário conectar a conta profissional da campanha. Comentários e menções são a base do MVP. Curtidas individuais e compartilhamentos individuais não devem ser afirmados como disponíveis. Métricas agregadas são opcionais/nullable.

DADOS DEMO
Criar seed/demo mode para facilitar avaliação visual: uma campanha 'Campanha Demo', um coordenador, dois líderes, 20-30 membros por líder e algumas análises históricas. Marcar claramente o ambiente/dados demo para não confundir com produção.

QUALIDADE
Crie componentes reutilizáveis, tipos fortes, validação de formulários, tratamento de erros e código organizado. Não deixe botões sem função. As funções principais devem estar implementadas de ponta a ponta com banco quando possível. Gere migrações/schema e RLS. Antes de concluir, valide fluxos principais: login, criação de líder pelo coordenador, cadastro em massa, isolamento de dados, análise demo, histórico e exportação Excel por dia.

COMECE CONSTRUINDO O PRODUTO COMPLETO DO MVP, PRIORIZANDO PRIMEIRO A FUNDAÇÃO, BANCO/RLS, AUTENTICAÇÃO E UX PRINCIPAL. Depois implemente as telas e fluxos restantes. Ao final, deixe um resumo claro do que foi implementado e o que depende de credenciais externas da Meta.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rede-pulse-ai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e8e5c2b5-ac88-42af-973a-121bb4fc9317).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
