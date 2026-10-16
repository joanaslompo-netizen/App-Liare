# LIARE Simple — grupo 1

## S00 — Ponto de recuperação

- Código anterior preservado na branch `backup/liare-simple-before-group1-2026-10-08`.
- Commit de referência: `fa34176f0c7b2e136eb42f8a094383d82d045af5`.
- Backup de dados mantido separadamente do repositório público.
- Restauração verificada com o carregador real em armazenamento isolado: coleções, campos originais, estoques, números de pedidos e segunda abertura preservados.
- O backup anterior da nuvem não pôde ser consultado, pois o login Google estava indisponível. O backup completo recebido permite recuperar o estado anterior à reforma independentemente dessa cópia.

Verificação local: `node --import tsx scripts/verify-backup.ts /caminho/para/backup.json`.

## Regras permanentes — S72, S74–S79

- Um item por commit; preservar campos antigos e histórico.
- Separar interface de cálculos e movimentações.
- Priorizar Home/navegação, estoque, compras, fórmula base, produção, pedidos e relatórios.
- Adicionar funções apenas quando eliminam trabalho, evitam erro ou melhoram uma decisão.
- Cada mudança exige tipagem/build e verificação do fluxo afetado; salvar, reabrir, editar e recarregar no celular e desktop. Sincronização real deve ser conferida na conta conectada antes de considerar essa parte validada.
- Meta: compra em menos de um minuto, pedido em poucos passos, produção em segundos e pendências/custo/margem acessíveis.
- Nunca incluir backups ou dados de clientes no GitHub.

## S01 — Operação e cadastro

| Tipo | Funções |
| --- | --- |
| Operação diária | Pedido, Produção, Compra e Estoque |
| Cadastro | Produto/Receita, Material, Cliente e Fornecedor |
| Consulta | Relatórios e históricos |
| Excepcional | Configurações, backup e sincronização |

Esta classificação orienta a reforma; não altera a navegação por si só.

## S11 — conceitos distintos

Pausado significa que o material não está em uso no momento; o estoque registrado permanece. Não controlar estoque significa continuar usando e calculando o custo sem inventário físico. O segundo comportamento depende do S10, fora deste grupo; não será simulado usando Pausado.

## Home — computador e iPad, 16/10/2026

- Prioridade atual: uso no computador/iPad; alterações específicas do celular e do botão + ficam para depois.
- Resumo financeiro compacto, com valor contratado no mês, quanto fica estimado (inclui remuneração) e saldo total a receber. Cálculos financeiros preservados.
- Entregas e encomendas em destaque; atrasos visíveis; linhas de encomenda abrem o pedido correspondente.
- Reposição separada de encomendas, limitada a quatro itens inicialmente e sem linhas com reposição de zero unidades. Clique na reposição abre a produção do produto.
- Insumos em baixa separados da reposição de produtos; acesso ao estoque com filtro.
- Tarefas com altura conforme conteúdo; pendentes por padrão; concluídas e sugestões acessíveis sob demanda. Blocos redundantes de pedidos removidos da Home; histórico permanece em Pedidos.
- Atalhos: novo pedido, registrar produção, registrar compra e ajustar estoque. Pedido, compra e produção abrem os formulários; ajuste abre a lista de materiais para escolher o item.
- Validação: tipagem, compilação, regressão do grupo 1 e simulação integrada dos atalhos (abrir/cancelar/voltar sem alterar dados).
- A conferência visual da publicação será feita com a sessão de exemplo da nuvem; não representa validação da conta real nem sincronização entre aparelhos.
