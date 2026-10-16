# Ficha de pedidos — 16/10/2026

Foco aprovado: computador e iPad. Abrir um pedido leva a uma ficha ampla de acompanhamento, sem entrar automaticamente no formulário de edição.

## Acessos e navegação
- Home: entregas, cobranças e encomendas abrem a ficha correspondente, com destaque da seção de origem.
- Lista: número do pedido e Abrir pedido levam à mesma ficha.
- Financeiro: links de pedido levam à ficha com destaque no pagamento.
- Voltar mantém montada a tela anterior, preservando busca e filtros.
- A navegação para outra seção encerra a ficha.

## Organização
- Cabeçalho com cliente, número, data e estados separados de produção, pagamento e entrega.
- Itens à esquerda; pagamento e entrega à direita.
- Receber e Entregar abrem somente os campos da ação, dentro da página. Usam o mesmo serviço financeiro já existente.
- Editar dados e Editar itens são ações separadas. O formulário de itens substitui visualmente a lista, sem repetir os mesmos produtos duas vezes.
- Fatura disponível; histórico, custos, devoluções e cancelamento em acessos secundários.

## Alteração dos itens
- Quantidades, preços, inclusão, remoção e troca de produto mantêm o ID e número do pedido.
- Composição e referências de personalizados existentes são preservadas. Um novo personalizado pode entrar com composição/custo ainda a definir.
- Totais, descontos, frete e reserva usam a operação save_order existente. A edição não cria recebimento nem entrega.
- Aumento do total gera saldo adicional; redução abaixo do pago preserva excedente em crédito do cliente identificado, com aviso antes de salvar.
- Produto/preço de item com histórico de entrega e remoção desse item ficam protegidos. Quantidade não pode ficar abaixo da entrega líquida.

## Validação
- npm run lint; npm run build.
- npm run test:group1 e npm run test:finance.
- npm run test:orders: abertura sem pop-up, quantidade/preço, substituição e inclusão no mesmo pedido, recebimento original preservado, crédito excedente, reserva sem baixa física, entrega parcial, proteção de item entregue, busca e dados preservados ao voltar/reabrir. Dados sintéticos em armazenamento isolado.
- Conferência visual da versão publicada usa a sessão de exemplos da nuvem. A conta real e a sincronização entre aparelhos não fazem parte dessa comprovação.
