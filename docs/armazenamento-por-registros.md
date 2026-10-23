# Armazenamento por registros — protocolos 4 e 5

O leitor aceita o formato 4 publicado anteriormente. Novas alterações usam o
formato 5 com manifesto compacto e diferenças sobre registros imutáveis, sem
reenviar imagens inalteradas. A profundidade máxima é 4; todas as camadas têm
integridade SHA-256 conferida. As linhas compactas de `recordRows` são strings JSON: o Firestore não aceita arrays diretamente dentro de arrays. A leitura também aceita as tuplas anteriores. A atualização ocorre junto de uma alteração real,
sem migração em massa ao abrir. Ver `auditoria-cota-2026-10-22.md`.

O app e a conexão privada usam o mesmo protocolo, mantido byte a byte em
`src/services/workspaceRecordStore.ts` (app) e `src/workspaceRecordStore.ts`
(conexão). Mudanças de protocolo exigem teste dos dois adaptadores.

## Invariantes

- A base `liare_connected_v1` permanece intocada. Nada é apagado na migração.
- A primeira gravação migra e salva a alteração em uma transação atômica.
- `records_liare_connected_v1` contém apenas cabeçalho, ordem e referências.
- Cada item tem documento próprio `r4_<hash da seção e ID>_<revisão>` ou `r5_...`.
- Configurações e campos desconhecidos são preservados; entradas financeiras,
  contas a pagar e movimentos de estoque têm registros individuais.
- Registros são versionados: uma edição cria uma versão nova, sem destruir a antiga.
- `previous_records_liare_connected_v1` guarda o índice da revisão anterior;
  recuperar esse índice reconstrói o backup completo usando os registros antigos.
- `archive_liare_connected_v1` é a cópia integral original, criada uma única vez.
- As regras atuais já isolam esses documentos por usuário em `workspaces`.
  Não se ampliam permissões nem se criam subcoleções sem regras.
- Os dois adaptadores leem o índice e a base antiga dentro da transação.
  Qualquer alteração concorrente impede um commit sobre uma revisão desatualizada.
- O conteúdo recebido é conferido por SHA-256. Falta/corrupção bloqueia o fluxo,
  sem voltar silenciosamente à base antiga ou criar uma base vazia.
- Uma aba antiga que grave na base legada é detectada pelo digest da origem.
  As duas bases são preservadas e o novo cliente bloqueia gravações. Para resolver,
  exportar ambas, comparar as alterações e mesclar por registro com revisão humana;
  não apagar o índice nem sobrescrever a origem para esconder o conflito.
- Leituras e previews não fazem migração ou gravação.
- Sem alteração de conteúdo, nenhuma escrita é feita.
- Migração inicial tem limite seguro de 450 documentos por transação. Acima disso,
  o fluxo para antes de escrever e requer migração em lotes preparada separadamente.

## Publicação e ativação

1. Executar testes do protocolo, SDK e REST, financeiro, armazenamento local e build.
2. Publicar a conexão com leitura dos dois formatos; não migrar ainda.
3. Publicar o app com o mesmo protocolo e confirmar o commit servido.
4. Exportar a base atual e conferir contagens, valores, imagens e histórico no teste local.
5. Na conexão, executar `liare_migrate_storage` em `preview`, conferir a revisão,
   e então `migrate` com essa revisão. O backup integral também é salvo em R2 antes
   do commit. Falha de cota não muda os dados; repetir após a renovação da cota.
6. Ler novamente e comparar conteúdo com a exportação anterior, descontando apenas
   revisão, data e autor da sincronização. Conferir a consulta das receitas pelo app.
7. Recarregar o app em todos os aparelhos antes de novas alterações.

## Recuperação

O backup anterior é lido pelo app por meio de `fetchPreviousWorkspaceFromCloud`.
Na primeira revisão migrada, ele usa o arquivo integral original. Depois, usa o
índice anterior. Restaurar pelo app cria uma revisão nova e preserva o histórico.
Não publicar um cliente antigo após ativar o novo armazenamento: ele não conhece
os registros novos. Em emergência, manter a versão nova e exportar/inspecionar
antes de qualquer reversão de formato. A origem antiga fica disponível para
comparação e recuperação, mas não representa alterações posteriores à migração.

## Verificação

- Protocolo: fidelidade, exclusões, ordenação, campos desconhecidos, backup, no-op,
  falha atômica, revisão divergente, corrupção e aba antiga.
- SDK: validação dos payloads pelo parser real de `WriteBatch.set`, sem commit ou rede; compra, estoque e conta a pagar; manifestos atual/anterior aceitos, enquanto o formato antigo com arrays aninhados é recusado. Também fluxo de upload/leitura/recuperação e duas operações concorrentes sobre
  o mesmo crédito, impedindo gasto duplicado.
- REST: importação, preview sem escrita, cadastro idempotente, proteção da revisão,
  custos, estoque, financeiro, autenticação e isolamento entre usuários.
- App: falha de cota suspende repetição; falhas temporárias têm espera progressiva;
  mudanças rápidas são agrupadas em 15 segundos; gravação local permanece imediata.
