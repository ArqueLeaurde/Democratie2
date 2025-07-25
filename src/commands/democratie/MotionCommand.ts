import { Message, MessageEmbed } from "discord.js"
import { CommandoClient, CommandoMessage } from "discord.js-commando"
import { PathReporter } from "io-ts/lib/PathReporter"
import Motion, { LegacyMotionVoteType, MotionResolution } from "../../Motion"
import { response, ResponseType } from "../../Util"
import Command from "../Command"

export default class MotionCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: "motion",
      aliases: ["propose", "proposal", "call"],
      description: "Gère les motions.",

      allowWithConfigurableRoles: ["proposeRole"],
      adminsAlwaysAllowed: true,

      args: [
        {
          key: "subcommandOrText",
          prompt: "Le texte de la motion, ou une sous-commande (list, status, kill).",
          type: "string",
          default: "",
        },
        {
            key: "id",
            prompt: "L'ID de la motion (pour status/kill).",
            type: "integer",
            default: 0, // 0 indique qu'aucun ID n'a été fourni
        }
      ],
    })
  }

  async execute(msg: CommandoMessage, args: { subcommandOrText: string, id: number }): Promise<Message | Message[]> {
    await msg.guild.members.fetch() // Privileged intents fix

    const { subcommandOrText, id } = args

    // gestion !motion list
    if (subcommandOrText.toLowerCase() === 'list') {
        const activeMotions = this.council.getActiveMotions()
        if (activeMotions.length === 0) {
            return msg.reply("Aucune motion n'est actuellement active.")
        }
        const embed = new MessageEmbed()
            .setTitle("📋 Motions Actives")
            .setColor("BLUE")
            .setDescription(activeMotions.map(m => `**#${m.number}**: ${m.text.substring(0, 100)}...`).join('\n\n'))
        return msg.embed(embed)
    }

    // gestion !motion status [id]
    if (subcommandOrText.toLowerCase() === 'status') {
        let motionToDisplay: Motion | undefined;
        if (id > 0) {
            motionToDisplay = this.council.findMotionByNumber(id);
        } else {
            const activeMotions = this.council.getActiveMotions();
            if (activeMotions.length === 1) {
                motionToDisplay = activeMotions[0];
            } else if (activeMotions.length > 1) {
                return msg.reply("Plusieurs motions sont actives. Veuillez spécifier un ID : `!motion status <id>`");
            }
        }

        if (!motionToDisplay) {
            return msg.reply(id > 0 ? `La motion #${id} est introuvable.` : `Aucune motion active.`);
        }
        return motionToDisplay.postMessage();
    }

    // gestion !motion kill [id]
    if (subcommandOrText.toLowerCase() === 'kill') {
        let motionToKill: Motion | undefined;
        if (id > 0) {
            motionToKill = this.council.findMotionByNumber(id);
        } else {
            const activeMotions = this.council.getActiveMotions();
            if (activeMotions.length === 1) {
                motionToKill = activeMotions[0];
            } else if (activeMotions.length > 1) {
                return msg.reply("Plusieurs motions sont actives. Veuillez spécifier un ID : `!motion kill <id>`");
            }
        }
        
        if (!motionToKill) {
            return msg.reply(id > 0 ? `La motion #${id} est introuvable.` : `Aucune motion active à annuler.`);
        }

        if (motionToKill.authorId === msg.author.id || msg.member.hasPermission("MANAGE_GUILD")) {
            motionToKill.resolve(MotionResolution.Killed)
            await motionToKill.postMessage()
            return msg.say(`La motion #${motionToKill.number} a été annulée.`)
        } else {
            return msg.reply("Vous n'avez pas la permission d'annuler cette motion.")
        }
    }

    // gestion !motion <texte>
    const fullText = subcommandOrText.trim();
    
    if (fullText.length === 0) {
        return msg.reply("Syntaxe incorrecte. Pour créer une motion, tapez `!motion <texte de la proposition>`.");
    }

    // Logique de file d'attente retirée car plusieurs motion peuvent être gérées maintenant

    if (this.council.getConfig("councilorMotionDisable")) {
      return msg.reply("La création de motions est désactivée dans ce conseil.")
    }

    const proposeRole = this.council.getConfig("proposeRole")
    if (proposeRole && !msg.member.roles.cache.has(proposeRole)) {
      return msg.reply("Tu as pas les permissions de proposer une motion.")
    }

    if (fullText.length > 2000) {
      return msg.reply(
        "Ta motion est trop longue. La taille limite est de 2000 caractères."
      )
    }

    if (this.council.isUserOnCooldown(msg.author.id)) {
      return msg.reply(
        `Tu dois attendre ${+(this.council.userCooldown / 3600000).toFixed(
          2
        )} heures entre chaque motions. (${+(
          this.council.getUserCooldown(msg.author.id) / 3600000
        ).toFixed(2)} heures restants)`
      )
    }

    const result = Motion.parseMotionOptions(fullText)

    if (result.isLeft()) {
      return msg.reply(
        response(ResponseType.Bad, PathReporter.report(result).join("\n"))
      )
    }

    const [text, options] = result.value

    if (
      options.majority &&
      options.majority < this.council.getConfig("majorityMinimum")
    ) {
      return msg.reply(
        response(
          ResponseType.Bad,
          `Le type de majorité spécifié n'est pas autorisé par le point de configuration ~majority.minimum~ . Veuillez spécifier un majorité plus haute.`
        )
      )
    }

    if (this.council.getConfig("userCooldownKill")) {
      this.council.setUserCooldown(msg.author.id, Date.now())
    }

    // Création de la motion
    const motion = this.council.createMotion({
      text,
      authorId: msg.author.id,
      authorName: msg.member.displayName,
      createdAt: Date.now(),
      voteType: LegacyMotionVoteType.Majority, // voteType est conservé pour la rétrocompatibilité potentielle avec commandes mais géré par les options
      active: true,
      resolution: MotionResolution.Unresolved,
      didExpire: false,
      votes: [],
      options,
    })

    await msg.reply(`✅ Motion **#${motion.number}** créée avec succès !`)
    return motion.postMessage(true)
  }
}
