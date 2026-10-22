# Revisão do consumo de Firestore — 22/10/2026

## Escopo e evidência

Revisados os caminhos de persistência do app e da conexão: autenticação, perfil,
leitura inicial, listeners, sincronização automática/manual, operações financeiras,
revisões, armazenamento local, fórmulas e recálculo, imagens, migração e restauração.
As telas restantes usam esses caminhos centrais; não fazem gravações diretas no banco.

Consulta de diagnóstico somente leitura: revisão 141, formato por registros,
286 registros e 1.011.840 bytes caso a base fosse reunida num documento.
Isso não é uma medição do painel de quotas. O download integral para inspeção foi
bloqueado pela revisão automática; não foi usado no trabalho. Nenhum dado real de
cliente foi necessário para os testes. Não foram criados movimentos na conta real.

## Falhas reproduzidas e correções

1. **Datas no recálculo:** toda receita ganhava a data atual, mesmo com preço e
   composição iguais. Em outro dia, isso regravava receitas sem mudança. Agora
   a comparação de conteúdo mantém o registro e a data quando nada mudou.
2. **Fotos nos registros:** mudar estoque/preço reenviava o registro completo.
   O protocolo 5 guarda diferenças sobre uma versão imutável já existente quando
   isso economiza pelo menos 35%. Fotos e notas inalteradas não são reenviadas.
   Cadeias têm profundidade máxima 4 e voltam a um registro completo; todas as
   camadas e o resultado têm SHA-256 conferido.
3. **Índices grandes:** os manifestos atual e anterior eram reescritos com nomes
   de campos e hashes hexadecimais repetidos. O protocolo 5 usa linhas compactas,
   tabela de seções e hashes sem perda em base64url.
4. **Falso no-op:** a ordem dos campos de objetos podia mudar as referências e
   produzir escrita sem mudança de negócio. Campos de objetos agora têm ordem
   canônica; a ordem das listas de materiais, pedidos etc. continua preservada.
5. **Retry do SDK:** o Firebase classifica RESOURCE_EXHAUSTED como repetível.
   As transações usam maxAttempts=1; somente disputas ABORTED recebem até três
   tentativas controladas. Cota diária não dispara novas tentativas de banco.
6. **Pausa perdida:** o bloqueio era apenas uma ref de React, perdida ao reabrir.
   Agora é persistido por usuário e compartilhado entre abas. Erros diários
   aguardam a próxima meia-noite do Pacífico com margem de um minuto e retomam
   automaticamente. Limite temporário sem indicação diária aguarda um minuto.
   Falhas de leitura também encerram os listeners ativos e impedem novos listeners
   durante a pausa; falha só de escrita continua permitindo leituras.
7. **Perfil na abertura:** cada abertura escrevia updatedAt no perfil através de
   setDoc, que tem uma fila de retry própria. O app usa os dados de Firebase Auth
   para exibição e não grava perfil ao abrir.
8. **Leituras duplicadas:** a operação financeira lia toda a base antes de a
   transação lê-la novamente. Usa agora a revisão conhecida, mantendo a leitura
   e a validação dentro da transação. Snapshots iniciais já conhecidos não geram
   outro download. Registros escritos com sucesso entram no cache imutável.
9. **Origem legada na conexão:** o guardião relia todo o documento original. O
   REST passa a conferir updateTime com uma máscara pequena e só baixa o conteúdo
   novamente se a versão mudou. O commit continua verificando essa versão.

## Compatibilidade e implantação

- App e conexão mantêm o mesmo arquivo de protocolo, conferido byte a byte.
- O leitor entende registros 4 e 5. Dados antigos são lidos sem migração em massa.
- Primeira alteração aproveita os registros existentes; não reenvia todo o catálogo.
- O mesmo ID de manifesto é mantido. Clientes antigos recusam a nova versão em
  vez de gravarem sobre uma cópia desatualizada; atualizar as abas/aparelhos.
- A base legada, o arquivo original e os registros históricos permanecem intactos.
- A cota já consumida no Google não é devolvida por uma publicação de código.

## Validação

`npm run test:quota`: sem gravações ociosas; agrupamento de alterações; uma tentativa
ao atingir cota; pausa após reabrir; retomada diária e preservação da fila; datas
de receitas inalteradas; compatibilidade 4→5; fotos, notas e histórico; exclusão de
campos; substituição de imagem; limite de cadeia; corrupção e ciclo recusados.

Carga sintética com 286 registros: primeira mudança de estoque, preservando o
manifesto anterior no formato 4, caiu de 110.101 para 79.510 bytes (27,8%). Essa
medição é de payload simulado, não de unidades faturadas; índices e outros clientes
também afetam a cota. Nos testes menores já migrados, uma edição envia 26.097 bytes
em vez de duas cópias integrais de 724.046 bytes. Não interpretar isso como redução
medida de uso da conta real.

Também foram executados os testes de pedidos, financeiro, produção, fórmulas,
modais, cache local, SDK e REST, além de tipagem e compilação. Conferir os resultados
da execução antes de publicar. Sem teste visual autenticado na conta real.

Referências: https://firebase.google.com/docs/firestore/enterprise/pricing
e https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/get
