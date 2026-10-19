# CORREÇÃO V67 — ID DO BANCO FIRESTORE

O banco mostrado no seu Google Cloud está com o ID **`default`** (sem parênteses).
A versão anterior do CRM estava conectando em **`(default)`**, por isso o Authentication funcionava, mas o Firestore respondia que o banco não existia.

Nesta versão o arquivo `firebase-config.js` contém:

```js
databaseId: "default"
```

E o SDK/REST do CRM usam esse mesmo ID.

> Se você futuramente recriar o banco como `(default)`, altere apenas `databaseId` para `"(default)"`.

---

# Firebase — AG CRM V60

Projeto configurado: `agimoveis-6308b`.

## Arquitetura usada nesta versão

- **Firebase Authentication**: login por e-mail/senha e Google.
- **Cloud Firestore**: usuários, permissões, dados do CRM e catálogo público do site.
- **Google Drive**: será usado futuramente para fotos e documentos. A integração com Drive ainda não está ativa nesta versão.
- **Firebase Storage não é usado e não precisa ser habilitado.**

## 1. Crie o Cloud Firestore

No Firebase Console:

1. Abra **Build → Firestore Database**.
2. Clique em **Create database / Criar banco de dados**.
3. Crie o banco padrão **`(default)`**.
4. Escolha a região do projeto.
5. Abra **Rules / Regras** e publique o conteúdo de `firestore.rules`.

Se aparecer `Failed to get document because the client is offline`, confirme primeiro se o Firestore `(default)` foi realmente criado.

## 2. Authentication

Em **Build → Authentication → Sign-in method**:

- ative **Email/Password**;
- ative **Google**;
- em **Settings → Authorized domains**, adicione o domínio onde o CRM está hospedado.

Exemplos: `seuusuario.github.io` ou `crm.seudominio.com.br`, sem `https://` e sem caminho.

## 3. Primeiro administrador

Com o Firestore vazio, o primeiro usuário autenticado cria `system/bootstrap` e recebe o perfil **Administrador**. Os próximos cadastros ficam aguardando aprovação em **Ajustes → Usuários e permissões**.

## 4. Fotos e documentos nesta versão

As fotos adicionadas localmente continuam disponíveis no navegador em que foram carregadas, mas **não são enviadas para o Firestore** e não usam Firebase Storage. Isso evita gravar imagens Base64 em documentos do Firestore.

Quando a integração com Google Drive for implementada, o CRM enviará o arquivo ao Drive e salvará no Firestore apenas o ID/link do arquivo.

## 5. Diagnóstico de conexão

O CRM:

- usa long polling no Firestore para melhorar compatibilidade com algumas hospedagens/redes;
- tenta reconectar automaticamente;
- mantém a sessão do Authentication mesmo se o Firestore estiver temporariamente indisponível;
- mostra **Tentar conectar ao Firestore** quando necessário.

Abra o CRM por **http/https**. Não use `file://` para testar Google Authentication.


## Cadastro de usuários no Firestore
Nesta versão, todo usuário criado no Firebase Authentication também recebe um documento em `users/{uid}` no Cloud Firestore.

- Primeiro usuário: `Administrador`, `active: true`, `approvalStatus: approved`.
- Usuários seguintes: `Corretor`, `active: false`, `approvalStatus: pending` até o administrador aprovar.
- A solicitação também é registrada em `accessRequests/{uid}` para aparecer em Ajustes > Usuários e permissões.

**Importante:** publique o arquivo `firestore.rules` desta mesma versão. As regras anteriores não permitiam que um usuário comum criasse o próprio perfil pendente em `users/{uid}`.


## Correção V62 — Authentication criou, mas Firestore não

A V62 não usa mais uma leitura de `public/catalog` como pré-requisito para criar o perfil. Logo após a autenticação, ela grava diretamente o perfil do usuário em `users/{uid}`.

Se já existe um usuário no **Authentication** mas não existe em **Firestore**, basta entrar novamente com esse usuário usando a V62. O CRM detecta a ausência e cria automaticamente o documento.

**Obrigatório:** copie todo o conteúdo de `firestore.rules`, vá em **Firebase Console → Firestore Database → Regras**, substitua as regras existentes e clique em **Publicar**.

Depois confirme em **Firestore Database → Dados** que surgiram as coleções `users` e `system` (primeiro administrador), ou `users` e `accessRequests` (usuário pendente).

## Correção V63 — não fica mais preso em “Conectando ao Firestore”

A V63 possui dois transportes para o Firestore:

1. SDK oficial Firebase/Firestore;
2. fallback REST HTTPS autenticado pelo mesmo Firebase Authentication.

Se o navegador/hospedagem bloquear o canal usado pelo SDK e ele ficar offline, o CRM troca automaticamente para HTTPS comum. O login não deve permanecer indefinidamente em “Conectando ao Firestore”.

### Regras obrigatórias da V63

Publique o `firestore.rules` deste pacote. O bootstrap do primeiro administrador foi ajustado para funcionar também no modo REST HTTPS.

### Se ainda houver erro após publicar as regras

A mensagem mostrada no login passa a representar a resposta real do Firestore. Se indicar que o banco `(default)` não foi encontrado, é necessário criar **Firestore Database** no Firebase Console; isso não tem relação com Firebase Storage.


## V64 — correção do travamento após autenticação

O CRM agora usa a API REST HTTPS do Cloud Firestore como caminho primário para criar/ler `users/{uid}` durante o login. Assim, o SDK do Firestore não consegue mais deixar a tela presa indefinidamente em “Conectando ao Firestore…”. Há também um timeout global de inicialização.

Se o Firestore estiver sem banco `(default)` ou as regras não tiverem sido publicadas, a tela exibirá o erro correspondente em vez de ficar carregando.


## V65 — usuário do Authentication sem documento no Firestore

Criar um usuário manualmente em **Authentication** não cria automaticamente um documento no Cloud Firestore.
A V65 faz essa criação no **primeiro login pelo CRM**.

Fluxo do primeiro usuário com Firestore vazio:
1. usuário autentica;
2. CRM cria `system/bootstrap` com o UID autenticado;
3. CRM cria `users/{uid}` como `Administrador`;
4. CRM relê o documento para confirmar a gravação;
5. somente depois libera a interface.

Para funcionar, publique o `firestore.rules` desta V65 em **Firestore Database → Regras**.
Se você já criou o usuário no Authentication, não precisa apagá-lo: publique as regras e entre com ele pelo CRM.


## V66 — fluxo definitivo de usuários

- Com o Firestore vazio, o **primeiro usuário autenticado** cria `system/bootstrap` e `users/{uid}` automaticamente como **Administrador**, ativo e aprovado.
- Qualquer **novo cadastro posterior** (e-mail/senha ou Google) cria `users/{uid}` como **Corretor**, `active: false`, `approvalStatus: pending`, além de `accessRequests/{uid}`.
- O usuário pendente **não entra no CRM** até ser aprovado.
- O Administrador aprova ou recusa em **Ajustes → Usuários e permissões** e pode escolher o perfil antes de aprovar.
- Usuários criados diretamente pelo Administrador na própria aba continuam sendo criados já aprovados, pois a ação já parte de uma conta Administradora autenticada.

Publique o `firestore.rules` deste pacote para garantir que um cadastro comum não consiga se autoaprovar.


## V68 — cache e banco nomeado
Use a pasta inteira desta versão. O CRM fixa o banco como `(default)` e os arquivos carregam com `?v=69` para evitar cache de versões antigas.
