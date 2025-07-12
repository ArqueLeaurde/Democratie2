import { MessageEmbed } from 'discord.js';
import { CommandoClient, CommandoMessage } from 'discord.js-commando';
import Command from '../Command';

export default class HelpCommand extends Command {
  constructor(client : CommandoClient) {
    super(client, {
      name: 'help',
      aliases: ['aide', 'h'],
      description: "Affiche la liste des commandes ou des informations sur une commande spécifique.",
      councilOnly: false, // help command available everywhere, not limited to council channel
      args: [
        {
          key: 'commandName',
          prompt: 'Sur quelle commande souhaitez-vous de l\'aide ?',
          type: 'string',
          default: '', 
        },
      ],
    });
  }

  public async execute(msg: CommandoMessage, args: { commandName: string }): Promise<any> {
    const { commandName } = args;

    // 1- Specific command (!help [command])
    if (commandName) {
      // check for command name or aliases
      const commands = this.client.registry.findCommands(commandName, true);
      if (commands.length === 0) {
        return msg.reply("Cette commande n'existe pas.");
      }
      
      const command = commands[0] as Command; 

      const embed = new MessageEmbed()
        .setColor('#3498db') //sidebar color
        .setTitle(`Aide pour la commande : \`!${command.name}\``)
        .setDescription(command.description);

      if (command.aliases && command.aliases.length > 0) {
        embed.addField('Alias', `\`${command.aliases.join('`, `')}\``);
      }

	  // displays who can use the command
      if (command.councilOnly) {
        embed.addField('Permission', 'Réservée au salon du conseil');
      }
      if (command.adminOnly) {
        embed.addField('Permission', 'Réservée aux administrateurs');
      }

      return msg.embed(embed);
    } 
    // 2 - General case (!help)
    else {
      const embed = new MessageEmbed()
        .setColor('#2ecc71') // side bar color
        .setTitle('Panneau d\'aide de Démocratie')
        .setThumbnail(this.client.user?.displayAvatarURL() || '') // display updated avatar on the help pannel if null or undefined --> no picture
        .setDescription(`Voici la liste des commandes disponibles.
        Pour plus d'informations sur une commande, tapez \`!help <nom_de_la_commande>\`.`);
      

      // group commands by category
      const sortedGroups = Array.from(this.client.registry.groups.values())
          .sort((a, b) => a.name.localeCompare(b.name));

      for (const group of sortedGroups) {
        // ownerOnly commands arent displayed
        const commands = group.commands
          .filter(cmd => !cmd.ownerOnly)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(cmd => `**${cmd.name}**: ${cmd.description}`) // display description next to command
          .join('\n');
        if (commands.length > 0) {
            embed.addField(`Groupe : ${group.name}`, commands);
        }
      }

      embed.setFooter('Vive la Démocratie');

      return msg.embed(embed);
    }
  }
}