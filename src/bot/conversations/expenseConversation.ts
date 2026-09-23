import { Conversation } from '@grammyjs/conversations';
import { Context } from 'grammy';
import { Charge, ICharge } from '../../models/Charge.js';

type MyContext = Context;
type MyConversation = Conversation<MyContext>;

export async function addExpenseConversation(conversation: MyConversation, ctx: MyContext) {
  // Step 1: Description
  await ctx.reply('💸 **Enregistrement d\'une nouvelle Dépense / Masrouf**\n\n👉 *A3tini el description:* (Ex: `Clinique Hannibal - Patiente Amira`, `Sponsor Meta`, `Kray Cabinet`)', { parse_mode: 'Markdown' });
  
  const descCtx = await conversation.wait();
  const description = descCtx.message?.text?.trim() || 'Dépense Sans Titre';

  // Step 2: Montant
  await ctx.reply('💰 *A3tini el Montant b TND:* (Ex: `800` ou `1500`)', { parse_mode: 'Markdown' });
  
  const amountCtx = await conversation.wait();
  const montant = parseFloat(amountCtx.message?.text || '0');

  if (isNaN(montant) || montant <= 0) {
    await ctx.reply('❌ **Montant invalide !** Annulation.');
    return;
  }

  // Step 3: Type & Catégorie
  await ctx.reply(
    '🏷 *Ekhter el Catégorie mta3 el masrouf:*\n\n' +
    '🔴 **Charges Directes (Interventions):**\n' +
    '1️⃣ `Clinique` / `Bloc`\n' +
    '2️⃣ `Hôtel` / `Transfert`\n\n' +
    '🔵 **Charges Fixes (Générales):**\n' +
    '3️⃣ `SPONSOR` (Pub / Meta)\n' +
    '4️⃣ `LOYER` (Kray Cabinet)\n' +
    '5️⃣ `ELECTRICITE` (STEG / Eau / Net)\n' +
    '6️⃣ `SALAIRE` (Assistante / Equipe)\n' +
    '7️⃣ `AUTRE`',
    { parse_mode: 'Markdown' }
  );

  const catCtx = await conversation.wait();
  const choice = catCtx.message?.text?.trim();

  let categorie = 'AUTRE';
  let typeCharge: 'DIRECTE' | 'FIXE' = 'FIXE';

  if (choice === '1') { categorie = 'Clinique'; typeCharge = 'DIRECTE'; }
  else if (choice === '2') { categorie = 'Hôtel'; typeCharge = 'DIRECTE'; }
  else if (choice === '3' || choice?.toUpperCase() === 'SPONSOR') { categorie = 'SPONSOR'; typeCharge = 'FIXE'; }
  else if (choice === '4' || choice?.toUpperCase() === 'LOYER') { categorie = 'LOYER'; typeCharge = 'FIXE'; }
  else if (choice === '5' || choice?.toUpperCase() === 'ELECTRICITE') { categorie = 'ELECTRICITE'; typeCharge = 'FIXE'; }
  else if (choice === '6' || choice?.toUpperCase() === 'SALAIRE') { categorie = 'SALAIRE'; typeCharge = 'FIXE'; }

  // Save to DB
  const newExpense: ICharge = await Charge.create({
    typeCharge,
    categorie,
    montant,
    description,
    date: new Date(),
  });

  const dateFormatted = new Date(newExpense.date).toLocaleDateString('fr-FR');

  await ctx.reply(
    `✅ **Masrouf Enregistré b Njaḥ !**\n\n` +
    `📌 **Description:** ${description}\n` +
    `💰 **Montant:** \`${montant} TND\`\n` +
    `🏷 **Catégorie:** \`${categorie}\` (${typeCharge})\n` +
    `📅 **Date:** ${dateFormatted}`,
    { parse_mode: 'Markdown' }
  );
}