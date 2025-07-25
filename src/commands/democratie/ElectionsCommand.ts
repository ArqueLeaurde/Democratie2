import Discord, { TextChannel, Message, MessageEmbed } from "discord.js"
import { CommandoClient, CommandoMessage } from "discord.js-commando"
import Command from "../Command"
import Election from "../../Election"
import { ElectionData } from "../../ElectionData"
import Democratie from "../../Democratie"

type Args = {
  subcommandOrReason: string
  candDurOrId: number
  voteDur: number
}

let electionCounter = 0;

export default class ElectionsCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: "election",
      description: "Gère les élections.",
      args: [
        {
          key: "subcommandOrReason",
          prompt: "Le motif de l’élection, ou une sous-commande (list, status, kill).",
          type: "string",
          default: ""
        },
        {
          key: "candDurOrId",
          prompt: "Durée de la phase de candidature (en minutes) ou ID de l'élection.",
          type: "integer",
          default: 0
        },
        {
          key: "voteDur",
          prompt: "Durée de la phase de vote (en minutes).",
          type: "integer",
          default: 0
        }
      ],
      adminOnly: true
    })
  }

  async run(
    msg: CommandoMessage,
    args: Args
  ): Promise<Message | Message[]> {
    const democratie = (this.client as any).democratie as typeof Democratie
    const { subcommandOrReason, candDurOrId, voteDur } = args;

    if (subcommandOrReason.toLowerCase() === "list") {
        const activeElections = Array.from(democratie.elections.values()).filter(
            e => e.data.phase !== 'Finished'
        );
        
        if (activeElections.length === 0) {
          return msg.reply("ℹ️ Il n'y a actuellement aucune élection en cours.");
        }
        
        const embed = new MessageEmbed()
          .setTitle("🗳️ Élections en cours")
          .setColor("ORANGE");
        
        activeElections.forEach(e => {
          const id = e.data.id.split('-')[1];
          const channelName = msg.guild?.channels.cache.get(e.data.channelId)?.name || 'salon inconnu';
          embed.addField(
            `**ID: ${id}** - ${e.data.reason}`, 
            `Phase: ${e.data.phase} | Salon: #${channelName}`, 
            false
          );
        });
        
        return msg.embed(embed);
    }
    
    if (subcommandOrReason.toLowerCase() === "kill") {
        if (candDurOrId <= 0) return msg.reply("Veuillez fournir l'ID de l'élection : `!election kill <id>`");
        
        const election = democratie.elections.get(`election-${candDurOrId}`);
        if (!election) {
            return msg.reply(`⚠️ L'élection avec l'ID ${candDurOrId} n'a pas été trouvée.`);
        }
        
        election.data.phase = 'Finished';
        democratie.elections.delete(`election-${candDurOrId}`);
        
        return msg.reply(`✅ L'élection **ID ${candDurOrId}** a été annulée.`);
    }

    if (subcommandOrReason.toLowerCase() === "status") {
        if (candDurOrId <= 0) return msg.reply("Veuillez fournir l'ID de l'élection : `!election status <id>`");
        const election = democratie.elections.get(`election-${candDurOrId}`);
        if (!election) {
            return msg.reply(`⚠️ L'élection avec l'ID ${candDurOrId} n'a pas été trouvée.`);
        }

        const embed = new Discord.MessageEmbed()
            .setColor("ORANGE")
            .setTitle(`📊 État de l'élection #${candDurOrId}`)
            .setDescription(`**Objet :** ${election.data.reason}`)

        if (election.data.phase === "Candidacy") {
            embed.setFooter(`Fin des candidatures <t:${Math.floor(election.data.endsCandidacyAt / 1000)}:R>`);
            embed.addField(
                "Candidats",
                election.data.candidates.length > 0 ? election.data.candidates.map((c) => `• ${c.name}`).join("\n") : "Aucun candidat pour le moment",
                false
            );
        } else if (election.data.phase === "Voting") {
            embed.setFooter(`Fin du vote <t:${Math.floor(election.data.endsVotingAt! / 1000)}:R>`);
            election.data.candidates.forEach((c, i) => {
                const votesFor = election.data.votes.filter(v => v.candidateId === c.id).length;
                embed.addField(`${election.emojis[i]} ${c.name}`, `${votesFor} vote(s)`, true);
            });
        } else {
            embed.setFooter("Élection terminée");
        }
        return msg.embed(embed);
    }
    
    const reason = subcommandOrReason;
    const candDur = candDurOrId;
    if (reason.trim() === "" || candDur <= 0 || voteDur <= 0) {
      return msg.reply("❌ Usage incorrect. Exemple : `!election \"Délégué de classe\" 10 20`");
    }
    
    electionCounter++;
    const newElectionId = `election-${electionCounter}`;

    const msCand = candDur * 60_000;
    const msVote = voteDur * 60_000;
    const endsCandidacyAt = Date.now() + msCand;

    const data: ElectionData = {
      id: newElectionId,
      reason: reason,
      phase: "Candidacy",
      endsCandidacyAt,
      candidates: [],
      votes: [],
      channelId: msg.channel.id
    };

    const newElection = new Election(data, msg.channel as TextChannel);
    democratie.elections.set(newElectionId, newElection);

    await msg.say(
      `📢 Élection **ID ${electionCounter}** ouverte : **${reason}**\n` +
      `Les candidatures sont ouvertes jusqu'à <t:${Math.floor(endsCandidacyAt / 1000)}:R>. Utilisez \`!candidat "raison" ${electionCounter}\`.`
    );
    
    (async () => {
        await newElection.startCandidacy(msCand);

        setTimeout(async () => {
            if (newElection.data.phase !== 'Candidacy') return;

            if (newElection.data.candidates.length === 0) {
                await msg.say(`⚠️ L'élection **ID ${electionCounter}** n'a reçu aucune candidature. Résultats immédiats.`);
                await newElection.announceResults();
                democratie.elections.delete(newElectionId);
                return;
            }

            await newElection.startVoting(msVote);

            setTimeout(() => {
                if (newElection.data.phase !== 'Voting') return;

                newElection.announceResults().catch(console.error);
                democratie.elections.delete(newElectionId);
            }, msVote);
        }, msCand);
    })();

    return [];
  }
}


