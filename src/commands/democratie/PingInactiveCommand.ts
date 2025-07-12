import { Message } from "discord.js"
import { CommandoClient, CommandoMessage } from "discord.js-commando"
import Command from "../Command"

export default class PingInactiveCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: "pinginactive",
      aliases: [
        "chomeurs",
        "flemmards",
        "absents",
        "pingremaining",
        "mentionremaining",
        "alertothers",
        "lazyvoters",
      ],
      description:
        "Mentionne les membres du conseil qui n'ont pas voté.",
      adminsAlwaysAllowed: true
    })
  }

  async execute(msg: CommandoMessage, args: any): Promise<Message | Message[]> {
    if (this.council.currentMotion == null) {
      return msg.reply("Il y a actuellement aucune motion active.")
    }

    return msg.reply(
      "Ces membres du conseil doivent voter :\n\n" +
        this.council.currentMotion.getRemainingVoters().array().join(" ")
    )
  }
}
