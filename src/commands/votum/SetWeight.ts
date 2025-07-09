import { Message } from "discord.js"
import { CommandoClient, CommandoMessage } from "discord.js-commando"
import Command from "../Command"

export default class SetWeightCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: "setweight",
      aliases: ["voteweights"],
      adminOnly: true,
      description:
        "Définit le poids du vote d'un membre spécifique du conseil ou d'un rôle (les poids des différents rôles sont cumulatifs)",

      args: [
        {
          key: "target",
          prompt: "The member or role to set the weight of",
          type: "member|role",
          default: "",
        },
        {
          key: "weight",
          prompt: "The weight to set",
          type: "float",
          default: 1,
        },
      ],
    })
  }

  async execute(msg: CommandoMessage, args: any): Promise<Message | Message[]> {
    const weights = this.council.getVoteWeights() || {}

    if (args.target !== "" && typeof args.weight === "number") {
      if (args.weight < 0) {
        return msg.reply("Le poids du vote ne doit pas être inférieur à 0")
      }

      if (args.weight === 1) {
        delete weights[args.target.id]
      } else {
        weights[args.target.id] = args.weight
      }

      this.council.setConfig("voteWeights", weights)
    }

    const lines = []
    for (const [id, weight] of Object.entries(weights)) {
      const maybeRole = await msg.guild.roles.fetch(id)
      const maybeUser = maybeRole
        ? null
        : await msg.guild.members.fetch(id).catch(() => null)

      if (maybeRole) {
        lines.push(`[Role] ${maybeRole.name} : ${weight}`)
      } else if (maybeUser) {
        lines.push(`[User] ${maybeUser.user.tag} : ${weight}`)
      } else {
        lines.push(`[Unknown] ${id} : ${weight}`)
      }
    }

    return msg.reply(
      (args.target ? `Le poids du vote de ${args.target} a été défini sur ${args.weight}.\n` : "") +
        `\n${lines.join("\n")}`,
      {
        split: true,
      }
    )
  }
}
