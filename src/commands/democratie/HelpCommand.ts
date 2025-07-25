import { MessageEmbed } from 'discord.js';
import { CommandoClient, CommandoMessage } from 'discord.js-commando';
import Command from '../Command';

const SYNTAXES: Record<string, string> = {
  election: "!election \"raison\" <dur_cand> <dur_vote> | !election list | !election status <id> | !election kill <id>",
  candidat: "!candidat \"raison\" [id_election]",
  motion: "!motion <texte> | !motion list | !motion status [id] | !motion kill <id>",
  yes: "!yes \"raison\" [id_motion]",
  no: "!no \"raison\" [id_motion]",
  abstain: "!abstain [raison] [id_motion]",
  pinginactive: "!pinginactive",
  archive: "!archive [plage] | !archive export",
  config: "!config [point] [valeur]/$remove",
  councilstats: "!councilstats",
  council: "!council [nom] | !council remove",
  setweight: "!setweight [@membre/@rôle] [poids]",
  help: "!help | !help [commande]"
}


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

      // displays the command's syntax
      const syntax = SYNTAXES[command.name]
      if (syntax) {
        embed.addField("Syntaxe", `\`${syntax}\``)
      }

      return msg.embed(embed);
    } 
    // 2 - General case (!help)
    else {
      const embed = new MessageEmbed()
        .setColor('#2ecc71')
        .setTitle('🏛️ Panneau d\'aide de Démocratie')
        .setThumbnail(this.client.user?.displayAvatarURL() || '')
        .setDescription(`Voici la liste des commandes disponibles.\nPour plus d'informations sur une commande, tapez \`!help <nom_de_la_commande>\`.`);

      // group by command group
      const commandGroups = this.organizeCommandsByGroup();

      for (const [groupName, commands] of Object.entries(commandGroups)) {
        if (commands.length > 0) {
          const commandList = commands
            .map(cmd => `**!${cmd.name}** - ${cmd.description.substring(0, 60)}${cmd.description.length > 60 ? '...' : ''}`)
            .join('\n');
          
          // diviser si nécessaire pour éviter erreur trop long
          const chunks = this.splitIntoChunks(commandList, 1000);
          chunks.forEach((chunk, index) => {
            const fieldName = index === 0 ? `${groupName}` : `${groupName} (suite)`;
            embed.addField(fieldName, chunk, false);
          });
        }
      }

      embed.setFooter('Vive la Démocratie • Tapez !help <commande> pour plus de détails');

      return msg.embed(embed);
    }
  }

  private organizeCommandsByGroup(): Record<string, Command[]> {
    const groups = {
      '🗳️ Élections': [] as Command[],
      '📋 Motions': [] as Command[],
      '⚙️ Configuration': [] as Command[],
      '📊 Statistiques': [] as Command[],
      '🔧 Autres': [] as Command[]
    };

    // Récupérer toutes les commandes du groupe democratie
    const democratieGroup = this.client.registry.groups.get('democratie');
    if (!democratieGroup) return groups;

    // Convertir la Collection en Array et filtrer
    const commands = Array.from(democratieGroup.commands.values())
      .filter(cmd => !cmd.ownerOnly)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Classer les commandes par groupe
    for (const cmd of commands) {
      const command = cmd as Command;
      switch (command.name) {
        case 'election':
        case 'candidat':
          groups['🗳️ Élections'].push(command);
          break;
        
        case 'motion':
        case 'yes':
        case 'no':
        case 'abstain':
        case 'pinginactive':
          groups['📋 Motions'].push(command);
          break;
        
        case 'config':
        case 'council':
        case 'setweight':
          groups['⚙️ Configuration'].push(command);
          break;
        
        case 'councilstats':
        case 'archive':
          groups['📊 Statistiques'].push(command);
          break;
        
        default:
          groups['🔧 Autres'].push(command);
          break;
      }
    }

    return groups;
  }

  private splitIntoChunks(text: string, maxLength: number): string[] {
    const lines = text.split('\n');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }
}
