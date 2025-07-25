import { CommandoClient, CommandoMessage } from "discord.js-commando"
import Command from "../Command"
import Democratie from "../../Democratie"
import Election from "../../Election"

type Args = {
  reason: string
  electionId: number
}

export default class CandidatCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: "candidat",
      aliases: ["candidate"],
      description: "Se porter candidat pour une élection en cours.",
      args: [
        {
          key: "reason",
          prompt: "Quelle est la raison de votre candidature ?",
          type: "string",
          default: ""
        },
        {
          key: "electionId",
          prompt: "Pour quelle élection souhaitez-vous postuler (ID) ?",
          type: "integer",
          default: 0 // ID optionnel
        }
      ],
    })
  }

  async run(
    msg: CommandoMessage,
    args: Args
  ): Promise<any> {
    const democratie = (this.client as any).democratie as typeof Democratie
    const { reason, electionId } = args;

    if (!reason) {
      return msg.reply("❌ Vous devez fournir une raison pour votre candidature. Exemple : `!candidat \"Mon programme est le meilleur\" 1`")
    }

    let targetElection: Election | undefined;

    // déterminer à quelle élection postuler
    if (electionId > 0) {
      // Cas 1: ID spécifié.
      targetElection = democratie.elections.get(`election-${electionId}`);
      if (!targetElection) {
        return msg.reply(`⚠️ L'élection avec l'ID ${electionId} est introuvable ou terminée.`);
      }
    } else {
      // Cas 2: ID non spécifié.
      // On cherche les élections en phase de candidature dans ce salon.
      const activeElectionsInChannel = Array.from(democratie.elections.values()).filter(
        e => e.data.phase === 'Candidacy' && e.data.channelId === msg.channel.id
      );

      if (activeElectionsInChannel.length === 0) {
        return msg.reply("ℹ️ Il n'y a aucune élection en phase de candidature actuellement dans ce salon.");
      } else if (activeElectionsInChannel.length === 1) {
        // S'il n'y en a qu'une, on la cible automatiquement.
        targetElection = activeElectionsInChannel[0];
      } else {
        // S'il y en a plusieurs, on demande à l'utilisateur de préciser.
        return msg.reply("Plusieurs élections sont en cours. Veuillez spécifier un ID. `!candidat \"Ma raison\" <id_election>`");
      }
    }

    // Vérifications appliquées à l'élection ciblée.
    if (targetElection.data.phase !== "Candidacy") {
      return msg.reply("La phase de candidature pour cette élection est terminée.");
    }

    if (targetElection.data.candidates.some(c => c.id === msg.author.id)) {
      return msg.reply("Vous êtes déjà candidat pour cette élection.");
    }

    // Ajout du candidat à l'élection spécifique.
    targetElection.addCandidate(msg.author.id, msg.member.displayName, reason);

    const targetId = targetElection.data.id.split('-')[1];
    return msg.reply(`✅ Félicitations ! Vous êtes maintenant candidat pour l'élection **ID ${targetId}** : "${targetElection.data.reason}".`);
  }
}