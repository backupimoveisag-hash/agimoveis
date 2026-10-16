# Firebase — AG Site

Este pacote já aponta para o projeto `agimoveis-6308b` e usa o mesmo catálogo público do CRM.

Para funcionar:
1. Crie/ative o **Cloud Firestore** no projeto.
2. Publique as regras `firestore.rules` que acompanham o pacote do CRM V56.
3. No Firebase Authentication do CRM, habilite **E-mail/senha** e **Google**.
4. Mantenha o mesmo `workspaceId: "main"` no CRM e no site.

O site lê `public/catalog` em tempo real e grava contatos em `siteLeads`.


Projeto Firebase atualizado: agimoveis-6308b. Firestore padrão: (default). Firebase Storage não é utilizado.
