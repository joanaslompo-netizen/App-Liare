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

## Receita atual nos projetos e nas próximas etapas — 29/10/2026

- Projetos vinculados a produtos consultam a receita do catálogo por ID; nome, rendimento, custos, escolhas de insumos virtuais e etapas se atualizam sem recriar o projeto. Receitas próprias do projeto permanecem independentes.
- Produções em andamento projetam e registram os próximos passos com a receita atual, incluindo produções iniciadas antes desta atualização. A consulta não grava migrações nem movimenta estoque.
- Quantidades, materiais, custos e mão de obra já registrados são preservados. O progresso por ingrediente impede uma segunda baixa quando as etapas mudam de lugar ou são unidas. A definição anterior fica no histórico ao salvar o próximo passo.
- Inserir, retirar ou reordenar fases preserva a contagem exclusiva das peças ainda em processo. Se a retirada de uma fase deixar peças prontas, a entrada em estoque exige registrar a conferência de finalização.
- Validação: produção, planejamento, receitas atuais, projetos, fabricação automática, tipagem, build e fluxo no navegador com dados fictícios.

## Consignações — 03/11/2026

- Locais com contato, comissão e combinados próprios; acesso pelo botão +, Home e repasses no Financeiro. Acertos ficam separados dos pedidos comuns e não consomem sua numeração.
- Envio transfere peças disponíveis do ateliê, preservando reservas. Saldo inicial já no parceiro pode ser registrado separadamente, sem descontar novamente do ateliê. Lotes guardam o preço e o custo do envio; os mais antigos são utilizados primeiro.
- Conferência registra o restante, a devolução física e as perdas. A diferença só vira venda após confirmação explícita. A venda baixa o estoque do parceiro uma vez, gera repasse após a comissão e não inventa recebimento de dinheiro.
- Repasses parciais abatem acertos mais antigos; caixa registra apenas o valor recebido. Vendas, comissões, custos e perdas aparecem separadamente nos relatórios. Mudanças de comissão valem para os próximos acertos.
- A última conferência pode ser desfeita com histórico preservado, antes de novas movimentações. Recebimentos vinculados precisam ser estornados; peças devolvidas já utilizadas ou reservadas impedem desfazer a devolução. Não há exclusão de histórico.
- Dados usam os registros existentes de estoque, vendas e financeiro, sem alterar o protocolo compartilhado de armazenamento; backup/restauração preservam os campos. Transações revalidam estoque e repasses e recusam conferências concorrentes ou desatualizadas.
- Validação com dados fictícios: cálculos, interface integrada, dois aparelhos simulados, armazenamento e Chromium em desktop/tablet/celular, incluindo recarga e correção. Não foram criados locais nem movimentos na conta real durante os testes.

## Gestão — 03/11/2026

- O acesso Relatórios do menu principal passa a ser Gestão, com uma visão geral para Relatórios, Financeiro e Consignações. As três áreas compartilham navegação interna e mantêm Gestão selecionado no menu principal.
- Atalhos existentes da Home, do cabeçalho e dos acertos abrem a seção correspondente dentro de Gestão; abrir um pedido e voltar preserva o caminho. A navegação não cria nem altera lançamentos, estoques, créditos ou acertos.
- Validação: tipagem/build, regressões de financeiro e consignações e navegação no Chromium em desktop/tablet/celular, incluindo teclado, atalhos, recebimento de pedido e recarga com dados fictícios.

## Busca de produtos nos consignados — 04/11/2026

- O envio de velas usa o seletor compartilhado de Modelo → Aroma, com busca por digitação como na produção. Quantidade e preço são conferidos antes de adicionar; a família permanece selecionada para incluir outro aroma.
- A seleção informa o estoque disponível após reservas, preserva o ID e o preço do aroma, impede repetir o mesmo produto na lista e pede concluir ou limpar um produto em preenchimento antes de enviar.
- Pedidos e produção conservam seus modos de seleção existentes. As regras de transferências, saldos iniciais, comissões e repasses permanecem nos mesmos comandos de estoque e financeiro.
- Validação com dados fictícios: seleção individual e por família, múltiplos aromas, preço e estoque, produto repetido, rascunho incompleto, reabertura, regressões de pedidos/produção e navegador em desktop/tablet/celular.

## Retirada de consignações — 05/11/2026

