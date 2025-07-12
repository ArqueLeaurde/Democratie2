import { Message } from "discord.js"
import { CommandoClient, CommandoMessage } from "discord.js-commando"
import Command from "../Command"

export default class CouncilCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: "council",
      aliases: ["conseil"],
      description:
        "Désigne un salon pour le conseil.",
      councilOnly: false,
      adminOnly: true,

      args: [
        {
          key: "name",
          prompt: 'Le nom du conseil, ou "remove" pour supprimer.',
          type: "string",
          default: "Demos",
        },
      ],
    })
  }

  async execute(msg: CommandoMessage, args: any): Promise<Message | Message[]> {
    if (args.name === "remove") {
      if (this.council.enabled) {
        this.council.enabled = false
        return msg.reply(
          `Conseil supprimé "${this.council.name}". (Note: Les paramètes restent sauvegardés si tu ouvres de nouveau un conseil ici.)`
        )
      } else {
        return msg.reply("Il y a aucun conseil activé dans ce salon.")
      }
    }

    if (this.council.enabled) {
      if (this.council.name !== args.name) {
        this.council.name = args.name
        return msg.reply(`Le nom du conseil a été modifié pour "${args.name}"`)
      } else {
        return msg.reply(`Ce conseil existe déjà.`)
      }
    } else {
      this.council.enabled = true
      this.council.name = args.name

      return msg.reply(`Conseil "${args.name}" a été créé.`)
    }
  }
}
