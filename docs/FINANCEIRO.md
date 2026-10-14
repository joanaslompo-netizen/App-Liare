# Financeiro LIARE — 14/10/2026

## Mudanças

- Financeiro acessível no cabeçalho: caixa, a receber, créditos, contas a pagar e histórico.
- Recebimentos individuais por valor/data/meio/conta, com taxas e cartão aguardando depósito.
- Crédito por cliente, saldo inicial, adiantamento, cortesia, uso no pedido e devolução.
- Cortesia não vira dinheiro; uso de crédito quita o pedido sem nova entrada de caixa.
- Movimentos imutáveis e estornos com referência; pagamentos antigos permanecem como legado, sem datas inventadas.
- Pedidos: rascunho/confirmado/cancelado, reserva automática ao salvar e numeração alocada na transação para contas conectadas.
- Movimentos por pedido: pagamentos, crédito, entregas parciais, devoluções físicas, compensação de devolução parcial e cancelamento.
- Edições preservam pagamentos. Aumento de total cria saldo; redução gera crédito do excedente para cliente identificado.
- Cancelamento preserva histórico. Pagamento misto devolve crédito original e reembolsa somente a parte recebida em dinheiro.
- Compras: unidade-base registrada, frete distribuído por valor, último custo para receitas e custo médio de estoque; conta a pagar e pagamento separados.
- Despesas, aportes, retiradas, transferências e saldo inicial. Frete cobrado separado no pedido; despesas já incluídas no rateio podem ser excluídas do resultado para evitar duplicação.
- Relatórios por linha de pedido, descontos até o centavo, visão por pedidos ou entregas, família/aroma, custos e remuneração separados.
- Resultados de entregas registradas usam custos guardados no evento; receitas atuais não reescrevem a venda antiga.
- Trabalho de componentes feitos no ateliê separado dos materiais na precificação; multiplicador visível na receita.
- Snapshot local integral, exportação/importação e sincronização incluem o financeiro; primeiro movimento guarda recuperação local.

## Conferência prática — use seus próximos movimentos reais

1. Recarregue o app nos aparelhos que usa. Abra **Financeiro** pelo cabeçalho.
2. Confira pedidos antigos: total, saldo, itens e número. Valores pagos anteriores ficam preservados; datas de parcelas antigas não entram artificialmente no caixa.
3. Em uma encomenda, salve o pedido e abra **Movimentos**. Registre só o valor recebido naquele momento. Confira saldo e histórico.
4. No próximo adiantamento sem produtos definidos, abra **Valor antecipado / crédito**, selecione cliente e informe valor/data. Confira o extrato.
5. No pedido desse cliente, abra **Movimentos → Receber / usar crédito** e marque **Usar crédito disponível**. Confira saldo e falta pagar.
6. Registre uma retirada parcial em **Entregar**, por item e quantidade. O restante continua pendente; isso não muda pagamentos.
7. Em devolução, primeiro registre as peças e sua condição. Depois use **Devolver valor**, escolhendo crédito ou dinheiro.
8. Na compra real, marque se já foi paga; se não, informe vencimento. Confira **A pagar** e custo atualizado do material.
9. Abra relatórios: **Peças entregues** para realizado e **Pedidos confirmados** para estimativa. Pedidos mistos devem mostrar seus produtos separados.
10. Confira a edição em outro aparelho conectado à mesma conta. Créditos e operações de pedidos conectados são gravados imediatamente por transação, sem esperar a fila de dez minutos.

Não faça pagamentos fictícios na conta real para testar. Se houver divergência, registre pedido, ação e valores esperados/observados.

## Regras dos dados anteriores

- Crédito antigo informado como saldo inicial não é caixa novo.
- Saldo de banco só é confiável após saldo inicial e movimentos faltantes conferidos.
- Custos antigos sem remuneração separada são identificados como legado; não são recompostos com a receita atual.
- Despesas cadastradas no resultado devem ser gastos adicionais, não valores já incluídos no rateio das receitas.
- Compra anterior à reforma sem evidência da movimentação de estoque não tem reversão física automática; ajuste precisa de conferência.
- Conta conectada exige conexão para operações financeiras; modo local permanece disponível para uso em um aparelho, e conflitos de crédito impedem gravação na nuvem.

## Validação

- Tipagem e compilação de produção.
- Testes anteriores: preservação de campos, formulários, fatura, custos e integridade.
- Cenários financeiros: parcelas em meses diferentes; crédito R$300/R$120/R$180; pagamentos excedentes; alterações de total; cortesias; estornos; cancelamento misto; entregas/devoluções parciais; custo médio; frete de compra; cartão e liquidação; precificação do trabalho interno.
- Interface simulada: registrar R$300, usar R$120, recarregar e manter R$180 e histórico.
- Concorrência simulada usando o serviço real: duas utilizações de R$250 sobre saldo R$300 permitem somente uma, mantendo R$50.

Teste visual em navegador e sincronização numa conta real não foram concluídos neste ambiente. Os testes de interface e de concorrência são simulados e não substituem essa conferência.
