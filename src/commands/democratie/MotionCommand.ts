import { Message } from "discord.js"
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
      description: "Créer une motion",

      allowWithConfigurableRoles: ["proposeRole"],
      adminsAlwaysAllowed: true,

      args: [
        {
          key: "text",
          prompt: "Le texte du motion à proposer.",
          type: "string",
          default: "",
        },
      ],
    })
  }

  async execute(msg: CommandoMessage, args: any): Promise<Message | Message[]> {
    await msg.guild.members.fetch() // Privileged intents fix

    if (!args.text) {
      if (this.council.currentMotion) {
        return this.council.currentMotion.postMessage()
      } else {
        return msg.reply(
          "Aucune motion n'est active. Fait `!motion <texte>` pour créer une."
        )
      }
    }

    if (this.council.currentMotion) {
      if (args.text === "kill") {
        if (
          this.council.currentMotion.authorId === msg.author.id ||
          msg.member.hasPermission("MANAGE_GUILD") ||
          !!msg.member.roles.cache.find((role) => role.name === "Democratie Admin")
        ) {
          const motion = this.council.currentMotion
          motion.resolve(MotionResolution.Killed)
          return motion.postMessage()
        } else {
          return msg.reply("Tu as pas la permission de tuer cette motion.")
        }
      }

      if (!this.council.getConfig("motionQueue")) {
        return msg.reply("Il y a déjà actuellement une motion active.")
      }
    }

    if (args.text === "kill") {
      return msg.reply("Il y a aucune motion active.")
    }

    if (this.council.getConfig("councilorMotionDisable")) {
      return msg.reply("La création de motions est désactivée dans ce conseil.")
    }

    const proposeRole = this.council.getConfig("proposeRole")
    if (proposeRole && !msg.member.roles.cache.has(proposeRole)) {
      return msg.reply("Tu as pas les permissions de proposer une motion.")
    }

    if (args.text.length > 2000) {
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

    let voteType = LegacyMotionVoteType.Majority

    const result = Motion.parseMotionOptions(args.text)

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
          //`The given majority type is disallowed by the ~majority.minimum~ configuration point. Please specify a higher majority.`
          `Le type de majorité spécifié n'est pas autorisé par le point de configuration ~majority.minimum~ . Veuillez spécifier un majorité plus haute.`
        )
      )
    }

    const motionAlreadyExists = this.council.currentMotion

    if (this.council.getConfig("userCooldownKill")) {
      this.council.setUserCooldown(msg.author.id, Date.now())
    }

    const motion = this.council.createMotion({
      text,
      authorId: msg.author.id,
      authorName: msg.member.displayName,
      createdAt: Date.now(),
      voteType,
      active: true,
      resolution: MotionResolution.Unresolved,
      didExpire: false,
      votes: [],
      options,
    })

    if (motionAlreadyExists) {
      return msg.reply(
        response(
          ResponseType.Good,
          "Ta motion est en attente et sera proposée après la motion actuelle."
        )
      )
    }

    return motion.postMessage(true)
  }
}
