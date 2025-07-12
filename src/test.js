// index.js
const { Client, GatewayIntentBits, Partials, SlashCommandBuilder, Routes, REST, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'poll') {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('yes')
          .setLabel('✅ Oui')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('no')
          .setLabel('❌ Non')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('abstain')
          .setLabel(' Blanc')
          .setStyle(ButtonStyle.Danger),
      );
    
    await interaction.reply({ content: '📊 Votez ci-dessous :', components: [row] });
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  await interaction.reply({ content: `Tu as voté : ${interaction.customId === 'yes' ? '✅ Oui' : '❌ Non'}`, ephemeral: true });
});

client.login('TON_TOKEN_ICI');
