import { Message } from "discord.js";
import { CommandoClient, CommandoMessage } from "discord.js-commando";
import Command from "../Command";

export default class CandidatCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: "candidat",
      description: "Se porter candidat aux élections",
      args: [
        {
          key: "reason",
          prompt: "Pourquoi te présenter ?",
          type: "string",
        },
      ],
    });
  }

  async run(
    msg: CommandoMessage,
    args: any,
    fromPattern?: boolean
  ): Promise<Message | Message[]> {
    const { reason } = args as { reason: string };
    const democratie = (this.client as any).democratie;
    const election = democratie.currentElection;

    if (!election || election.data.phase !== "Candidacy") {
      return msg.reply("Aucune élection en phase de candidature.");
    }

    election.addCandidate(msg.author.id, msg.member.displayName, reason);
    return msg.reply("✅ Candidature enregistrée.");
  }
}
