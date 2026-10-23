# Fabricação automática no consumo — 23/10/2026

Quando um material feito no ateliê ou uma receita usada como componente não tem
saldo suficiente, o app usa primeiro o saldo pronto. A diferença é preparada e
consumida na mesma operação, baixando os ingredientes da receita proporcionalmente
ao rendimento. Não se arredonda para um lote inteiro nem se cria sobra artificial.
Receitas aninhadas usam a mesma regra e compartilham os saldos disponíveis.

## Onde acontece

- Venda: ao registrar a entrega que movimenta estoque. Salvar ou reservar um pedido
  não antecipa produção nem consumo. Um produto com receita completa pode cobrir
  sua própria falta dessa forma; a entrega continua validada na transação da nuvem.
- Produção direta e conjunta: a previsão e as baixas consideram os saldos de todos
  os itens selecionados, na ordem, sem usar o mesmo componente pronto duas vezes.
- Produção por etapas: somente os insumos da etapa avançada são consumidos; a
  receita da etapa continua vindo do snapshot da ordem. Nada é baixado ao abrir.
- Produção de materiais internos e de personalizados: usam o mesmo planejador de
  consumo, incluindo componentes que também precisem de fabricação automática.

## Integridade e histórico

O planejador é puro. Retorna os insumos efetivamente consumidos do estoque pronto
e das matérias-primas, junto das quantidades fabricadas e imediatamente consumidas.
O histórico registra entradas/saídas da fabricação automática com a referência da
operação. Produções guardam também `automaticManufacturing`, exibido nos detalhes.
As baixas líquidas permitem estornar os insumos corretos, sem devolver um componente
inteiro que não existia antes. Devolver um produto vendido ao estoque não desfaz
sua fabricação real nem devolve seus ingredientes.

Receita ausente/incompleta, rendimento inválido, ingrediente variável não escolhido
ou ciclo impede uma fabricação presumida. A falta de matéria-prima aparece na
previsão; a entrega é recusada sem alteração parcial. Nas produções, permanece o
fluxo já existente de aviso e confirmação para insuficiência física. Itens duráveis
e fórmulas virtuais preservam suas regras de consumo.

Não se fabrica automaticamente uma receita que já tem produção em andamento:
o app orienta concluir essa ordem, protegendo insumos já baixados por etapas.
Reservas de outros pedidos são protegidas na entrega. A repetição da entrega
conserva o mesmo identificador e não gera uma segunda fabricação ou baixa.

Não há execução programada, polling nem gravação em repouso. Os registros novos
só são gerados na operação de consumo do usuário; abrir uma previsão não escreve.
O protocolo de armazenamento não mudou, e os novos campos são listas de objetos
compatíveis com o parser real do Firebase.

## Validação

`test:auto-manufacturing`: estoque parcial, receitas aninhadas, matéria-prima
insuficiente, referências circulares, lotes compartilhados, planejamento sem
mutação, entrega repetida, devolução, histórico igual ao saldo, UI real com dados
simulados, reabertura e estorno.

O serviço de nuvem simulado confirma que duas entregas concorrentes não conseguem
usar a mesma matéria-prima; o SDK instalado valida a serialização do histórico.
Também passaram as suítes de produção, etapas, planejamento, materiais virtuais,
financeiro, contas/cartões e cota, além de tipagem e build. Nenhum movimento fictício
foi criado na conta real; não houve teste visual autenticado na base de produção.
