# Checklist prático — LIARE Simple, grupo 1

Use o app habitual. Recarregue a página para receber a versão nova. Faça uma passagem no celular/iPad e outra no computador. Não importe o backup nem restaure exemplos para executar este checklist.

| Conferência | Como testar e resultado esperado | Celular/iPad | Computador |
| --- | --- | --- | --- |
| Dados existentes | Confira os materiais, produtos e pedidos que já usa. Estoques, números e configurações devem continuar presentes. | [ ] | [ ] |
| Próximas entregas | Veja se as entregas estão por data, com cliente e quantidade. Toque em uma: deve abrir aquele pedido. | [ ] | [ ] |
| Contas a receber | Abra um pedido parcialmente pago. Na Home deve aparecer só o saldo restante; toque nele para abrir o mesmo pedido. Pedido sem saldo não deve aparecer como cobrança. | [ ] | [ ] |
| Material simples | Abra um material comprado. Nome, categoria, unidade, compra/custo e estoque continuam acessíveis; fornecedor, tipo e observações aparecem em Mais opções. | [ ] | [ ] |
| Campos recolhidos | Em uma edição que já faria, deixe Mais opções fechado, salve e reabra. Fornecedor, observações, estoque e campos avançados devem permanecer. | [ ] | [ ] |
| Duráveis | Abra um molde ou ferramenta, expanda os detalhes e confira medidas/opções antigas. Salvar uma edição deve preservá-las. | [ ] | [ ] |
| Material do ateliê | Abra uma receita interna. Composição, rendimento e tempo continuam disponíveis quando esse tipo exige. | [ ] | [ ] |
| Receita de produto | Abra um produto: identificação, composição, rendimento e tempo devem estar acessíveis. Estoque/observações, etapas, indiretos e margem/preço estão em Mais opções. Confira os valores antigos antes e depois de salvar. | [ ] | [ ] |
| Personalizados | Na lista de produtos, abra Mais opções: receitas personalizadas. Consulte/edite uma e confira que continua personalizada depois de salvar. | [ ] | [ ] |
| Históricos | Em Materiais e Produtos, abra Mais opções: histórico. Compras e produção continuam consultáveis. | [ ] | [ ] |
| Fornecedor avulso | Na próxima compra real, use a opção avulsa e digite o fornecedor. Salve: o nome deve aparecer no histórico sem exigir cadastro. | [ ] | [ ] |
| Cliente rápido | No próximo pedido real, cadastre o cliente com nome e, se quiser, telefone. Aniversário e observações são opcionais em Mais opções; o cliente deve ficar vinculado. | [ ] | [ ] |
| Formulários e botões | Confira que consegue rolar até Salvar e Cancelar. No celular, os cadastros extensos ocupam a tela inteira; entradas não devem provocar zoom. | [ ] | [ ] |
| Fatura | Gere/abra o resumo de um pedido. Confira número, itens, valores, PIX e instrução de cartão via WhatsApp. O design deve continuar igual. Não precisa enviar a ninguém. | [ ] | [ ] |
| Integridade | Em Configurações, clique Verificar integridade dos dados. Leia os pontos apresentados. A ação apenas consulta; não modifica nenhum registro. Cadastros em preparação ou itens excluídos do histórico podem gerar avisos. | [ ] | [ ] |
| Reabertura | Depois de uma edição real, recarregue e confira que ela permaneceu. | [ ] | [ ] |

## Sincronização real — ainda precisa desta conferência

- [ ] Após salvar uma edição real, aguarde o indicador sincronizado.
- [ ] Abra o outro aparelho conectado à mesma conta e confira a edição.
- [ ] Reabra o primeiro aparelho e confirme que a alteração não voltou ao estado anterior.

A conexão Google não funcionou no ambiente de validação. A lógica de sincronização foi preservada, mas essa parte não foi validada em uma conta real.

## O que esta entrega cobre

S00 e S01: recuperação e classificação documentadas. S06/S09: entregas e saldos abrem o pedido exato. S11: distinção entre pausa e controle de estoque. S17/S18/S30/S39/S59/S60/S61: campos e funções secundárias recolhidos, personalizados preservados e validação duplicada removida. S43/S45: fornecedor avulso e cliente rápido. S52: fatura preservada e verificada. S63–S67: datas locais, apresentação mobile, ações de cadastro e confirmação extra de receita incompleta. S70/S72: integridade somente de leitura e campos antigos preservados. S74–S79: testes, commits por item, limites de escopo e metas registrados.

O campo **Controlar estoque: Sim/Não** depende do S10, fora deste grupo. Por isso o S17 não recebe esse campo nesta entrega. Navegação principal, cálculos de estoque, método de custo, propagação da fórmula base e sincronização não foram reformados aqui.

## Validação técnica realizada

Tipagem e build passaram. Testes dos formulários simularam edição/salvamento com campos recolhidos, duráveis, personalizados, fornecedor avulso e abertura de pedidos. Passaram também os testes de custos/famílias, fatura e integridade. A restauração do backup completo com o carregador real preservou coleções, campos originais e números de pedidos, incluindo a segunda abertura.

A prévia foi compilada pela Vercel, mas exigiu login para o teste pelo navegador. Após a publicação no app habitual, foram conferidos no navegador de desktop a abertura do pedido pela entrega e pela cobrança, o cliente rápido, o formulário de material recolhido e a checagem de integridade, usando os dados de exemplo daquela sessão. Nenhum desses testes salvou ou alterou registros. O teste visual em celular/iPad e a sincronização entre aparelhos precisam ser concluídos neste checklist. Testes simulados não substituem essas conferências.

Se algum ponto falhar, registre a tela, o que fez, o resultado esperado e o resultado observado. Não é necessário desfazer dados ou restaurar o backup por conta própria.
