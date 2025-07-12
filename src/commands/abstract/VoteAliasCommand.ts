import { Message } from "discord.js"
import { CommandoMessage } from "discord.js-commando"
import { CastVoteStatus } from "../../Motion"
import { CouncilData } from "../../CouncilData"
import Command from "../Command"

const EMOJI_BY_STATE: Record<number, string> = {
  1: "👍",
  0: "🏳️",
  [-1]: "👎",
}
const ALL_EMOJIS = Object.values(EMOJI_BY_STATE)

export default class VoteAliasCommand extends Command {
  protected state!: 1 | 0 | -1

  async execute(
    msg: CommandoMessage,
    args: { reason: string }
  ): Promise<Message | Message[]> {
    // check for active motion
    if (!this.council.currentMotion) {
      return msg.reply("Pas de motion en cours.")
    }

    // get called command
    const cmdName =
      msg.command?.name || (msg.command as any)?.memberName
    if (!cmdName) {
      return msg.reply("Erreur interne : impossible de déterminer la commande.")
    }

    // check for reason (if command --> yes, if reaction --> no)
    const reasonKeyMap: Record<string, keyof CouncilData> = {
      yes: "reasonRequiredYes",
      no: "reasonRequiredNo",
      abstain: "reasonRequiredAbstain",
    }
    const reasonKey = reasonKeyMap[cmdName]
    if (!args.reason && this.council.getConfig(reasonKey)) {
      return msg.reply("Vous devez fournir une raison pour votre vote.")
    }
    if (args.reason.length > 1000) {
      return msg.reply("Raison trop longue (max 1000 caractères).")
    }

    const motion = this.council.currentMotion

    // load message and update reactions
    if (!motion.messageId) {
      return msg.reply("Impossible de retrouver le message de vote.")
    }
    const pollMsg = await msg.channel.messages.fetch(motion.messageId)

    // remove old reactions 
    await Promise.all(
      ALL_EMOJIS
        .filter((emoji) => emoji !== EMOJI_BY_STATE[this.state])
        .map((emoji) =>
          pollMsg.reactions.cache.get(emoji)?.users.remove(msg.author.id)
        )
    )
    // add corresponding reaction
    await pollMsg.react(EMOJI_BY_STATE[this.state])

    // cast vote
    const voteStatus = motion.castVote({
      authorId: msg.author.id,
      authorName: msg.member.displayName,
      name: `${cmdName} (commande)`,
      state: this.state,
      reason: args.reason,
      isDictator:
        !!this.council.getConfig("dictatorRole") &&
        msg.member.roles.cache.has(this.council.getConfig("dictatorRole")!),
    })

    // user feedback on vote change
    switch (voteStatus) {
      case CastVoteStatus.New:
        return motion.postMessage()
      case CastVoteStatus.Changed:
        return motion.postMessage(
          `${msg.member} a changé son vote en ${cmdName}.`
        )
      default:
        return msg.reply("Votre vote n'a pas pu être enregistré.")
    }
  }
}
