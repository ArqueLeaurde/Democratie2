import { Message } from "discord.js"
import { CommandoMessage } from "discord.js-commando"
import Motion, { CastVoteStatus } from "../../Motion"
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
    args: { reason: string, motionId: number } // motionId a été ajouté.
  ): Promise<Message | Message[]> {
    
    let targetMotion: Motion | undefined;
    if (args.motionId > 0) {
      // Cas 1: ID spécifié.
      targetMotion = this.council.findMotionByNumber(args.motionId);
    } else {
      // Cas 2: pas d'ID fourni.
      const activeMotions = this.council.getActiveMotions();
      if (activeMotions.length === 0) {
        return msg.reply("Il n'y a aucune motion active pour laquelle voter.");
      } else if (activeMotions.length === 1) {
        targetMotion = activeMotions[0];
      } else {
        return msg.reply("Plusieurs motions sont actives. Veuillez spécifier un ID : `!<commande> \"raison\" <id_motion>`");
      }
    }

    // verif motion trouvée
    if (!targetMotion) {
      return msg.reply(`La motion #${args.motionId} est introuvable ou n'est plus active.`);
    }

    // logique initiale mais qui utilise la motion ciblée au lieu de la seule motion active
    const cmdName = msg.command?.name || (msg.command as any)?.memberName
    if (!cmdName) {
      return msg.reply("Erreur interne : impossible de déterminer la commande.")
    }

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

    if (!targetMotion.messageId) {
      return msg.reply("Impossible de retrouver le message de vote pour cette motion.")
    }
    const pollMsg = await msg.channel.messages.fetch(targetMotion.messageId)

    await Promise.all(
      ALL_EMOJIS
        .filter((emoji) => emoji !== EMOJI_BY_STATE[this.state])
        .map((emoji) =>
          pollMsg.reactions.cache.get(emoji)?.users.remove(msg.author.id)
        )
    )
    await pollMsg.react(EMOJI_BY_STATE[this.state])

    const voteStatus = targetMotion.castVote({
      authorId: msg.author.id,
      authorName: msg.member.displayName,
      name: `${cmdName} (commande)`,
      state: this.state,
      reason: args.reason,
      isDictator:
        !!this.council.getConfig("dictatorRole") &&
        msg.member.roles.cache.has(this.council.getConfig("dictatorRole")!),
    })

    // On supprime le message de commande de l'utilisateur pour garder le salon propre
    await msg.delete().catch(console.error);

    switch (voteStatus) {
      case CastVoteStatus.New:
        // Pas besoin de renvoyer un message si on met juste à jour le post de la motion
        return targetMotion.postMessage()
      case CastVoteStatus.Changed:
        return targetMotion.postMessage(
          `<@${msg.author.id}> a changé son vote en **${cmdName}**.`
        )
      default:
        return msg.reply("Votre vote n'a pas pu être enregistré.")
    }
  }
}