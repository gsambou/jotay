import { test, expect } from '@playwright/test';

// Parcours nominal du portail participant, dans un vrai navigateur.
test('portail — connexion OTP puis affichage du solde', async ({ page }) => {
  await page.goto('/w/OPAQUE');

  await page.getByPlaceholder('+221').fill('+221771112233');
  await page.getByRole('button', { name: 'Recevoir le code' }).click();

  await page.getByPlaceholder('Code').fill('654321'); // code fixe du fake OTP
  await page.getByRole('button', { name: 'Valider' }).click();

  // Le solde serveur seedé (3000) s'affiche, avec l'indicateur de fraîcheur.
  await expect(page.locator('#balance')).toHaveText('3 000');
  await expect(page.locator('#asof')).toContainText('À jour à');
});

test('portail — code erroné : message d\'erreur, pas de solde', async ({ page }) => {
  await page.goto('/w/OPAQUE');
  await page.getByPlaceholder('+221').fill('+221771112233');
  await page.getByRole('button', { name: 'Recevoir le code' }).click();
  await page.getByPlaceholder('Code').fill('000000');
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.locator('#err-code')).toContainText('invalide');
});
