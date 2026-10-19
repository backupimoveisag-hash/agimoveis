// AG CRM V105 — Google Drive backup
// O OAuth Client ID de uma aplicação Web NÃO é segredo e pode ficar no front-end.
// Configure no Google Cloud Console e substitua o valor abaixo.
window.AG_GOOGLE_DRIVE_CONFIG = {
  enabled: true,
  oauthClientId: "COLE_AQUI_O_CLIENT_ID.apps.googleusercontent.com",
  folderName: "AG CRM Backups",
  autoBackup: false,
  autoBackupDelayMs: 120000
};
