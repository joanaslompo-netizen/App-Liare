# Produção e seleção por modelo

- A produção abre em **Em andamento**, com quantidade, progresso de todas as etapas e ação direta para registrar o trabalho. Concluídas, busca, filtros, custos, observações, registro completo e estorno continuam disponíveis.
- Nova produção, registro de etapa e consulta completa são páginas internas, com retorno para a lista. Não usam janelas sobrepostas.
- O seletor compartilhado em produção, novos pedidos e edição dos itens do pedido usa **Modelo → Aroma**. Agrupa somente vínculos explícitos com receita mãe ou o campo Família. Nomes semelhantes não criam vínculos. Cada escolha mantém o ID real da receita e seus dados comerciais.
- A receita mãe continua selecionável quando também representa um aroma. Receitas individuais são selecionadas diretamente. Personalizados continuam no fluxo específico do pedido.
- É possível iniciar vários itens com quantidades em unidades. O rendimento da receita converte essas unidades em quantidade proporcional de bateladas. Linhas com a mesma receita e as mesmas escolhas de materiais são somadas.
- As previsões somam materiais compartilhados. Produções diretas mantêm a conclusão e baixa imediatas; a tela informa isso antes de confirmar. Receitas por etapas mantêm snapshots e só movimentam os materiais de cada etapa, com entrada dos produtos prontos na última etapa.
- O registro conjunto usa os mesmos handlers de estoque do app, com IDs únicos e saldos anteriores/posteriores sequenciais para as baixas imediatas. Não há migração ou reescrita do histórico.

## Verificação

`npm run test:production` cobre agrupamento explícito, rendimento, custo, materiais compartilhados, insuficiência conjunta, materiais variáveis/duráveis e o fluxo no App real com dados locais de teste: iniciar vários itens, etapas parciais, bloqueio de excesso, estoque final, linhas repetidas e reabertura. Também cobre a reutilização do seletor após adicionar produtos individuais e aromas.

As verificações de pedidos preservam preços editados, dados do cliente, personalizados, frete, descontos, recebimentos, reservas e entregas. Foram executadas também as verificações do grupo 1, financeiro, sincronização simulada, modais, tipagem e build. Estes testes não alteram a conta conectada nem comprovam sincronização real entre aparelhos.