- Cada local tem a ação Retirar produtos para selecionar quantidades ou retirar todas as peças, com data e observações. O retorno ao ateliê acontece ao confirmar, sem depender de uma conferência do período.
- A retirada transfere o estoque do parceiro para o ateliê com histórico nas duas pontas, preservando os custos originais dos lotes e a média do estoque. Vendas, comissões, repasses e conferências anteriores são preservados.
- Quantidades inteiras limitadas ao saldo do local; transações revalidam o estoque e impedem retirar duas vezes por repetição ou concorrência entre aparelhos. Cancelar não movimenta peças.
- Validação com dados fictícios: retiradas parciais e totais, múltiplos aromas/lotes, saldo inicial, custos, histórico, financeiro, persistência, interface integrada e dois aparelhos simulados; tipagem/build e navegador em desktop/tablet/celular. Nenhuma movimentação de teste na conta real.

## Lista de produtos para retirada — 05/11/2026

- Retirada usa a busca compartilhada de Modelo → Aroma, exibindo somente produtos com saldo positivo no local selecionado. O agrupamento mantém a família original mesmo quando a receita-mãe não tem saldo no parceiro.
- Selecione produto e quantidade e adicione à retirada; somente os itens escolhidos aparecem para ajustar ou remover. Produtos repetidos, quantidades acima do saldo e seleções ainda não adicionadas são sinalizados antes de confirmar. A opção de retirar tudo continua disponível.
- O estoque mostrado no seletor é o do local, sem preço de venda. A transferência, custos e histórico seguem o comando existente; pedidos, produção e envios conservam a seleção padrão.
- Validação com dados fictícios: filtro por local/modelo/aroma, produto com saldo apenas no ateliê ou em outro parceiro, produto repetido, seleção pendente, edição/remoção, retorno parcial/total e persistência. Tipagem/build, regressões do seletor e navegador em desktop/tablet/celular.

## Fatura pelo WhatsApp — 05/11/2026

- Faturas individuais e conjuntas têm Enviar no WhatsApp. Abre a conversa do cliente com a fatura em texto preenchida; a pessoa revisa e envia no WhatsApp. Para o PDF, a tela orienta salvar e anexar o arquivo na conversa.
- Usa o telefone atual do cliente vinculado por ID; pedidos sem vínculo podem usar o contato do próprio pedido. Números brasileiros recebem o código 55 quando necessário, sem duplicá-lo. Telefones ausentes/inválidos ou contatos conflitantes na fatura conjunta bloqueiam o atalho e explicam como corrigir.
- Mensagem inclui produtos/quantidades/preços, frete, total antes do desconto, desconto, devoluções compensadas, valor pago, saldo e Pix quando houver saldo. Custos internos e dados financeiros de outros clientes não são compartilhados. Preparar/abrir a mensagem não marca a fatura como enviada ou paga, nem altera dados.
- Validação: faturas e contato, fatura conjunta com recebimentos reais, tipagem/build e navegador em computador/tablet/celular com dados fictícios. Testes conferem a URL e o texto sem enviar mensagens a clientes.

## Anexo PDF da fatura — 05/11/2026

- Substitui o envio em texto por Compartilhar PDF nos aparelhos com compartilhamento de arquivos. O PDF fica pronto antes do clique; o compartilhamento abre a escolha de aplicativo/contato do aparelho. O número cadastrado é exibido para conferência; não se promete selecionar automaticamente o destinatário no compartilhamento nativo.
- Baixar PDF salva o arquivo diretamente, sem a caixa de impressão; fica disponível também nos navegadores sem compartilhamento. Abrir WhatsApp do cliente abre apenas a conversa para anexar o arquivo. Imprimir continua disponível.
- PDF A4 gerado no aparelho, com fontes empacotadas e carregamento do gerador apenas ao abrir a fatura. Preserva produtos, informações do pedido/cliente, Pix, valores antes dos descontos, devoluções, pagamentos e saldo; suporta fatura conjunta e tabelas com várias páginas. Não publica a fatura em um endereço público nem registra pagamento/envio.
- Cancelar o compartilhamento mantém a fatura aberta; falhas permitem baixar ou tentar novamente. Mudanças nos pedidos invalidam o PDF anterior antes de habilitar as ações; arquivos temporários são liberados ao fechar.
- Validação com dados fictícios: PDF real, texto e renderização, faturas individuais/conjuntas e várias páginas, compartilhamento nativo simulado, cancelamento/falha, download, contatos e persistência; tipagem/build e navegador em desktop/tablet/celular. Nenhuma mensagem enviada a clientes.
